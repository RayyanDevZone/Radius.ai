import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth/server";
import { pool } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { SignOutButton } from "./sign-out-button";

async function DashboardContent() {
  await connection(); // request-time only; don't prerender session-dependent UI
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const { locale, t } = await getI18n();
  const { rows } = await pool.query<{ now: Date }>("select now() as now");
  const dbTime = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  }).format(rows[0].now);

  return (
    <div lang={locale} className="flex flex-col gap-4">
      <h1 className="text-4xl">{t.dashboard.title}</h1>
      <p>
        {t.dashboard.signedInAs} <strong>{session.user.email}</strong>
      </p>
      <p className="text-sm text-muted">
        {t.dashboard.dbTime}: {dbTime}
      </p>
      <SignOutButton label={t.dashboard.signOut} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-16">
      <Suspense fallback={<p aria-busy>…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
