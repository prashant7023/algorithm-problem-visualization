import { motion } from "framer-motion";
import { primitiveText } from "../../../lib/heap";
import type { Heap, Value } from "../../../lib/types";
import { dsColor } from "./primitives";

export function DPTableView({ heap, id }: { heap: Heap; id: string }) {
  const obj = heap[id];
  if (!obj || obj.type !== "array") return null;
  const color = dsColor("dptable");

  const rows: Value[][] = obj.items.map((row) => {
    if (row.kind === "ref") {
      const r = heap[row.id];
      return r && r.type === "array" ? r.items : [];
    }
    return [row];
  });

  return (
    <div className="inline-block py-2">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 mb-1">
          {row.map((cell, ci) => (
            <motion.div
              key={ci}
              layout
              className="w-11 h-11 rounded-md flex items-center justify-center font-mono text-sm text-white"
              style={{ background: `${color}12`, border: `1px solid ${color}40` }}
            >
              {primitiveText(cell)}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}
