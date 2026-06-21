"""Entrypoint that runs INSIDE the sandbox.

Reads a JSON payload on stdin:
    { "code": "<user source>", "entry": "hasCycle",
      "args": [ {"type": "linkedlist", "values": [3,2,0,-4], "pos": 1} ],
      "max_steps": 10000 }

Builds the input, installs the tracer, runs the entry function, and writes the
NDJSON frame stream (header -> frame* -> end) to stdout.
"""
import json
import sys
import types

import adapters
from detector import Detector
from framestream import FrameStream
from runner import MaxStepsExceeded, Tracer
from serializer import Serializer

USER_FILENAME = "<user_code>"


def load_user_function(code, entry):
    module = types.ModuleType("user_solution")
    # Provide default ListNode / TreeNode for platform-style solutions.
    module.__dict__.setdefault("ListNode", adapters.ListNode)
    module.__dict__.setdefault("TreeNode", adapters.TreeNode)
    compiled = compile(code, USER_FILENAME, "exec")
    exec(compiled, module.__dict__)  # noqa: S102 - sandboxed
    if entry not in module.__dict__:
        raise NameError(f"entry function {entry!r} not found in submitted code")
    return module.__dict__[entry]


def main():
    payload = json.load(sys.stdin)
    code = payload["code"]
    entry = payload["entry"]
    arg_specs = payload.get("args", [])
    max_steps = int(payload.get("max_steps", 10_000))

    fn = load_user_function(code, entry)
    args = [adapters.build(spec) for spec in arg_specs]

    stream = FrameStream(sys.stdout, lang="python", entry=entry)
    tracer = Tracer(USER_FILENAME, Serializer(Detector()), stream, max_steps=max_steps)

    sys.settrace(tracer.trace)
    status, error = "ok", None
    try:
        fn(*args)
    except MaxStepsExceeded as e:
        status, error = "capped", str(e)
    except Exception as e:  # noqa: BLE001 - report any user error cleanly
        status, error = "error", f"{type(e).__name__}: {e}"
    finally:
        sys.settrace(None)
        stream.end(status=status, error=error)


if __name__ == "__main__":
    main()
