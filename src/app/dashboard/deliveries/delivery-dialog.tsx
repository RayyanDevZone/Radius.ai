"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createDelivery, updateDelivery } from "@/lib/delivery-actions";
import { normalizeDeliveryInput, validateDeliveryInput, MAX_DELIVERY_ITEMS, NOTES_MAX, type DeliveryField } from "@/lib/deliveries";
import type { DeliveryFormOptions } from "@/lib/delivery-form-data";
import { fill } from "@/lib/format";
import { cleanMoney, fromPaise, isMoney, moneyFormatter, toPaise } from "@/lib/money";
import { inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { AddRoundButton, FormDialog, FormRow, SelectInput } from "../_components/form-dialog";
import { Icon } from "../_components/section";

type T = Dictionary["dashboard"]["deliveries"];

/** Form choices + store, sent to the page once and shared by every row's Edit popup. */
type FormContext = { options: DeliveryFormOptions; storeName: string; today: string };
const DeliveryFormContext = createContext<FormContext | null>(null);

export function DeliveryFormProvider({ value, children }: { value: FormContext | null; children: ReactNode }) {
  return <DeliveryFormContext.Provider value={value}>{children}</DeliveryFormContext.Provider>;
}

export const useDeliveryForm = () => useContext(DeliveryFormContext);

export type DeliveryFormValues = {
  shopId: string;
  scheduledFor: string;
  vehicleId: string | null;
  assignedTo: string | null;
  notes: string | null;
  items: { productId: string; quantity: number; unitPrice: string }[];
};

type ItemState = { key: number; productId: string; quantity: string; unitPrice: string };

let nextKey = 1;
const blankItem = (): ItemState => ({ key: nextKey++, productId: "", quantity: "1", unitPrice: "" });

/**
 * Add mode (no `edit`): "+" button that opens the popup.
 * Edit mode: opens right away, prefilled; `onClose` runs when it closes.
 * Owners only; the server checks too. The store is the one picked in the
 * side menu (the server reads it from the session, not from this form).
 */
export function DeliveryDialog({
  t,
  locale,
  options,
  storeName,
  today,
  edit,
  onClose,
}: {
  t: T;
  locale: string;
  options: DeliveryFormOptions;
  storeName: string;
  today: string;
  edit?: { id: string; values: DeliveryFormValues };
  onClose?: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const f = t.form;
  const isEdit = edit != null;
  const money = moneyFormatter(locale);

  const initial = () => ({
    shopId: edit?.values.shopId ?? "",
    scheduledFor: edit?.values.scheduledFor ?? today,
    vehicleId: edit?.values.vehicleId ?? "",
    assignedTo: edit?.values.assignedTo ?? "",
    notes: edit?.values.notes ?? "",
    items: edit
      ? edit.values.items.map((i) => ({ key: nextKey++, productId: i.productId, quantity: String(i.quantity), unitPrice: i.unitPrice }))
      : [blankItem()],
  });

  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: DeliveryField; message: string } | null>(null);

  useEffect(() => {
    if (isEdit && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isEdit]);

  const priceOf = (productId: string) => options.products.find((p) => p.id === productId)?.price ?? "";
  const set = <K extends keyof ReturnType<typeof initial>>(key: K, value: ReturnType<typeof initial>[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
    if (fieldError) setFieldError(null);
  };
  const setItem = (key: number, patch: Partial<ItemState>) =>
    set(
      "items",
      form.items.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );

  function chooseProduct(item: ItemState, productId: string) {
    // Fill the price from the product unless the user already typed their own.
    const keepPrice = item.unitPrice !== "" && item.unitPrice !== priceOf(item.productId);
    setItem(item.key, { productId, unitPrice: keepPrice ? item.unitPrice : trimPrice(priceOf(productId)) });
  }

  function open() {
    setForm(initial());
    setError(null);
    setFieldError(null);
    dialogRef.current?.showModal();
  }

  const lineTotal = (it: ItemState) => {
    const price = cleanMoney(it.unitPrice);
    return /^\d{1,6}$/.test(it.quantity) && isMoney(price) ? toPaise(price) * BigInt(it.quantity) : null;
  };
  const total = form.items.reduce((acc, it) => acc + (lineTotal(it) ?? BigInt(0)), BigInt(0));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const input = normalizeDeliveryInput({
      ...form,
      items: form.items.filter((i) => i.productId || i.unitPrice).map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
    });
    const invalid = validateDeliveryInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }

    setPending(true);
    try {
      const result = edit ? await updateDelivery(edit.id, input) : await createDelivery(input);
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

  const errFor = (field: DeliveryField) => (fieldError?.field === field ? fieldError.message : null);
  const missing = options.shops.length === 0 ? f.needShops : options.products.length === 0 ? f.needProducts : null;

  return (
    <>
      {!isEdit && <AddRoundButton label={t.add} onClick={open} testId="add-delivery" />}
      <FormDialog
        dialogRef={dialogRef}
        testId={isEdit ? "edit-delivery-dialog" : "add-delivery-dialog"}
        size="lg"
        title={isEdit ? t.manage.editTitle : f.title}
        subtitle={isEdit ? t.manage.editSubtitle : fill(f.subtitle, { store: storeName })}
        icon={<Icon name="route" className="h-6 w-6" />}
        pending={pending}
        error={error ?? missing}
        submitLabel={isEdit ? t.manage.save : f.submit}
        pendingLabel={f.pending}
        cancelLabel={f.cancel}
        closeLabel={f.close}
        onSubmit={onSubmit}
        onClose={onClose}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormRow id={`${uid}-shop`} label={f.shop} required error={errFor("shopId")}>
            <SelectInput
              id={`${uid}-shop`}
              value={form.shopId}
              onChange={(e) => set("shopId", e.target.value)}
              invalid={!!errFor("shopId")}
              aria-describedby={errFor("shopId") ? `${uid}-shop-error` : undefined}
            >
              <option value="">{f.chooseShop}</option>
              {options.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.hint ? `${s.label} · ${s.hint}` : s.label}
                </option>
              ))}
            </SelectInput>
          </FormRow>

          <FormRow id={`${uid}-date`} label={f.date} required error={errFor("scheduledFor")}>
            <input
              id={`${uid}-date`}
              type="date"
              value={form.scheduledFor}
              onChange={(e) => set("scheduledFor", e.target.value)}
              aria-invalid={errFor("scheduledFor") ? true : undefined}
              className={inputClass}
            />
          </FormRow>

          <FormRow id={`${uid}-vehicle`} label={f.vehicle} optional={f.optional} error={errFor("vehicleId")}>
            <SelectInput id={`${uid}-vehicle`} value={form.vehicleId} onChange={(e) => set("vehicleId", e.target.value)}>
              <option value="">{f.notDecided}</option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </SelectInput>
          </FormRow>

          <FormRow id={`${uid}-assignee`} label={f.assignee} optional={f.optional} error={errFor("assignedTo")}>
            <SelectInput id={`${uid}-assignee`} value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
              <option value="">{f.notDecided}</option>
              {options.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.hint ? `${e.label} · ${e.hint}` : e.label}
                </option>
              ))}
            </SelectInput>
          </FormRow>
        </div>

        {/* Items */}
        <fieldset className="flex flex-col gap-2" aria-describedby={errFor("items") ? `${uid}-items-error` : undefined}>
          <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            {f.items} <span className="text-red-700">*</span>
          </legend>

          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_5.5rem_8rem_6.5rem_2.5rem] gap-2 px-1 text-xs font-medium uppercase tracking-[0.1em] text-muted sm:grid">
            <span>{f.product}</span>
            <span>{f.quantity}</span>
            <span>{f.price}</span>
            <span className="text-right">{f.lineTotal}</span>
            <span />
          </div>

          <ul className="flex flex-col gap-2">
            {form.items.map((it, index) => {
              const lt = lineTotal(it);
              return (
                <li
                  key={it.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-accent-strong/50 bg-white/50 p-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_6.5rem_2.5rem] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <SelectInput
                      aria-label={`${f.product} ${index + 1}`}
                      value={it.productId}
                      onChange={(e) => chooseProduct(it, e.target.value)}
                    >
                      <option value="">{f.chooseProduct}</option>
                      {options.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                    <input
                      aria-label={`${f.quantity} ${index + 1}`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={it.quantity}
                      onChange={(e) => setItem(it.key, { quantity: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                      className={`${inputClass} px-3 text-center tabular-nums`}
                    />
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                        ₹
                      </span>
                      <input
                        aria-label={`${f.price} ${index + 1}`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={it.unitPrice}
                        onChange={(e) => setItem(it.key, { unitPrice: e.target.value })}
                        className={`${inputClass} pl-7 pr-2 tabular-nums`}
                      />
                    </div>
                  </div>
                  <span className="self-center text-sm font-medium tabular-nums sm:text-right">
                    {lt === null ? <span className="text-muted">—</span> : money(fromPaise(lt))}
                  </span>
                  <button
                    type="button"
                    onClick={() => set("items", form.items.length > 1 ? form.items.filter((x) => x.key !== it.key) : [blankItem()])}
                    aria-label={`${f.removeItem} ${index + 1}`}
                    title={f.removeItem}
                    className="flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-accent-strong"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={form.items.length >= MAX_DELIVERY_ITEMS}
              onClick={() => set("items", [...form.items, blankItem()])}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/20 px-4 text-sm font-medium transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-50"
            >
              <span aria-hidden>+</span> {f.addItem}
            </button>
            <p className="text-base" aria-live="polite">
              <span className="text-muted">{f.total}: </span>
              <span className="text-lg font-semibold" data-testid="delivery-total">
                {money(fromPaise(total))}
              </span>
            </p>
          </div>
          {errFor("items") && (
            <p id={`${uid}-items-error`} className="text-sm text-red-700">
              {errFor("items")}
            </p>
          )}
        </fieldset>

        <FormRow id={`${uid}-notes`} label={f.notes} optional={f.optional} error={errFor("notes")}>
          <input
            id={`${uid}-notes`}
            autoComplete="off"
            maxLength={NOTES_MAX}
            placeholder={f.notesPlaceholder}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={inputClass}
          />
        </FormRow>
      </FormDialog>
    </>
  );
}

/** "1250.00" → "1250", "12.50" → "12.50" (cleaner to edit). */
const trimPrice = (p: string) => p.replace(/\.00$/, "");
