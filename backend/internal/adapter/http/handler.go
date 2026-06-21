// Package http is the transport adapter: REST + streaming. For the first
// vertical slice it streams NDJSON over a chunked HTTP response; the WebSocket
// hub will plug in later behind the same FrameSink port.
package http

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/algotrace/backend/internal/domain"
	"github.com/algotrace/backend/internal/usecase"
)

// Hard ceiling so a hung tracer (e.g. a stuck debugger) can't keep the request
// open forever — the client unsticks with an error instead of "Tracing…".
const traceTimeout = 45 * time.Second

type Handler struct {
	run      *usecase.RunTrace
	sessions usecase.SessionRepo
}

func New(run *usecase.RunTrace, sessions usecase.SessionRepo) *Handler {
	return &Handler{run: run, sessions: sessions}
}

func (h *Handler) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/trace", h.trace)
	mux.HandleFunc("GET /api/session/{id}", h.session)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	return mux
}

// ndjsonSink writes each envelope as one line and flushes immediately so frames
// reach the client live.
type ndjsonSink struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func (s ndjsonSink) Push(env domain.Envelope) error {
	if _, err := s.w.Write(env); err != nil {
		return err
	}
	if _, err := s.w.Write([]byte("\n")); err != nil {
		return err
	}
	if s.flusher != nil {
		s.flusher.Flush()
	}
	return nil
}

func (h *Handler) trace(w http.ResponseWriter, r *http.Request) {
	var req domain.TraceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	flusher, _ := w.(http.Flusher)
	sink := &countingSink{inner: ndjsonSink{w: w, flusher: flusher}}

	ctx, cancel := context.WithTimeout(r.Context(), traceTimeout)
	defer cancel()

	start := time.Now()
	log.Printf("[trace] start lang=%s entry=%s codeBytes=%d", req.Lang, req.Entry, len(req.Code))
	id, err := h.run.Execute(ctx, req, sink)
	dur := time.Since(start).Round(time.Millisecond)
	if err != nil {
		log.Printf("[trace] FAIL lang=%s entry=%s after=%s err=%v", req.Lang, req.Entry, dur, err)
		// Headers may already be sent mid-stream; emit a trailing error envelope.
		_ = sink.Push(domain.Envelope(`{"kind":"end","status":"error","error":` +
			strconvQuote(err.Error()) + `}`))
		return
	}
	log.Printf("[trace] ok lang=%s entry=%s session=%s frames=%d dur=%s", req.Lang, req.Entry, id, sink.count, dur)
}

// countingSink tracks how many envelopes were streamed, for logging.
type countingSink struct {
	inner ndjsonSink
	count int
}

func (s *countingSink) Push(env domain.Envelope) error {
	s.count++
	return s.inner.Push(env)
}

func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s, err := h.sessions.Get(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(s)
}

func strconvQuote(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}
