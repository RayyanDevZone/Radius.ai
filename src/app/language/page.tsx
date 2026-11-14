import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getStoredLocale } from "@/i18n/server";
import { LanguagePicker } from "./language-picker";

const delay = (s: number) => ({ animationDelay: `${s}s` });

function Title({ locale, shimmer }: { locale: Locale; shimmer: boolean }) {
  const t = getDictionary(locale).language;
  return (
    <span lang={locale}>
      {t.titleBefore}
      <span className={shimmer ? "text-shimmer italic" : "italic"}>{t.titleAccent}</span>
      {t.titleAfter}
    </span>
  );
}

async function LanguageContent() {
  const stored = await getStoredLocale();
  // This page's labels stay in English (Hindi appears only in the subheading).
  const t = getDictionary("en").language;

  return (
    <section className="relative flex w-full max-w-2xl flex-col items-center gap-7 text-center">
      <span
        lang="en"
        className="animate-fade-up rounded-full border border-accent-strong bg-accent/60 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em]"
        style={delay(0)}
      >
        {t.badge}
      </span>

      {/* Always bilingual: English heading, Hindi subheading. */}
      <h1 className="animate-fade-up text-5xl leading-tight tracking-tight sm:text-7xl" style={delay(0.15)}>
        <Title locale="en" shimmer />
      </h1>

      <p className="animate-fade-up font-serif text-2xl text-muted" style={delay(0.3)}>
        <Title locale="hi" shimmer={false} />
      </p>

      <LanguagePicker
        startDelay={0.45}
        initial={stored}
        continueLabels={{
          en: getDictionary("en").language.continue,
          hi: getDictionary("hi").language.continue,
        }}
      />
    </section>
  );
}

export default function LanguagePage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full bg-accent blur-3xl"
      />
      <Suspense fallback={null}>
        <LanguageContent />
      </Suspense>
    </main>
  );
}
