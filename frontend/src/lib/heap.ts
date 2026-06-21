import type { Frame, Heap, HeapObject, Value } from "./types";

// Reconstruct the running heap by merging deltas 0..cursor (stable ids).
export function heapUpTo(frames: Frame[], cursor: number): Heap {
  const heap: Heap = {};
  for (let i = 0; i <= cursor && i < frames.length; i++) {
    Object.assign(heap, frames[i].heapDelta);
  }
  return heap;
}

export function isRef(v: Value | undefined): v is { kind: "ref"; id: string; ds: import("./types").DSType } {
  return !!v && v.kind === "ref";
}

export function fieldRefId(obj: HeapObject | undefined, field: string): string | null {
  if (!obj || (obj.type !== "node" && obj.type !== "object")) return null;
  const f = obj.fields[field];
  return f && f.kind === "ref" ? f.id : null;
}

export function nodeVal(obj: HeapObject | undefined): Value | null {
  if (!obj || (obj.type !== "node" && obj.type !== "object")) return null;
  return obj.fields.val ?? obj.fields.value ?? null;
}

export function primitiveText(v: Value | null | undefined): string {
  if (!v) return "∅";
  if (v.kind === "primitive") return v.value === null ? "null" : String(v.value);
  return `→${v.id}`;
}
