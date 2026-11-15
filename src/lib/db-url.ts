/**
 * pg (v8) already treats sslmode=prefer|require|verify-ca as "verify-full"
 * (full certificate + hostname check) but warns that pg v9 will switch them to
 * weaker libpq semantics. Neon's connection strings use sslmode=require, so we
 * state the current, strict behaviour explicitly. This silences the warning
 * and keeps verify-full after the pg v9 upgrade. Neon's certificates are
 * publicly trusted, so no CA file is needed.
 *
 * No `server-only` import: drizzle.config.ts uses this too.
 */
export function withVerifiedSsl(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString;
  try {
    const url = new URL(connectionString);
    const mode = url.searchParams.get("sslmode");
    if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return connectionString; // not a URL (e.g. key=value form): leave untouched
  }
}
