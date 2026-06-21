"""Build an adjacency list from {"n": int, "edges": [[a,b],...], "directed": bool}."""


def build(spec):
    n = spec.get("n")
    edges = spec.get("edges", [])
    directed = spec.get("directed", False)

    adj = {i: [] for i in range(n)} if n is not None else {}
    for a, b in edges:
        adj.setdefault(a, []).append(b)
        if not directed:
            adj.setdefault(b, []).append(a)
    return adj
