// Display helpers shared by server and client components.

/** Fills "{key}" placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** Picks the "one" or "other" string and fills {n}. */
export const plural = (n: number, one: string, other: string) => (n === 1 ? one : fill(other, { n }));

const intlLocale = (locale: string) => (locale === "hi" ? "hi-IN" : "en-IN");

/** "2026-11-18" → "18 Nov" (or "18 Nov 2025" when not this year). The date is a calendar day, no time zone. */
export function formatDay(locale: string, isoDate: string, today?: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const sameYear = today ? today.slice(0, 4) === isoDate.slice(0, 4) : false;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Whole-number formatter for counts. */
export const countFormatter = (locale: string) => new Intl.NumberFormat(intlLocale(locale));
