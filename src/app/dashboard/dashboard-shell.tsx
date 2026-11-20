"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { UserMenu } from "./user-menu";
import { Icon, type IconName } from "./_components/section";
import type { Dictionary } from "@/i18n/dictionaries";

export type ShellLabels = Pick<Dictionary["dashboard"], "nav" | "openMenu" | "closeMenu" | "soon"> & {
  profile: Pick<Dictionary["dashboard"]["profile"], "title">;
};

type Props = {
  lang: string;
  /** Only the strings the frame uses (the full dashboard dictionary is large). */
  t: ShellLabels;
  /** Shows owner-only menu items. UI only; pages check the role on the server. */
  isOwner: boolean;
  /** Business name, shown in the top-bar account pill. */
  business: string;
  /** Store dropdown at the top of the drawer (rendered by the layout). */
  storePicker?: ReactNode;
  children: ReactNode;
};

const LG = "(min-width: 1024px)";

function subscribeToLg(onChange: () => void) {
  const mq = window.matchMedia(LG);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * App frame: full-width top bar (menu toggle, Radius.ai logo, account menu)
 * and a left drawer that collapses to an icon-only rail.
 * - Desktop (lg+): the drawer sits beside the content and starts open; the
 *   toggle shrinks it to the rail and the content widens.
 * - Mobile: starts as the rail; opening slides the full panel over the content.
 * Two separate flags, so nothing flickers on load.
 */
export function DashboardShell({ lang, t, business, isOwner, storePicker, children }: Props) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Server snapshot is "mobile"; React switches to the real value right after
  // hydration, without a mismatch.
  const isDesktop = useSyncExternalStore(subscribeToLg, () => window.matchMedia(LG).matches, () => false);
  const isOpen = isDesktop ? desktopOpen : mobileOpen;
  const toggle = () => (isDesktop ? setDesktopOpen((v) => !v) : setMobileOpen((v) => !v));

  // Close the mobile drawer on Escape (and on link taps, below).
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Open/closed classes per breakpoint, spelled out literally for Tailwind.
  // Using both flags (not `isOpen`) keeps the server render correct on desktop.
  const expandedOnly = `${mobileOpen ? "block" : "hidden"} ${desktopOpen ? "lg:block" : "lg:hidden"}`;
  // Labels stay readable to screen readers when the rail hides them.
  const labelClass = `whitespace-nowrap ${mobileOpen ? "" : "sr-only"} ${desktopOpen ? "lg:not-sr-only" : "lg:sr-only"}`;
  // px-3.5 centres the 20px icon in the 48px rail, so icons don't move when the panel opens.
  const linkClass =
    "flex h-12 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition hover:bg-accent/60 aria-[current=page]:bg-foreground aria-[current=page]:text-background";

  const nav: { href: string; label: string; icon: IconName; ready: boolean }[] = [
    { href: "/dashboard", label: t.nav.dashboard, icon: "grid", ready: true },
    { href: "/dashboard/deliveries", label: t.nav.deliveries, icon: "route", ready: true },
    // Owner-only page (business money).
    ...(isOwner ? [{ href: "/dashboard/payments", label: t.nav.payments, icon: "wallet" as const, ready: true }] : []),
    { href: "/dashboard/stock", label: t.nav.stock, icon: "layers", ready: true },
    { href: "/dashboard/products", label: t.nav.products, icon: "box", ready: true },
    { href: "/dashboard/shops", label: t.nav.shops, icon: "shop", ready: true },
    { href: "/dashboard/vehicles", label: t.nav.vehicles, icon: "truck", ready: true },
    // Owner-only page (it lists employees' names and emails).
    ...(isOwner ? [{ href: "/dashboard/employees", label: t.nav.employees, icon: "users" as const, ready: true }] : []),
    // Stores (where stores are managed) is the last option.
    { href: "/dashboard/stores", label: t.nav.stores, icon: "store", ready: true },
  ];

  return (
    <div lang={lang} className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-foreground/10 bg-background/90 px-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-controls="dashboard-drawer"
            aria-expanded={isOpen}
            aria-label={isOpen ? t.closeMenu : t.openMenu}
            data-testid="drawer-toggle"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            {/* Three lines morph into an X while the drawer is open. */}
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path
                d="M4 7h16"
                className="transition-transform duration-300 ease-out"
                style={{ transformOrigin: "12px 12px", transform: isOpen ? "rotate(45deg) translateY(5px)" : "none" }}
              />
              <path
                d="M4 12h16"
                className="transition-opacity duration-200 ease-out"
                style={{ opacity: isOpen ? 0 : 1 }}
              />
              <path
                d="M4 17h16"
                className="transition-transform duration-300 ease-out"
                style={{ transformOrigin: "12px 12px", transform: isOpen ? "rotate(-45deg) translateY(-5px)" : "none" }}
              />

            </svg>
          </button>
          <Link href="/dashboard" lang="en" aria-label="Radius.ai" className="font-serif text-2xl tracking-tight sm:text-3xl">
            Radius<span className="text-shimmer italic">.ai</span>
          </Link>
        </div>
        <UserMenu label={t.profile.title} business={business} active={pathname === "/dashboard/profile"} />
      </header>

      <div className="relative flex flex-1">
        {/* Mobile backdrop */}
        {mobileOpen && (
          <button
            type="button"
            aria-label={t.closeMenu}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-16 z-20 bg-foreground/30 lg:hidden"
          />
        )}

        {/* Drawer: closed, it shrinks to an icon-only rail instead of
            disappearing. The outer <aside> reserves the rail's space (and, on
            desktop, the open panel's space); on mobile the open panel
            overflows it and slides over the content. */}
        <aside
          id="dashboard-drawer"
          aria-label={t.nav.dashboard}
          data-open={mobileOpen || undefined}
          data-desktop-open={desktopOpen || undefined}
          className={[
            "sticky top-16 z-20 h-[calc(100dvh-4rem)] w-16 shrink-0 transition-[width] duration-300 ease-out",
            desktopOpen ? "lg:w-64" : "lg:w-16",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-y-0 left-0 flex flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-foreground/10 bg-background p-2 transition-[width] duration-300 ease-out",
              mobileOpen ? "w-72" : "w-16",
              desktopOpen ? "lg:w-64" : "lg:w-16",
            ].join(" ")}
          >
            {/* Store dropdown at the top of the drawer (business name lives in the top bar) */}
            <div className={`mb-1 ${expandedOnly}`}>{storePicker}</div>

            <nav className="flex flex-col gap-1">
              {nav.map((item) =>
                item.ready ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={isOpen ? undefined : item.label}
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={linkClass}
                  >
                    <Icon name={item.icon} />
                    <span className={labelClass}>{item.label}</span>
                  </Link>
                ) : (
                  <span
                    key={item.label}
                    title={isOpen ? undefined : item.label}
                    aria-disabled="true"
                    className="flex h-12 shrink-0 cursor-not-allowed items-center gap-3 rounded-xl px-3.5 text-sm text-muted/80"
                  >
                    <Icon name={item.icon} />
                    <span className={labelClass}>{item.label}</span>
                    <span className={`ml-auto rounded-full bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted ${expandedOnly}`}>
                      {t.soon}
                    </span>
                  </span>
                ),
              )}
            </nav>

            {/* Settings: pinned to the bottom of the drawer */}
            <div className="mt-auto border-t border-foreground/10 pt-2">
              <Link
                href="/dashboard/settings"
                title={isOpen ? undefined : t.nav.settings}
                aria-current={pathname === "/dashboard/settings" ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                data-testid="drawer-settings"
                className={linkClass}
              >
                <Icon name="settings" />
                <span className={labelClass}>{t.nav.settings}</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Content: full width */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
