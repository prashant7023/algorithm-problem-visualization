"""Build a binary tree from level-order values with `null` for missing nodes.

Example: [3, 9, 20, null, null, 15, 7] is the classic LeetCode level-order form.
"""
from collections import deque


def build(spec):
    from . import TreeNode

    values = spec["values"]
    if not values or values[0] is None:
        return None

    root = TreeNode(values[0])
    queue = deque([root])
    i = 1
    n = len(values)
    while queue and i < n:
        node = queue.popleft()
        if i < n:
            v = values[i]
            i += 1
            if v is not None:
                node.left = TreeNode(v)
                queue.append(node.left)
        if i < n:
            v = values[i]
            i += 1
            if v is not None:
                node.right = TreeNode(v)
                queue.append(node.right)
    return root
