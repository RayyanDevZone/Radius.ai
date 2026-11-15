import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";

// Empty state for now: there is no products table yet. When it exists, load
// the rows here with the tenant from getContext() (see CONVENTIONS.md).
async function ProductsContent() {
  const [ctx, { t }] = await Promise.all([getContext(), getI18n()]);
  const d = t.dashboard;
  return (
    <section aria-labelledby="products-title" className="flex flex-col gap-5">
      <SectionHeader
        id="products-title"
        title={d.products.title}
        count={0}
        countLabel={d.products}
        addLabel={d.products.add}
        comingSoon={d.comingSoon}
        canAdd={ctx.role === "owner"}
      />
      <EmptyState title={d.products.empty} hint={d.products.emptyHint} icon={<Icon name="box" className="h-7 w-7" />} />
    </section>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
