import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth/server";
import { pool } from "@/lib/db";
import { SignOutButton } from "./sign-out-button";

async function DashboardContent() {
  await connection(); // request-time only; don't prerender session-dependent UI
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const { rows } = await pool.query<{ now: Date }>("select now() as now");

  return (
    <>
      <p>
        Signed in as <strong>{session.user.email}</strong>
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Database time: {rows[0].now.toISOString()}
      </p>
      <SignOutButton />
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-4xl">Dashboard</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
