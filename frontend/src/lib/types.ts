// Mirror of docs/frame-schema.md. This is the contract — keep it in sync.

export type DSType =
  | "array"
  | "linkedlist"
  | "tree"
  | "graph"
  | "stack"
  | "queue"
  | "dptable"
  | "hashmap"
  | "set"
  | "string"
  | "object";

export type Primitive = number | string | boolean | null;

export type Value =
  | { kind: "primitive"; value: Primitive }
  | { kind: "ref"; id: string; ds: DSType };

export type HeapObject =
  | { type: "array"; items: Value[]; more?: number }
  | { type: "set"; items: Value[]; more?: number }
  | { type: "node"; class: string; fields: Record<string, Value> }
  | { type: "object"; class: string; fields: Record<string, Value> }
  | { type: "dict"; entries: [Value, Value][]; more?: number }
  | { type: "truncated" };

export type Heap = Record<string, HeapObject>;

export interface Frame {
  step: number;
  lang: string;
  event: "line" | "call" | "return" | "exception";
  func: string;
  line: number;
  depth: number;
  scope: Record<string, Value>;
  heapDelta: Heap;
  changed: string[];
  returnValue: Value | null;
  exception: { type: string; message: string } | null;
}

export type Envelope =
  | { kind: "header"; schema: number; lang: string; entry: string }
  | ({ kind: "frame" } & Frame)
  | { kind: "end"; steps: number; status: "ok" | "error" | "capped"; error?: string };

// ---- request ----

export type ArgSpec =
  | { type: "int"; value: number }
  | { type: "float"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "string"; value: string }
  | { type: "array"; value: Primitive[] }
  | { type: "matrix"; value: Primitive[][] }
  | { type: "linkedlist"; values: Primitive[]; pos?: number }
  | { type: "binarytree"; values: (Primitive | null)[] }
  | { type: "graph"; n?: number; edges: number[][]; directed?: boolean };

export interface TraceRequest {
  lang: string;
  code: string;
  entry: string;
  args: ArgSpec[];
  maxSteps?: number;
}
