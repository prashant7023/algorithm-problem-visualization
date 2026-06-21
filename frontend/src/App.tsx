import { CodeEditor } from "./features/editor/CodeEditor";
import { InputBuilder } from "./features/input/InputBuilder";
import { PlayerControls } from "./features/player/PlayerControls";
import { ScopePanel } from "./features/player/ScopePanel";
import { Stage } from "./features/visualizer/Stage";
import { useTrace } from "./store/traceStore";

export default function App() {
  const { frames, cursor, status, error, run } = useTrace();
  const running = status === "running";

  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3 p-3 min-h-0">
        {/* LEFT — editor + input */}
        <div className="flex flex-col gap-3 min-h-0">
          <section className="panel flex-1 min-h-0 overflow-hidden flex flex-col">
            <PanelTitle>Solution</PanelTitle>
            <div className="flex-1 min-h-0">
              <CodeEditor />
            </div>
          </section>

          <section className="panel p-4">
            <PanelTitle>Input</PanelTitle>
            <InputBuilder />
            <button
              onClick={run}
              disabled={running}
              className="mt-3 w-full py-2.5 rounded-lg font-semibold text-[#0b0d14] bg-[var(--color-ll)] hover:brightness-110 disabled:opacity-50 transition"
            >
              {running ? "Tracing…" : "▶  Run trace"}
            </button>
            {error && <p className="mt-2 text-xs text-red-400 font-mono">{error}</p>}
          </section>
        </div>

        {/* RIGHT — visualizer + player + scope */}
        <div className="flex flex-col gap-3 min-h-0">
          <section className="panel flex-1 min-h-0 p-3 overflow-hidden">
            <Stage frames={frames} cursor={cursor} />
          </section>
          <section className="panel p-3">
            <PlayerControls />
          </section>
          <section className="panel p-4 max-h-56 overflow-auto">
            <ScopePanel frame={frames[cursor]} />
          </section>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-line)]">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-bold text-white tracking-tight">
          Algo<span style={{ color: "var(--color-ll)" }}>Trace</span>
        </span>
        <span className="text-xs text-[var(--color-muted)]">Paste your code. Watch it think.</span>
      </div>
      <a
        href="https://github.com"
        className="text-xs text-[var(--color-muted)] hover:text-white transition-colors"
      >
        any language · any platform
      </a>
    </header>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 px-4 pt-3">
      {children}
    </h2>
  );
}
