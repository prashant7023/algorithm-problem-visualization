import { primitiveText } from "../../lib/heap";
import type { Frame } from "../../lib/types";
import { dsColor, pointerColor } from "../visualizer/renderers/primitives";

export function ScopePanel({ frame }: { frame: Frame | undefined }) {
  if (!frame) return null;
  const changed = new Set(frame.changed);
  const entries = Object.entries(frame.scope);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Variables</h3>
        <span className="text-[11px] font-mono text-[var(--color-muted)]">
          {frame.func} · line {frame.line} · {frame.event}
        </span>
      </div>

      {entries.length === 0 && <p className="text-xs text-[var(--color-muted)]">No locals yet.</p>}

      <div className="flex flex-col gap-1">
        {entries.map(([name, v]) => {
          const isChanged = changed.has(name);
          return (
            <div
              key={name}
              className="flex items-center gap-2 font-mono text-sm rounded-md px-2 py-1 transition-colors"
              style={{ background: isChanged ? "rgba(167,139,250,0.12)" : "transparent" }}
            >
              <span style={{ color: pointerColor(name) }} className="font-semibold">
                {name}
              </span>
              <span className="text-[var(--color-muted)]">=</span>
              {v.kind === "primitive" ? (
                <span className="text-white">{primitiveText(v)}</span>
              ) : (
                <span style={{ color: dsColor(v.ds) }}>
                  {v.ds} <span className="text-[var(--color-muted)]">({v.id})</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {frame.returnValue && (
        <div className="mt-1 text-sm font-mono text-[var(--color-tree)]">
          ⤶ returns {primitiveText(frame.returnValue)}
        </div>
      )}
      {frame.exception && (
        <div className="mt-1 text-sm font-mono text-red-400">
          ✕ {frame.exception.type}: {frame.exception.message}
        </div>
      )}
    </div>
  );
}
