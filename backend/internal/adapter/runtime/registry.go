// Package runtime registers the per-language tracer runtimes. Adding a language
// is an adapter-layer change here only — the usecase and frontend are untouched.
package runtime

import (
	"fmt"
	"path/filepath"

	"github.com/algotrace/backend/internal/domain"
	"github.com/algotrace/backend/internal/usecase"
)

type registry struct {
	byLang map[string]usecase.LanguageRuntime
}

// New builds the registry. tracerRoot is the dir containing python/ and cpp/.
func New(tracerRoot string) usecase.RuntimeRegistry {
	r := &registry{byLang: map[string]usecase.LanguageRuntime{}}
	r.register(pythonRuntime{dir: filepath.Join(tracerRoot, "python")})
	r.register(cppRuntime{dir: filepath.Join(tracerRoot, "cpp")})
	// Future: java (JDWP), ts (node inspector), go (delve), rust (lldb).
	return r
}

func (r *registry) register(rt usecase.LanguageRuntime) {
	r.byLang[rt.Lang()] = rt
}

func (r *registry) For(lang string) (usecase.LanguageRuntime, error) {
	rt, ok := r.byLang[lang]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %q", lang)
	}
	return rt, nil
}

// pythonRuntime — native settrace driver (reference implementation).
type pythonRuntime struct{ dir string }

func (p pythonRuntime) Lang() string                        { return "python" }
func (p pythonRuntime) Image() string                       { return "python:3.12-slim" }
func (p pythonRuntime) WorkDir() string                     { return p.dir }
func (pythonRuntime) Command(_ domain.TraceRequest) []string { return []string{"python", "harness.py"} }

// cppRuntime — universal-style driver: g++ -g + gdb/MI, orchestrated in Python.
type cppRuntime struct{ dir string }

func (c cppRuntime) Lang() string                        { return "cpp" }
func (c cppRuntime) Image() string                       { return "gcc:13" }
func (c cppRuntime) WorkDir() string                     { return c.dir }
func (cppRuntime) Command(_ domain.TraceRequest) []string { return []string{"python", "harness.py"} }
