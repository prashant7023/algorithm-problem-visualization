"""Serialize C++ variables (read via gdb) into the §3 heap graph.

v1 coverage: scalars, std::string, std::vector<scalar|string>, nested vectors
(matrix -> dptable), and node pointers (linked list / tree) with cycle detection
by address. Anything else degrades to its raw gdb value string.
"""
MAX_ITEMS = 100
MAX_DEPTH = 40

_SCALARS = ("int", "unsigned", "long", "short", "char", "bool", "float", "double", "signed", "size_t", "wchar_t")
_NODE_VAL = ("val", "value", "data", "key")
_NODE_NEXT = ("next",)
_NODE_TREE = ("left", "right")


def is_scalar(t: str) -> bool:
    t = t.replace("const", "").strip()
    if "*" in t or "<" in t:
        return False
    return any(t == s or t.startswith(s + " ") or t == s for s in _SCALARS) or t in _SCALARS


def is_string(t: str) -> bool:
    return "basic_string" in t or t.strip().rstrip("&").endswith("std::string")


def is_vector(t: str) -> bool:
    return t.replace("const", "").strip().startswith("std::vector")


def is_pointer(t: str) -> bool:
    return t.strip().rstrip("&").endswith("*")


def first_template_arg(t: str) -> str:
    i = t.find("<")
    if i < 0:
        return ""
    depth = 0
    inner = ""
    for j in range(i, len(t)):
        c = t[j]
        if c == "<":
            depth += 1
        elif c == ">":
            depth -= 1
            if depth == 0:
                inner = t[i + 1 : j]
                break
    depth = 0
    for k, c in enumerate(inner):
        if c == "<":
            depth += 1
        elif c == ">":
            depth -= 1
        elif c == "," and depth == 0:
            return inner[:k].strip()
    return inner.strip()


def split_brace_list(s: str):
    """Split a gdb brace list `{a, b, {c, d}}` at top level, respecting quotes."""
    s = s.strip()
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1]
    out, buf, depth, inq = [], "", 0, False
    i = 0
    while i < len(s):
        c = s[i]
        if c == '"' and (i == 0 or s[i - 1] != "\\"):
            inq = not inq
        if not inq:
            if c in "{[(":
                depth += 1
            elif c in "}])":
                depth -= 1
            elif c == "," and depth == 0:
                out.append(buf.strip())
                buf = ""
                i += 1
                continue
        buf += c
        i += 1
    if buf.strip():
        out.append(buf.strip())
    return out


def parse_scalar(s: str, t: str):
    s = s.strip()
    if t.strip() == "bool":
        return s == "true"
    if "char" in t:
        # gdb prints e.g.  65 'A'
        q = s.find("'")
        return s[q:] if q >= 0 else s
    try:
        if "float" in t or "double" in t:
            return float(s)
        return int(s.split()[0])
    except (ValueError, IndexError):
        return _strip_quotes(s)


def _strip_quotes(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        return s[1:-1]
    return s


class CSerializer:
    def __init__(self, mi):
        self.mi = mi
        self._ids = {}
        self._counter = 0

    def _id(self, key: str) -> str:
        sid = self._ids.get(key)
        if sid is None:
            self._counter += 1
            sid = f"o{self._counter}"
            self._ids[key] = sid
        return sid

    def value(self, expr: str, heap: dict, depth: int = 0):
        t = self.mi.type_of(expr) or ""
        return self._value_typed(expr, t, heap, depth)

    def _value_typed(self, expr, t, heap, depth):
        if is_string(t):
            raw = self.mi.evaluate(f"{expr}._M_dataplus._M_p")
            return {"kind": "primitive", "value": _strip_quotes(raw) if raw else ""}
        if is_scalar(t):
            raw = self.mi.evaluate(expr)
            return {"kind": "primitive", "value": parse_scalar(raw or "", t)}
        if is_vector(t):
            return self._vector(expr, t, heap, depth)
        if is_pointer(t):
            return self._pointer(expr, t, heap, depth)
        # fallback: raw value as text
        raw = self.mi.evaluate(expr)
        return {"kind": "primitive", "value": raw if raw is not None else f"<{t}>"}

    def _vector(self, expr, t, heap, depth):
        addr = self.mi.evaluate(f"(void*)&({expr})") or expr
        sid = self._id(addr)
        elem = first_template_arg(t)
        count = self.mi.eval_int(f"({expr}._M_impl._M_finish - {expr}._M_impl._M_start)")
        count = max(0, min(count, MAX_ITEMS))
        nested = is_vector(elem)
        ds = "dptable" if nested else "array"

        if sid in heap:
            return {"kind": "ref", "id": sid, "ds": ds}
        heap[sid] = {"type": "array", "items": []}  # placeholder

        items = []
        if count and (is_scalar(elem) or is_string(elem)) and not is_string(elem):
            raw = self.mi.evaluate(f"*({expr}._M_impl._M_start)@{count}")
            for piece in split_brace_list(raw or "{}"):
                items.append({"kind": "primitive", "value": parse_scalar(piece, elem)})
        else:
            for i in range(count):
                items.append(self.value(f"{expr}._M_impl._M_start[{i}]", heap, depth + 1))
        heap[sid] = {"type": "array", "items": items}
        return {"kind": "ref", "id": sid, "ds": ds}

    def _pointer(self, expr, t, heap, depth):
        addr = self.mi.evaluate(expr)
        if not addr or addr.split()[0] in ("0x0", "0"):
            return {"kind": "primitive", "value": None}
        key = addr.split()[0]
        ds = self._classify_node(expr)
        if ds is None:
            return {"kind": "primitive", "value": key}  # opaque pointer
        sid = self._id(key)
        if sid in heap:
            return {"kind": "ref", "id": sid, "ds": ds}
        heap[sid] = {"type": "node", "class": _short_type(t), "fields": {}}
        if depth >= MAX_DEPTH:
            return {"kind": "ref", "id": sid, "ds": ds}
        fields = {}
        for f in _NODE_VAL:
            v = self._field(expr, f, heap, depth)
            if v is not None:
                fields["val"] = v
                break
        for f in _NODE_NEXT + _NODE_TREE:
            v = self._field(expr, f, heap, depth)
            if v is not None:
                fields[f] = v
        heap[sid] = {"type": "node", "class": _short_type(t), "fields": fields}
        return {"kind": "ref", "id": sid, "ds": ds}

    def _classify_node(self, expr):
        has = lambda f: self.mi.type_of(f"({expr})->{f}") is not None
        if any(has(f) for f in _NODE_NEXT):
            return "linkedlist"
        if any(has(f) for f in _NODE_TREE):
            return "tree"
        if any(has(f) for f in _NODE_VAL):
            return "object"
        return None

    def _field(self, expr, field, heap, depth):
        ft = self.mi.type_of(f"({expr})->{field}")
        if ft is None:
            return None
        return self._value_typed(f"({expr})->{field}", ft, heap, depth + 1)


def _short_type(t: str) -> str:
    return t.strip().rstrip("&").rstrip("*").strip().split("::")[-1]
