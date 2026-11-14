import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { AuthForm } from "./auth-form";

type Mode = "sign-in" | "sign-up";

async function Localized({ mode }: { mode: Mode }) {
  const { locale, t } = await getI18n();
  return <AuthForm mode={mode} locale={locale} t={t.auth} />;
}

// Reads the language cookie at request time, so it sits behind Suspense.
export function LocalizedAuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={null}>
      <Localized mode={mode} />
    </Suspense>
  );
}
