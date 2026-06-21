// Package usecase holds application logic and the PORT interfaces it depends on.
// It knows nothing about Docker/HTTP/Postgres — only these abstractions.
package usecase

import (
	"context"

	"github.com/algotrace/backend/internal/domain"
)

// SandboxRunner executes a request in an isolated environment and streams
// NDJSON envelopes on the returned channel, closing it when the trace ends.
type SandboxRunner interface {
	Run(ctx context.Context, req domain.TraceRequest) (<-chan domain.Envelope, error)
}

// LanguageRuntime knows how to build+launch ONE language's tracer. Adding a
// language = registering a new runtime; nothing else in the system changes.
type LanguageRuntime interface {
	Lang() string
	Image() string                          // sandbox image (toolchain + debug adapter)
	Command(req domain.TraceRequest) []string // how to launch the harness/adapter
	WorkDir() string                        // where the command runs
}

// RuntimeRegistry resolves a language to its runtime.
type RuntimeRegistry interface {
	For(lang string) (LanguageRuntime, error)
}

// SessionRepo persists completed traces for replay / shareable links.
type SessionRepo interface {
	Save(ctx context.Context, s domain.Session) error
	Get(ctx context.Context, id string) (domain.Session, error)
}

// FrameSink receives envelopes as they stream (e.g. a WebSocket/NDJSON writer).
type FrameSink interface {
	Push(env domain.Envelope) error
}
