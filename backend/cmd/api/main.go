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
	addr := listenAddr()
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
	if err := http.ListenAndServe(addr, withCORS(handler.Routes())); err != nil {
		log.Fatal(err)
	}
}

func listenAddr() string {
	// Render (and most PaaS) inject PORT without a leading colon.
	if p := os.Getenv("PORT"); p != "" {
		if p[0] == ':' {
			return p
		}
		return ":" + p
	}
	return envOr("ALGOTRACE_ADDR", ":8080")
}

func withCORS(next http.Handler) http.Handler {
	origin := envOr("ALGOTRACE_CORS_ORIGIN", "*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if origin != "*" {
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func defaultTracerDir() string {
	if _, err := os.Stat("/app/tracer"); err == nil {
		return "/app/tracer"
	}
	// From algotrace/backend → algotrace/tracer
	wd, _ := os.Getwd()
	return filepath.Join(wd, "..", "tracer")
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
