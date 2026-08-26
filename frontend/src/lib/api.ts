import type { Envelope, TraceRequest } from "./types";

// Streams the NDJSON trace response, invoking `onEnvelope` per parsed line as
// it arrives (frames appear live, not after completion).
export async function streamTrace(
  req: TraceRequest,
  onEnvelope: (env: Envelope) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${base}/api/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`trace request failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) onEnvelope(JSON.parse(trimmed) as Envelope);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      flushLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  flushLine(buffer);
}
