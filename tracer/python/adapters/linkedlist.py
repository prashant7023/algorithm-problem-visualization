"""Build a singly linked list from {"values": [...], "pos": int}.

`pos` >= 0 connects the tail back to that index, creating a cycle (the
Linked List Cycle problem). `pos` = -1 (default) means no cycle.
"""


def build(spec):
    from . import ListNode

    values = spec["values"]
    pos = spec.get("pos", -1)
    nodes = [ListNode(v) for v in values]
    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i + 1]
    if pos is not None and pos >= 0 and nodes:
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None
