import { useMemo } from "react";
import { heapUpTo } from "../../lib/heap";
import { walkLinkedList } from "../../lib/structures";
import type { Frame, Value } from "../../lib/types";
import { ArrayView } from "./renderers/ArrayView";
import { DPTableView } from "./renderers/DPTableView";
import { HashMapView, ObjectView } from "./renderers/KeyedView";
import { LinkedListView } from "./renderers/LinkedListView";
import { TreeView } from "./renderers/TreeView";
import { dsColor } from "./renderers/primitives";

export function Stage({ frames, cursor }: { frames: Frame[]; cursor: number }) {
  const heap = useMemo(() => heapUpTo(frames, cursor), [frames, cursor]);
  const frame = frames[cursor];

  if (!frame) {
    return (
      <Empty>
        Paste code, set an input, and hit <b className="text-white">Run</b> to watch it execute.
      </Empty>
    );
  }

  // Group scope: refs (-> heap objects) and primitive index pointers.
  const refEntries = Object.entries(frame.scope).filter(([, v]) => v.kind === "ref") as [
    string,
    Extract<Value, { kind: "ref" }>,
  ][];
  const primEntries = Object.entries(frame.scope).filter(
    ([, v]) => v.kind === "primitive",
  ) as [string, Extract<Value, { kind: "primitive" }>][];

  const pointerByNode: Record<string, string[]> = {};
  for (const [name, v] of refEntries) (pointerByNode[v.id] ||= []).push(name);

  const byDs = (ds: string) => refEntries.filter(([, v]) => v.ds === ds);
  const cards: { key: string; color: string; title: string; body: React.ReactNode }[] = [];

  // --- Linked lists: render once from the best head, overlay all pointers ---
  const llRefs = byDs("linkedlist");
  if (llRefs.length) {
    const start =
      llRefs.find(([n]) => n === "head")?.[1].id ??
      llRefs
        .map(([, v]) => v.id)
        .reduce((best, id) =>
          walkLinkedList(heap, id).order.length > walkLinkedList(heap, best).order.length ? id : best,
        );
    cards.push({
      key: "ll",
      color: dsColor("linkedlist"),
      title: "Linked list",
      body: <LinkedListView heap={heap} startId={start} pointers={pointerByNode} />,
    });
  }

  // --- Trees ---
  const treeRefs = byDs("tree");
  if (treeRefs.length) {
    const root = treeRefs.find(([n]) => n === "root")?.[1].id ?? treeRefs[0][1].id;
    cards.push({
      key: "tree",
      color: dsColor("tree"),
      title: "Tree",
      body: <TreeView heap={heap} rootId={root} pointers={pointerByNode} />,
    });
  }

  // --- Arrays & DP tables (dedupe by id) ---
  const seen = new Set<string>();
  for (const [name, v] of [...byDs("array"), ...byDs("dptable")]) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const isDp = v.ds === "dptable";
    const indexPointers: Record<number, string[]> = {};
    if (!isDp) {
      const len = arrayLen(heap, v.id);
      for (const [pn, pv] of primEntries) {
        if (typeof pv.value === "number" && Number.isInteger(pv.value) && pv.value >= 0 && pv.value < len)
          (indexPointers[pv.value] ||= []).push(pn);
      }
    }
    cards.push({
      key: `arr-${v.id}`,
      color: dsColor(v.ds),
      title: `${isDp ? "DP table" : "Array"} ${name}`,
      body: isDp ? (
        <DPTableView heap={heap} id={v.id} />
      ) : (
        <ArrayView heap={heap} id={v.id} indexPointers={indexPointers} />
      ),
    });
  }

  // --- Hashmaps / sets / objects ---
  for (const [name, v] of byDs("hashmap")) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    cards.push({ key: `map-${v.id}`, color: dsColor("hashmap"), title: `Map ${name}`, body: <HashMapView heap={heap} id={v.id} /> });
  }
  for (const [name, v] of byDs("set")) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    cards.push({ key: `set-${v.id}`, color: dsColor("set"), title: `Set ${name}`, body: <ArrayView heap={heap} id={v.id} /> });
  }
  for (const [name, v] of byDs("object")) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    cards.push({ key: `obj-${v.id}`, color: dsColor("object"), title: name, body: <ObjectView heap={heap} id={v.id} /> });
  }

  if (!cards.length) return <Empty>No visual structures in scope at this step.</Empty>;

  return (
    <div className="flex flex-col gap-4 overflow-auto h-full p-1">
      {cards.map((c) => (
        <section key={c.key} className="panel p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{c.title}</h3>
          </div>
          <div className="overflow-x-auto">{c.body}</div>
        </section>
      ))}
    </div>
  );
}

function arrayLen(heap: ReturnType<typeof heapUpTo>, id: string): number {
  const o = heap[id];
  return o && (o.type === "array" || o.type === "set") ? o.items.length : 0;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full grid place-items-center text-center text-sm text-[var(--color-muted)] p-8">
      <p className="max-w-xs">{children}</p>
    </div>
  );
}
