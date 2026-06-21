# Frame Schema (v1) — the universal contract

This is the single boundary between **every language tracer**, the **Go transport**, and the **React renderer**. It is deliberately language-neutral: a C++ `ListNode*`, a Java `ListNode`, a Rust `Option<Box<Node>>`, and a Python linked-list node all normalize to the *same* representation. The renderer never knows which language produced a frame.

> **Stability:** changing this schema is a breaking change across all three layers. Version it. Current version: **`1`**.

A trace is an ordered stream of **frames**, one per executed source line, delivered as **NDJSON** (one JSON object per line) over stdout (tracer → Go) and over WebSocket (Go → client).

---

## Frame

```jsonc
{
  "step": 12,               // 0-based monotonic index
  "lang": "python",         // "python" | "cpp" | "java" | "rust" | "ts" | "go"
  "event": "line",          // "line" | "call" | "return" | "exception"
  "func": "hasCycle",       // function being executed
  "line": 5,                // line in the USER's code (1-based)
  "depth": 2,               // call-stack depth
  "scope": {                // locals in the current frame: name -> Value
    "slow": { "kind": "ref", "id": "o2", "ds": "linkedlist" },
    "fast": { "kind": "ref", "id": "o4", "ds": "linkedlist" }
  },
  "heapDelta": {            // ONLY objects new/changed this step: id -> HeapObject
    "o4": { "type": "node", "class": "ListNode",
            "fields": { "val": {"kind":"primitive","value":0},
                        "next": {"kind":"ref","id":"o5","ds":"linkedlist"} } }
  },
  "changed": ["fast"],      // scope vars changed since previous frame → highlight
  "returnValue": null,      // Value on "return" events, else null
  "exception": null         // { "type": "...", "message": "..." } on errors
}
```

---

## Value

A `Value` is what a variable *holds*. Either an inline primitive or a reference into the heap.

```jsonc
Value =
  | { "kind": "primitive", "value": 42 | 3.14 | "str" | true | null }
  | { "kind": "ref", "id": "o2", "ds": "<DSType>" }   // points into the heap
```

## HeapObject

Stored **once** in the heap, keyed by a stable `id`, referenced by `Value.ref`. Referencing by id (not nesting) is what makes cycles and shared references representable.

```jsonc
HeapObject =
  | { "type": "array",  "items": Value[], "more"?: number }              // list/vector/array; `more` = truncated count
  | { "type": "node",   "class": string, "fields": { [name]: Value } }   // linked-list / tree node
  | { "type": "dict",   "entries": [Value, Value][], "more"?: number }   // map/hashmap
  | { "type": "set",    "items": Value[], "more"?: number }
  | { "type": "object", "class": string, "fields": { [name]: Value } }   // generic struct/instance
  | { "type": "truncated" }                                               // depth/size cap hit
```

## DSType — the detected semantic type (picks the renderer)

```
ds = "array" | "linkedlist" | "tree" | "graph"
   | "stack" | "queue" | "dptable" | "hashmap"
   | "set"   | "string" | "object"
```

`ds` is computed **tracer-side** (the detector has the live objects / typed debug variables). The frontend maps `ds → Renderer` and never re-infers.

---

## Client reconstruction rules

The client keeps a running `heap` and applies frames in order:

1. **Frame 0** carries every reachable object in `heapDelta` (a full snapshot).
2. Each later frame merges `heapDelta` into the running `heap` (stable ids → in-place update).
3. To render step *k*: read `frames[k].scope`; for each `ref`, look up `heap[id]`; render `registry[ds]`.
4. **Seeking** to step *k* = replay deltas `0..k` (memoize checkpoints for speed).
5. `changed` drives the highlight/pulse; `ref` vars render as labeled badges on their target node (e.g. `slow`, `fast`).
6. Ids are stable for the lifetime of an object → animation libraries can use `id` as the layout key so a "moving pointer" is the same badge animating to a new node.

---

## Caps (enforced tracer-side, surfaced honestly)

| Cap | Default | On hit |
|---|---|---|
| `max_steps` | 10,000 | stop trace, emit terminal frame with note |
| max heap depth | 50 | emit `{ "type": "truncated" }` |
| max container items | 100 | emit first 100 + `"more": N` |
| max output bytes | 256 KB | stop, terminal frame |

---

## Transport envelope

The first message of a stream is a header, then frames, then a terminal:

```jsonc
{ "kind": "header", "schema": 1, "lang": "python", "entry": "hasCycle" }
{ "kind": "frame", ...Frame }
{ "kind": "frame", ...Frame }
{ "kind": "end", "steps": 27, "status": "ok" | "error" | "capped", "error"?: "..." }
```
