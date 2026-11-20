import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth-context";
import { CREDIT_DAYS, businessToday } from "@/lib/deliveries";
import { fill, formatDay } from "@/lib/format";
import { listPayments, listShopBalances } from "@/lib/ledger-data";
import { moneyFormatter, sumMoney } from "@/lib/money";
import { listShops } from "@/lib/shops-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { SearchableTable } from "../_components/searchable-list";
import { PaymentDialog } from "./payment-dialog";
import { PaymentRowActions } from "./payment-row-actions";

async function PaymentsContent() {
  // Owner-only page: business money. The tenant comes from the session.
  const ctx = await getContext();
  if (ctx.role !== "owner") redirect("/dashboard");

  const [{ locale, t }, balances, payments, shops] = await Promise.all([getI18n(), listShopBalances(), listPayments(), listShops()]);
  const d = t.dashboard;
  const p = d.payments;
  const money = moneyFormatter(locale);
  const today = businessToday();

  const owing = balances.filter((b) => Number(b.balance) > 0);
  const totalDue = sumMoney(owing.map((b) => b.balance));
  const overdue = sumMoney(balances.map((b) => b.overdue));
  const balanceOf = new Map(balances.map((b) => [b.shopId, b.balance]));

  return (
    <section aria-labelledby="payments-title" className="flex flex-col gap-8">
      <SectionHeader
        id="payments-title"
        title={p.title}
        count={payments.length}
        countLabel={p}
        addLabel={p.add}
        comingSoon={d.comingSoon}
        canAdd
        addAction={
          <PaymentDialog
            t={p}
            locale={locale}
            today={today}
            shops={shops.map((s) => ({ id: s.id, name: s.firmName, balance: balanceOf.get(s.id) ?? null }))}
          />
        }
      />

      {/* Summary */}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label={p.summary.due} value={money(totalDue)} />
        <SummaryTile
          label={p.summary.overdue}
          value={money(overdue)}
          hint={fill(p.summary.overdueHint, { days: CREDIT_DAYS })}
          warn={Number(overdue) > 0}
        />
        <SummaryTile label={p.summary.owing} value={String(owing.length)} />
      </dl>

      {/* Shop balances */}
      <section aria-labelledby="balances-title" className="flex flex-col gap-3">
        <div>
          <h2 id="balances-title" className="text-2xl">
            {p.balancesTitle}
          </h2>
          <p className="text-sm text-muted">{p.balancesHint}</p>
        </div>
        {balances.length === 0 ? (
          <EmptyState title={p.balancesEmpty} icon={<Icon name="shop" className="h-7 w-7" />} />
        ) : (
          <SearchableTable
            testId="balance-list"
            labels={{ ...d.search, placeholder: p.searchBalances }}
            columns={[
              { label: p.columns.shop, className: "min-w-[10rem]" },
              { label: p.columns.billed, className: "whitespace-nowrap text-right" },
              { label: p.columns.paid, className: "whitespace-nowrap text-right" },
              { label: p.columns.balance, className: "whitespace-nowrap text-right" },
              { label: p.columns.overdue, className: "whitespace-nowrap text-right" },
              { label: p.columns.lastPayment, className: "whitespace-nowrap" },
              { label: d.rowActions.actions, srOnly: true, className: "py-1.5 pr-2 text-right" },
            ]}
            rows={balances.map((b) => {
              const bal = Number(b.balance);
              return {
                id: b.shopId,
                search: [b.firmName, b.mobile].join(" "),
                cells: [
                  <span key="s" className="flex flex-col">
                    <span className="font-medium">{b.firmName}</span>
                    <a href={`tel:${b.mobile}`} className="text-xs text-muted underline-offset-2 hover:underline">
                      {b.mobile}
                    </a>
                  </span>,
                  <span key="b" className="tabular-nums">
                    {money(b.billed)}
                  </span>,
                  <span key="p" className="tabular-nums">
                    {money(b.paid)}
                  </span>,
                  bal > 0 ? (
                    <span key="bal" className="font-semibold tabular-nums">
                      {money(b.balance)}
                    </span>
                  ) : (
                    <span key="bal" className="rounded-full bg-accent/70 px-2.5 py-0.5 text-xs font-medium">
                      {bal < 0 ? `${p.advance} ${money(-bal)}` : p.settled}
                    </span>
                  ),
                  Number(b.overdue) > 0 ? (
                    <span key="o" className="font-medium tabular-nums text-red-700">
                      {money(b.overdue)}
                    </span>
                  ) : (
                    <span key="o" className="text-muted">
                      —
                    </span>
                  ),
                  b.lastPaymentOn ? formatDay(locale, b.lastPaymentOn, today) : <span className="text-muted">—</span>,
                  <PaymentDialog key="r" t={p} locale={locale} today={today} shop={{ id: b.shopId, name: b.firmName, balance: b.balance }} />,
                ],
              };
            })}
          />
        )}
      </section>

      {/* Recent payments */}
      <section aria-labelledby="recent-payments-title" className="flex flex-col gap-3">
        <h2 id="recent-payments-title" className="text-2xl">
          {p.recentTitle}
        </h2>
        {payments.length === 0 ? (
          <EmptyState title={p.empty} hint={p.emptyHint} icon={<Icon name="wallet" className="h-7 w-7" />} />
        ) : (
          <SearchableTable
            testId="payment-list"
            labels={{ ...d.search, placeholder: p.search }}
            columns={[
              { label: p.columns.date, className: "whitespace-nowrap" },
              { label: p.columns.shop, className: "min-w-[10rem]" },
              { label: p.columns.amount, className: "whitespace-nowrap text-right" },
              { label: p.columns.method },
              { label: p.columns.receivedBy },
              { label: p.columns.delivery, className: "whitespace-nowrap" },
              { label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" },
            ]}
            rows={payments.map((row) => ({
              id: row.id,
              search: [row.shopName, row.amount, p.methods[row.method], row.receivedByName ?? "", row.note ?? "", row.deliveryNumber ? `#${row.deliveryNumber}` : ""].join(" "),
              cells: [
                <span key="d" className="whitespace-nowrap">
                  {formatDay(locale, row.receivedOn, today)}
                </span>,
                <span key="s" className="flex flex-col">
                  <span className="font-medium">{row.shopName}</span>
                  {row.note && <span className="text-xs text-muted">{row.note}</span>}
                </span>,
                <span key="a" className="font-medium tabular-nums">
                  {money(row.amount)}
                </span>,
                <span key="m" className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-medium text-muted">
                  {p.methods[row.method]}
                </span>,
                row.receivedByName ?? <span className="text-muted">—</span>,
                row.deliveryNumber ? <span className="tabular-nums">#{row.deliveryNumber}</span> : <span className="text-muted">—</span>,
                <PaymentRowActions
                  key="ra"
                  manage={p.manage}
                  labels={d.rowActions}
                  id={row.id}
                  name={`${money(row.amount)} · ${row.shopName}`}
                />,
              ],
            }))}
          />
        )}
      </section>
    </section>
  );
}

function SummaryTile({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-accent-strong/60 bg-white/70 p-5 shadow-sm">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-3xl font-semibold ${warn ? "text-red-700" : ""}`}>{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <PaymentsContent />
    </Suspense>
  );
}
