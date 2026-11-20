import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { CREDIT_DAYS, DELIVERY_STATUSES } from "@/lib/deliveries";
import type {
  EmployeeActivity,
  LowStockRow,
  Outstanding,
  Overview,
  QuietShop,
  SalesTrend,
  TodayStats,
  TopProduct,
  TopShop,
  VehicleActivity,
} from "@/lib/dashboard-data";
import { fill, formatDay, plural } from "@/lib/format";
import { moneyFormatter, toPaise } from "@/lib/money";
import { formatVehicleNumber } from "@/lib/vehicles";
import { Icon, type IconName } from "../_components/section";
import { STATUS_STYLE } from "../deliveries/status-badge";
import { SalesChart } from "./sales-chart";

type D = Dictionary["dashboard"];
type H = D["home"];

/* ------------------------------------------------------------------ */
/* Building blocks                                                    */
/* ------------------------------------------------------------------ */

export function Panel({
  id,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-4 rounded-3xl border border-accent-strong/60 bg-white/70 p-5 shadow-sm sm:p-6 ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-2xl leading-tight">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            {action.label} →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-foreground/15 px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/** Ranked row: name, value, and a thin bar for its share of the leader. */
function RankRow({ name, detail, value, share }: { name: string; detail?: string; value: string; share: number }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{name}</span>
        <span className="shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-accent/60">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Math.round(share * 100))}%` }} />
        </span>
        {detail && <span className="shrink-0 text-xs text-muted">{detail}</span>}
      </div>
    </li>
  );
}

/** Share of the largest value, from exact money strings. */
const shares = (amounts: string[]) => {
  const paise = amounts.map(toPaise);
  const max = paise.reduce((m, p) => (p > m ? p : m), BigInt(0));
  return paise.map((p) => (max > BigInt(0) ? Number((p * BigInt(1000)) / max) / 1000 : 0));
};

/* ------------------------------------------------------------------ */
/* Setup checklist                                                    */
/* ------------------------------------------------------------------ */

const STEPS = [
  { key: "stores", href: "/dashboard/stores", icon: "store" },
  { key: "products", href: "/dashboard/products", icon: "box" },
  { key: "shops", href: "/dashboard/shops", icon: "shop" },
  { key: "vehicles", href: "/dashboard/vehicles", icon: "truck" },
  { key: "employees", href: "/dashboard/employees", icon: "users" },
  { key: "deliveries", href: "/dashboard/deliveries", icon: "route" },
] as const satisfies readonly { key: keyof H["checklist"]["steps"]; href: string; icon: IconName }[];

/** Shown until every step has at least one record; then it disappears. */
export function SetupChecklist({ h, overview }: { h: H; overview: Overview }) {
  const steps = STEPS.map((s) => ({ ...s, done: overview[s.key].total > 0 }));
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const c = h.checklist;
  const next = steps.find((s) => !s.done)?.key;

  return (
    <section
      aria-labelledby="checklist-title"
      data-testid="setup-checklist"
      className="relative overflow-hidden rounded-3xl border border-accent-strong/70 bg-accent/35 p-5 sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="checklist-title" className="text-2xl sm:text-3xl">
            {c.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{fill(c.progress, { done, total: steps.length })}</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-label={fill(c.progress, { done, total: steps.length })}
          className="h-2 w-full overflow-hidden rounded-full bg-background/80 sm:w-48"
        >
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => {
          const copy = c.steps[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                aria-current={s.key === next ? "step" : undefined}
                className={`group flex h-full items-center gap-3 rounded-2xl border px-4 py-3 transition focus-visible:outline-2 focus-visible:outline-accent-strong ${
                  s.done
                    ? "border-transparent bg-background/50 text-muted"
                    : "border-accent-strong/70 bg-background hover:-translate-y-0.5 hover:shadow-md aria-[current=step]:border-foreground"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    s.done ? "bg-brand text-background" : "bg-accent/70 text-brand"
                  }`}
                >
                  {s.done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium ${s.done ? "line-through decoration-foreground/30" : "text-foreground"}`}>{copy.title}</span>
                  <span className="block text-xs text-muted">{copy.hint}</span>
                </span>
                <span className="sr-only">{s.done ? c.done : ""}</span>
                {!s.done && (
                  <span aria-hidden className="text-sm font-medium text-brand transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Overview cards                                                     */
/* ------------------------------------------------------------------ */

const CARDS = [
  { key: "shops", href: "/dashboard/shops", icon: "shop" },
  { key: "products", href: "/dashboard/products", icon: "box" },
  { key: "vehicles", href: "/dashboard/vehicles", icon: "truck" },
  { key: "employees", href: "/dashboard/employees", icon: "users" },
  { key: "stores", href: "/dashboard/stores", icon: "store" },
] as const satisfies readonly { key: keyof H["overview"]["cards"]; href: string; icon: IconName }[];

export function OverviewCards({ h, overview, locale }: { h: H; overview: Overview; locale: string }) {
  const nf = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN");
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-3">
      <h2 id="overview-title" className="sr-only">
        {h.overview.title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-testid="overview-cards">
        {CARDS.map((c) => {
          const { total, thisMonth } = overview[c.key];
          return (
            <li key={c.key}>
              <Link
                href={c.href}
                data-testid={`overview-${c.key}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-accent-strong/60 bg-white/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm text-muted">{h.overview.cards[c.key]}</span>
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/70 text-brand">
                    <Icon name={c.icon} className="h-4 w-4" />
                  </span>
                </span>
                <span className="text-3xl font-semibold">{nf.format(total)}</span>
                <span className={`text-xs ${thisMonth > 0 ? "font-medium text-brand" : "text-muted"}`}>
                  {thisMonth > 0 ? fill(h.overview.newThisMonth, { n: nf.format(thisMonth) }) : h.overview.noneThisMonth}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Today                                                              */
/* ------------------------------------------------------------------ */

function Tile({ label, value, hint, icon, tone = "default", children }: { label: string; value: string; hint?: ReactNode; icon: IconName; tone?: "default" | "warn"; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-accent-strong/60 bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm text-muted">{label}</dt>
        <span aria-hidden className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === "warn" ? "bg-red-50 text-red-700" : "bg-accent/70 text-brand"}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <dd className={`text-3xl font-semibold ${tone === "warn" ? "text-red-700" : ""}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
      {children}
    </div>
  );
}

export function TodayTiles({ d, today, locale }: { d: D; today: TodayStats; locale: string }) {
  const h = d.home.today;
  const money = moneyFormatter(locale);
  const planned = DELIVERY_STATUSES.map((s) => ({ status: s, n: today.planned[s] }));
  const plannedTotal = planned.reduce((a, p) => a + p.n, 0);

  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-title" className="text-2xl">
          {h.title}
        </h2>
        <Link href="/dashboard/deliveries" className="rounded-full px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-accent/60">
          {h.viewDeliveries} →
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="today-tiles">
        <Tile
          label={h.planned}
          icon="route"
          value={String(plannedTotal)}
          hint={plannedTotal === 0 ? h.plannedEmpty : fill(h.plannedOf, { done: today.planned.delivered, total: plannedTotal })}
        >
          {plannedTotal > 0 && (
            <dd className="flex flex-col gap-2">
              {/* Thin segmented bar: one whole (today's plan) split by status; legend names the parts. */}
              <span
                role="img"
                aria-label={planned.filter((p) => p.n > 0).map((p) => `${d.deliveries.statuses[p.status]}: ${p.n}`).join(", ")}
                className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
              >
                {planned
                  .filter((p) => p.n > 0)
                  .map((p) => (
                    <span key={p.status} className={`h-full first:rounded-l-full last:rounded-r-full ${STATUS_STYLE[p.status].dot}`} style={{ flexGrow: p.n }} />
                  ))}
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {planned
                  .filter((p) => p.n > 0)
                  .map((p) => (
                    <span key={p.status} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_STYLE[p.status].dot}`} />
                      {d.deliveries.statuses[p.status]} {p.n}
                    </span>
                  ))}
              </span>
            </dd>
          )}
        </Tile>
        <Tile
          label={h.delivered}
          icon="check"
          value={money(today.salesToday)}
          hint={plural(today.deliveredCount, h.deliveriesOne, h.deliveries)}
        />
        <Tile label={h.collected} icon="wallet" value={money(today.collectedToday)} hint={h.allStores} />
        <Tile
          label={h.late}
          icon="alert"
          tone={today.overdueOpen > 0 ? "warn" : "default"}
          value={String(today.overdueOpen)}
          hint={today.overdueOpen > 0 ? h.lateHint : h.lateNone}
        />
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sales trend                                                        */
/* ------------------------------------------------------------------ */

export function SalesTrendPanel({ h, trend, locale }: { h: H; trend: SalesTrend; locale: string }) {
  const t = h.trend;
  const money = moneyFormatter(locale);
  const cur = toPaise(trend.total);
  const prev = toPaise(trend.previousTotal);
  const change = prev > BigInt(0) ? Number(((cur - prev) * BigInt(1000)) / prev) / 10 : null;
  const hasSales = cur > BigInt(0);

  return (
    <Panel id="trend-title" title={t.title} subtitle={t.subtitle}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-5xl font-semibold tracking-tight" data-testid="sales-total">
          {money(trend.total)}
        </p>
        <p className="pb-1.5 text-sm">
          {change === null ? (
            <span className="text-muted">{t.noPrevious}</span>
          ) : (
            <>
              <span className={`font-semibold ${change >= 0 ? "text-brand" : "text-red-700"}`}>
                <span aria-hidden>{change >= 0 ? "▲" : "▼"} </span>
                {change >= 0 ? "+" : "−"}
                {Math.abs(change).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 })}%
              </span>{" "}
              <span className="text-muted">{t.vsPrevious}</span>
            </>
          )}
        </p>
      </div>
      {hasSales ? (
        <SalesChart
          days={trend.days}
          locale={locale}
          totalLabel={money(trend.total)}
          labels={{
            chartLabel: t.chartLabel,
            showTable: t.showTable,
            date: t.date,
            sales: t.sales,
            count: t.count,
            deliveries: t.deliveries,
            deliveriesOne: t.deliveriesOne,
          }}
        />
      ) : (
        <Empty>{t.empty}</Empty>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Rankings                                                           */
/* ------------------------------------------------------------------ */

export function TopProductsPanel({ d, items, locale }: { d: D; items: TopProduct[]; locale: string }) {
  const t = d.home.topProducts;
  const money = moneyFormatter(locale);
  const s = shares(items.map((i) => i.revenue));
  return (
    <Panel id="top-products-title" title={t.title} subtitle={t.subtitle}>
      {items.length === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((p, i) => (
            <RankRow
              key={`${p.name}-${i}`}
              name={p.name}
              value={money(p.revenue)}
              share={s[i]}
              detail={fill(t.sold, { n: p.quantity })}
            />
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function TopShopsPanel({ d, items, locale }: { d: D; items: TopShop[]; locale: string }) {
  const t = d.home.topShops;
  const money = moneyFormatter(locale);
  const s = shares(items.map((i) => i.revenue));
  return (
    <Panel id="top-shops-title" title={t.title} subtitle={t.subtitle}>
      {items.length === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((shop, i) => (
            <RankRow
              key={shop.shopId}
              name={shop.name}
              value={money(shop.revenue)}
              share={s[i]}
              detail={plural(shop.deliveries, d.home.today.deliveriesOne, d.home.today.deliveries)}
            />
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function QuietShopsPanel({ h, quiet, locale, todayIso, quietDays }: { h: H; quiet: { count: number; shops: QuietShop[] }; locale: string; todayIso: string; quietDays: number }) {
  const t = h.quiet;
  return (
    <Panel id="quiet-title" title={t.title} subtitle={fill(t.subtitle, { days: quietDays })}>
      {quiet.count === 0 ? (
        <Empty>{fill(t.empty, { days: quietDays })}</Empty>
      ) : (
        <>
          <p className="-mt-2 text-sm font-medium text-amber-900">{plural(quiet.count, t.countOne, t.count)}</p>
          <ul className="flex flex-col divide-y divide-foreground/10">
            {quiet.shops.map((s) => (
              <li key={s.shopId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">
                    {s.lastOrderOn ? fill(t.lastOrder, { date: formatDay(locale, s.lastOrderOn, todayIso) }) : t.never}
                  </span>
                </span>
                <a
                  href={`tel:${s.mobile}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 px-3 text-xs font-medium transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-accent-strong"
                >
                  <Icon name="phone" className="h-3.5 w-3.5" />
                  {t.call}
                  <span className="sr-only"> {s.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Outstanding payments                                               */
/* ------------------------------------------------------------------ */

export function OutstandingPanel({ h, data, locale }: { h: H; data: Outstanding; locale: string }) {
  const t = h.outstanding;
  const money = moneyFormatter(locale);
  const hasOverdue = toPaise(data.overdue) > BigInt(0);
  return (
    <Panel id="outstanding-title" title={t.title} subtitle={t.subtitle} action={{ href: "/dashboard/payments", label: t.viewAll }}>
      {data.shopsOwing === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-accent/40 p-3">
              <dt className="text-xs text-muted">{t.due}</dt>
              <dd className="text-2xl font-semibold">{money(data.totalDue)}</dd>
              <dd className="text-xs text-muted">{plural(data.shopsOwing, t.owingOne, t.owing)}</dd>
            </div>
            <div className={`rounded-2xl p-3 ${hasOverdue ? "bg-red-50" : "bg-accent/40"}`}>
              <dt className="text-xs text-muted">{t.overdue}</dt>
              <dd className={`text-2xl font-semibold ${hasOverdue ? "text-red-700" : ""}`}>{money(data.overdue)}</dd>
              <dd className="text-xs text-muted">{fill(t.overdueHint, { days: CREDIT_DAYS })}</dd>
            </div>
          </dl>
          <ul className="flex flex-col divide-y divide-foreground/10">
            {data.top.map((s) => (
              <li key={s.shopId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  {Number(s.overdue) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                      <Icon name="alert" className="h-3 w-3" />
                      {fill(t.overdueTag, { amount: money(s.overdue) })}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{money(s.balance)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicles and employees                                             */
/* ------------------------------------------------------------------ */

export function VehiclesPanel({ d, items }: { d: D; items: VehicleActivity[] }) {
  const t = d.home.vehicles;
  const on = items.filter((v) => v.onRoad).length;
  return (
    <Panel
      id="vehicles-panel-title"
      title={t.title}
      subtitle={items.length ? fill(t.summary, { on, idle: items.length - on }) : undefined}
      action={{ href: "/dashboard/vehicles", label: d.nav.vehicles }}
    >
      {items.length === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {items.slice(0, 6).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${v.onRoad ? "bg-sky-100 text-sky-900" : "bg-accent/60 text-muted"}`}>
                  <Icon name="truck" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{formatVehicleNumber(v.number)}</span>
                  <span className="block text-xs text-muted">
                    {fill(t.today, { n: v.plannedToday })} · {fill(t.delivered30, { n: v.delivered30 })}
                  </span>
                </span>
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${v.onRoad ? "bg-sky-100 text-sky-900" : "bg-foreground/10 text-muted"}`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${v.onRoad ? "bg-sky-600" : "bg-foreground/30"}`} />
                {v.onRoad ? t.onRoad : t.idle}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function EmployeesPanel({ d, items, locale }: { d: D; items: EmployeeActivity[]; locale: string }) {
  const t = d.home.employees;
  const money = moneyFormatter(locale);
  return (
    <Panel id="employees-panel-title" title={t.title} subtitle={t.subtitle} action={{ href: "/dashboard/employees", label: d.nav.employees }}>
      {items.length === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {items.slice(0, 6).map((e) => (
            <li key={e.userId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/70 text-sm font-semibold text-brand">
                  {e.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block text-xs text-muted">
                    {fill(t.delivered, { n: e.delivered30 })} · {fill(t.collected, { amount: money(e.collected30) })}
                    {e.openToday > 0 && ` · ${fill(t.open, { n: e.openToday })}`}
                  </span>
                </span>
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${e.outNow ? "bg-sky-100 text-sky-900" : "bg-foreground/10 text-muted"}`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${e.outNow ? "bg-sky-600" : "bg-foreground/30"}`} />
                {e.outNow ? t.out : t.notOut}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Low stock                                                          */
/* ------------------------------------------------------------------ */

export function LowStockPanel({ d, data, showStore }: { d: D; data: { count: number; items: LowStockRow[] }; showStore: boolean }) {
  const t = d.home.lowStock;
  return (
    <Panel
      id="low-stock-title"
      title={t.title}
      subtitle={data.count > 0 ? plural(data.count, t.countOne, t.count) : undefined}
      action={{ href: "/dashboard/stock", label: t.viewAll }}
    >
      {data.count === 0 ? (
        <Empty>{t.empty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {data.items.map((r) => {
            const out = r.quantity <= 0;
            const unit = r.unit ? ` ${d.products.units[r.unit].toLowerCase()}` : "";
            return (
              <li key={`${r.productId}-${r.storeName}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {showStore && `${r.storeName} · `}
                    {fill(t.alertAt, { n: r.lowStockAt })}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${out ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                >
                  {out ? t.out : `${fill(t.left, { n: r.quantity })}${unit}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
