"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { selectStore } from "@/lib/select-store";
import { Icon } from "./_components/section";
import type { Dictionary } from "@/i18n/dictionaries";

type Store = { id: string; name: string };

const chevron = (open: boolean) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * Side-menu dropdown under the business card: shows the selected store and
 * lets the user switch. The choice is saved on the server (selectStore), which
 * re-renders the page for the new store.
 */
export function StorePicker({
  t,
  stores,
  selectedId,
}: {
  t: Dictionary["dashboard"]["storePicker"];
  stores: Store[];
  selectedId: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Shows the new choice immediately while the server catches up.
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const currentId = (pending && optimisticId) || selectedId;
  const current = stores.find((s) => s.id === currentId) ?? null;

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: string) {
    setOpen(false);
    if (id === selectedId) return;
    setOptimisticId(id);
    startTransition(async () => {
      await selectStore(id);
    });
  }

  // No stores yet: say so, and point to the Stores page.
  if (stores.length === 0) {
    return (
      <div className="mb-3 rounded-xl border border-dashed border-foreground/20 px-3 py-3" data-testid="store-picker-empty">
        <p className="text-xs uppercase tracking-[0.15em] text-muted">{t.label}</p>
        <p className="mt-0.5 text-sm text-muted">{t.none}</p>
        <Link href="/dashboard/stores" className="mt-1 inline-block text-sm font-medium underline decoration-accent-strong decoration-2 underline-offset-4">
          {t.manage}
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="true"
        data-testid="store-picker"
        className="flex w-full items-center gap-3 rounded-xl border border-accent-strong/70 bg-background px-3 py-2.5 text-left transition hover:border-foreground/40 hover:bg-accent/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong aria-expanded:border-foreground/40"
      >
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-brand">
          <Icon name="store" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs uppercase tracking-[0.15em] text-muted">{t.label}</span>
          <span className="block truncate font-medium" data-testid="store-picker-current">
            {current?.name ?? t.choose}
          </span>
        </span>
        {pending ? (
          <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        ) : (
          chevron(open)
        )}
      </button>

      {open && (
        <div
          id={listId}
          className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-[0_18px_40px_-18px_rgba(31,58,43,0.45)]"
        >
          <p className="px-3 pb-1 pt-2.5 text-xs uppercase tracking-[0.15em] text-muted">{t.choose}</p>
          <ul className="max-h-64 overflow-y-auto p-1" data-testid="store-picker-list">
            {stores.map((s) => {
              const isCurrent = s.id === currentId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => choose(s.id)}
                    aria-current={isCurrent ? "true" : undefined}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none aria-[current=true]:font-medium"
                  >
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {isCurrent && (
                      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/stores"
            onClick={() => setOpen(false)}
            className="block border-t border-foreground/10 px-3 py-2.5 text-sm font-medium text-brand transition hover:bg-accent/40"
          >
            {t.manage} →
          </Link>
        </div>
      )}
    </div>
  );
}
