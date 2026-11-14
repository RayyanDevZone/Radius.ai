"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type AuthStrings = Dictionary["auth"];

// Map Better Auth error codes to translated messages.
function errorMessage(code: string | undefined, t: AuthStrings) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t.errors.invalidCredentials;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return t.errors.userExists;
    case "PASSWORD_TOO_SHORT":
      return t.errors.passwordTooShort;
    default:
      return t.errors.generic;
  }
}

export function AuthForm({
  mode,
  locale,
  t,
}: {
  mode: "sign-in" | "sign-up";
  locale: Locale;
  t: AuthStrings;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(errorMessage(error.code, t));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const isSignUp = mode === "sign-up";

  return (
    <main
      lang={locale}
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16"
    >
      <h1 className="text-4xl">{isSignUp ? t.signUpTitle : t.signInTitle}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {isSignUp && (
          <input name="name" placeholder={t.name} required className="rounded border px-3 py-2" />
        )}
        <input name="email" type="email" placeholder={t.email} required className="rounded border px-3 py-2" />
        <input
          name="password"
          type="password"
          placeholder={t.password}
          required
          minLength={8}
          className="rounded border px-3 py-2"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
        >
          {pending ? t.pending : isSignUp ? t.signUp : t.signIn}
        </button>
      </form>
      <p className="text-sm">
        {isSignUp ? (
          <>
            {t.haveAccount}{" "}
            <Link href="/auth/sign-in" className="underline">
              {t.signIn}
            </Link>
          </>
        ) : (
          <>
            {t.noAccount}{" "}
            <Link href="/auth/sign-up" className="underline">
              {t.signUp}
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
