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

/** True if this heap object looks like a singly-linked list node. */
export function isListNode(heap: Heap, id: string): boolean {
  const o = heap[id];
  return !!o && o.type === "node" && "next" in o.fields;
}

/**
 * Starts of every distinct linked-list chain currently in the heap.
 *
 * Prefer structural heads (nodes never referenced via another node's `next`)
 * so mid-list pointers like `l1 = l1->next` still show the full original list.
 * Fall back to scope refs when the structure is a pure cycle (no head).
 */
export function linkedListChainStarts(
  heap: Heap,
  scopeRefIds: string[],
): string[] {
  const listIds = Object.keys(heap).filter((id) => isListNode(heap, id));
  if (!listIds.length) return [];

  const pointedTo = new Set<string>();
  for (const id of listIds) {
    const n = fieldRefId(heap[id], "next");
    if (n && isListNode(heap, n)) pointedTo.add(n);
  }

  const roots = listIds.filter((id) => !pointedTo.has(id));
  const live = new Set(scopeRefIds.filter((id) => isListNode(heap, id)));

  // Keep only chains that a live pointer still sits on (skip orphan nodes).
  const fromRoots = roots.filter((root) => {
    const { order } = walkLinkedList(heap, root);
    return order.some((id) => live.has(id));
  });
  if (fromRoots.length) return fromRoots;

  // Pure cycle(s): pick one start per overlapping walk from live pointers.
  const starts: string[] = [];
  const covered = new Set<string>();
  for (const id of scopeRefIds) {
    if (!isListNode(heap, id) || covered.has(id)) continue;
    const { order } = walkLinkedList(heap, id);
    if (!order.length) continue;
    starts.push(id);
    for (const n of order) covered.add(n);
  }
  return starts;
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
