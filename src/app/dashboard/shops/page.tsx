import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";

// Empty state for now: there is no shops table yet. When it exists, load the
// rows here with the tenant from getContext() (see CONVENTIONS.md).
async function ShopsContent() {
  const [ctx, { t }] = await Promise.all([getContext(), getI18n()]);
  const d = t.dashboard;
  return (
    <section aria-labelledby="shops-title" className="flex flex-col gap-5">
      <SectionHeader
        id="shops-title"
        title={d.shops.title}
        count={0}
        countLabel={d.shops}
        addLabel={d.shops.add}
        comingSoon={d.comingSoon}
        canAdd={ctx.role === "owner"}
      />
      <EmptyState title={d.shops.empty} hint={d.shops.emptyHint} icon={<Icon name="shop" className="h-7 w-7" />} />
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
