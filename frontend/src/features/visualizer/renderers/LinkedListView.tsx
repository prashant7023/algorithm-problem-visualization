import { motion } from "framer-motion";
import { nodeVal, primitiveText } from "../../../lib/heap";
import { walkLinkedList } from "../../../lib/structures";
import type { Heap } from "../../../lib/types";
import { PointerRow, dsColor } from "./primitives";

export function LinkedListView({
  heap,
  startId,
  pointers,
}: {
  heap: Heap;
  startId: string;
  pointers: Record<string, string[]>;
}) {
  const { order, cycleTo } = walkLinkedList(heap, startId);
  const color = dsColor("linkedlist");

  return (
    <div className="flex items-center gap-1 flex-wrap py-2">
      {order.map((id, i) => (
        <div key={id} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <PointerRow names={pointers[id] ?? []} />
            <motion.div
              layout
              layoutId={`node-${id}`}
              className="min-w-14 h-14 px-3 rounded-xl flex flex-col items-center justify-center font-mono"
              style={{ background: `${color}14`, border: `1px solid ${color}66` }}
            >
              <span className="text-base font-semibold text-white">
                {primitiveText(nodeVal(heap[id]))}
              </span>
              <span className="text-[9px] text-[var(--color-muted)]">{id}</span>
            </motion.div>
          </div>
          {i < order.length - 1 && <Arrow color={color} />}
        </div>
      ))}
      {cycleTo && (
        <div className="ml-2 flex items-center gap-1 text-xs font-mono" style={{ color }}>
          <span>⟲ cycle → {primitiveText(nodeVal(heap[cycleTo]))}</span>
          <span className="text-[var(--color-muted)]">({cycleTo})</span>
        </div>
      )}
      {!cycleTo && order.length > 0 && (
        <span className="ml-1 text-xs text-[var(--color-muted)] font-mono">→ null</span>
      )}
    </div>
  );
}

function Arrow({ color }: { color: string }) {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" className="shrink-0">
      <line x1="0" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.5" />
      <path d="M20 2 L26 7 L20 12 Z" fill={color} />
    </svg>
  );
}
