import { useTrace } from "../../store/traceStore";
import { MenuSelect } from "../../components/MenuSelect";

const PRESETS: { label: string; entry: string; lang: string; code: string; args: string }[] = [
  {
    label: "Linked List Cycle",
    entry: "hasCycle",
    lang: "python",
    code: `def hasCycle(head):\n    slow, fast = head, head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow == fast:\n            return True\n    return False\n`,
    args: JSON.stringify([{ type: "linkedlist", values: [3, 2, 0, -4], pos: 1 }], null, 2),
  },
  {
    label: "Binary Search",
    entry: "search",
    lang: "python",
    code: `def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n`,
    args: JSON.stringify([{ type: "array", value: [-1, 0, 3, 5, 9, 12] }, { type: "int", value: 9 }], null, 2),
  },
  {
    label: "Unique Paths (DP)",
    entry: "fill",
    lang: "python",
    code: `def fill(m, n):\n    dp = [[1] * n for _ in range(m)]\n    for i in range(1, m):\n        for j in range(1, n):\n            dp[i][j] = dp[i-1][j] + dp[i][j-1]\n    return dp[m-1][n-1]\n`,
    args: JSON.stringify([{ type: "int", value: 3 }, { type: "int", value: 4 }], null, 2),
  },
  {
    label: "Max Depth (Tree)",
    entry: "maxDepth",
    lang: "python",
    code: `def maxDepth(root):\n    if not root:\n        return 0\n    return 1 + max(maxDepth(root.left), maxDepth(root.right))\n`,
    args: JSON.stringify([{ type: "binarytree", values: [3, 9, 20, null, null, 15, 7] }], null, 2),
  },
  {
    label: "Largest Altitude (C++)",
    entry: "largestAltitude",
    lang: "cpp",
    code: `class Solution {\npublic:\n    int largestAltitude(vector<int>& gain) {\n        int mx_val = 0, alt = 0;\n        for (int i = 0; i < gain.size(); i++) {\n            alt += gain[i];\n            mx_val = max(mx_val, alt);\n        }\n        return mx_val;\n    }\n};\n`,
    args: JSON.stringify([{ type: "array", value: [-5, 1, 5, 0, -7] }], null, 2),
  },
  {
    label: "Reverse List (C++)",
    entry: "reverseList",
    lang: "cpp",
    code: `class Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        ListNode* prev = nullptr;\n        while (head) {\n            ListNode* nxt = head->next;\n            head->next = prev;\n            prev = head;\n            head = nxt;\n        }\n        return prev;\n    }\n};\n`,
    args: JSON.stringify([{ type: "linkedlist", values: [1, 2, 3, 4, 5] }], null, 2),
  },
];

const LANGS = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java", disabled: true, hint: "Coming soon" },
  { value: "ts", label: "TypeScript", disabled: true, hint: "Coming soon" },
];

export function InputBuilder() {
  const { entry, setEntry, lang, setLang, argsText, setArgsText, setCode } = useTrace();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setCode(p.code);
              setEntry(p.entry);
              setLang(p.lang);
              setArgsText(p.args);
            }}
            className="text-xs px-2.5 py-1 rounded-md hairline hover:border-[var(--color-ll)] hover:text-white transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <label className="flex-1 flex flex-col gap-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">Entry function</span>
          <input
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            className="bg-[var(--color-ink-850)] hairline rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-[var(--color-ll)]"
          />
        </label>
        <MenuSelect
          className="w-36 shrink-0"
          label="Language"
          title="Language"
          value={lang}
          options={LANGS}
          onChange={setLang}
          placement="down"
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
          Input (JSON args)
        </span>
        <textarea
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          spellCheck={false}
          rows={6}
          className="bg-[var(--color-ink-850)] hairline rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-[var(--color-ll)] resize-y"
        />
      </label>
    </div>
  );
}
