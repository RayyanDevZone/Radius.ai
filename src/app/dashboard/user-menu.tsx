import Link from "next/link";

/**
 * Account pill in the top bar: person icon + the full business name in a
 * rounded chip. Opens the Profile page.
 */
export function UserMenu({ label, business, active }: { label: string; business: string; active: boolean }) {
  return (
    <Link
      href="/dashboard/profile"
      aria-label={business ? `${label}: ${business}` : label}
      title={business || label}
      aria-current={active ? "page" : undefined}
      data-testid="user-menu-button"
      className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-accent-strong/60 bg-white/70 py-1 pl-1.5 pr-4 text-foreground shadow-sm transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong aria-[current=page]:bg-accent/70"
    >
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/70 text-brand">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" strokeLinecap="round" />
        </svg>
      </span>
      {business && (
        <span className="text-sm font-medium leading-tight" data-testid="topbar-business-name">
          {business}
        </span>
      )}
    </Link>
  );
}
