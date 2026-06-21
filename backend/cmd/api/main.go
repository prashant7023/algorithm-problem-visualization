// Command api wires the clean-architecture layers together and serves HTTP.
package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"path/filepath"

	httpadapter "github.com/algotrace/backend/internal/adapter/http"
	"github.com/algotrace/backend/internal/adapter/repo"
	"github.com/algotrace/backend/internal/adapter/runtime"
	"github.com/algotrace/backend/internal/adapter/sandbox"
	"github.com/algotrace/backend/internal/usecase"
)

func main() {
	addr := envOr("ALGOTRACE_ADDR", ":8080")
	tracerDir := envOr("ALGOTRACE_TRACER_DIR", defaultTracerDir())

	runtimes := runtime.New(tracerDir)
	sessions := repo.NewMemory()
	run := &usecase.RunTrace{
		Runtimes: runtimes,
		Sandbox:  sandbox.NewLocal(runtimes),
		Sessions: sessions,
		NewID:    newID,
	}
	handler := httpadapter.New(run, sessions)

	log.Printf("algotrace api listening on %s (tracers: %s)", addr, tracerDir)
	if err := http.ListenAndServe(addr, handler.Routes()); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func defaultTracerDir() string {
	wd, _ := os.Getwd()
	return filepath.Join(wd, "..", "..", "tracer")
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
