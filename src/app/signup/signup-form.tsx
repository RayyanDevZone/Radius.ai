"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { abandonSignup, setupBusiness, type SetupResult } from "@/lib/business-setup";
import { normalizeBusinessInput, validateBusinessInput, type BusinessField } from "@/lib/validation";
import { authErrorMessage } from "@/lib/auth-errors";
import { AuthShell, Field, FieldGroup, FormError, PasswordField, SubmitButton } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

export function SignupForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: BusinessField; message: string } | null>(null);

  const fieldMessage = (field: BusinessField) => (field === "phone" ? t.errors.phone : t.errors.businessName);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const business = normalizeBusinessInput({ businessName: form.get("businessName"), phone: form.get("phone") });

    // Check the business fields before creating the account.
    const invalid = validateBusinessInput(business);
    if (invalid) {
      setFieldError({ field: invalid, message: fieldMessage(invalid) });
      return;
    }

    setPending(true);
    try {
      // Step 1: create the user. This also signs them in (session cookie set).
      // The SDK either returns { error } or throws an AuthApiError (e.g. on a
      // 422 "user already exists"); treat both the same way.
      let signUpError: unknown = null;
      try {
        ({ error: signUpError } = await authClient.signUp.email({ name, email, password }));
      } catch (err) {
        signUpError = err;
      }
      if (signUpError) {
        setError(authErrorMessage(signUpError as Parameters<typeof authErrorMessage>[0], t));
        return;
      }

      // Step 2: create the org + owner membership + active org + profile, on
      // the server. setupBusiness() rolls back by itself if it fails.
      let result: SetupResult;
      try {
        result = await setupBusiness(business);
      } catch {
        // No response (network, crash). Ask the server to finish or roll back.
        const outcome = await abandonSignup().catch(() => null);
        if (outcome?.status === "complete") {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        if (outcome?.status === "kept") {
          router.push("/onboarding");
          return;
        }
        setError(t.errors.setupFailed);
        return;
      }

      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: fieldMessage(result.field) });
        return;
      }
      if (result.error === "phone_taken" && result.accountRemoved) {
        // The new account was rolled back, so the same email can be reused:
        // the user only has to change the phone number and submit again.
        setFieldError({ field: "phone", message: t.errors.phoneTaken });
        return;
      }
      if ((result.error === "setup_failed" || result.error === "phone_taken") && !result.accountRemoved) {
        // Account kept but has no business: let them finish on /onboarding.
        router.push("/onboarding");
        return;
      }
      setError(result.error === "setup_failed" ? t.errors.setupFailed : t.errors.generic);
    } catch {
      setError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      lang={locale}
      title={t.signUpTitle}
      subtitle={t.signUpSubtitle}
      tabs={{ active: "signup", signInLabel: t.signInTab, signUpLabel: t.signUpTab }}
      backHomeLabel={t.backHome}
    >
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-6">
        <FieldGroup legend={t.yourDetails}>
          <Field label={t.name} name="name" autoComplete="name" placeholder={t.namePlaceholder} required maxLength={100} />
          <Field
            label={t.email}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t.emailPlaceholder}
            required
          />
          <PasswordField
            label={t.password}
            name="password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
            placeholder={t.newPasswordPlaceholder}
            autoComplete="new-password"
            required
            minLength={8}
            hint={t.passwordHint}
          />
        </FieldGroup>

        <FieldGroup legend={t.businessDetails}>
          <Field
            label={t.businessName}
            name="businessName"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={100}
            error={fieldError?.field === "businessName" ? fieldError.message : null}
          />
          <Field
            label={t.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={t.phonePlaceholder}
            hint={t.phoneHint}
            required
            error={fieldError?.field === "phone" ? fieldError.message : null}
          />
        </FieldGroup>

        <FormError message={error} />
        <SubmitButton pending={pending} label={t.signUp} pendingLabel={t.pending} />
      </form>
    </AuthShell>
  );
}
