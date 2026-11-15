"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import type { Dictionary } from "@/i18n/dictionaries";

type Strings = Dictionary["dashboard"]["profile"];

const signOutIcon = (
  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </svg>
);

/**
 * Red "Sign out" button. Asks for confirmation in a modal first.
 * Uses the native <dialog>: focus stays inside it, and Escape cancels.
 */
export function SignOutConfirm({ t }: { t: Strings }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        data-testid="profile-sign-out"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-7 text-base font-medium text-white shadow-[0_8px_30px_-12px_rgba(220,38,38,0.6)] transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 sm:w-auto"
      >
        {signOutIcon}
        {t.signOut}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-body"
        // Clicking the dimmed backdrop (the dialog element itself) cancels.
        onClick={(e) => {
          if (e.target === e.currentTarget && !pending) dialogRef.current?.close();
        }}
        onCancel={(e) => pending && e.preventDefault()}
        data-testid="sign-out-dialog"
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-foreground/10 bg-background p-0 text-foreground shadow-[0_24px_60px_-20px_rgba(31,58,43,0.5)] backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 p-6 text-center sm:p-7">
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            {signOutIcon}
          </span>
          <h2 id="sign-out-title" className="text-3xl">
            {t.confirmTitle}
          </h2>
          <p id="sign-out-body" className="text-sm leading-6 text-muted">
            {t.confirmBody}
          </p>
          <div className="mt-3 flex w-full flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className="h-12 flex-1 rounded-full border border-foreground/20 text-base font-medium transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={signOut}
              data-testid="confirm-sign-out"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-red-600 text-base font-medium text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-wait disabled:opacity-70"
            >
              {pending && (
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {pending ? t.signingOut : t.confirmYes}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
