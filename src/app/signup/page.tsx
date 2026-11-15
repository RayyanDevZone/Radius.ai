import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { SignupForm } from "./signup-form";

// Reads the language cookie, so it renders behind Suspense. Signed-in users
// are redirected to /dashboard by src/proxy.ts.
async function SignupGate() {
  const { locale, t } = await getI18n();
  return <SignupForm locale={locale} t={t.auth} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupGate />
    </Suspense>
  );
}
