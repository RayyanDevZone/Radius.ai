"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { recordPayment } from "@/lib/payment-actions";
import { fill } from "@/lib/format";
import { moneyFormatter } from "@/lib/money";
import {
  normalizePaymentInput,
  validatePaymentInput,
  PAYMENT_METHODS,
  PAYMENT_NOTE_MAX,
  type PaymentField,
  type PaymentMethod,
} from "@/lib/payments";
import { inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { AddRoundButton, FormDialog, FormRow, PillRadios, SelectInput } from "../_components/form-dialog";
import { Icon } from "../_components/section";

type T = Dictionary["dashboard"]["payments"];
export type PaymentShop = { id: string; name: string; balance: string | null };

/**
 * "Record payment" popup. With `shops`: a "+" button and a shop picker.
 * With `shop`: a small "Record payment" button for that shop's row.
 * Owners only; the server checks too.
 */
export function PaymentDialog({
  t,
  locale,
  today,
  shops,
  shop,
}: {
  t: T;
  locale: string;
  today: string;
  shops?: PaymentShop[];
  shop?: PaymentShop;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const f = t.form;
  const money = moneyFormatter(locale);

  const [shopId, setShopId] = useState(shop?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [receivedOn, setReceivedOn] = useState(today);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: PaymentField; message: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [mounted]);

  function open() {
    setShopId(shop?.id ?? "");
    setAmount(shop?.balance && Number(shop.balance) > 0 ? shop.balance.replace(/\.00$/, "") : "");
    setMethod("cash");
    setReceivedOn(today);
    setNote("");
    setError(null);
    setFieldError(null);
    if (mounted) dialogRef.current?.showModal();
    else setMounted(true);
  }

  const selectedShop = shop ?? shops?.find((s) => s.id === shopId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    const input = normalizePaymentInput({ shopId, amount, method, receivedOn, note });
    const invalid = validatePaymentInput(input, today);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }
    setPending(true);
    try {
      const result = await recordPayment(input);
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

  const errFor = (field: PaymentField) => (fieldError?.field === field ? fieldError.message : null);

  return (
    <>
      {shop ? (
        <button
          type="button"
          onClick={open}
          data-testid="record-payment-for-shop"
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-foreground/20 px-3 text-xs font-medium transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          <span aria-hidden>+</span> {t.add}
          <span className="sr-only">: {shop.name}</span>
        </button>
      ) : (
        <AddRoundButton label={t.add} onClick={open} testId="add-payment" />
      )}

      {mounted && (
        <FormDialog
          dialogRef={dialogRef}
          testId="payment-dialog"
          title={f.title}
          subtitle={shop ? shop.name : f.subtitle}
          icon={<Icon name="wallet" className="h-6 w-6" />}
          pending={pending}
          error={error ?? (shops && shops.length === 0 ? f.needShops : null)}
          submitLabel={f.submit}
          pendingLabel={f.pending}
          cancelLabel={f.cancel}
          closeLabel={f.close}
          onSubmit={onSubmit}
        >
          {!shop && (
            <FormRow
              id={`${uid}-shop`}
              label={f.shop}
              required
              error={errFor("shopId")}
              hint={selectedShop?.balance && Number(selectedShop.balance) > 0 ? fill(f.balance, { amount: money(selectedShop.balance) }) : undefined}
            >
              <SelectInput
                id={`${uid}-shop`}
                value={shopId}
                onChange={(e) => {
                  setShopId(e.target.value);
                  setFieldError(null);
                }}
                invalid={!!errFor("shopId")}
              >
                <option value="">{f.chooseShop}</option>
                {shops?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectInput>
            </FormRow>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormRow
              id={`${uid}-amount`}
              label={f.amount}
              required
              error={errFor("amount")}
              hint={shop?.balance && Number(shop.balance) > 0 ? fill(f.balance, { amount: money(shop.balance) }) : undefined}
            >
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  ₹
                </span>
                <input
                  id={`${uid}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={errFor("amount") ? true : undefined}
                  className={`${inputClass} pl-9 tabular-nums`}
                />
              </div>
            </FormRow>
            <FormRow id={`${uid}-date`} label={f.date} required error={errFor("receivedOn")}>
              <input
                id={`${uid}-date`}
                type="date"
                max={today}
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
                aria-invalid={errFor("receivedOn") ? true : undefined}
                className={inputClass}
              />
            </FormRow>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {f.method} <span className="text-red-700">*</span>
            </span>
            <PillRadios
              name={`${uid}-method`}
              label={f.method}
              value={method}
              onChange={setMethod}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: t.methods[m] }))}
            />
            {errFor("method") && <p className="text-sm text-red-700">{errFor("method")}</p>}
          </div>

          <FormRow id={`${uid}-note`} label={f.note} optional={f.optional} error={errFor("note")}>
            <input
              id={`${uid}-note`}
              autoComplete="off"
              maxLength={PAYMENT_NOTE_MAX}
              placeholder={f.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </FormRow>
        </FormDialog>
      )}
    </>
  );
}
