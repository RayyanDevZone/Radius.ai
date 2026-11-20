// Shared result shape and helpers for the Edit / Delete row actions.

/** `in_use`: other records (deliveries, payments) still point at it. */
export type DeleteResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" | "failed" | "in_use" };

/**
 * Something still references the row: Postgres foreign_key_violation (23503)
 * or restrict_violation (23001, from ON DELETE RESTRICT). Drizzle wraps the
 * driver error, so look through `cause`.
 */
export const isForeignKeyViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === "23503" || code === "23001" || isForeignKeyViolation((err as { cause?: unknown }).cause);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row ids come from the client, so check the shape before Postgres sees them. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
