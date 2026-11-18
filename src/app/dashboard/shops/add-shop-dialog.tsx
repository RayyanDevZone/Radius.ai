"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { addShop, updateShop } from "@/lib/shop-actions";
import { normalizeShopInput, validateShopInput, SHOP_LIMITS, type ShopField, type ShopInput } from "@/lib/shops";
import { Field, FormError, SubmitButton } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

type T = Dictionary["dashboard"]["shops"];

/**
 * Add mode (no `edit`): "+ Add shop" button that opens the popup.
 * Edit mode: opens right away, prefilled with `edit.values`; `onClose` runs
 * when it closes. Owners only; the server checks too.
 */
export function AddShopDialog({ t, edit, onClose }: { t: T; edit?: { id: string; values: ShopInput }; onClose?: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: ShopField; message: string } | null>(null);
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

    const input = normalizeShopInput(Object.fromEntries(new FormData(e.currentTarget)));
    const invalid = validateShopInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }

    setPending(true);
    try {
      const result = edit ? await updateShop(edit.id, input) : await addShop(input);
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

  const errFor = (field: ShopField) => (fieldError?.field === field ? fieldError.message : null);
  const v = edit?.values;

  return (
    <>
      {!isEdit && (
        <button
          type="button"
          onClick={open}
          aria-label={t.add}
          title={t.add}
          data-testid="add-shop"
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
        data-testid={isEdit ? "edit-shop-dialog" : "add-shop-dialog"}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClose={() => onClose?.()}
        // Click on the dimmed backdrop (the dialog element itself) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-accent-strong/70 bg-background p-0 text-left text-foreground shadow-[0_24px_60px_-28px_rgba(31,58,43,0.45)] backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-6 sm:p-8">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={`${uid}-title`} className="text-3xl leading-tight">
                {isEdit ? t.manage.editTitle : f.title}
              </h2>
              <p className="text-sm text-muted">{isEdit ? t.manage.editSubtitle : f.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={f.close}
              className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <Field
            id={`${uid}-firmName`}
            label={`${f.firmName} *`}
            name="firmName"
            autoComplete="off"
            placeholder={f.firmNamePlaceholder}
            defaultValue={v?.firmName}
            required
            maxLength={SHOP_LIMITS.firmName.max}
            error={errFor("firmName")}
          />

          <Field
            id={`${uid}-firmAddress`}
            label={`${f.firmAddress} *`}
            name="firmAddress"
            autoComplete="off"
            placeholder={f.firmAddressPlaceholder}
            defaultValue={v?.firmAddress}
            required
            maxLength={SHOP_LIMITS.firmAddress.max}
            error={errFor("firmAddress")}
          />

          <Field
            id={`${uid}-ownerName`}
            label={`${f.ownerName} *`}
            name="ownerName"
            autoComplete="off"
            placeholder={f.ownerNamePlaceholder}
            defaultValue={v?.ownerName}
            required
            maxLength={SHOP_LIMITS.ownerName.max}
            error={errFor("ownerName")}
          />

          <Field
            id={`${uid}-mobile`}
            label={`${f.mobile} *`}
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder={f.mobilePlaceholder}
            defaultValue={v?.mobile}
            hint={f.mobileHint}
            required
            error={errFor("mobile")}
          />

          <FormError message={error} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="mt-1 inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-muted transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-50 sm:w-auto"
            >
              {f.cancel}
            </button>
            <div className="flex-1">
              <SubmitButton pending={pending} label={isEdit ? t.manage.save : f.submit} pendingLabel={f.pending} />
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
