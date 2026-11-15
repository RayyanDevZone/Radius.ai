"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setupBusiness } from "@/lib/business-setup";
import { normalizeBusinessInput, validateBusinessInput, type BusinessField } from "@/lib/validation";
import { AuthShell, Field, FormError, SubmitButton } from "@/components/form-ui";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import type { Dictionary } from "@/i18n/dictionaries";

/** Safety net: a signed-in user with no business finishes setup here. */
export function OnboardingForm({
  locale,
  t,
  tOnboarding,
}: {
  locale: string;
  t: Dictionary["auth"];
  tOnboarding: Dictionary["onboarding"];
}) {
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
    const business = normalizeBusinessInput({ businessName: form.get("businessName"), phone: form.get("phone") });
    const invalid = validateBusinessInput(business);
    if (invalid) {
      setFieldError({ field: invalid, message: fieldMessage(invalid) });
      return;
    }
    setPending(true);
    try {
      const result = await setupBusiness(business);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else if (result.error === "invalid_input") {
        setFieldError({ field: result.field, message: fieldMessage(result.field) });
      } else if (result.error === "phone_taken" && !result.accountRemoved) {
        setFieldError({ field: "phone", message: t.errors.phoneTaken });
      } else if (result.error === "unauthenticated" || result.accountRemoved) {
        router.push("/signup");
        router.refresh();
      } else {
        setError(t.errors.setupFailedKept);
      }
    } catch {
      setError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      lang={locale}
      title={tOnboarding.title}
      subtitle={tOnboarding.subtitle}
      footer={<SignOutButton label={tOnboarding.signOut} />}
    >
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
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
        <FormError message={error} />
        <SubmitButton pending={pending} label={tOnboarding.submit} pendingLabel={t.pending} />
      </form>
    </AuthShell>
  );
}
