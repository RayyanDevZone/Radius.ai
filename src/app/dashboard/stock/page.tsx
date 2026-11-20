import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { countFormatter, fill } from "@/lib/format";
import { getStoreSelection } from "@/lib/selected-store";
import { listStock, type StockRow } from "@/lib/stock-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { SearchableTable } from "../_components/searchable-list";
import { StockRowActions } from "./stock-dialog";

type Level = "ok" | "low" | "out" | "untracked";

const levelOf = (r: StockRow): Level => (!r.tracked ? "untracked" : r.quantity <= 0 ? "out" : r.quantity <= r.lowStockAt ? "low" : "ok");

const LEVEL_STYLE: Record<Level, string> = {
  ok: "bg-accent text-foreground",
  low: "bg-amber-100 text-amber-900",
  out: "bg-red-100 text-red-800",
  untracked: "bg-foreground/10 text-muted",
};

async function StockContent() {
  // Tenant, role and store come from the session.
  const [ctx, { selected }, { locale, t }] = await Promise.all([getContext(), getStoreSelection(), getI18n()]);
  const d = t.dashboard;
  const s = d.stock;
  const isOwner = ctx.role === "owner";
  const nf = countFormatter(locale);

  if (!selected) {
    return (
      <section aria-labelledby="stock-title" className="flex flex-col gap-5">
        <h1 id="stock-title" className="text-3xl sm:text-4xl">
          {s.title}
        </h1>
        <EmptyState title={d.deliveries.noStore} hint={d.deliveries.noStoreHint} icon={<Icon name="store" className="h-7 w-7" />} />
      </section>
    );
  }

  const rows = await listStock(selected.id);

  return (
    <section aria-labelledby="stock-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <SectionHeader
          id="stock-title"
          title={s.title}
          count={rows.length}
          countLabel={s}
          addLabel={s.update}
          comingSoon={d.comingSoon}
          canAdd={false}
        />
        <p className="text-sm text-muted">{fill(s.intro, { store: selected.name })}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={s.empty} hint={s.emptyHint} icon={<Icon name="layers" className="h-7 w-7" />} />
      ) : (
        <SearchableTable
          testId="stock-list"
          labels={{ ...d.search, placeholder: s.search }}
          columns={[
            { label: s.columns.product },
            { label: s.columns.quantity, className: "whitespace-nowrap text-right" },
            { label: s.columns.alertAt, className: "whitespace-nowrap text-right" },
            { label: s.columns.status },
            ...(isOwner ? [{ label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" }] : []),
          ]}
          rows={rows.map((r) => {
            const level = levelOf(r);
            const unit = r.unit ? d.products.units[r.unit].toLowerCase() : "";
            return {
              id: r.productId,
              search: [r.name, s.statuses[level]].join(" "),
              cells: [
                <span key="n" className="flex items-center gap-3 font-medium">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-brand">
                    <Icon name="box" className="h-4 w-4" />
                  </span>
                  {r.name}
                </span>,
                <span key="q" className={`font-medium tabular-nums ${r.quantity < 0 ? "text-red-700" : ""}`}>
                  {nf.format(r.quantity)}
                  {unit && <span className="font-normal text-muted"> {unit}</span>}
                </span>,
                <span key="l" className="tabular-nums text-muted">
                  {nf.format(r.lowStockAt)}
                </span>,
                <span key="st" className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLE[level]}`}>
                  {s.statuses[level]}
                </span>,
                ...(isOwner
                  ? [
                      <StockRowActions
                        key="a"
                        t={s}
                        labels={d.rowActions}
                        manage={d.products.manage}
                        storeName={selected.name}
                        item={{ productId: r.productId, name: r.name, quantity: r.quantity, lowStockAt: r.lowStockAt }}
                      />,
                    ]
                  : []),
              ],
            };
          })}
        />
      )}
    </section>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <StockContent />
    </Suspense>
  );
}
