import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { listShops } from "@/lib/shops-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { ImportDialog } from "../_components/import-button";
import { SearchableTable } from "../_components/searchable-list";
import { AddShopDialog } from "./add-shop-dialog";
import { ShopRowActions } from "./shop-row-actions";

async function ShopsContent() {
  // Tenant and role come from the session (getContext()).
  const [ctx, shops, { t }] = await Promise.all([getContext(), listShops(), getI18n()]);
  const d = t.dashboard;
  const isOwner = ctx.role === "owner";

  return (
    <section aria-labelledby="shops-title" className="flex flex-col gap-5">
      <SectionHeader
        id="shops-title"
        title={d.shops.title}
        count={shops.length}
        countLabel={d.shops}
        addLabel={d.shops.add}
        comingSoon={d.comingSoon}
        importAction={<ImportDialog kind="shops" label={d.importFile} t={d.importer} errors={d.shops.form.errors} />}
        canAdd={isOwner}
        addAction={<AddShopDialog t={d.shops} />}
      />

      {shops.length === 0 ? (
        <EmptyState title={d.shops.empty} hint={d.shops.emptyHint} icon={<Icon name="shop" className="h-7 w-7" />} />
      ) : (
        <SearchableTable
          testId="shop-list"
          labels={{ ...d.search, placeholder: d.shops.search }}
          columns={[
            { label: d.shops.columns.firm },
            { label: d.shops.columns.address, className: "min-w-[14rem] text-muted" },
            { label: d.shops.columns.owner },
            { label: d.shops.columns.mobile, className: "whitespace-nowrap" },
            ...(isOwner ? [{ label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" }] : []),
          ]}
          rows={shops.map((s) => ({
            id: s.id,
            search: [s.firmName, s.firmAddress, s.ownerName, s.mobile].join(" "),
            cells: [
              <span key="f" className="flex items-center gap-3 font-medium">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-brand">
                  <Icon name="shop" className="h-4 w-4" />
                </span>
                {s.firmName}
              </span>,
              s.firmAddress,
              s.ownerName,
              <a key="m" href={`tel:${s.mobile}`} className="font-medium underline-offset-2 hover:underline">
                {s.mobile}
              </a>,
              ...(isOwner ? [<ShopRowActions key="a" t={d.shops} labels={d.rowActions} shop={s} />] : []),
            ],
          }))}
        />
      )}
    </section>
  );
}

export default function ShopsPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <ShopsContent />
    </Suspense>
  );
}
