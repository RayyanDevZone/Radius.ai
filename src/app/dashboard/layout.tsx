import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { getPageContext } from "@/lib/auth-context";
import { db } from "@/db";
import { authOrganization } from "@/db/auth-schema";
import { getI18n } from "@/i18n/server";
import { getStoreSelection } from "@/lib/selected-store";
import { DashboardShell } from "./dashboard-shell";
import { StorePicker } from "./store-picker";

// Shared frame (top bar + drawer) for /dashboard and every page under it.
async function Frame({ children }: { children: React.ReactNode }) {
  // Redirects to /login or /onboarding if there's no valid tenant context.
  const ctx = await getPageContext();
  const { locale, t } = await getI18n();

  // Keyed by the org id from the server-side context.
  const [[org], { stores, selected }] = await Promise.all([
    db.select({ name: authOrganization.name }).from(authOrganization).where(eq(authOrganization.id, ctx.orgId)).limit(1),
    getStoreSelection(),
  ]);

  return (
    <DashboardShell
      lang={locale}
      t={{
        nav: t.dashboard.nav,
        openMenu: t.dashboard.openMenu,
        closeMenu: t.dashboard.closeMenu,
        soon: t.dashboard.soon,
        profile: { title: t.dashboard.profile.title },
      }}
      business={org?.name ?? ""}
      isOwner={ctx.role === "owner"}
      storePicker={
        <StorePicker
          t={t.dashboard.storePicker}
          stores={stores.map(({ id, name }) => ({ id, name }))}
          selectedId={selected?.id ?? null}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}

function FrameSkeleton() {
  return (
    <div aria-busy className="flex min-h-dvh flex-col">
      <div className="h-16 border-b border-foreground/10" />
      <div className="flex-1 animate-pulse p-6">
        <div className="h-8 w-40 rounded bg-foreground/10" />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}
