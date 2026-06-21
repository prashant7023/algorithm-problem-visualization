import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { useTrace } from "../../store/traceStore";

// Maps our `lang` to a Monaco language id.
const MONACO_LANG: Record<string, string> = {
  python: "python",
  cpp: "cpp",
  java: "java",
  rust: "rust",
  ts: "typescript",
  go: "go",
};

export function CodeEditor() {
  const code = useTrace((s) => s.code);
  const setCode = useTrace((s) => s.setCode);
  const lang = useTrace((s) => s.lang);
  const frames = useTrace((s) => s.frames);
  const cursor = useTrace((s) => s.cursor);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorations = useRef<string[]>([]);

  const line = frames[cursor]?.line ?? 0;

  // Highlight the currently executing line + scroll it into view.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    if (line > 0) {
      decorations.current = ed.deltaDecorations(decorations.current, [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "trace-line",
            glyphMarginClassName: "trace-line-glyph",
          },
        },
      ]);
      ed.revealLineInCenterIfOutsideViewport(line);
    } else {
      decorations.current = ed.deltaDecorations(decorations.current, []);
    }
  }, [line]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={MONACO_LANG[lang] ?? "plaintext"}
      value={code}
      onChange={(v) => setCode(v ?? "")}
      onMount={onMount}
      options={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 13,
        minimap: { enabled: false },
        glyphMargin: true,
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        lineNumbersMinChars: 3,
        renderLineHighlight: "none",
      }}
    />
  );
}
