import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

export type MenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
};

type Placement = "up" | "down";

export function MenuSelect({
  value,
  options,
  onChange,
  label,
  title,
  placement = "down",
  className = "",
  buttonClassName = "",
}: {
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  /** Optional small caption above the control */
  label?: string;
  title?: string;
  placement?: Placement;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const display = current?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel =
    placement === "up"
      ? "bottom-[calc(100%+6px)] origin-bottom"
      : "top-[calc(100%+6px)] origin-top";

  return (
    <div ref={root} className={`relative ${className}`}>
      {label && (
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
      )}
      <button
        type="button"
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-white
          bg-[var(--color-ink-850)] border border-[var(--color-line)]
          hover:border-[var(--color-ll)] transition ${buttonClassName}`}
      >
        <span className="truncate font-mono text-left">{display}</span>
        <motion.svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="opacity-60 shrink-0"
        >
          <path
            d="M2 3.5 L5 6.5 L8 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, scale: 0.94, y: placement === "up" ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: placement === "up" ? 4 : -4 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.6 }}
            className={`absolute left-0 right-0 z-40 py-1 rounded-xl overflow-hidden
              bg-[#12151f] border border-[var(--color-line)]
              shadow-[0_16px_48px_rgba(0,0,0,0.55)] ${panel}`}
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active} aria-disabled={o.disabled}>
                  <button
                    type="button"
                    disabled={o.disabled}
                    onClick={() => {
                      if (o.disabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition
                      disabled:opacity-40 disabled:cursor-not-allowed
                      ${
                        active
                          ? "bg-[var(--color-ll)]/15 text-[var(--color-ll)]"
                          : "text-soft hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="font-mono truncate">{o.label}</span>
                      {o.hint && (
                        <span className="text-[10px] text-[var(--color-muted)] font-sans">
                          {o.hint}
                        </span>
                      )}
                    </span>
                    {active && !o.disabled && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0">
                        <path
                          d="M2.5 6.2 L4.8 8.5 L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
