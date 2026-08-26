"""C++ tracer entrypoint (runs inside the sandbox).

Reads the same JSON payload as the Python tracer on stdin, then:
  1. generates a compilable harness (codegen),
  2. compiles it with g++ -g -O0,
  3. drives gdb over MI, stepping through ONLY the user's lines,
  4. emits the identical NDJSON frame schema.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import codegen
import livescope
from cvalue import CSerializer
from framestream import FrameStream
from gdbmi import GdbMI, parse_stop

# MSYS g++ often exits 1 with empty stderr when invoked from Win32 Python.
# Prefer a native MinGW toolchain when several g++s are installed.
_WIN_GPP_FALLBACKS = (
    r"C:\MinGW\bin\g++.exe",
    r"C:\mingw64\bin\g++.exe",
    r"C:\msys64\mingw64\bin\g++.exe",
)
_WIN_GDB_FALLBACKS = (
    r"C:\MinGW\bin\gdb.exe",
    r"C:\mingw64\bin\gdb.exe",
    r"C:\msys64\mingw64\bin\gdb.exe",
)


def _tool_candidates(name: str, fallbacks: tuple[str, ...]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in [shutil.which(name), *fallbacks]:
        if not p:
            continue
        key = os.path.normcase(os.path.abspath(p))
        if key in seen or not os.path.isfile(p):
            continue
        seen.add(key)
        out.append(p)
    return out


def compile_source(source: str, workdir: str):
    src = os.path.join(workdir, "prog.cpp")
    exe = os.path.join(workdir, "prog.exe" if os.name == "nt" else "prog")
    with open(src, "w", encoding="utf-8") as f:
        f.write(source)

    compilers = _tool_candidates("g++", _WIN_GPP_FALLBACKS if os.name == "nt" else ())
    if not compilers:
        return None, None, (
            "g++ not found on PATH. Install MinGW-w64 g++ and ensure it is on PATH."
        )

    last_err = ""
    for gpp in compilers:
        proc = subprocess.run(
            [gpp, "-g", "-O0", "-std=c++17", src, "-o", exe],
            capture_output=True, text=True,
        )
        if proc.returncode == 0 and os.path.isfile(exe):
            return src, exe, None
        msg = (proc.stderr or proc.stdout or "").strip()
        if not msg:
            msg = (
                f"{gpp} exited {proc.returncode} with no output "
                "(common with MSYS g++ outside the MSYS shell)"
            )
        last_err = msg
    return None, None, last_err


def find_gdb() -> str | None:
    cands = _tool_candidates("gdb", _WIN_GDB_FALLBACKS if os.name == "nt" else ())
    return cands[0] if cands else None


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
    if cerr or not exe:
        hint = ""
        if cerr and ("no matching function" in cerr or "no known conversion" in cerr):
            hint = (
                "Hint: your INPUT args don't match the function signature. "
                f"Check that the JSON args fit {entry}(...)'s parameter types "
                "(e.g. an array param needs {\"type\":\"array\"}, not a linked list).\n\n"
            )
        stream.end(
            status="error",
            error=f"{hint}compile error:\n{(cerr or 'unknown').strip()[:1500]}",
        )
        return

    gdb = find_gdb()
    if not gdb:
        stream.end(
            status="error",
            error="gdb not found on PATH. Install MinGW GDB (with debug support) and retry.",
        )
        return

    mi = GdbMI(exe, gdb=gdb)
    status, error = "ok", None
    try:
        # Break at the entry function (try plain name, then Solution::name).
        if not mi.command(f"-break-insert {entry}").startswith("^done"):
            if not mi.command(f"-break-insert Solution::{entry}").startswith("^done"):
                stream.end(status="error", error=f"could not set breakpoint at {entry}")
                return

        stop = parse_stop(mi.exec_command("-exec-run"))
        ser = CSerializer(mi)
        live_ranges = livescope.declaration_ranges(code, entry)

        def in_user_code(s) -> bool:
            return (
                same_file(s.get("file"), srcfile)
                and ustart <= int(s.get("line") or 0) <= uend
                and s.get("func") not in (None, "main")
            )

        def capture_scope(at_user_line: int | None = None):
            names = mi.locals_and_args()
            heap, scope = {}, {}
            for n in names:
                if n == "this":
                    continue
                if at_user_line is not None and not livescope.is_live(live_ranges, n, at_user_line):
                    continue
                scope[n] = ser.value(n, heap, 0)
            return scope, heap

        def leave_helpers(s):
            """If we landed in generated helpers/lib code, finish back out."""
            while stream.step < max_steps:
                if s["reason"] in ("exited", "exited-normally") or s["func"] == "main":
                    return s
                if in_user_code(s):
                    return s
                if same_file(s.get("file"), srcfile) and s.get("func") == "main":
                    return s
                s = parse_stop(mi.exec_command("-exec-finish"))
            return s

        while stream.step < max_steps:
            if stop["reason"] in ("exited", "exited-normally") or stop["func"] == "main":
                break
            if not in_user_code(stop):
                stop = leave_helpers(stop)
                continue

            # GDB stops *before* a line runs. Step first, then emit the frame
            # for that line with post-execution locals (so `int sum = carry`
            # shows sum==0, not stack garbage). Keep a pre-step snapshot only
            # for the final return, when -exec-next leaves the function.
            prev_line = stop["line"]
            prev_func = stop["func"] or entry
            user_line = prev_line - ustart + 1
            pre_scope, pre_heap = capture_scope(user_line)
            stop = leave_helpers(parse_stop(mi.exec_command("-exec-next")))

            if in_user_code(stop) or (
                same_file(stop.get("file"), srcfile)
                and stop.get("func") not in (None, "main")
            ):
                scope, heap = capture_scope(user_line)
            else:
                scope, heap = pre_scope, pre_heap
            src_lines = code.splitlines()
            src_line = src_lines[user_line - 1] if 1 <= user_line <= len(src_lines) else ""
            stream.push(
                scope,
                heap,
                user_line,
                prev_func,
                "line",
                1,
                force_changed=livescope.assignment_targets(src_line),
            )
    except Exception as e:  # noqa: BLE001
        status, error = "error", f"{type(e).__name__}: {e}"
    finally:
        mi.close()
        stream.end(status=status, error=error)


if __name__ == "__main__":
    main()
