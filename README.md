# AlgoTrace

**Paste your code. Watch it think.**

AlgoTrace takes *your* solution to any coding problem — from LeetCode, Codeforces, CodeChef, AtCoder, or your own scratch file — in **any language**, plus your custom input, and produces a **visual, animated, step-by-step execution trace** with auto-generated data-structure diagrams synced to the line being executed.

No preset animations. No hand-waving. Your code, your input, your logic — made visible.

---

## What it does

Paste `hasCycle` with linked list `[3,2,0,-4] pos=1` and watch `slow` and `fast` physically chase each other around the cycle, one step at a time, with the current source line highlighted in the editor. That's it. That's the whole pitch.

Every existing visualizer animates *preset* algorithms. AlgoTrace traces *your* code.

---

## Features

- **Any language** — Python, C++, Java, TypeScript/JS, Go, Rust (Python and C++ ship first; others via DAP)
- **Any platform** — LeetCode, Codeforces, CodeChef, AtCoder, HackerRank, classwork, scratch files
- **Auto data-structure detection** — linked list, binary tree, DP table, array, hashmap, stack, graph — detected from your live objects, rendered with the right diagram automatically
- **Step-by-step playback** — play, pause, step forward/back, scrub the timeline, change speed
- **Code sync** — current executed line stays highlighted in the Monaco editor
- **Animated pointer badges** — `slow`, `fast`, `left`, `right`, `cur` — colored markers animate between nodes
- **Cycle detection** — circular linked lists render with a back-edge arrow, not infinite recursion
- **Delta streaming** — frames stream live over HTTP; only changed heap objects sent per step

---

## Stack

| Layer | Tech |
|---|---|
| **Tracer — Python** | `sys.settrace` native hook — fastest possible, zero deps in sandbox |
| **Tracer — C++** | GDB/MI2 client — reads locals, vectors, pointer-chained nodes via DWARF debug info |
| **Tracer — others** | DAP (Debug Adapter Protocol) universal client — one driver for Java, TS, Go, Rust |
| **Backend** | Go 1.25 — clean architecture (domain ← usecase ← adapter), streaming NDJSON over HTTP |
| **Frontend** | React 18 + TypeScript + Vite, Monaco editor, Zustand, Tailwind CSS, Framer Motion |
| **Sandbox** | Local subprocess (dev) → Docker + gVisor (production) |

---

## Project layout

```
algotrace/
├── backend/                  # Go orchestration + HTTP API
│   ├── cmd/api/main.go
│   └── internal/
│       ├── domain/           # Frame, TraceRequest, Session
│       ├── usecase/          # RunTrace + port interfaces
│       └── adapter/
│           ├── http/         # POST /api/trace handler
│           ├── sandbox/      # subprocess runner (→ Docker in prod)
│           ├── runtime/      # LanguageRuntime registry
│           └── repo/         # in-memory session store
├── tracer/
│   ├── python/               # sys.settrace driver (reference impl)
│   │   ├── harness.py        # entrypoint: load code, build input, emit NDJSON
│   │   ├── runner.py         # settrace hook → one frame per line event
│   │   ├── serializer.py     # live objects → heap graph (cycle-safe, depth-capped)
│   │   ├── detector.py       # classify object → ds type (linkedlist/tree/array/…)
│   │   └── adapters/         # input builders: linkedlist, binarytree, graph, array
│   └── cpp/                  # GDB/MI2 driver
│       ├── harness.py        # compile + launch gdb + emit NDJSON
│       ├── gdbmi.py          # GDB/MI2 protocol client
│       ├── cvalue.py         # C++ type → heap graph (vector, pointer chains, scalars)
│       ├── codegen.py        # generate compilable harness (injects ListNode/TreeNode)
│       └── framestream.py    # NDJSON header/frame/end writer
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── editor/       # Monaco with live line decoration
│       │   ├── input/        # Input Builder (type + values + language picker)
│       │   ├── player/       # play/pause/step/scrub + speed controls
│       │   └── visualizer/
│       │       ├── Stage.tsx          # picks renderer by ds type
│       │       └── renderers/
│       │           ├── LinkedListView.tsx
│       │           ├── ArrayView.tsx
│       │           ├── TreeView.tsx
│       │           ├── DPTableView.tsx
│       │           └── KeyedView.tsx  # hashmap + object
│       ├── store/traceStore.ts        # Zustand: frames, cursor, playback state
│       └── lib/
│           ├── heap.ts        # replay heapDeltas up to cursor
│           ├── structures.ts  # linked-list walk, tree layout
│           └── api.ts         # streamTrace() — NDJSON streaming fetch
└── docs/
    └── frame-schema.md        # the universal data contract
```

---

## Frame schema (the universal contract)

Every language tracer emits the same NDJSON frame format. The renderer never knows which language produced a frame.

```jsonc
{
  "step": 12,
  "lang": "python",           // "python" | "cpp" | "java" | "ts" | "go" | "rust"
  "event": "line",            // "line" | "call" | "return" | "exception"
  "func": "hasCycle",
  "line": 5,
  "depth": 1,
  "scope": {
    "slow": { "kind": "ref", "id": "o2", "ds": "linkedlist" },
    "fast": { "kind": "ref", "id": "o4", "ds": "linkedlist" }
  },
  "heapDelta": {              // only objects that changed this step
    "o4": { "type": "node", "fields": { "val": -4, "next": { "kind": "ref", "id": "o2" } } }
  },
  "changed": ["fast"],        // vars changed → pulse highlight
  "returnValue": null,
  "exception": null
}
```

`ds` is detected tracer-side from live objects (Python) or DWARF type info (C++/GDB). The frontend maps `ds → Renderer` and never re-infers. Delta encoding means only changed heap objects are sent per step — a 500-cell DP table doesn't re-send 500 cells every frame.

---

## Getting started

### Prerequisites

- **Go 1.21+**
- **Python 3.10+**
- **Node.js 18+**
- **g++ with debug support** (for C++ traces — MinGW-w64 on Windows)
- **GDB** (for C++ traces)

### Run the backend

```bash
cd algotrace/backend
go run ./cmd/api
# → listening on 127.0.0.1:8080
```

The backend reads `ALGOTRACE_TRACER_DIR` (defaults to `../../tracer` relative to the binary).

### Run the frontend

```bash
cd algotrace/frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies `/api/*` to `http://127.0.0.1:8080` — no CORS config needed.

### Try it

1. Open `http://localhost:5173`
2. Click **"Linked List Cycle (Python)"** preset → Run trace
3. Watch `slow` and `fast` chase the cycle

For C++: click **"Largest Altitude (C++)"** or **"Reverse List (C++)"** preset.

---

## Supported input types

The Input Builder accepts typed argument specs. Match these to your function's parameter types:

| Function parameter | Input type | Example |
|---|---|---|
| `int` / `long` | `{"type":"int","value":5}` | plain number |
| `string` | `{"type":"string","value":"abc"}` | |
| `int[]` / `vector<int>` | `{"type":"array","value":[1,2,3]}` | |
| `int[][]` / `vector<vector<int>>` | `{"type":"matrix","value":[[1,2],[3,4]]}` | |
| `ListNode*` / linked list | `{"type":"linkedlist","values":[3,2,0,-4],"pos":1}` | `pos=-1` = no cycle |
| `TreeNode*` / binary tree | `{"type":"binarytree","values":[1,2,3,null,null,4]}` | level-order, nulls ok |
| `Graph` (n + edges) | `{"type":"graph","n":4,"edges":[[0,1],[1,2]]}` | |

**Important for C++:** the input type must match the function's parameter type exactly. `vector<int>&` needs `{"type":"array"}`, not `{"type":"linkedlist"}`.

---

## Architecture notes

**Clean architecture (Go backend):** dependency rule `domain ← usecase ← adapter`. Adding a new language means registering a new `LanguageRuntime` in `adapter/runtime/` — the use case, HTTP handler, and frontend are untouched.

**Heap graph by id:** objects stored once by stable id (`o1`, `o2`…), referenced via `{"kind":"ref","id":"o2"}`. This handles cyclic linked lists and shared tree nodes without infinite recursion or duplication.

**Python tracer:** `sys.settrace` fires on every line event. The serializer follows live object references, assigns stable short ids, and stops at cycles. DS detection inspects the live object: `has .next → linkedlist`, `has .left/.right → tree`, `list of lists of numbers → dptable`, etc.

**C++ tracer:** compiles with `g++ -g -O0 -std=c++17`, launches under GDB with MI2 protocol, single-steps with `-exec-next`, reads locals via `-stack-list-locals`, evaluates vector internals via `*vec._M_impl._M_start@count`. Codegen injects `ListNode`/`TreeNode` struct definitions only when the user's code uses but doesn't define them (LeetCode style).

---

## Language support roadmap

| Language | Status | Mechanism |
|---|---|---|
| Python | **Working** | `sys.settrace` native |
| C++ | **Working** | GDB/MI2 |
| Java | Planned | JDWP / java-debug DAP |
| TypeScript / JS | Planned | V8 Inspector / js-debug DAP |
| Go | Planned | Delve (`dlv dap`) |
| Rust | Planned | CodeLLDB DAP |

All planned languages will plug into the same frame schema with no frontend changes.

---

## License

MIT
