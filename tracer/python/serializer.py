"""Turn live Python values into the §3 heap-graph (cycle-safe, depth/size capped).

Object identity (`id()`) maps to a STABLE short id for the whole trace, so the
renderer can use it as an animation key and deltas stay small.
"""


class Serializer:
    def __init__(self, detector, max_depth=50, max_items=100):
        self.detector = detector
        self.max_depth = max_depth
        self.max_items = max_items
        self._ids = {}      # python id() -> stable short id
        self._counter = 0

    def short_id(self, obj) -> str:
        pyid = id(obj)
        sid = self._ids.get(pyid)
        if sid is None:
            self._counter += 1
            sid = f"o{self._counter}"
            self._ids[pyid] = sid
        return sid

    def serialize_scope(self, locals_dict):
        """Return (scope, heap) for one stack frame's locals."""
        heap = {}
        scope = {}
        for name, val in locals_dict.items():
            if name.startswith("__"):
                continue
            scope[name] = self.value(val, heap, 0)
        return scope, heap

    def value(self, obj, heap, depth):
        """Serialize one value into a Value, populating `heap` with referenced objects."""
        if obj is None or isinstance(obj, (bool, int, float, str)):
            return {"kind": "primitive", "value": obj}
        sid = self.short_id(obj)
        ds = self.detector.classify(obj)
        if sid not in heap:
            heap[sid] = {"type": "truncated"}   # placeholder breaks reference cycles
            heap[sid] = self._heap_object(obj, heap, depth)
        return {"kind": "ref", "id": sid, "ds": ds}

    def _heap_object(self, obj, heap, depth):
        if depth >= self.max_depth:
            return {"type": "truncated"}
        nxt = depth + 1

        if isinstance(obj, (list, tuple)):
            items = [self.value(x, heap, nxt) for x in obj[: self.max_items]]
            out = {"type": "array", "items": items}
            if len(obj) > self.max_items:
                out["more"] = len(obj) - self.max_items
            return out

        if isinstance(obj, dict):
            entries = []
            for i, (k, v) in enumerate(obj.items()):
                if i >= self.max_items:
                    break
                entries.append([self.value(k, heap, nxt), self.value(v, heap, nxt)])
            out = {"type": "dict", "entries": entries}
            if len(obj) > self.max_items:
                out["more"] = len(obj) - self.max_items
            return out

        if isinstance(obj, (set, frozenset)):
            items = [self.value(x, heap, nxt) for x in list(obj)[: self.max_items]]
            out = {"type": "set", "items": items}
            if len(obj) > self.max_items:
                out["more"] = len(obj) - self.max_items
            return out

        # Generic instance: linked-list node, tree node, or custom class.
        fields = self._fields(obj, heap, nxt)
        kind = "node" if self.detector.is_node(obj) else "object"
        return {"type": kind, "class": type(obj).__name__, "fields": fields}

    def _fields(self, obj, heap, depth):
        fields = {}
        d = getattr(obj, "__dict__", None)
        if d is not None:
            for k, v in d.items():
                fields[k] = self.value(v, heap, depth)
        else:
            for k in getattr(type(obj), "__slots__", ()):
                if hasattr(obj, k):
                    fields[k] = self.value(getattr(obj, k), heap, depth)
        return fields
