"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
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
      setError(error.message ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const isSignUp = mode === "sign-up";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl">{isSignUp ? "Create an account" : "Sign in"}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {isSignUp && (
          <input name="name" placeholder="Name" required className="rounded border px-3 py-2" />
        )}
        <input name="email" type="email" placeholder="Email" required className="rounded border px-3 py-2" />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={8}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>
      <p className="text-sm">
        {isSignUp ? (
          <>Already have an account? <Link href="/auth/sign-in" className="underline">Sign in</Link></>
        ) : (
          <>No account? <Link href="/auth/sign-up" className="underline">Sign up</Link></>
        )}
      </p>
    </main>
  );
}
