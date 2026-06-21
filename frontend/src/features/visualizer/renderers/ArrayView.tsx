import { motion } from "framer-motion";
import { primitiveText } from "../../../lib/heap";
import type { Heap } from "../../../lib/types";
import { PointerRow, dsColor } from "./primitives";

// indexPointers maps an array index -> variable names pointing there (i, j, lo...).
export function ArrayView({
  heap,
  id,
  indexPointers = {},
}: {
  heap: Heap;
  id: string;
  indexPointers?: Record<number, string[]>;
}) {
  const obj = heap[id];
  if (!obj || (obj.type !== "array" && obj.type !== "set")) return null;
  const color = dsColor("array");

  return (
    <div className="flex items-end gap-1 py-2 flex-wrap">
      {obj.items.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <PointerRow names={indexPointers[i] ?? []} />
          <motion.div
            layout
            className="min-w-11 h-11 px-2 rounded-lg flex items-center justify-center font-mono text-sm font-semibold text-white"
            style={{ background: `${color}14`, border: `1px solid ${color}55` }}
          >
            {primitiveText(v)}
          </motion.div>
          <span className="text-[10px] text-[var(--color-muted)] font-mono">{i}</span>
        </div>
      ))}
      {obj.more ? (
        <span className="text-xs text-[var(--color-muted)] self-center">+{obj.more} more</span>
      ) : null}
    </div>
  );
}
