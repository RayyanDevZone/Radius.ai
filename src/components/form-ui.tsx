"use client";

import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";

// Visual language matches the home/language pages: soft green glow, glassy
// card, pill buttons. Inputs are 48px tall with 16px text so they're easy to
// tap and iOS doesn't zoom.

const delay = (s: number) => ({ animationDelay: `${s}s` });

const inputClass =
  "h-12 w-full rounded-xl border border-accent-strong/80 bg-background/80 px-4 text-base text-foreground placeholder:text-muted/60 transition-all duration-200 hover:border-foreground/40 focus:border-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-accent/70 aria-invalid:border-red-600";

/** Centered, phone-first card used by /login, /signup and /onboarding. */
/** Big, obvious "Sign in | Create account" switch at the top of the card. */
function AuthTabs({ active, signInLabel, signUpLabel }: AuthTabsProps) {
  const tabs = [
    { key: "login", label: signInLabel, href: "/login" },
    { key: "signup", label: signUpLabel, href: "/signup" },
  ] as const;
  return (
    <nav className="mb-7 grid grid-cols-2 gap-1 rounded-full bg-accent/60 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4 py-2.5 text-center text-sm font-medium transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
              isActive
                ? "bg-foreground text-background shadow-[0_6px_18px_-8px_rgba(31,58,43,0.6)]"
                : "text-muted hover:bg-background/70 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

type AuthTabsProps = { active: "login" | "signup"; signInLabel: string; signUpLabel: string };

export function AuthShell({
  lang,
  title,
  subtitle,
  children,
  footer,
  tabs,
  backHomeLabel,
}: {
  lang: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Shows the Sign in / Create account switch (login and signup only). */
  tabs?: AuthTabsProps;
  /** Shows a "← Back to home" link under the card. */
  backHomeLabel?: string;
}) {
  return (
    <main lang={lang} className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
      <div
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full bg-accent blur-3xl"
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <Link href="/" lang="en" aria-label="Radius.ai" className="animate-fade-up font-serif text-4xl tracking-tight" style={delay(0)}>
          Radius<span className="text-shimmer italic">.ai</span>
        </Link>
        <div
          className="animate-fade-up w-full rounded-3xl border border-accent-strong/70 bg-background/75 p-6 shadow-[0_24px_60px_-28px_rgba(31,58,43,0.45)] backdrop-blur-md sm:p-8"
          style={delay(0.1)}
        >
          {tabs && <AuthTabs {...tabs} />}
          <header className="mb-6 flex flex-col gap-2">
            <h1 className="text-4xl leading-tight">{title}</h1>
            {subtitle && <p className="text-sm leading-6 text-muted">{subtitle}</p>}
          </header>
          {children}
        </div>
        {footer && (
          <div className="animate-fade-up text-center text-sm text-muted" style={delay(0.2)}>
            {footer}
          </div>
        )}
        {backHomeLabel && (
          <Link
            href="/"
            className="animate-fade-up group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
            style={delay(0.25)}
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            {backHomeLabel}
          </Link>
        )}
      </div>
    </main>
  );
}

export function FieldGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted">{legend}</legend>
      {children}
    </fieldset>
  );
}

type FieldProps = { label: string; hint?: string; error?: string | null; name: string; trailing?: ReactNode } & ComponentProps<"input">;

export function Field({ label, hint, error, name, trailing, className, ...input }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${trailing ? "pr-20" : ""} ${className ?? ""}`}
          {...input}
        />
        {trailing}
      </div>
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

export function PasswordField({
  showLabel,
  hideLabel,
  ...props
}: Omit<FieldProps, "type" | "trailing"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={`field-${props.name}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
        >
          {visible ? hideLabel : showLabel}
        </button>
      }
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span aria-hidden className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
        !
      </span>
      {message}
    </div>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="group mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 text-base font-medium text-background shadow-[0_8px_30px_-10px_rgba(31,58,43,0.5)] transition-all duration-300 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_40px_-12px_rgba(31,58,43,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background"
          />
          {pendingLabel}
        </>
      ) : (
        <>
          {label}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </>
      )}
    </button>
  );
}
