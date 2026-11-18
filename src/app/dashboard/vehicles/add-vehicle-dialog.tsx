"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { addVehicle, updateVehicle } from "@/lib/vehicle-actions";
import { formatVehicleNumber, normalizeVehicleInput, validateVehicleInput, VEHICLE_TYPES, type VehicleField, type VehicleInput } from "@/lib/vehicles";
import { FormError, SubmitButton, inputClass } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { TYPE_ICONS } from "./vehicle-icons";

type T = Dictionary["dashboard"]["vehicles"];

/**
 * Add mode (no `edit`): "+ Add vehicle" button that opens the popup.
 * Edit mode: opens right away, prefilled with `edit.values`; `onClose` runs
 * when it closes. Owners only; the server checks too.
 */
export function AddVehicleDialog({ t, edit, onClose }: { t: T; edit?: { id: string; values: VehicleInput }; onClose?: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: VehicleField; message: string } | null>(null);
  const uid = useId();
  const f = t.form;
  const isEdit = edit != null;

  // Edit mode is mounted on demand, so open as soon as it mounts.
  useEffect(() => {
    if (isEdit && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isEdit]);

  function reset() {
    formRef.current?.reset();
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

    const input = normalizeVehicleInput(Object.fromEntries(new FormData(e.currentTarget)));
    const invalid = validateVehicleInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }

    setPending(true);
    try {
      const result = edit ? await updateVehicle(edit.id, input) : await addVehicle(input);
      if (result.ok) {
        dialogRef.current?.close();
        if (!edit) reset();
        // Saved. Close right away and reload the list in the background.
        startTransition(() => router.refresh());
      } else if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: f.errors[result.field] });
      } else if (result.error === "taken") {
        setFieldError({ field: "number", message: f.errors.taken });
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

  const numberError = fieldError?.field === "number" ? fieldError.message : null;
  const typeError = fieldError?.field === "type" ? fieldError.message : null;

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
        data-testid={isEdit ? "edit-vehicle-dialog" : "add-vehicle-dialog"}
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
                <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
                <circle cx="7" cy="17.5" r="1.5" />
                <circle cx="17" cy="17.5" r="1.5" />
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
          <div className="flex flex-col gap-6 overflow-y-auto overflow-x-hidden px-6 py-6 sm:px-8">
            {/* Vehicle number, styled like a number plate */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${uid}-number`} className="flex items-center gap-2 text-sm font-medium">
                {f.number} <span className="text-red-700">*</span>
              </label>
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-foreground text-[10px] font-bold tracking-wide text-background"
                >
                  IND
                </span>
                <input
                  id={`${uid}-number`}
                  name="number"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder={f.numberPlaceholder}
                  defaultValue={edit ? formatVehicleNumber(edit.values.number) : undefined}
                  maxLength={16}
                  aria-invalid={numberError ? true : undefined}
                  aria-describedby={numberError ? `${uid}-number-error` : `${uid}-number-hint`}
                  className={`${inputClass} pl-13 text-lg font-semibold uppercase tracking-[0.12em] placeholder:font-normal placeholder:tracking-[0.12em]`}
                />
              </div>
              {numberError ? (
                <p id={`${uid}-number-error`} className="text-sm text-red-700">
                  {numberError}
                </p>
              ) : (
                <p id={`${uid}-number-hint`} className="text-xs text-muted">
                  {f.numberHint}
                </p>
              )}
            </div>

            {/* Vehicle type */}
            <fieldset aria-describedby={typeError ? `${uid}-type-error` : undefined} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                {f.type} <span className="text-red-700">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {VEHICLE_TYPES.map((v) => (
                  <label key={v} className="relative cursor-pointer">
                    <input type="radio" name="type" value={v} defaultChecked={v === (edit?.values.type ?? "pickup")} className="peer sr-only" />
                    <span className="flex h-full flex-col items-center gap-2 rounded-2xl border border-accent-strong/80 bg-background/80 px-3 py-4 text-center transition-all hover:border-foreground/40 peer-checked:border-foreground peer-checked:bg-accent/50 peer-checked:ring-4 peer-checked:ring-accent/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-strong">
                      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/70 text-brand">
                        {TYPE_ICONS[v]}
                      </span>
                      <span className="text-sm font-medium leading-tight">{t.types[v]}</span>
                    </span>
                    <span
                      aria-hidden
                      className="absolute right-2.5 top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-foreground text-background peer-checked:flex"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  </label>
                ))}
              </div>
              {typeError && (
                <p id={`${uid}-type-error`} className="text-sm text-red-700">
                  {typeError}
                </p>
              )}
            </fieldset>

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
