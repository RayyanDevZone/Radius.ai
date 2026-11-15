import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthContextError, getContext } from "@/lib/auth-context";
import { getI18n } from "@/i18n/server";
import { OnboardingForm } from "./onboarding-form";

async function OnboardingGate() {
  try {
    await getContext();
  } catch (err) {
    if (!(err instanceof AuthContextError)) throw err;
    if (err.code === "UNAUTHENTICATED") redirect("/login");
    // NO_ORGANIZATION: the only case where this page is useful.
    const { locale, t } = await getI18n();
    return <OnboardingForm locale={locale} t={t.auth} tOnboarding={t.onboarding} />;
  }
  // Already belongs to a business.
  redirect("/dashboard");
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingGate />
    </Suspense>
  );
}
