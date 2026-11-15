"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
      className="h-11 shrink-0 rounded-xl border border-foreground/20 px-4 text-sm font-medium transition hover:bg-foreground hover:text-background disabled:opacity-60"
    >
      {label}
    </button>
  );
}
