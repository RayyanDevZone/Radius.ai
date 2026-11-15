import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon } from "./_components/section";
import { SectionSkeleton } from "./_components/section-skeleton";

// Dashboard home: empty for now. Stores live at /dashboard/stores.
async function HomeContent() {
  const { t } = await getI18n();
  const d = t.dashboard;
  return (
    <section aria-labelledby="home-title" className="flex flex-col gap-5">
      <h1 id="home-title" className="text-3xl sm:text-4xl">
        {d.title}
      </h1>
      <EmptyState title={d.home.empty} hint={d.home.emptyHint} icon={<Icon name="grid" className="h-7 w-7" />} />
    </section>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
