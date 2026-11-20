import { Suspense } from "react";
import Link from "next/link";
import { getContext } from "@/lib/auth-context";
import {
  QUIET_DAYS,
  getEmployeeActivity,
  getLowStock,
  getMyDay,
  getOutstanding,
  getOverview,
  getQuietShops,
  getSalesTrend,
  getToday,
  getTopProducts,
  getTopShops,
  getVehicleActivity,
} from "@/lib/dashboard-data";
import { businessToday, type DeliveryStatus } from "@/lib/deliveries";
import { formatDay } from "@/lib/format";
import { moneyFormatter } from "@/lib/money";
import { getStoreSelection } from "@/lib/selected-store";
import { getI18n } from "@/i18n/server";
import type { Dictionary } from "@/i18n/dictionaries";
import { Icon } from "./_components/section";
import { StatusBadge } from "./deliveries/status-badge";
import {
  EmployeesPanel,
  LowStockPanel,
  OutstandingPanel,
  OverviewCards,
  Panel,
  QuietShopsPanel,
  SalesTrendPanel,
  SetupChecklist,
  TodayTiles,
  TopProductsPanel,
  TopShopsPanel,
  VehiclesPanel,
} from "./_home/widgets";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function HomeContent({ searchParams }: { searchParams: SearchParams }) {
  // Tenant and role come from the session; never from the URL.
  const [ctx, { locale, t }] = await Promise.all([getContext(), getI18n()]);
  return ctx.role === "owner" ? (
    <OwnerHome orgId={ctx.orgId} d={t.dashboard} locale={locale} searchParams={searchParams} />
  ) : (
    <EmployeeHome orgId={ctx.orgId} userId={ctx.userId} d={t.dashboard} locale={locale} />
  );
}

/* ------------------------------------------------------------------ */
/* Owner                                                              */
/* ------------------------------------------------------------------ */

async function OwnerHome({ orgId, d, locale, searchParams }: { orgId: string; d: Dictionary["dashboard"]; locale: string; searchParams: SearchParams }) {
  const h = d.home;
  // "?scope=all" only widens the view to every store of *this* business.
  const [{ selected }, sp] = await Promise.all([getStoreSelection(), searchParams]);
  const allStores = sp.scope === "all" || !selected;
  const storeId = allStores ? null : selected.id;
  const todayIso = businessToday();

  const [overview, today, trend, topProducts, topShops, quiet, outstanding, vehicles, employees, lowStock] = await Promise.all([
    getOverview(orgId),
    getToday(orgId, storeId),
    getSalesTrend(orgId, storeId),
    getTopProducts(orgId, storeId),
    getTopShops(orgId, storeId),
    getQuietShops(orgId),
    getOutstanding(orgId),
    getVehicleActivity(orgId, storeId),
    getEmployeeActivity(orgId, storeId),
    getLowStock(orgId, storeId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="home-title" className="text-3xl sm:text-4xl">
            {d.title}
          </h1>
          <p className="mt-1 text-sm text-muted">{h.subtitle}</p>
        </div>
        {selected && (
          <nav aria-label={h.scope.label} className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.15em] text-muted">{h.scope.label}</span>
            <div className="inline-flex rounded-full bg-accent/60 p-1" data-testid="scope-switch">
              {[
                { href: "/dashboard", label: selected.name, current: !allStores },
                { href: "/dashboard?scope=all", label: h.scope.all, current: allStores },
              ].map((o) => (
                <Link
                  key={o.href}
                  href={o.href}
                  aria-current={o.current ? "page" : undefined}
                  className="max-w-[12rem] truncate rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:shadow-[0_6px_16px_-8px_rgba(31,58,43,0.7)]"
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <SetupChecklist h={h} overview={overview} />
      <OverviewCards h={h} overview={overview} locale={locale} />
      <TodayTiles d={d} today={today} locale={locale} />
      <SalesTrendPanel h={h} trend={trend} locale={locale} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopProductsPanel d={d} items={topProducts} locale={locale} />
        <TopShopsPanel d={d} items={topShops} locale={locale} />
        <OutstandingPanel h={h} data={outstanding} locale={locale} />
        <QuietShopsPanel h={h} quiet={quiet} locale={locale} todayIso={todayIso} quietDays={QUIET_DAYS} />
        <VehiclesPanel d={d} items={vehicles} />
        <EmployeesPanel d={d} items={employees} locale={locale} />
        <LowStockPanel d={d} data={lowStock} showStore={allStores} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee: my day                                                   */
/* ------------------------------------------------------------------ */

async function EmployeeHome({ orgId, userId, d, locale }: { orgId: string; userId: string; d: Dictionary["dashboard"]; locale: string }) {
  const m = d.home.myDay;
  const day = await getMyDay(orgId, userId);
  const money = moneyFormatter(locale);
  const todayIso = businessToday();

  const tiles = [
    { label: m.open, value: String(day.open.length), icon: "route" as const },
    { label: m.delivered, value: String(day.deliveredToday), hint: money(day.salesToday), icon: "check" as const },
    { label: m.collected, value: money(day.collectedToday), icon: "wallet" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 id="home-title" className="text-3xl sm:text-4xl">
          {m.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{m.subtitle}</p>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="my-day-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-2 rounded-2xl border border-accent-strong/60 bg-white/70 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm text-muted">{tile.label}</dt>
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/70 text-brand">
                <Icon name={tile.icon} className="h-4 w-4" />
              </span>
            </div>
            <dd className="text-3xl font-semibold">{tile.value}</dd>
            {tile.hint && <dd className="text-xs text-muted">{tile.hint}</dd>}
          </div>
        ))}
      </dl>

      <Panel id="my-deliveries-title" title={m.listTitle} action={{ href: "/dashboard/deliveries", label: m.viewAll }}>
        {day.open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/15 px-4 py-8 text-center">
            <p className="font-medium">{m.empty}</p>
            <p className="mt-1 text-sm text-muted">{m.emptyHint}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="my-deliveries">
            {day.open.map((o) => {
              const late = o.scheduledFor < todayIso;
              const status = o.status as DeliveryStatus;
              return (
                <li key={o.id} className="flex flex-col gap-2 rounded-2xl border border-accent-strong/50 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">#{o.number}</span>
                      <span className="truncate font-medium">{o.shopName}</span>
                      {late && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{m.late}</span>}
                    </p>
                    <p className="text-sm text-muted">{o.shopAddress}</p>
                    <p className="text-xs text-muted">
                      {o.storeName} · {formatDay(locale, o.scheduledFor, todayIso)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <span className="font-semibold tabular-nums">{money(o.total)}</span>
                    <StatusBadge status={status} label={d.deliveries.statuses[status]} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy className="flex animate-pulse flex-col gap-6">
      <div className="h-10 w-48 rounded-lg bg-foreground/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-foreground/5" />
        ))}
      </div>
      <div className="h-72 rounded-3xl bg-foreground/5" />
    </div>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
