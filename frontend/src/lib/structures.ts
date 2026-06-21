// Helpers that turn the heap graph into renderable, ordered structures.
import { fieldRefId } from "./heap";
import type { Heap } from "./types";

export interface ListWalk {
  order: string[]; // node ids in next-order
  cycleTo: string | null; // if the last node's next points back into the list
}

// Follow `next` from a start node, detecting cycles (the hasCycle case).
export function walkLinkedList(heap: Heap, startId: string, max = 300): ListWalk {
  const order: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = startId;
  while (cur && heap[cur] && !seen.has(cur) && order.length < max) {
    seen.add(cur);
    order.push(cur);
    cur = fieldRefId(heap[cur], "next");
  }
  return { order, cycleTo: cur && seen.has(cur) ? cur : null };
}

export interface TreeLayoutNode {
  id: string;
  depth: number;
  x: number; // column index from in-order traversal
}

// In-order x-position + depth-based y. Good enough for binary trees.
export function layoutTree(heap: Heap, rootId: string, max = 200): TreeLayoutNode[] {
  const out: TreeLayoutNode[] = [];
  let col = 0;
  const visit = (id: string | null, depth: number, seen: Set<string>) => {
    if (!id || !heap[id] || seen.has(id) || out.length >= max) return;
    seen.add(id);
    visit(fieldRefId(heap[id], "left"), depth + 1, seen);
    out.push({ id, depth, x: col++ });
    visit(fieldRefId(heap[id], "right"), depth + 1, seen);
  };
  visit(rootId, 0, new Set());
  return out;
}
