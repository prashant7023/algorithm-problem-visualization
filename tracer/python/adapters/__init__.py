"""Input builders: turn the Input Builder's typed payload into real objects.

This is the "[3,2,0,-4] with pos=1 -> real linked list" magic. The default
ListNode / TreeNode duck-type whatever the user's solution expects, and are
injected into the user namespace so platform-provided classes resolve too.
"""
from . import linkedlist, tree, graph


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def build(spec):
    """Materialize one argument from its spec: {"type": ..., ...}."""
    t = spec["type"]
    if t == "int":
        return spec["value"]
    if t == "float":
        return float(spec["value"])
    if t == "bool":
        return bool(spec["value"])
    if t == "string":
        return spec["value"]
    if t == "array":
        return list(spec["value"])
    if t == "matrix":
        return [list(row) for row in spec["value"]]
    if t == "linkedlist":
        return linkedlist.build(spec)
    if t in ("tree", "binarytree"):
        return tree.build(spec)
    if t == "graph":
        return graph.build(spec)
    raise ValueError(f"unknown input type: {t!r}")
