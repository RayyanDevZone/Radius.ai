import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { listVehicles } from "@/lib/vehicles-data";
import { formatVehicleNumber } from "@/lib/vehicles";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { ImportDialog } from "../_components/import-button";
import { SearchableTable } from "../_components/searchable-list";
import { AddVehicleDialog } from "./add-vehicle-dialog";
import { VehicleRowActions } from "./vehicle-row-actions";
import { TYPE_ICONS } from "./vehicle-icons";

async function VehiclesContent() {
  // Tenant and role come from the session (getContext()); listVehicles() is tenant-scoped.
  const [ctx, vehicles, { t }] = await Promise.all([getContext(), listVehicles(), getI18n()]);
  const d = t.dashboard;
  const v = d.vehicles;
  const isOwner = ctx.role === "owner";

  return (
    <section aria-labelledby="vehicles-title" className="flex flex-col gap-5">
      <SectionHeader
        id="vehicles-title"
        title={v.title}
        count={vehicles.length}
        countLabel={v}
        addLabel={v.add}
        comingSoon={d.comingSoon}
        importAction={<ImportDialog kind="vehicles" label={d.importFile} t={d.importer} errors={v.form.errors} />}
        canAdd={isOwner}
        addAction={<AddVehicleDialog t={v} />}
      />

      {vehicles.length === 0 ? (
        <EmptyState title={v.empty} hint={v.emptyHint} icon={<Icon name="truck" className="h-7 w-7" />} />
      ) : (
        <SearchableTable
          testId="vehicle-list"
          labels={{ ...d.search, placeholder: v.search }}
          columns={[{ label: v.columns.number }, { label: v.columns.type }, ...(isOwner ? [{ label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" }] : [])]}
          rows={vehicles.map((row) => ({
            id: row.id,
            search: [row.number, v.types[row.type]].join(" "),
            cells: [
              <span key="n" className="inline-flex items-center rounded-lg border-2 border-foreground/80 bg-background px-2.5 py-0.5 font-semibold tracking-[0.12em] whitespace-nowrap">
                {formatVehicleNumber(row.number)}
              </span>,
              <span key="t" className="flex items-center gap-3 text-muted">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-brand [&>svg]:h-5 [&>svg]:w-5">
                  {TYPE_ICONS[row.type]}
                </span>
                {v.types[row.type]}
              </span>,
              ...(isOwner ? [<VehicleRowActions key="a" t={v} labels={d.rowActions} vehicle={row} />] : []),
            ],
          }))}
        />
      )}
    </section>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <VehiclesContent />
    </Suspense>
  );
}
