"""Classify a live Python object into a DSType (the §3 / frame-schema `ds`).

Heuristics are cheapest-first and structure-wins. The SAME logic table is the
spec the universal DAP driver re-implements against typed debug variables.
"""

_NODE_NEXT = ("next",)
_NODE_TREE = ("left", "right", "children")


def _has_attr(obj, name):
    return hasattr(obj, name) and not callable(getattr(obj, name, None))


def _is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


class Detector:
    def classify(self, obj) -> str:
        if isinstance(obj, str):
            return "string"
        if isinstance(obj, (list, tuple)):
            return self._classify_list(obj)
        if isinstance(obj, dict):
            return self._classify_dict(obj)
        if isinstance(obj, (set, frozenset)):
            return "set"
        # Custom instances -> structural detection.
        if any(_has_attr(obj, a) for a in _NODE_NEXT):
            return "linkedlist"
        if any(_has_attr(obj, a) for a in _NODE_TREE):
            return "tree"
        return "object"

    def _classify_list(self, obj) -> str:
        # 2D numeric grid -> DP table / matrix.
        if obj and all(isinstance(r, (list, tuple)) for r in obj):
            if all(all(_is_number(y) or y is None for y in r) for r in obj):
                return "dptable"
        return "array"

    def _classify_dict(self, obj) -> str:
        vals = list(obj.values())
        # adjacency-style {node: [neighbours]} -> graph
        if vals and all(isinstance(v, (list, set, tuple)) for v in vals):
            return "graph"
        return "hashmap"

    def is_node(self, obj) -> bool:
        return self.classify(obj) in ("linkedlist", "tree")
