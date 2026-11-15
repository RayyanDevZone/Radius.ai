"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addStore } from "@/lib/stores";
import type { Dictionary } from "@/i18n/dictionaries";

type StoresStrings = Dictionary["dashboard"]["stores"];

export function AddStoreForm({ t }: { t: StoresStrings }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      // No org id is sent: addStore() takes the tenant from the session.
      const result = await addStore({
        name: String(form.get("name") ?? ""),
        address: String(form.get("address") ?? ""),
      });
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
        return;
      }
      setError(
        result.error === "invalid_name"
          ? t.errors.invalidName
          : result.error === "duplicate_name"
            ? t.errors.duplicate
            : result.error === "forbidden"
              ? t.errors.forbidden
              : t.errors.failed,
      );
    } catch {
      setError(t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-accent-strong/80 bg-background/80 px-4 text-base placeholder:text-muted/60 focus:border-foreground focus:outline-none focus:ring-4 focus:ring-accent/70";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.name}
          <input name="name" required minLength={2} maxLength={100} placeholder={t.namePlaceholder} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.address}
          <input name="address" maxLength={300} placeholder={t.addressPlaceholder} className={inputClass} />
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-foreground px-6 text-base font-medium text-background transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:self-start"
      >
        {pending ? "…" : `+ ${t.add}`}
      </button>
    </form>
  );
}
