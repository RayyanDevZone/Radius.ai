import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

/** The locale the user explicitly chose, or null if they haven't chosen yet. */
export async function getStoredLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

/** Current locale (falls back to English) and its dictionary. Request-time only. */
export async function getI18n() {
  const locale = (await getStoredLocale()) ?? DEFAULT_LOCALE;
  return { locale, t: getDictionary(locale) };
}
