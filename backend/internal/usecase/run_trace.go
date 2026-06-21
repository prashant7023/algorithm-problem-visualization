package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/algotrace/backend/internal/domain"
)

const (
	maxCodeBytes    = 64 * 1024
	defaultMaxSteps = 10_000
)

// RunTrace orchestrates a single trace: validate -> sandbox -> stream -> persist.
// It depends only on ports, never on concrete infrastructure.
type RunTrace struct {
	Runtimes RuntimeRegistry
	Sandbox  SandboxRunner
	Sessions SessionRepo
	NewID    func() string
}

func (u *RunTrace) Execute(ctx context.Context, req domain.TraceRequest, sink FrameSink) (string, error) {
	if err := u.validate(&req); err != nil {
		return "", err
	}

	stream, err := u.Sandbox.Run(ctx, req)
	if err != nil {
		return "", fmt.Errorf("sandbox: %w", err)
	}

	saved := make([]domain.Envelope, 0, 256)
	for env := range stream {
		if perr := sink.Push(env); perr != nil {
			return "", fmt.Errorf("sink: %w", perr)
		}
		saved = append(saved, env)
	}

	id := u.NewID()
	session := domain.Session{ID: id, Request: req, Stream: saved}
	if serr := u.Sessions.Save(ctx, session); serr != nil {
		return id, fmt.Errorf("persist: %w", serr)
	}
	return id, nil
}

func (u *RunTrace) validate(req *domain.TraceRequest) error {
	if req.Code == "" {
		return errors.New("code is required")
	}
	if len(req.Code) > maxCodeBytes {
		return fmt.Errorf("code exceeds %d bytes", maxCodeBytes)
	}
	if req.Entry == "" {
		return errors.New("entry function is required")
	}
	if _, err := u.Runtimes.For(req.Lang); err != nil {
		return err
	}
	if req.MaxSteps <= 0 || req.MaxSteps > defaultMaxSteps {
		req.MaxSteps = defaultMaxSteps
	}
	return nil
}
