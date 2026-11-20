"use client";

import { useId, type ComponentProps, type ReactNode, type RefObject } from "react";
import { FormError, SubmitButton, inputClass } from "@/components/form-ui";

/**
 * Popup form frame shared by the delivery, payment and stock forms (same look
 * as the Add product popup): tinted header with an icon, scrolling body,
 * Cancel + Submit footer. The parent owns the <dialog> through `dialogRef`
 * and calls showModal() / close().
 */
export function FormDialog({
  dialogRef,
  title,
  subtitle,
  icon,
  pending,
  error,
  submitLabel,
  pendingLabel,
  cancelLabel,
  closeLabel,
  onSubmit,
  onClose,
  testId,
  size = "md",
  danger,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  closeLabel: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose?: () => void;
  testId?: string;
  size?: "sm" | "md" | "lg";
  /** Red submit button (e.g. Cancel delivery). */
  danger?: boolean;
  children?: ReactNode;
}) {
  const uid = useId();
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${uid}-title`}
      data-testid={testId}
      onCancel={(e) => pending && e.preventDefault()}
      onClose={() => onClose?.()}
      // A click on the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${width} overflow-hidden rounded-[1.75rem] border border-accent-strong/70 bg-background p-0 text-left text-foreground shadow-[0_40px_100px_-30px_rgba(31,58,43,0.55)] transition duration-200 ease-out starting:open:translate-y-4 starting:open:opacity-0 backdrop:bg-foreground/45 backdrop:backdrop-blur-[3px]`}
    >
      <form method="post" onSubmit={onSubmit} noValidate className="flex max-h-[min(90dvh,820px)] flex-col">
        <header className="relative flex items-start gap-4 overflow-hidden border-b border-accent-strong/50 bg-accent/40 px-6 py-5 sm:px-8">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent blur-2xl" />
          <span
            aria-hidden
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_8px_20px_-10px_rgba(31,58,43,0.7)] ${danger ? "bg-red-600 text-white" : "bg-foreground text-background"}`}
          >
            {icon}
          </span>
          <div className="relative min-w-0 flex-1">
            <h2 id={`${uid}-title`} className="text-3xl leading-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="relative -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-6 sm:px-8">
          {children}
          <FormError message={error} />
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-accent-strong/50 bg-accent/25 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-muted transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <div className={`sm:w-56 [&>button]:mt-0 ${danger ? "[&>button]:bg-red-600 [&>button]:text-white" : ""}`}>
            <SubmitButton pending={pending} label={submitLabel} pendingLabel={pendingLabel} />
          </div>
        </footer>
      </form>
    </dialog>
  );
}

/** Label + control + hint/error for one form row. */
export function FormRow({
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

/**
 * Native <select> in the app's input style. Native is right here: long shop
 * and product lists get the phone's own picker, with type-to-find.
 */
export function SelectInput({ invalid, className, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={`${inputClass} cursor-pointer appearance-none pr-10 ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/** Pill radio group (e.g. Cash / UPI / Cheque / Bank). */
export function PillRadios<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 rounded-xl bg-accent/60 p-1">
      {options.map((o) => (
        <label key={o.value} className="relative flex-1 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="flex h-10 min-w-20 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted transition-all hover:text-foreground peer-checked:bg-foreground peer-checked:text-background peer-checked:shadow-[0_6px_16px_-8px_rgba(31,58,43,0.7)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-strong">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Round "+" button that opens an add popup (same as the other list pages). */
export function AddRoundButton({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background shadow-[0_8px_24px_-12px_rgba(31,58,43,0.6)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
