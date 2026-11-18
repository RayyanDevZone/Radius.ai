// Shared result shape and helpers for the Edit / Delete row actions.

export type DeleteResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" | "failed" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row ids come from the client, so check the shape before Postgres sees them. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
