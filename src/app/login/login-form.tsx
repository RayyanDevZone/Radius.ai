"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { activateOrganization } from "@/lib/business-setup";
import { signInWithIdentifier } from "@/lib/sign-in";
import { authErrorMessage } from "@/lib/auth-errors";
import { AuthShell, Field, FormError, PasswordField, SubmitButton } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

export function LoginForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      // Email or phone is resolved on the server; the browser never learns
      // which email a phone number belongs to.
      const result = await signInWithIdentifier({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (!result.ok) {
        setError(authErrorMessage(result.code, t));
        return;
      }
      // The server picks the user's org from neon_auth.member and makes it the
      // session's active org. The client never sends an org id.
      const { next } = await activateOrganization();
      router.push(next);
      router.refresh();
    } catch {
      setError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      lang={locale}
      title={t.signInTitle}
      subtitle={t.signInSubtitle}
      tabs={{ active: "login", signInLabel: t.signInTab, signUpLabel: t.signUpTab }}
      backHomeLabel={t.backHome}
    >
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label={t.identifier}
          name="identifier"
          type="text"
          // Shows the @ key and digits on phone keyboards.
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t.identifierPlaceholder}
          required
        />
        <PasswordField
          label={t.password}
          name="password"
          showLabel={t.showPassword}
          hideLabel={t.hidePassword}
          placeholder={t.passwordPlaceholder}
          autoComplete="current-password"
          required
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label={t.signIn} pendingLabel={t.pending} />
      </form>
    </AuthShell>
  );
}
