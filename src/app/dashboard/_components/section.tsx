import type { ReactNode } from "react";
import { AddButton } from "./add-button";

/**
 * Shared header for list pages (Stores, Products, Shops):
 *   Title  [count]                                  [import] [+]
 * The Add button is shown to owners only.
 */
export function SectionHeader({
  id,
  title,
  count,
  countLabel,
  addLabel,
  comingSoon,
  canAdd,
  addAction,
  importAction,
}: {
  id: string;
  title: string;
  count: number;
  countLabel: { one: string; other: string };
  addLabel: string;
  comingSoon: string;
  canAdd: boolean;
  /** Real add flow (e.g. a dialog trigger). Without it, the button shows "Coming soon". */
  addAction?: ReactNode;
  /** CSV / XLSX import trigger (ImportDialog), shown left of the + button. */
  importAction?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <h1 id={id} className="text-3xl sm:text-4xl">
          {title}
        </h1>
        <span className="rounded-full bg-accent/60 px-3 py-1 text-sm text-muted" data-testid="section-count">
          {count} {count === 1 ? countLabel.one : countLabel.other}
        </span>
      </div>
      {canAdd && (
        <div className="flex items-center gap-2">
          {importAction}
          {addAction ?? <AddButton label={addLabel} comingSoon={comingSoon} />}
        </div>
      )}
    </div>
  );
}

/** Centered empty state with an icon. */
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon: ReactNode }) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/20 px-6 py-16 text-center"
    >
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/60 text-brand">
        {icon}
      </span>
      <p className="text-lg font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Line icons shared by the drawer menu and the pages. */
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      {ICONS[name]}
    </svg>
  );
}

export type IconName = "grid" | "box" | "shop" | "truck" | "users" | "store" | "settings";

const ICONS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  box: <path d="M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4 8-4M12 12v8" />,
  shop: <path d="M4 10l1.5-5h13L20 10M4 10v9h16v-9M4 10h16M9 19v-5h6v5" />,
  store: <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />,
  truck: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17" cy="17.5" r="1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M16 5a3 3 0 010 6M18 14.5c1.6.6 2.6 2 3 4.5" />
    </>
  ),
};
