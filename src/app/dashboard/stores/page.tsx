import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { getStoreSelection } from "@/lib/selected-store";
import { sortAlphabetically } from "@/lib/sort";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { SearchableGrid } from "../_components/searchable-list";

async function StoresContent() {
  // Tenant and role come from the session (getContext()).
  const [ctx, { stores, selected }, { t }] = await Promise.all([getContext(), getStoreSelection(), getI18n()]);
  const d = t.dashboard;

  return (
    <section aria-labelledby="stores-title" className="flex flex-col gap-5">
      <SectionHeader
        id="stores-title"
        title={d.stores.title}
        count={stores.length}
        countLabel={d.stores}
        addLabel={d.stores.add}
        comingSoon={d.comingSoon}
        canAdd={ctx.role === "owner"}
      />

      {stores.length === 0 ? (
        <EmptyState title={d.stores.empty} icon={<Icon name="store" className="h-7 w-7" />} />
      ) : (
        <SearchableGrid
          testId="store-list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          labels={{ ...d.search, placeholder: d.stores.search }}
          items={sortAlphabetically(stores, (s) => s.name).map((s) => ({
            id: s.id,
            search: [s.name, s.address ?? ""].join(" "),
            node: (
              <li
                aria-current={s.id === selected?.id ? "true" : undefined}
                className="flex flex-col gap-3 rounded-2xl border border-accent-strong/60 bg-white/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md aria-[current=true]:border-foreground aria-[current=true]:ring-2 aria-[current=true]:ring-accent-strong/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/70 text-brand">
                    <Icon name="store" />
                  </span>
                  {s.id === selected?.id && (
                    <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background" data-testid="store-selected-badge">
                      {d.storePicker.selected}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{s.name}</p>
                  {s.address && <p className="mt-1 text-sm leading-6 text-muted">{s.address}</p>}
                </div>
              </li>
            ),
          }))}
        />
      )}
    </section>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <StoresContent />
    </Suspense>
  );
}
