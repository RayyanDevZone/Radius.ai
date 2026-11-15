"use client";

import { useEffect, useState } from "react";

/**
 * "+ Add …" button in a section header. The add flows aren't built yet, so a
 * tap shows a short "Coming soon" note instead of doing nothing silently.
 * Swap `onClick` for the real form/dialog when it exists.
 */
export function AddButton({ label, comingSoon }: { label: string; comingSoon: string }) {
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(false), 2500);
    return () => clearTimeout(id);
  }, [note]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setNote(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background shadow-[0_8px_24px_-12px_rgba(31,58,43,0.6)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {label}
      </button>
      <p
        role="status"
        className={`pointer-events-none absolute right-0 top-[calc(100%+0.4rem)] whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition-opacity ${
          note ? "opacity-100" : "opacity-0"
        }`}
      >
        {note ? comingSoon : ""}
      </p>
    </div>
  );
}
