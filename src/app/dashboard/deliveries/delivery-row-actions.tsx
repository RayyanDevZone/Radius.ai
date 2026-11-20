"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { deleteDelivery, setDeliveryStatus } from "@/lib/delivery-actions";
import { canMoveTo, type DeliveryStatus } from "@/lib/deliveries";
import { fill } from "@/lib/format";
import { cleanMoney, moneyFormatter } from "@/lib/money";
import { PAYMENT_METHODS, isPositiveMoney, type PaymentMethod } from "@/lib/payments";
import { inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormDialog, FormRow, PillRadios } from "../_components/form-dialog";
import { RowActions, type RowMenuItem } from "../_components/row-actions";
import { Icon } from "../_components/section";
import { DeliveryDialog, useDeliveryForm, type DeliveryFormValues } from "./delivery-dialog";

type T = Dictionary["dashboard"]["deliveries"];
type Target = "out_for_delivery" | "delivered" | "cancelled";

/**
 * ⋮ menu for one delivery: the next status steps, plus Edit (pending only)
 * and Delete (pending or cancelled) for owners. Employees get only the
 * forward steps on their own deliveries; the server checks all of this.
 */
export function DeliveryRowActions({
  t,
  labels,
  methods,
  locale,
  role,
  delivery,
  edit,
}: {
  t: T;
  labels: Dictionary["dashboard"]["rowActions"];
  methods: Dictionary["dashboard"]["payments"]["methods"];
  locale: string;
  role: "owner" | "employee";
  delivery: { id: string; number: number; status: DeliveryStatus; shopName: string; total: string };
  /** Prefill for the Edit popup (pending deliveries). Choices come from DeliveryFormProvider. */
  edit?: DeliveryFormValues;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const form = useDeliveryForm();
  const name = `#${delivery.number} · ${delivery.shopName}`;

  const step = (to: Target, key: string, label: string, icon: React.ReactNode, danger?: boolean): RowMenuItem[] =>
    canMoveTo(delivery.status, to, role) ? [{ key, label, icon, danger, onSelect: () => setTarget(to) }] : [];

  const items = [
    ...step("out_for_delivery", "out", t.actions.out, truckIcon),
    ...step("delivered", "delivered", t.actions.delivered, checkIcon),
    ...step("cancelled", "cancel", t.actions.cancel, banIcon, true),
  ];

  const isOwner = role === "owner";
  const canEdit = isOwner && delivery.status === "pending" && edit && form;
  const canDelete = isOwner && (delivery.status === "pending" || delivery.status === "cancelled");
  if (items.length === 0 && !canEdit && !canDelete) return null;

  return (
    <>
      <RowActions
        labels={labels}
        manage={t.manage}
        name={name}
        extraItems={items}
        onDelete={canDelete ? () => deleteDelivery(delivery.id) : undefined}
        renderEdit={
          canEdit
            ? (close) => (
                <DeliveryDialog
                  t={t}
                  locale={locale}
                  options={form.options}
                  storeName={form.storeName}
                  today={form.today}
                  edit={{ id: delivery.id, values: edit }}
                  onClose={close}
                />
              )
            : undefined
        }
      />
      {target && (
        <StatusDialog
          t={t}
          methods={methods}
          locale={locale}
          to={target}
          name={name}
          id={delivery.id}
          total={delivery.total}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}

function StatusDialog({
  t,
  methods,
  locale,
  to,
  name,
  id,
  total,
  onClose,
}: {
  t: T;
  methods: Dictionary["dashboard"]["payments"]["methods"];
  locale: string;
  to: Target;
  name: string;
  id: string;
  total: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const s = t.status;
  const money = moneyFormatter(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collect, setCollect] = useState(false);
  const [amount, setAmount] = useState(total.replace(/\.00$/, ""));
  const [method, setMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const copy =
    to === "delivered"
      ? { title: s.deliveredTitle, body: fill(s.deliveredBody, { name, amount: money(total) }), icon: <Icon name="check" className="h-6 w-6" /> }
      : to === "cancelled"
        ? { title: s.cancelTitle, body: fill(s.cancelBody, { name }), icon: banIconLarge }
        : { title: s.outTitle, body: fill(s.outBody, { name }), icon: <Icon name="truck" className="h-6 w-6" /> };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const paid = collect ? { amount: cleanMoney(amount), method } : null;
    if (paid && !isPositiveMoney(paid.amount)) {
      setError(s.errors.invalid_payment);
      return;
    }
    setPending(true);
    try {
      const result = await setDeliveryStatus(id, to, paid);
      if (result.ok) {
        dialogRef.current?.close();
        startTransition(() => router.refresh());
      } else {
        setError(s.errors[result.error]);
      }
    } catch {
      setError(s.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      dialogRef={dialogRef}
      testId="delivery-status-dialog"
      size="sm"
      title={copy.title}
      subtitle={copy.body}
      icon={copy.icon}
      danger={to === "cancelled"}
      pending={pending}
      error={error}
      submitLabel={to === "cancelled" ? t.actions.cancel : s.confirm}
      pendingLabel={s.pending}
      cancelLabel={s.back}
      closeLabel={t.form.close}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {to === "delivered" && (
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-accent-strong/60 bg-white/60 px-4 py-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={collect}
              onChange={(e) => setCollect(e.target.checked)}
              data-testid="collect-payment"
              className="h-5 w-5 accent-[var(--foreground)]"
            />
            {s.collect}
          </label>
          {collect && (
            <>
              <FormRow id={`${uid}-amount`} label={s.amount} required>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                    ₹
                  </span>
                  <input
                    id={`${uid}-amount`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`${inputClass} pl-9 tabular-nums`}
                  />
                </div>
              </FormRow>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{s.method}</span>
                <PillRadios
                  name={`${uid}-method`}
                  label={s.method}
                  value={method}
                  onChange={setMethod}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: methods[m] }))}
                />
              </div>
            </>
          )}
        </div>
      )}
    </FormDialog>
  );
}

const svg = (d: string, cls = "h-4 w-4 shrink-0") => (
  <svg aria-hidden viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const truckIcon = svg("M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z");
const checkIcon = svg("M5 12.5l4.5 4.5L19 7.5");
const banPath = "M12 21a9 9 0 100-18 9 9 0 000 18zM5.7 5.7l12.6 12.6";
const banIcon = svg(banPath);
const banIconLarge = svg(banPath, "h-6 w-6");
