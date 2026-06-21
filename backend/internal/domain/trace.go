// Package domain holds the core entities. It has ZERO dependencies on other
// layers (no Docker, no HTTP, no DB) — the clean-architecture dependency rule.
package domain

import "encoding/json"

// TraceRequest is a submitted solution + the input to run it against.
type TraceRequest struct {
	Lang     string            `json:"lang"`
	Code     string            `json:"code"`
	Entry    string            `json:"entry"`
	Args     []json.RawMessage `json:"args"`
	MaxSteps int               `json:"maxSteps,omitempty"`
}

// Envelope is one NDJSON message from a tracer: a "header", "frame", or "end"
// (see docs/frame-schema.md). Frames are relayed verbatim — the schema is the
// contract, so the backend does not re-model every field, it transports them.
type Envelope = json.RawMessage

// Session is a completed, replayable trace (the basis for shareable links).
type Session struct {
	ID      string       `json:"id"`
	Request TraceRequest `json:"request"`
	Stream  []Envelope   `json:"stream"`
}
