import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { getPageContext } from "@/lib/auth-context";
import { db } from "@/db";
import { authOrganization, authUser } from "@/db/auth-schema";
import { getI18n } from "@/i18n/server";
import { listStores } from "@/lib/stores-data";
import { SignOutButton } from "./sign-out-button";
import { AddStoreForm } from "./add-store-form";

async function DashboardContent() {
  // Redirects to /login or /onboarding if there's no valid tenant context.
  const ctx = await getPageContext();
  const { locale, t } = await getI18n();

  // Every lookup is keyed by ids from the server-side context.
  const [[org], [user], storeList] = await Promise.all([
    db.select({ name: authOrganization.name }).from(authOrganization).where(eq(authOrganization.id, ctx.orgId)).limit(1),
    db.select({ name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.id, ctx.userId)).limit(1),
    listStores(),
  ]);

  const d = t.dashboard;
  const roleLabel = d.roles[ctx.role];

  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.15em] text-muted">{d.business}</p>
            <p className="truncate font-serif text-2xl leading-tight" data-testid="business-name">
              {org?.name}
            </p>
          </div>
          <SignOutButton label={d.signOut} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <h1 className="text-3xl sm:text-4xl">{d.title}</h1>

        <section className="rounded-2xl border border-foreground/10 bg-white/70 p-5 shadow-sm">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted">{d.signedInAs}</dt>
              <dd className="mt-1 text-lg font-medium">{user?.name}</dd>
              <dd className="truncate text-sm text-muted">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted">{d.role}</dt>
              <dd className="mt-1">
                <span className="inline-flex items-center rounded-full border border-accent-strong bg-accent/60 px-3 py-1 text-sm font-medium">
                  {roleLabel}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="stores-title" className="rounded-2xl border border-foreground/10 bg-white/70 p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="stores-title" className="text-2xl">
              {d.stores.title}
            </h2>
            <span className="text-sm text-muted">{storeList.length}</span>
          </div>
          {storeList.length === 0 ? (
            <p className="mb-4 text-sm text-muted">
              {d.stores.empty} {ctx.role === "owner" && d.stores.emptyOwner}
            </p>
          ) : (
            <ul className="mb-4 flex flex-col gap-2" data-testid="store-list">
              {storeList.map((s) => (
                <li key={s.id} className="rounded-xl border border-accent-strong/60 bg-background/70 px-4 py-3">
                  <p className="font-medium">{s.name}</p>
                  {s.address && <p className="text-sm text-muted">{s.address}</p>}
                </li>
              ))}
            </ul>
          )}
          {ctx.role === "owner" && <AddStoreForm t={d.stores} />}
        </section>

        <p className="rounded-2xl border border-dashed border-foreground/20 p-5 text-sm text-muted">{d.comingSoon}</p>
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy className="mx-auto w-full max-w-3xl animate-pulse px-4 py-6">
      <div className="h-8 w-48 rounded bg-foreground/10" />
      <div className="mt-6 h-32 rounded-2xl bg-foreground/5" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
