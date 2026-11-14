"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

const LANGUAGES = [
  { code: "en", native: "English", label: "English" },
  { code: "hi", native: "हिन्दी", label: "Hindi" },
] as const;

const delay = (s: number) => ({ animationDelay: `${s}s` });

export function LanguagePicker({
  startDelay,
  initial,
  continueLabels,
}: {
  startDelay: number;
  /** Previously chosen language (from the cookie), preselected if present. */
  initial: Locale | null;
  continueLabels: Record<Locale, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Locale | null>(initial);

  function onContinue() {
    if (!selected) return;
    // Remember the choice for a year; server code can read it via cookies().
    document.cookie = `${LOCALE_COOKIE}=${selected}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push("/dashboard");
    router.refresh(); // re-render server components with the new language
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div
        role="radiogroup"
        aria-label="Language / भाषा"
        className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {LANGUAGES.map((lang, i) => {
          const isSelected = selected === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={isSelected}
              lang={lang.code}
              onClick={() => setSelected(lang.code)}
              style={delay(startDelay + i * 0.12)}
              className={`animate-fade-up group relative flex flex-col items-start gap-1 rounded-2xl border px-6 py-5 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong ${
                isSelected
                  ? "border-foreground bg-accent/70 shadow-[0_14px_40px_-16px_rgba(31,58,43,0.55)]"
                  : "border-accent-strong/70 bg-background/60 hover:border-foreground/40 hover:bg-accent/40"
              }`}
            >
              <span className="font-serif text-3xl leading-tight">{lang.native}</span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                {lang.label}
              </span>
              <span
                aria-hidden
                className={`absolute right-5 top-5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-all duration-300 ${
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-accent-strong text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!selected}
        style={delay(startDelay + 0.35)}
        className="animate-fade-up group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background shadow-[0_8px_30px_-10px_rgba(31,58,43,0.5)] transition-all duration-300 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_40px_-12px_rgba(31,58,43,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span lang={selected ?? "en"}>{continueLabels[selected ?? "en"]}</span>
        <span
          aria-hidden
          className="transition-transform duration-300 group-enabled:group-hover:translate-x-1"
        >
          →
        </span>
      </button>
    </div>
  );
}
