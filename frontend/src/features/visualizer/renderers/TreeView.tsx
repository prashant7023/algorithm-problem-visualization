import { motion } from "framer-motion";
import { fieldRefId, nodeVal, primitiveText } from "../../../lib/heap";
import { layoutTree } from "../../../lib/structures";
import type { Heap } from "../../../lib/types";
import { PointerRow, dsColor } from "./primitives";

const CELL = 56;
const GAP_X = 20;
const GAP_Y = 64;

export function TreeView({
  heap,
  rootId,
  pointers,
}: {
  heap: Heap;
  rootId: string;
  pointers: Record<string, string[]>;
}) {
  const nodes = layoutTree(heap, rootId);
  if (!nodes.length) return null;
  const color = dsColor("tree");

  const pos = new Map(nodes.map((n) => [n.id, n]));
  const width = nodes.length * (CELL + GAP_X);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const height = (maxDepth + 1) * GAP_Y + 40;
  const xOf = (x: number) => x * (CELL + GAP_X) + CELL / 2;
  const yOf = (d: number) => d * GAP_Y + 28;

  return (
    <div className="relative" style={{ width, height }}>
      <svg className="absolute inset-0" width={width} height={height}>
        {nodes.map((n) => {
          const edges = (["left", "right"] as const)
            .map((side) => fieldRefId(heap[n.id], side))
            .filter((c): c is string => !!c && pos.has(c));
          return edges.map((cid) => {
            const c = pos.get(cid)!;
            return (
              <line
                key={`${n.id}-${cid}`}
                x1={xOf(n.x)}
                y1={yOf(n.depth)}
                x2={xOf(c.x)}
                y2={yOf(c.depth)}
                stroke={`${color}66`}
                strokeWidth="1.5"
              />
            );
          });
        })}
      </svg>
      {nodes.map((n) => (
        <div
          key={n.id}
          className="absolute flex flex-col items-center"
          style={{ left: xOf(n.x) - CELL / 2, top: yOf(n.depth) - 14 }}
        >
          <PointerRow names={pointers[n.id] ?? []} />
          <motion.div
            layout
            layoutId={`node-${n.id}`}
            className="rounded-full flex items-center justify-center font-mono text-sm font-semibold text-white"
            style={{
              width: CELL,
              height: CELL,
              background: `${color}16`,
              border: `1px solid ${color}66`,
            }}
          >
            {primitiveText(nodeVal(heap[n.id]))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
