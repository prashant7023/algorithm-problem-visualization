// Package sandbox implements SandboxRunner. `local` runs the tracer as a plain
// subprocess for development; the production runner (Docker/gVisor) will satisfy
// the same port without touching the usecase layer.
package sandbox

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"

	"github.com/algotrace/backend/internal/domain"
	"github.com/algotrace/backend/internal/usecase"
)

type Local struct {
	runtimes usecase.RuntimeRegistry
}

func NewLocal(runtimes usecase.RuntimeRegistry) *Local {
	return &Local{runtimes: runtimes}
}

func (l *Local) Run(ctx context.Context, req domain.TraceRequest) (<-chan domain.Envelope, error) {
	rt, err := l.runtimes.For(req.Lang)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(map[string]any{
		"code": req.Code, "entry": req.Entry, "args": req.Args, "max_steps": req.MaxSteps,
	})
	if err != nil {
		return nil, err
	}

	argv := rt.Command(req)
	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	cmd.Dir = rt.WorkDir()
	cmd.Stdin = bytes.NewReader(payload)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	log.Printf("[sandbox] lang=%s entry=%s cmd=%q dir=%s", req.Lang, req.Entry, strings.Join(argv, " "), cmd.Dir)
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start tracer: %w", err)
	}

	out := make(chan domain.Envelope, 64)
	go func() {
		defer close(out)
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 0, 1024*1024), 16*1024*1024)
		count := 0
		for sc.Scan() {
			line := append([]byte(nil), sc.Bytes()...)
			count++
			select {
			case out <- domain.Envelope(line):
			case <-ctx.Done():
				_ = cmd.Process.Kill()
				log.Printf("[sandbox] lang=%s CANCELLED/timeout after %d lines", req.Lang, count)
				return
			}
		}
		werr := cmd.Wait()
		if errTxt := strings.TrimSpace(stderr.String()); errTxt != "" {
			log.Printf("[sandbox] lang=%s tracer stderr:\n%s", req.Lang, truncate(errTxt, 4000))
		}
		if werr != nil {
			log.Printf("[sandbox] lang=%s tracer exited: %v (emitted %d lines)", req.Lang, werr, count)
			// Surface the failure to the client as a terminal envelope.
			msg, _ := json.Marshal(map[string]any{
				"kind": "end", "status": "error",
				"error": fmt.Sprintf("tracer process failed: %v", werr),
			})
			out <- domain.Envelope(msg)
		} else {
			log.Printf("[sandbox] lang=%s tracer done, %d lines", req.Lang, count)
		}
	}()
	return out, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…(truncated)"
}
