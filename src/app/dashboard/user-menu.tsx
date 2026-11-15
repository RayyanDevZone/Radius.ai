import Link from "next/link";

/** Person icon in the top bar. Opens the Profile page. */
export function UserMenu({ label, active }: { label: string; active: boolean }) {
  return (
    <Link
      href="/dashboard/profile"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-testid="user-menu-button"
      // Just the green icon: no circle/background. 44px tap target is kept.
      className="flex h-11 w-11 items-center justify-center rounded-full text-brand transition hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong aria-[current=page]:bg-accent/70 aria-[current=page]:text-foreground"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
