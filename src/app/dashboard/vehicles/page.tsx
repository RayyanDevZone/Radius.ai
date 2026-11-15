import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";

// Empty state for now: there is no vehicles table yet. When it exists, load
// the rows here with the tenant from getContext() (see CONVENTIONS.md).
async function VehiclesContent() {
  const [ctx, { t }] = await Promise.all([getContext(), getI18n()]);
  const d = t.dashboard;
  return (
    <section aria-labelledby="vehicles-title" className="flex flex-col gap-5">
      <SectionHeader
        id="vehicles-title"
        title={d.vehicles.title}
        count={0}
        countLabel={d.vehicles}
        addLabel={d.vehicles.add}
        comingSoon={d.comingSoon}
        canAdd={ctx.role === "owner"}
      />
      <EmptyState title={d.vehicles.empty} hint={d.vehicles.emptyHint} icon={<Icon name="truck" className="h-7 w-7" />} />
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
