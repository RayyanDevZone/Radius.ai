"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { addProduct, updateProduct } from "@/lib/product-actions";
import {
  normalizeProductInput,
  validateProductInput,
  SALE_UNITS,
  SIZE_UNITS,
  type ProductField,
  type ProductInput,
} from "@/lib/products";
import { FormError, SubmitButton, inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

type T = Dictionary["dashboard"]["products"];

/**
 * Add mode (no `edit`): "+ Add product" button that opens the popup.
 * Edit mode: opens right away, prefilled with `edit.values`; `onClose` runs
 * when it closes. Owners only; the server checks too.
 */
export function AddProductDialog({ t, edit, onClose }: { t: T; edit?: { id: string; values: ProductInput }; onClose?: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: ProductField; message: string } | null>(null);
  // Bumped on reset so the custom Unit picker (not a native input) remounts at its default.
  const [resetKey, setResetKey] = useState(0);
  const uid = useId();
  const f = t.form;
  const isEdit = edit != null;

  // Edit mode is mounted on demand, so open as soon as it mounts.
  useEffect(() => {
    if (isEdit && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isEdit]);

  function reset() {
    formRef.current?.reset();
    setResetKey((k) => k + 1);
    setError(null);
    setFieldError(null);
  }

  function open() {
    reset();
    dialogRef.current?.showModal();
  }

  function close() {
    if (pending) return;
    dialogRef.current?.close();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const input = normalizeProductInput(Object.fromEntries(new FormData(e.currentTarget)));
    const invalid = validateProductInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }

    setPending(true);
    try {
      const result = edit ? await updateProduct(edit.id, input) : await addProduct(input);
      if (result.ok) {
        dialogRef.current?.close();
        if (!edit) reset();
        // Saved. Close right away and reload the list in the background.
        startTransition(() => router.refresh());
      } else if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: f.errors[result.field] });
      } else if (result.error === "not_found") {
        setError(t.manage.notFound);
      } else {
        setError(f.errors[result.error]);
      }
    } catch {
      setError(f.errors.failed);
    } finally {
      setPending(false);
    }
  }

  const errFor = (field: ProductField) => (fieldError?.field === field ? fieldError.message : null);
  const sizeError = errFor("sizeValue") ?? errFor("sizeUnit");

  return (
    <>
      {!isEdit && (
      <button
        type="button"
        onClick={open}
        aria-label={t.add}
        title={t.add}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background shadow-[0_8px_24px_-12px_rgba(31,58,43,0.6)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        data-testid={isEdit ? "edit-product-dialog" : "add-product-dialog"}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClose={() => onClose?.()}
        // A click on the dimmed backdrop (the dialog element itself) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-xl overflow-hidden text-left rounded-[1.75rem] border border-accent-strong/70 bg-background p-0 text-foreground shadow-[0_40px_100px_-30px_rgba(31,58,43,0.55)] transition duration-200 ease-out starting:open:translate-y-4 starting:open:opacity-0 backdrop:bg-foreground/45 backdrop:backdrop-blur-[3px]"
      >
        <form
          ref={formRef}
          method="post"
          onSubmit={onSubmit}
          // Hide a stale error as soon as the user edits the form.
          onChange={() => fieldError && setFieldError(null)}
          noValidate
          className="flex max-h-[min(90dvh,760px)] flex-col">
          {/* Header */}
          <header className="relative flex items-start gap-4 overflow-hidden border-b border-accent-strong/50 bg-accent/40 px-6 py-5 sm:px-8">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent blur-2xl" />
            <span aria-hidden className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-[0_8px_20px_-10px_rgba(31,58,43,0.7)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                <path d="M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4 8-4M12 12v8" />
              </svg>
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 id={`${uid}-title`} className="text-3xl leading-tight">
                {isEdit ? t.manage.editTitle : f.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{isEdit ? t.manage.editSubtitle : f.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={f.close}
              className="relative -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {/* Body */}
          <div className="flex flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-6 sm:px-8">
            <Row id={`${uid}-name`} label={f.name} required error={errFor("name")}>
              <input
                id={`${uid}-name`}
                name="name"
                autoComplete="off"
                placeholder={f.namePlaceholder}
                defaultValue={edit?.values.name}
                maxLength={120}
                aria-invalid={errFor("name") ? true : undefined}
                aria-describedby={errFor("name") ? `${uid}-name-error` : undefined}
                className={inputClass}
              />
            </Row>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Row id={`${uid}-price`} label={f.price} required error={errFor("price")}>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted">
                    ₹
                  </span>
                  <input
                    id={`${uid}-price`}
                    name="price"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    defaultValue={edit?.values.price}
                    aria-invalid={errFor("price") ? true : undefined}
                    aria-describedby={errFor("price") ? `${uid}-price-error` : undefined}
                    className={`${inputClass} pl-9 tabular-nums`}
                  />
                </div>
              </Row>

              <Row id={`${uid}-hsn`} label={f.hsnCode} optional={f.optional} hint={f.hsnHint} error={errFor("hsnCode")}>
                <input
                  id={`${uid}-hsn`}
                  name="hsnCode"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1006"
                  defaultValue={edit?.values.hsnCode ?? undefined}
                  maxLength={10}
                  aria-invalid={errFor("hsnCode") ? true : undefined}
                  aria-describedby={errFor("hsnCode") ? `${uid}-hsn-error` : `${uid}-hsn-hint`}
                  className={`${inputClass} tabular-nums tracking-wider`}
                />
              </Row>
            </div>

            {/* Size: number + measure */}
            <Row id={`${uid}-size`} label={f.size} required error={sizeError}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${uid}-size`}
                  name="sizeValue"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={f.sizePlaceholder}
                  defaultValue={edit?.values.sizeValue}
                  aria-invalid={sizeError ? true : undefined}
                  aria-describedby={sizeError ? `${uid}-size-error` : undefined}
                  className={`${inputClass} min-w-0 sm:flex-1 tabular-nums`}
                />
                <div role="radiogroup" aria-label={f.sizeUnit} className="grid h-12 shrink-0 grid-cols-4 gap-1 rounded-xl bg-accent/60 p-1 sm:w-60">
                  {SIZE_UNITS.map((u) => (
                    <label key={u} className="relative cursor-pointer">
                      <input type="radio" name="sizeUnit" value={u} defaultChecked={u === (edit?.values.sizeUnit ?? "kg")} className="peer sr-only" />
                      <span className="flex h-full items-center justify-center rounded-lg text-sm font-medium text-muted transition-all hover:text-foreground peer-checked:bg-foreground peer-checked:text-background peer-checked:shadow-[0_6px_16px_-8px_rgba(31,58,43,0.7)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-strong">
                        {t.sizeUnits[u]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </Row>

            {/* Unit: bag / piece / packet / crate */}
            <Row id={`${uid}-unit`} label={f.unit} optional={f.optional} error={errFor("unit")}>
              <UnitSelect
                key={resetKey}
                initial={edit?.values.unit}
                id={`${uid}-unit`}
                label={f.unit}
                labels={t.units}
                noneLabel={f.noUnit}
                invalid={!!errFor("unit")}
                onChange={() => fieldError && setFieldError(null)}
              />
            </Row>

            <FormError message={error} />
          </div>

          {/* Footer */}
          <footer className="flex flex-col-reverse gap-2 border-t border-accent-strong/50 bg-accent/25 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-muted transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-50"
            >
              {f.cancel}
            </button>
            {/* SubmitButton has mt-1 for auth forms; cancel it here. */}
            <div className="sm:w-56 [&>button]:mt-0">
              <SubmitButton pending={pending} label={isEdit ? t.manage.save : f.submit} pendingLabel={f.pending} />
            </div>
          </footer>
        </form>
      </dialog>
    </>
  );
}

/** Label + control + hint/error for one form row. */
function Row({
  id,
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        {label}
        {required && <span className="text-red-700">*</span>}
        {optional && (
          <span className="rounded-full bg-accent/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">{optional}</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}


type SaleUnit = (typeof SALE_UNITS)[number];
/** "" = no unit (the field is optional). */
type UnitOption = SaleUnit | "";
const UNIT_OPTIONS: readonly UnitOption[] = ["", ...SALE_UNITS];

/**
 * Themed dropdown for the sale unit. A native <select> can't style its open
 * list, so this is a button + listbox; a hidden input carries the value into
 * the form. Opens upward because it's the last field in a scrolling body.
 */
function UnitSelect({
  id,
  initial,
  label,
  labels,
  noneLabel,
  invalid,
  onChange,
}: {
  id: string;
  initial?: SaleUnit | null;
  label: string;
  labels: Record<SaleUnit, string>;
  /** Shown for the empty choice. */
  noneLabel: string;
  invalid: boolean;
  onChange: () => void;
}) {
  const [value, setValue] = useState<UnitOption>(initial ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = `${id}-list`;

  function show() {
    setActive(UNIT_OPTIONS.indexOf(value));
    setOpen(true);
  }

  const text = (u: UnitOption) => (u ? labels[u] : noneLabel);
  const optId = (u: UnitOption) => `${id}-opt-${u || "none"}`;

  function choose(u: UnitOption) {
    if (u !== value) onChange();
    setValue(u);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = UNIT_OPTIONS.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return show();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => Math.min(last, Math.max(0, i + step)));
        break;
      }
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(UNIT_OPTIONS[active]);
        else show();
        break;
      case "Escape":
        // Close the list, not the whole dialog.
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input type="hidden" name="unit" value={value} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        aria-activedescendant={open ? optId(UNIT_OPTIONS[active]) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`${inputClass} flex cursor-pointer items-center justify-between text-left ${open ? "border-foreground bg-background ring-4 ring-accent/70" : ""}`}
      >
        <span className={value ? "" : "text-muted"}>{text(value)}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 bottom-full z-10 mb-2 flex flex-col gap-0.5 rounded-2xl border border-accent-strong/70 bg-background p-1.5 shadow-[0_20px_50px_-20px_rgba(31,58,43,0.45)]"
        >
          {UNIT_OPTIONS.map((u, i) => {
            const selected = u === value;
            return (
              <li
                key={u || "none"}
                id={optId(u)}
                role="option"
                aria-selected={selected}
                // Keep focus on the button so blur doesn't close the list first.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(u)}
                className={`flex h-11 cursor-pointer items-center justify-between rounded-xl px-3.5 text-base transition-colors ${
                  i === active ? "bg-accent/60" : ""
                } ${selected ? "font-medium text-foreground" : "text-foreground/80"}`}
              >
                {text(u)}
                {selected && (
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
