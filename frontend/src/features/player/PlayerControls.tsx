import { useEffect } from "react";
import { useTrace } from "../../store/traceStore";

export function PlayerControls() {
  const { frames, cursor, playing, speed, setCursor, step, togglePlay, pause, setSpeed } = useTrace();
  const total = frames.length;
  const atEnd = cursor >= total - 1;

  // Playback loop.
  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      pause();
      return;
    }
    const id = setInterval(() => useTrace.getState().step(1), 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed, atEnd, pause]);

  const disabled = total === 0;

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex items-center gap-1">
        <Btn label="⏮" title="Restart" disabled={disabled} onClick={() => setCursor(0)} />
        <Btn label="◀" title="Step back" disabled={disabled} onClick={() => step(-1)} />
        <button
          onClick={togglePlay}
          disabled={disabled}
          className="w-10 h-10 rounded-full grid place-items-center bg-[var(--color-ll)] text-ink-950 font-bold disabled:opacity-30 hover:brightness-110 transition"
          style={{ color: "#0b0d14" }}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <Btn label="▶" title="Step forward" disabled={disabled} onClick={() => step(1)} />
        <Btn label="⏭" title="End" disabled={disabled} onClick={() => setCursor(total - 1)} />
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={cursor}
        disabled={disabled}
        onChange={(e) => setCursor(Number(e.target.value))}
        className="flex-1 accent-[var(--color-ll)]"
      />

      <span className="text-xs font-mono text-[var(--color-muted)] w-20 text-right">
        {disabled ? "—" : `${cursor + 1} / ${total}`}
      </span>

      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="bg-[var(--color-ink-850)] hairline rounded-md px-2 py-1 text-xs text-white outline-none"
        title="Speed"
      >
        <option value={2}>0.5×</option>
        <option value={4}>1×</option>
        <option value={8}>2×</option>
        <option value={16}>4×</option>
      </select>
    </div>
  );
}

function Btn({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-9 h-9 rounded-lg hairline grid place-items-center text-sm text-soft hover:border-[var(--color-ll)] hover:text-white disabled:opacity-30 transition"
    >
      {label}
    </button>
  );
}
