// Package repo implements SessionRepo. `memory` is the dev store; a Postgres
// implementation will satisfy the same port for durable shareable links.
package repo

import (
	"context"
	"fmt"
	"sync"

	"github.com/algotrace/backend/internal/domain"
)

type Memory struct {
	mu sync.RWMutex
	m  map[string]domain.Session
}

func NewMemory() *Memory {
	return &Memory{m: map[string]domain.Session{}}
}

func (r *Memory) Save(_ context.Context, s domain.Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.m[s.ID] = s
	return nil
}

func (r *Memory) Get(_ context.Context, id string) (domain.Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.m[id]
	if !ok {
		return domain.Session{}, fmt.Errorf("session %q not found", id)
	}
	return s, nil
}
