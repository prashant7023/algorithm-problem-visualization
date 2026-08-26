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
        href="https://github.com/prashant7023"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-white transition-colors"
        aria-label="GitHub profile"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        github.com/prashant7023
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
