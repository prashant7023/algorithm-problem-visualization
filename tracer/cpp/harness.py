"""C++ tracer entrypoint (runs inside the sandbox).

Reads the same JSON payload as the Python tracer on stdin, then:
  1. generates a compilable harness (codegen),
  2. compiles it with g++ -g -O0,
  3. drives gdb over MI, stepping through ONLY the user's lines,
  4. emits the identical NDJSON frame schema.
"""
import json
import os
import subprocess
import sys
import tempfile

import codegen
from cvalue import CSerializer
from framestream import FrameStream
from gdbmi import GdbMI, parse_stop


def compile_source(source: str, workdir: str):
    src = os.path.join(workdir, "prog.cpp")
    exe = os.path.join(workdir, "prog.exe")
    with open(src, "w", encoding="utf-8") as f:
        f.write(source)
    proc = subprocess.run(
        ["g++", "-g", "-O0", "-std=c++17", src, "-o", exe],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        return None, None, proc.stderr
    return src, exe, None


def same_file(a, b):
    if not a or not b:
        return False
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def main():
    payload = json.load(sys.stdin)
    code = payload["code"]
    entry = payload["entry"]
    args = payload.get("args", [])
    max_steps = int(payload.get("max_steps", 10_000))

    stream = FrameStream(sys.stdout, lang="cpp", entry=entry)

    try:
        source, ustart, uend = codegen.generate(code, entry, args)
    except Exception as e:  # noqa: BLE001
        stream.end(status="error", error=f"codegen: {e}")
        return

    workdir = tempfile.mkdtemp(prefix="algotrace_cpp_")
    srcfile, exe, cerr = compile_source(source, workdir)
    if cerr:
        hint = ""
        if "no matching function" in cerr or "no known conversion" in cerr:
            hint = (
                "Hint: your INPUT args don't match the function signature. "
                f"Check that the JSON args fit {entry}(...)'s parameter types "
                "(e.g. an array param needs {\"type\":\"array\"}, not a linked list).\n\n"
            )
        stream.end(status="error", error=f"{hint}compile error:\n{cerr.strip()[:1500]}")
        return

    mi = GdbMI(exe)
    status, error = "ok", None
    try:
        # Break at the entry function (try plain name, then Solution::name).
        if not mi.command(f"-break-insert {entry}").startswith("^done"):
            if not mi.command(f"-break-insert Solution::{entry}").startswith("^done"):
                stream.end(status="error", error=f"could not set breakpoint at {entry}")
                return

        stop = parse_stop(mi.exec_command("-exec-run"))
        ser = CSerializer(mi)

        while stream.step < max_steps:
            if stop["reason"] in ("exited", "exited-normally") or stop["func"] == "main":
                break
            in_user = same_file(stop["file"], srcfile) and ustart <= stop["line"] <= uend
            if in_user:
                names = mi.locals_and_args()
                heap, scope = {}, {}
                for n in names:
                    if n == "this":
                        continue
                    scope[n] = ser.value(n, heap, 0)
                user_line = stop["line"] - ustart + 1
                stream.push(scope, heap, user_line, stop["func"] or entry, "line", 1)
                stop = parse_stop(mi.exec_command("-exec-step"))
            elif same_file(stop["file"], srcfile):
                # returned to main / harness -> done
                break
            else:
                # inside library code -> run until we return to the caller
                stop = parse_stop(mi.exec_command("-exec-finish"))
    except Exception as e:  # noqa: BLE001
        status, error = "error", f"{type(e).__name__}: {e}"
    finally:
        mi.close()
        stream.end(status=status, error=error)


if __name__ == "__main__":
    main()
