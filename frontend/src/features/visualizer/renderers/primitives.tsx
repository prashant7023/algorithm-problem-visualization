import { motion } from "framer-motion";
import type { DSType } from "../../../lib/types";

export function dsColor(ds: DSType): string {
  switch (ds) {
    case "linkedlist":
      return "var(--color-ll)";
    case "array":
      return "var(--color-arr)";
    case "tree":
    case "graph":
      return "var(--color-tree)";
    case "dptable":
      return "var(--color-dp)";
    case "hashmap":
    case "set":
      return "var(--color-map)";
    case "stack":
    case "queue":
      return "var(--color-stack)";
    default:
      return "var(--color-muted)";
  }
}

const PALETTE = [
  "#a78bfa",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#fb923c",
  "#22d3ee",
];

export function pointerColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// A labeled pointer badge. Uses layoutId so the SAME pointer animates to a new
// node between frames (a "moving pointer").
export function PointerBadge({ name }: { name: string }) {
  const color = pointerColor(name);
  return (
    <motion.div
      layoutId={`ptr-${name}`}
      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {name}
    </motion.div>
  );
}

export function PointerRow({ names }: { names: string[] }) {
  return (
    <div className="flex items-end justify-center gap-1 h-6">
      {names.map((n) => (
        <PointerBadge key={n} name={n} />
      ))}
    </div>
  );
}
