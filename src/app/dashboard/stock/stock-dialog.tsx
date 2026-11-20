"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { setStock } from "@/lib/stock-actions";
import { fill } from "@/lib/format";
import { normalizeStockInput, validateStockInput, type StockField } from "@/lib/stock";
import { inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormDialog, FormRow } from "../_components/form-dialog";
import { RowActions } from "../_components/row-actions";
import { Icon } from "../_components/section";

type T = Dictionary["dashboard"]["stock"];

/** ⋮ menu with "Update stock" for one product row. Owners only; the server checks too. */
export function StockRowActions({
  t,
  labels,
  manage,
  storeName,
  item,
}: {
  t: T;
  labels: Dictionary["dashboard"]["rowActions"];
  manage: Dictionary["dashboard"]["products"]["manage"];
  storeName: string;
  item: { productId: string; name: string; quantity: number; lowStockAt: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowActions
        labels={labels}
        manage={manage}
        name={item.name}
        extraItems={[{ key: "update", label: t.update, icon: <Icon name="layers" className="h-4 w-4" />, onSelect: () => setOpen(true) }]}
      />
      {open && <StockDialog t={t} storeName={storeName} item={item} onClose={() => setOpen(false)} />}
    </>
  );
}

function StockDialog({
  t,
  storeName,
  item,
  onClose,
}: {
  t: T;
  storeName: string;
  item: { productId: string; name: string; quantity: number; lowStockAt: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const f = t.form;
  const [quantity, setQuantity] = useState(String(Math.max(0, item.quantity)));
  const [lowStockAt, setLowStockAt] = useState(String(item.lowStockAt));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: StockField; message: string } | null>(null);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    const input = normalizeStockInput({ productId: item.productId, quantity, lowStockAt });
    const invalid = validateStockInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }
    setPending(true);
    try {
      const result = await setStock(input);
      if (result.ok) {
        dialogRef.current?.close();
        startTransition(() => router.refresh());
      } else if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: f.errors[result.field] });
      } else {
        setError(f.errors[result.error]);
      }
    } catch {
      setError(f.errors.failed);
    } finally {
      setPending(false);
    }
  }

  const errFor = (field: StockField) => (fieldError?.field === field ? fieldError.message : null);

  return (
    <FormDialog
      dialogRef={dialogRef}
      testId="stock-dialog"
      size="sm"
      title={f.title}
      subtitle={fill(f.subtitle, { name: item.name, store: storeName })}
      icon={<Icon name="layers" className="h-6 w-6" />}
      pending={pending}
      error={error}
      submitLabel={f.submit}
      pendingLabel={f.pending}
      cancelLabel={f.cancel}
      closeLabel={f.close}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <FormRow id={`${uid}-qty`} label={f.quantity} required hint={f.quantityHint} error={errFor("quantity")}>
        <input
          id={`${uid}-qty`}
          inputMode="numeric"
          autoComplete="off"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={errFor("quantity") ? true : undefined}
          className={`${inputClass} tabular-nums`}
        />
      </FormRow>
      <FormRow id={`${uid}-low`} label={f.lowStockAt} required hint={f.lowStockHint} error={errFor("lowStockAt")}>
        <input
          id={`${uid}-low`}
          inputMode="numeric"
          autoComplete="off"
          value={lowStockAt}
          onChange={(e) => setLowStockAt(e.target.value)}
          aria-invalid={errFor("lowStockAt") ? true : undefined}
          className={`${inputClass} tabular-nums`}
        />
      </FormRow>
    </FormDialog>
  );
}
