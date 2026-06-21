"""Emit the NDJSON transport envelope: header -> frame* -> end.

Delta encoding: only objects new/changed since the previous frame go into
`heapDelta`; only scope vars that changed are listed in `changed`.
"""
import json


class FrameStream:
    def __init__(self, out, lang, entry, schema=1):
        self.out = out
        self.lang = lang
        self.step = 0
        self._prev_heap = {}
        self._prev_scope = {}
        self._write({"kind": "header", "schema": schema, "lang": lang, "entry": entry})

    def _write(self, obj):
        self.out.write(json.dumps(obj, default=str) + "\n")
        self.out.flush()

    def push(self, scope, heap, line, func, event, depth, return_value=None, exception=None):
        heap_delta = {
            sid: obj for sid, obj in heap.items() if self._prev_heap.get(sid) != obj
        }
        changed = [n for n, v in scope.items() if self._prev_scope.get(n) != v]
        self._write({
            "kind": "frame",
            "step": self.step,
            "lang": self.lang,
            "event": event,
            "func": func,
            "line": line,
            "depth": depth,
            "scope": scope,
            "heapDelta": heap_delta,
            "changed": changed,
            "returnValue": return_value,
            "exception": exception,
        })
        self._prev_heap = heap
        self._prev_scope = scope
        self.step += 1

    def end(self, status="ok", error=None):
        msg = {"kind": "end", "steps": self.step, "status": status}
        if error:
            msg["error"] = error
        self._write(msg)
