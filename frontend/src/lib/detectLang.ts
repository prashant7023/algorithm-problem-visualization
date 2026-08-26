/** Best-effort language guess from source text. Returns null if unsure. */
export function detectLang(code: string): "python" | "cpp" | null {
  const c = code.trim();
  if (c.length < 12) return null;

  let cpp = 0;
  let py = 0;

  if (/#include\s*[<"]/.test(c)) cpp += 4;
  if (/\busing\s+namespace\s+std\b/.test(c)) cpp += 3;
  if (/\bnullptr\b/.test(c)) cpp += 3;
  if (/\bvector\s*</.test(c)) cpp += 2;
  if (/\bListNode\s*\*/.test(c) || /\bTreeNode\s*\*/.test(c)) cpp += 3;
  if (/\bclass\s+Solution\s*\{/.test(c)) cpp += 3;
  if (/::/.test(c)) cpp += 1;
  if (/->/.test(c)) cpp += 1;
  if (/;\s*$/m.test(c)) cpp += 1;
  if (/\bint\s+main\s*\(/.test(c)) cpp += 2;
  if (/\bpublic:\s*$/m.test(c)) cpp += 2;

  if (/\bdef\s+[A-Za-z_]\w*\s*\(/.test(c)) py += 4;
  if (/\bNone\b/.test(c)) py += 2;
  if (/\bTrue\b|\bFalse\b/.test(c) && !/\bnullptr\b/.test(c)) py += 1;
  if (/\bself\b/.test(c)) py += 2;
  if (/:\s*(#.*)?$/m.test(c) && /^\s{2,}\S/m.test(c)) py += 1;
  if (/\bprint\s*\(/.test(c) && !/\bprintf\s*\(/.test(c)) py += 1;
  if (/\belif\b/.test(c)) py += 3;

  if (cpp >= 3 && cpp > py + 1) return "cpp";
  if (py >= 3 && py > cpp + 1) return "python";
  if (cpp >= 4 && py === 0) return "cpp";
  if (py >= 3 && cpp === 0) return "python";
  return null;
}
