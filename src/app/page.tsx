import Link from "next/link";
import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { DbStatusLogger } from "./db-status-logger";

const WORD = "Radius";
const LETTER_STAGGER = 0.06; // seconds between letters
const HEADING_START = 0.25;
const AFTER_HEADING = HEADING_START + WORD.length * LETTER_STAGGER + 0.3;

const delay = (s: number) => ({ animationDelay: `${s}s` });

async function Hero() {
  const { locale, t } = await getI18n();

  return (
    <section lang={locale} className="relative flex max-w-2xl flex-col items-center gap-7 text-center">
      <span
        className="animate-fade-up rounded-full border border-accent-strong bg-accent/60 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em]"
        style={delay(0)}
      >
        {t.home.badge}
      </span>

      <h1 lang="en" aria-label="Radius.ai" className="text-7xl leading-none tracking-tight sm:text-9xl">
        {WORD.split("").map((ch, i) => (
          <span
            key={i}
            aria-hidden
            className="animate-letter"
            style={delay(HEADING_START + i * LETTER_STAGGER)}
          >
            {ch}
          </span>
        ))}
        <span
          aria-hidden
          className="animate-letter italic"
          style={delay(HEADING_START + WORD.length * LETTER_STAGGER)}
        >
          <span className="text-shimmer">.ai</span>
        </span>
      </h1>

      <p
        className="animate-fade-up max-w-md text-lg leading-8 text-muted"
        style={delay(AFTER_HEADING)}
      >
        {t.home.tagline}
      </p>

      <Link
        href="/language"
        className="animate-fade-up group mt-2 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background shadow-[0_8px_30px_-10px_rgba(31,58,43,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-12px_rgba(31,58,43,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong"
        style={delay(AFTER_HEADING + 0.2)}
      >
        {t.home.continue}
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </section>
  );
}

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
      {/* soft, slowly breathing green glow behind the headline */}
      <div
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full bg-accent blur-3xl"
      />

      {/* Hero reads the language cookie, so it renders at request time. */}
      <Suspense fallback={null}>
        <Hero />
      </Suspense>

      <DbStatusLogger />
    </main>
  );
}
