"""Approximate C++ local liveness from source text.

GDB lists every stack slot in the frame, including vars not yet declared
(or already out of scope). For the visualizer we only show names that are
live on the highlighted user line: declared on/before that line and still
inside their enclosing block.
"""
from __future__ import annotations

import re

_KEYWORDS = {
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor",
    "bool", "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t",
    "class", "compl", "concept", "const", "consteval", "constexpr", "constinit",
    "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
    "default", "delete", "do", "double", "dynamic_cast", "else", "enum",
    "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
    "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept",
    "not", "not_eq", "nullptr", "operator", "or", "or_eq", "private",
    "protected", "public", "register", "reinterpret_cast", "requires", "return",
    "short", "signed", "sizeof", "static", "static_assert", "static_cast",
    "struct", "switch", "template", "this", "thread_local", "throw", "true",
    "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
    "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
    "size_t", "string", "vector", "map", "set", "unordered_map", "pair",
    "ListNode", "TreeNode", "Solution",
}

# `Type name = ...` / `Type* name = ...` / `Type name;` at statement start
_DECL_RE = re.compile(
    r"^\s*(?:(?:const|static|volatile|unsigned|signed|long|short|mutable)\s+)*"
    r"(?:[\w:]+(?:\s*<[^>;{]+>)?)"
    r"(?:\s*\*+|\s+)+"
    r"([A-Za-z_]\w*)\s*(?:=|;)",
)

# `for (int i = 0;` / `for(int i=0;`
_FOR_DECL_RE = re.compile(
    r"\bfor\s*\(\s*(?:(?:const|unsigned|signed|long|short)\s+)*"
    r"(?:[\w:]+(?:\s*<[^>;]+>)?)"
    r"(?:\s*\*+|\s+)+"
    r"([A-Za-z_]\w*)\s*=",
)

# Plain local writes: `carry =`, `sum +=`, `i++` (not `a->b =` / `==`).
_ASSIGN_RE = re.compile(
    r"(?<![\w.>])([A-Za-z_]\w*)\s*(?:\+\+|--|\+=|-=|\*=|/=|%=|=(?!=))"
)


def _strip_strings_and_comments(line: str) -> str:
    out = []
    i, n = 0, len(line)
    while i < n:
        c = line[i]
        if c == "/" and i + 1 < n and line[i + 1] == "/":
            break
        if c in "\"'":
            quote = c
            out.append(" ")
            i += 1
            while i < n:
                if line[i] == "\\":
                    i += 2
                    continue
                if line[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _param_names(code: str, entry: str) -> list[str]:
    m = re.search(rf"\b{re.escape(entry)}\s*\(([^)]*)\)", code)
    if not m:
        return []
    names = []
    for part in m.group(1).split(","):
        part = part.strip()
        if not part or part == "...":
            continue
        ids = [t for t in re.findall(r"[A-Za-z_]\w*", part) if t not in _KEYWORDS]
        if ids:
            names.append(ids[-1])
    return names


def declaration_ranges(code: str, entry: str) -> dict[str, list[tuple[int, int]]]:
    """Map local name -> list of inclusive (from_line, to_line) ranges (1-based)."""
    lines = code.splitlines()
    n = len(lines)
    ranges: dict[str, list[tuple[int, int]]] = {}

    def add(name: str, start: int, end: int):
        if not name or name in _KEYWORDS:
            return
        ranges.setdefault(name, []).append((start, end))

    # Parameters live for the whole user snippet.
    for p in _param_names(code, entry):
        add(p, 1, n)

    # block_stack entries: depth opened at this `{`
    # pending_decls: names declared in current block, end filled on `}`
    block_stack: list[list[tuple[str, int]]] = [[]]  # synthetic outer function block

    for idx, raw in enumerate(lines, start=1):
        line = _strip_strings_and_comments(raw)

        # Declarations become live starting at this line (post-exec).
        for m in _DECL_RE.finditer(line):
            block_stack[-1].append((m.group(1), idx))
        for m in _FOR_DECL_RE.finditer(line):
            block_stack[-1].append((m.group(1), idx))

        # Process braces left-to-right.
        for ch in line:
            if ch == "{":
                block_stack.append([])
            elif ch == "}" and len(block_stack) > 1:
                closing = block_stack.pop()
                for name, start in closing:
                    # Live through the last statement of the block, not after `}`.
                    add(name, start, idx - 1 if idx > start else start)

    # Close any unfinished blocks at EOF (missing braces in paste).
    while len(block_stack) > 1:
        closing = block_stack.pop()
        for name, start in closing:
            add(name, start, n)
    for name, start in block_stack[0]:
        add(name, start, n)

    return ranges


def is_live(ranges: dict[str, list[tuple[int, int]]], name: str, line: int) -> bool:
    for start, end in ranges.get(name, []):
        if start <= line <= end:
            return True
    return False


def filter_scope(scope: dict, ranges: dict[str, list[tuple[int, int]]], line: int) -> dict:
    """Drop GDB locals that are not source-live on `line`."""
    if not ranges:
        return scope
    return {k: v for k, v in scope.items() if is_live(ranges, k, line)}


def assignment_targets(source_line: str) -> list[str]:
    """Local names written by this statement (`carry = …`, `sum += …`, `i++`)."""
    line = _strip_strings_and_comments(source_line)
    out: list[str] = []
    seen: set[str] = set()
    for m in _ASSIGN_RE.finditer(line):
        name = m.group(1)
        if name in _KEYWORDS or name in seen:
            continue
        seen.add(name)
        out.append(name)
    return out
