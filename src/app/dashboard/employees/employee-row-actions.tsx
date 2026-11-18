"use client";

import { deleteEmployee } from "@/lib/employee-actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { RowActions } from "../_components/row-actions";
import { AddEmployeeDialog } from "./add-employee-dialog";

/**
 * ⋮ menu for one employee row. `id` is the member id. Edit is offered only for
 * logins created in the app (`editable`); older email-only accounts can only
 * be removed from the business.
 */
export function EmployeeRowActions({
  t,
  labels,
  employee,
}: {
  t: Dictionary["dashboard"]["employees"];
  labels: Dictionary["dashboard"]["rowActions"];
  employee: { id: string; name: string; phone: string | null; designation: string | null; editable: boolean };
}) {
  const { id, name, phone, designation, editable } = employee;
  return (
    <RowActions
      labels={labels}
      manage={t.manage}
      name={name}
      onDelete={() => deleteEmployee(id)}
      renderEdit={
        editable
          ? (close) => (
              <AddEmployeeDialog t={t} edit={{ id, values: { name, phone: phone ?? "", designation: designation ?? "" } }} onClose={close} />
            )
          : undefined
      }
    />
  );
}
