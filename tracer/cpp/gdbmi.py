"""A minimal GDB/MI client.

gdb here has no Python support, so we drive it over the MI2 text protocol:
send a command on stdin, read result records from stdout. Only `^...` result
records and `*stopped` async records matter; stream records (~ & @ =) are ignored.
"""
import re
import subprocess

_VALUE_RE = re.compile(r'value="((?:[^"\\]|\\.)*)"')
_TYPE_RE = re.compile(r'type="((?:[^"\\]|\\.)*)"')
_NUMCHILD_RE = re.compile(r'numchild="(\d+)"')
_NAME_RE = re.compile(r'name="((?:[^"\\]|\\.)*)"')


def unescape(s: str) -> str:
    return s.encode("utf-8").decode("unicode_escape", "replace")


class GdbError(Exception):
    pass


class GdbMI:
    def __init__(self, exe: str):
        self.p = subprocess.Popen(
            ["gdb", "--interpreter=mi2", "--nx", "-q", exe],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        # consume the banner up to the first prompt (MI prompt is "(gdb) ")
        self._read_until(lambda l: l.startswith("(gdb)"))

    def _write(self, cmd: str):
        assert self.p.stdin
        self.p.stdin.write(cmd + "\n")
        self.p.stdin.flush()

    def _read_until(self, pred):
        assert self.p.stdout
        lines = []
        while True:
            line = self.p.stdout.readline()
            if not line:
                return lines, None
            line = line.rstrip("\r\n")
            lines.append(line)
            if pred(line):
                return lines, line

    def command(self, cmd: str):
        """Run a non-exec command; return the `^...` result line."""
        self._write(cmd)
        _, last = self._read_until(lambda l: l.startswith("^"))
        return last or ""

    def exec_command(self, cmd: str):
        """Run an exec command (run/step/next/finish); return the `*stopped` line."""
        self._write(cmd)
        self._read_until(lambda l: l.startswith("^"))  # ^running / ^error
        _, last = self._read_until(
            lambda l: l.startswith("*stopped") or l.startswith("^error") or l.startswith("*exited")
        )
        return last or ""

    # ---- typed helpers ----

    def evaluate(self, expr: str):
        """Return the string value of an expression, or None on error."""
        res = self.command(f'-data-evaluate-expression "{_esc(expr)}"')
        if not res.startswith("^done"):
            return None
        m = _VALUE_RE.search(res)
        return unescape(m.group(1)) if m else None

    def eval_int(self, expr: str, default=0) -> int:
        v = self.evaluate(expr)
        if v is None:
            return default
        try:
            return int(v.split()[0])
        except (ValueError, IndexError):
            return default

    def type_of(self, expr: str):
        """Resolve an expression's type via a throwaway var object."""
        res = self.command(f'-var-create - * "{_esc(expr)}"')
        if not res.startswith("^done"):
            return None
        name = _NAME_RE.search(res)
        t = _TYPE_RE.search(res)
        if name:
            self.command(f"-var-delete {name.group(1)}")
        return unescape(t.group(1)) if t else None

    def locals_and_args(self):
        names = []
        for cmd in ("-stack-list-arguments 0", "-stack-list-locals 0"):
            res = self.command(cmd)
            names += [unescape(m) for m in _NAME_RE.findall(res)]
        # de-dup, preserve order
        seen = set()
        out = []
        for n in names:
            if n not in seen:
                seen.add(n)
                out.append(n)
        return out

    def close(self):
        try:
            self._write("-gdb-exit")
            self.p.stdin.close()  # type: ignore
            self.p.wait(timeout=3)
        except Exception:
            self.p.kill()


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


# ---- *stopped frame parsing ----

_FRAME_FILE = re.compile(r'fullname="((?:[^"\\]|\\.)*)"')
_FRAME_LINE = re.compile(r'\bline="(\d+)"')
_FRAME_FUNC = re.compile(r'\bfunc="((?:[^"\\]|\\.)*)"')
_REASON = re.compile(r'reason="([^"]*)"')


def parse_stop(line: str):
    if line.startswith("*exited") or line.startswith("^error"):
        return {"reason": "exited", "file": None, "line": 0, "func": None}
    f = _FRAME_FILE.search(line)
    ln = _FRAME_LINE.search(line)
    fn = _FRAME_FUNC.search(line)
    r = _REASON.search(line)
    return {
        "reason": r.group(1) if r else "",
        "file": unescape(f.group(1)) if f else None,
        "line": int(ln.group(1)) if ln else 0,
        "func": unescape(fn.group(1)) if fn else None,
    }
