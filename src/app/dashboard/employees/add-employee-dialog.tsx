"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { addEmployee, updateEmployee } from "@/lib/employee-actions";
import {
  normalizeEmployeeInput,
  validateEmployeeInput,
  validateEmployeeUpdate,
  EMPLOYEE_LIMITS,
  type EmployeeField,
  type EmployeeUpdateInput,
} from "@/lib/employees";
import { Field, FormError, PasswordField, SubmitButton } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

type T = Dictionary["dashboard"]["employees"];

/**
 * Add mode (no `edit`): "+ Add employee" button that opens the popup. Creates a
 * login: the employee signs in with this phone number and the password set here.
 *
 * Edit mode: opens right away, prefilled with `edit.values` (`edit.id` is the
 * member id). Name, phone and designation only; the password stays the same.
 * `onClose` runs when it closes. Owners only; the server checks too.
 */
export function AddEmployeeDialog({
  t,
  edit,
  onClose,
}: {
  t: T;
  edit?: { id: string; values: EmployeeUpdateInput };
  onClose?: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: EmployeeField; message: string } | null>(null);
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

    const input = normalizeEmployeeInput(Object.fromEntries(new FormData(e.currentTarget)));
    const invalid = edit ? validateEmployeeUpdate(input) : validateEmployeeInput(input);
    if (invalid) {
      setFieldError({ field: invalid, message: f.errors[invalid] });
      return;
    }

    setPending(true);
    try {
      const result = edit
        ? await updateEmployee(edit.id, { name: input.name, phone: input.phone, designation: input.designation })
        : await addEmployee(input);
      if (result.ok) {
        dialogRef.current?.close();
        if (!edit) reset();
        // Saved. Close right away and reload the list in the background.
        startTransition(() => router.refresh());
      } else if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: f.errors[result.field] });
      } else if (result.error === "phone_taken") {
        setFieldError({ field: "phone", message: f.errors.phoneTaken });
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

  const errFor = (field: EmployeeField) => (fieldError?.field === field ? fieldError.message : null);
  const v = edit?.values;

  return (
    <>
      {!isEdit && (
        <button
          type="button"
          onClick={open}
          aria-label={t.add}
          title={t.add}
          data-testid="add-employee"
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
        data-testid={isEdit ? "edit-employee-dialog" : "add-employee-dialog"}
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
            id={`${uid}-name`}
            label={`${f.name} *`}
            name="name"
            autoComplete="off"
            placeholder={f.namePlaceholder}
            defaultValue={v?.name}
            required
            maxLength={EMPLOYEE_LIMITS.name.max}
            error={errFor("name")}
          />

          <Field
            id={`${uid}-phone`}
            label={`${f.phone} *`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder={f.phonePlaceholder}
            defaultValue={v?.phone}
            hint={f.phoneHint}
            required
            error={errFor("phone")}
          />

          <Field
            id={`${uid}-designation`}
            label={`${f.designation} *`}
            name="designation"
            autoComplete="off"
            placeholder={f.designationPlaceholder}
            defaultValue={v?.designation}
            required
            maxLength={EMPLOYEE_LIMITS.designation.max}
            error={errFor("designation")}
          />

          {!isEdit && (
            <PasswordField
              id={`${uid}-password`}
              label={`${f.password} *`}
              name="password"
              // Stops the browser saving this as the OWNER's password.
              autoComplete="new-password"
              hint={f.passwordHint}
              required
              minLength={EMPLOYEE_LIMITS.password.min}
              maxLength={EMPLOYEE_LIMITS.password.max}
              showLabel={f.showPassword}
              hideLabel={f.hidePassword}
              error={errFor("password")}
            />
          )}

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
