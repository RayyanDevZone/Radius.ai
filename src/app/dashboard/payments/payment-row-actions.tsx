"use client";

import { deletePayment } from "@/lib/payment-actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { RowActions } from "../_components/row-actions";

/** ⋮ menu for one payment: Delete (for payments entered by mistake). */
export function PaymentRowActions({
  manage,
  labels,
  id,
  name,
}: {
  manage: Dictionary["dashboard"]["payments"]["manage"];
  labels: Dictionary["dashboard"]["rowActions"];
  id: string;
  name: string;
}) {
  return <RowActions labels={labels} manage={manage} name={name} onDelete={() => deletePayment(id)} />;
}
