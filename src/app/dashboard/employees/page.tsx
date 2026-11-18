import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth-context";
import { listEmployees } from "@/lib/employees-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { ImportDialog } from "../_components/import-button";
import { SearchableTable } from "../_components/searchable-list";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EmployeeRowActions } from "./employee-row-actions";

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
        importAction={<ImportDialog kind="employees" label={d.importFile} t={d.importer} errors={d.employees.form.errors} />}
        canAdd
        addAction={<AddEmployeeDialog t={d.employees} />}
      />

      {employees.length === 0 ? (
        <EmptyState title={d.employees.empty} hint={d.employees.emptyHint} icon={<Icon name="users" className="h-7 w-7" />} />
      ) : (
        <SearchableTable
          testId="employee-list"
          labels={{ ...d.search, placeholder: d.employees.search }}
          columns={[
            { label: d.employees.columns.name },
            { label: d.employees.columns.contact, className: "whitespace-nowrap" },
            { label: d.employees.columns.designation },
            { label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" },
          ]}
          rows={employees.map((e) => ({
            id: e.id,
            search: [e.name, e.phone ?? "", e.email, e.designation ?? d.roles.employee].join(" "),
            cells: [
              <span key="n" className="flex items-center gap-3 font-medium">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/70 text-brand">
                  <Icon name="users" className="h-4 w-4" />
                </span>
                {e.name}
              </span>,
              e.phone ? (
                <a key="c" href={`tel:${e.phone}`} className="underline-offset-2 hover:underline">
                  {e.phone}
                </a>
              ) : (
                <span key="c" className="text-muted">{e.email}</span>
              ),
              <span key="d" className="text-xs uppercase tracking-[0.12em] text-brand">
                {e.designation ?? d.roles.employee}
              </span>,
              <EmployeeRowActions key="a" t={d.employees} labels={d.rowActions} employee={e} />,
            ],
          }))}
        />
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
