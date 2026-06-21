import { primitiveText } from "../../../lib/heap";
import type { Heap } from "../../../lib/types";
import { dsColor } from "./primitives";

// Renders dict/hashmap (key -> value) and generic objects (field -> value).
export function HashMapView({ heap, id }: { heap: Heap; id: string }) {
  const obj = heap[id];
  if (!obj || obj.type !== "dict") return null;
  const color = dsColor("hashmap");
  return (
    <div className="flex flex-col gap-1 py-2 font-mono text-sm">
      {obj.entries.map(([k, v], i) => (
        <Row key={i} color={color} k={primitiveText(k)} v={primitiveText(v)} />
      ))}
      {obj.more ? <span className="text-xs text-[var(--color-muted)]">+{obj.more} more</span> : null}
    </div>
  );
}

export function ObjectView({ heap, id }: { heap: Heap; id: string }) {
  const obj = heap[id];
  if (!obj || (obj.type !== "object" && obj.type !== "node")) return null;
  const color = dsColor("object");
  return (
    <div className="flex flex-col gap-1 py-2 font-mono text-sm">
      <span className="text-xs text-[var(--color-muted)]">{obj.class}</span>
      {Object.entries(obj.fields).map(([k, v]) => (
        <Row key={k} color={color} k={k} v={primitiveText(v)} />
      ))}
    </div>
  );
}

function Row({ color, k, v }: { color: string; k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="px-2 py-0.5 rounded-md text-white"
        style={{ background: `${color}1f`, border: `1px solid ${color}44` }}
      >
        {k}
      </span>
      <span className="text-[var(--color-muted)]">:</span>
      <span className="text-white">{v}</span>
    </div>
  );
}
