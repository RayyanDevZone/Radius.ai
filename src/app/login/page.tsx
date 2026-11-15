import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

// Reads the language cookie, so it renders behind Suspense. Signed-in users
// are redirected to /dashboard by src/proxy.ts.
async function LoginGate() {
  const { locale, t } = await getI18n();
  return <LoginForm locale={locale} t={t.auth} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginGate />
    </Suspense>
  );
}
