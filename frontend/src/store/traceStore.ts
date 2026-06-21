import { create } from "zustand";
import { streamTrace } from "../lib/api";
import type { Frame, TraceRequest } from "../lib/types";

type Status = "idle" | "running" | "done" | "error";

interface TraceState {
  code: string;
  entry: string;
  lang: string;
  argsText: string; // JSON array of ArgSpec, edited in the Input Builder

  frames: Frame[];
  status: Status;
  error: string | null;
  cursor: number;
  playing: boolean;
  speed: number; // frames per second

  setCode: (v: string) => void;
  setEntry: (v: string) => void;
  setLang: (v: string) => void;
  setArgsText: (v: string) => void;

  run: () => Promise<void>;
  setCursor: (n: number) => void;
  step: (delta: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (n: number) => void;
}

const DEFAULT_CODE = `def hasCycle(head):
    slow, fast = head, head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False
`;

const DEFAULT_ARGS = JSON.stringify(
  [{ type: "linkedlist", values: [3, 2, 0, -4], pos: 1 }],
  null,
  2,
);

export const useTrace = create<TraceState>((set, get) => ({
  code: DEFAULT_CODE,
  entry: "hasCycle",
  lang: "python",
  argsText: DEFAULT_ARGS,

  frames: [],
  status: "idle",
  error: null,
  cursor: 0,
  playing: false,
  speed: 4,

  setCode: (v) => set({ code: v }),
  setEntry: (v) => set({ entry: v }),
  setLang: (v) => set({ lang: v }),
  setArgsText: (v) => set({ argsText: v }),

  run: async () => {
    const { code, entry, lang, argsText } = get();
    let args: TraceRequest["args"];
    try {
      args = JSON.parse(argsText);
      if (!Array.isArray(args)) throw new Error("args must be a JSON array");
    } catch (e) {
      set({ status: "error", error: `Invalid input JSON: ${(e as Error).message}` });
      return;
    }

    set({ frames: [], cursor: 0, status: "running", error: null, playing: false });
    const collected: Frame[] = [];
    let sawEnd = false;
    try {
      await streamTrace({ lang, code, entry, args }, (env) => {
        if (env.kind === "frame") {
          collected.push(env);
          set({ frames: collected.slice() });
        } else if (env.kind === "end") {
          sawEnd = true;
          set({
            status: env.status === "ok" ? "done" : "error",
            error: env.error ?? (env.status === "capped" ? "step cap reached" : null),
          });
        }
      });
      // Stream closed without a terminal envelope — never leave the UI stuck.
      if (!sawEnd) {
        set({
          status: collected.length ? "done" : "error",
          error: collected.length ? null : "Tracer produced no frames (see backend log).",
        });
      }
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  setCursor: (n) => {
    const max = Math.max(0, get().frames.length - 1);
    set({ cursor: Math.min(Math.max(0, n), max) });
  },
  step: (delta) => get().setCursor(get().cursor + delta),
  play: () => {
    if (get().frames.length) set({ playing: true });
  },
  pause: () => set({ playing: false }),
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (n) => set({ speed: n }),
}));
