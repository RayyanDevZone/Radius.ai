import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth-context";
import { listEmployees } from "@/lib/employees-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";

// Owner-only: the list shows employees' names and emails.
async function EmployeesContent() {
  const ctx = await getPageContext();
  if (ctx.role !== "owner") redirect("/dashboard");

  const [employees, { t }] = await Promise.all([listEmployees(), getI18n()]);
  const d = t.dashboard;

  return (
    <section aria-labelledby="employees-title" className="flex flex-col gap-5">
      <SectionHeader
        id="employees-title"
        title={d.employees.title}
        count={employees.length}
        countLabel={d.employees}
        addLabel={d.employees.add}
        comingSoon={d.comingSoon}
        canAdd
      />

      {employees.length === 0 ? (
        <EmptyState title={d.employees.empty} hint={d.employees.emptyHint} icon={<Icon name="users" className="h-7 w-7" />} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="employee-list">
          {employees.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-4 rounded-2xl border border-accent-strong/60 bg-white/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/70 text-brand">
                <Icon name="users" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{e.name}</p>
                <p className="truncate text-sm text-muted">{e.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-brand">{d.roles.employee}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <EmployeesContent />
    </Suspense>
  );
}
