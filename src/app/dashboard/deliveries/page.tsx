import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { businessToday } from "@/lib/deliveries";
import { listDeliveries } from "@/lib/deliveries-data";
import { getDeliveryFormOptions } from "@/lib/delivery-form-data";
import { fill, formatDay, plural } from "@/lib/format";
import { moneyFormatter } from "@/lib/money";
import { getStoreSelection } from "@/lib/selected-store";
import { formatVehicleNumber } from "@/lib/vehicles";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { SearchableTable } from "../_components/searchable-list";
import { DeliveryDialog, DeliveryFormProvider } from "./delivery-dialog";
import { DeliveryRowActions } from "./delivery-row-actions";
import { StatusBadge } from "./status-badge";

async function DeliveriesContent() {
  // Tenant, role and store come from the session (getContext / getStoreSelection).
  const [ctx, { selected }, { locale, t }] = await Promise.all([getContext(), getStoreSelection(), getI18n()]);
  const d = t.dashboard;
  const dl = d.deliveries;
  const isOwner = ctx.role === "owner";

  if (!selected) {
    return (
      <section aria-labelledby="deliveries-title" className="flex flex-col gap-5">
        <h1 id="deliveries-title" className="text-3xl sm:text-4xl">
          {dl.title}
        </h1>
        <EmptyState title={dl.noStore} hint={dl.noStoreHint} icon={<Icon name="store" className="h-7 w-7" />} />
      </section>
    );
  }

  const [deliveries, options] = await Promise.all([listDeliveries(selected.id), isOwner ? getDeliveryFormOptions() : null]);
  const today = businessToday();
  const money = moneyFormatter(locale);

  return (
    <section aria-labelledby="deliveries-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <SectionHeader
          id="deliveries-title"
          title={dl.title}
          count={deliveries.length}
          countLabel={dl}
          addLabel={dl.add}
          comingSoon={d.comingSoon}
          canAdd={isOwner}
          addAction={options && <DeliveryDialog t={dl} locale={locale} options={options} storeName={selected.name} today={today} />}
        />
        <p className="text-sm text-muted">{fill(dl.from, { store: selected.name })}</p>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title={dl.empty}
          hint={isOwner ? dl.emptyHint : dl.emptyHintEmployee}
          icon={<Icon name="route" className="h-7 w-7" />}
        />
      ) : (
        <DeliveryFormProvider value={options && { options, storeName: selected.name, today }}>
        <SearchableTable
          testId="delivery-list"
          labels={{ ...d.search, placeholder: dl.search }}
          columns={[
            { label: dl.columns.delivery, className: "whitespace-nowrap" },
            { label: dl.columns.shop, className: "min-w-[10rem]" },
            { label: dl.columns.items, className: "min-w-[12rem]" },
            { label: dl.columns.assigned, className: "min-w-[9rem]" },
            { label: dl.columns.total, className: "whitespace-nowrap text-right" },
            { label: dl.columns.status },
            { label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" },
          ]}
          rows={deliveries.map((row) => {
            const late = row.scheduledFor < today && (row.status === "pending" || row.status === "out_for_delivery");
            const itemSummary = row.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ");
            return {
              id: row.id,
              search: [
                `#${row.number}`,
                row.shopName,
                itemSummary,
                row.vehicleNumber ?? "",
                row.assigneeName ?? "",
                dl.statuses[row.status],
                row.scheduledFor,
              ].join(" "),
              cells: [
                <span key="n" className="flex flex-col">
                  <span className="font-medium tabular-nums">#{row.number}</span>
                  <span className={`whitespace-nowrap text-xs ${late ? "font-medium text-red-700" : "text-muted"}`}>
                    {formatDay(locale, row.scheduledFor, today)}
                    {late && ` · ${d.home.myDay.late}`}
                  </span>
                </span>,
                <span key="s" className="font-medium">
                  {row.shopName}
                </span>,
                <span key="i" className="flex flex-col">
                  <span>{plural(row.items.length, dl.itemsCountOne, dl.itemsCount)}</span>
                  <span className="line-clamp-1 text-xs text-muted" title={itemSummary}>
                    {itemSummary}
                  </span>
                </span>,
                <span key="a" className="flex flex-col text-sm">
                  {row.vehicleNumber || row.assigneeName ? (
                    <>
                      {row.vehicleNumber && <span className="whitespace-nowrap">{formatVehicleNumber(row.vehicleNumber)}</span>}
                      {row.assigneeName && <span className="text-muted">{row.assigneeName}</span>}
                    </>
                  ) : (
                    <span className="text-muted">{dl.unassigned}</span>
                  )}
                </span>,
                <span key="t" className="flex flex-col items-end">
                  <span className="font-medium tabular-nums">{money(row.total)}</span>
                  {Number(row.collected) > 0 && (
                    <span className="whitespace-nowrap text-xs text-brand">{fill(dl.collected, { amount: money(row.collected) })}</span>
                  )}
                </span>,
                <StatusBadge key="st" status={row.status} label={dl.statuses[row.status]} />,
                <DeliveryRowActions
                  key="ra"
                  t={dl}
                  labels={d.rowActions}
                  methods={d.payments.methods}
                  locale={locale}
                  role={ctx.role}
                  delivery={{ id: row.id, number: row.number, status: row.status, shopName: row.shopName, total: row.total }}
                  edit={
                    isOwner && row.status === "pending"
                      ? {
                          shopId: row.shopId,
                          scheduledFor: row.scheduledFor,
                          vehicleId: row.vehicleId,
                          assignedTo: row.assignedTo,
                          notes: row.notes,
                          items: row.items
                            .filter((i): i is typeof i & { productId: string } => i.productId !== null)
                            .map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
                        }
                      : undefined
                  }
                />,
              ],
            };
          })}
        />
        </DeliveryFormProvider>
      )}
    </section>
  );
}

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <DeliveriesContent />
    </Suspense>
  );
}
