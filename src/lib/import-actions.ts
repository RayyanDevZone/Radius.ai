"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, shops, vehicles } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import { addEmployee } from "@/lib/employee-actions";
import {
  IMPORT_COLUMNS,
  IMPORT_KINDS,
  MAX_IMPORT_ROWS,
  checkRows,
  toInput,
  type ImportKind,
  type ImportRaw,
  type RowIssue,
} from "@/lib/import/specs";
import type { ProductInput } from "@/lib/products";
import type { ShopInput } from "@/lib/shops";
import type { VehicleInput } from "@/lib/vehicles";

export type ImportResult =
  /** `failed` is only ever non-empty for employees (each one is its own login, so they can't share one transaction). */
  | { ok: true; added: number; failed: RowIssue[] }
  /** Some rows are invalid. Nothing was saved. */
  | { ok: false; error: "invalid_rows"; issues: RowIssue[] }
  | { ok: false; error: "empty" | "too_many" | "forbidden" | "failed" };

/**
 * Bulk-adds rows from an uploaded CSV / XLSX to the current business. Owners
 * only; the tenant comes from requireOwner(), never from the input.
 *
 * Products, shops and vehicles are all-or-nothing: if any row is invalid (or a
 * vehicle number already exists), nothing is saved, so fixing the file and
 * uploading it again never creates duplicates.
 */
export async function importRows(kind: ImportKind, rawRows: unknown): Promise<ImportResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!(IMPORT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "failed" };

  const rows = sanitize(kind, rawRows);
  if (!rows) return { ok: false, error: "failed" };
  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.length > MAX_IMPORT_ROWS[kind]) return { ok: false, error: "too_many" };

  const issues = checkRows(kind, rows);
  if (issues.length) return { ok: false, error: "invalid_rows", issues };

  if (kind === "employees") return importEmployees(rows);

  const inputs = rows.map((r) => ({ row: r.row, input: toInput(kind, r.raw) }));
  try {
    if (kind === "vehicles") {
      const numbers = inputs.map((r) => (r.input as VehicleInput).number);
      const existing = await db
        .select({ number: vehicles.number })
        .from(vehicles)
        .where(and(eq(vehicles.organizationId, orgId), inArray(vehicles.number, numbers)));
      if (existing.length) {
        const taken = new Set(existing.map((e) => e.number));
        return {
          ok: false,
          error: "invalid_rows",
          issues: inputs.filter((r) => taken.has((r.input as VehicleInput).number)).map((r) => ({ row: r.row, field: "taken" })),
        };
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < inputs.length; i += 500) {
        const chunk = inputs.slice(i, i + 500).map((r) => ({ ...r.input, organizationId: orgId }));
        if (kind === "products") await tx.insert(products).values(chunk as (ProductInput & { organizationId: string })[]);
        else if (kind === "shops") await tx.insert(shops).values(chunk as (ShopInput & { organizationId: string })[]);
        else await tx.insert(vehicles).values(chunk as (VehicleInput & { organizationId: string })[]);
      }
    });
  } catch (err) {
    console.error(`[importRows:${kind}] failed`, err);
    return { ok: false, error: "failed" };
  }

  // The dialog refreshes the list itself (router.refresh()).
  return { ok: true, added: inputs.length, failed: [] };
}

/** One login per employee, created one at a time with addEmployee()'s own rollback. */
async function importEmployees(rows: { row: number; raw: ImportRaw }[]): Promise<ImportResult> {
  let added = 0;
  const failed: RowIssue[] = [];
  for (const { row, raw } of rows) {
    const result = await addEmployee(raw);
    if (result.ok) added++;
    else if (result.error === "forbidden") return { ok: false, error: "forbidden" };
    else failed.push({ row, field: result.error === "phone_taken" ? "phoneTaken" : result.error === "invalid_input" ? result.field : "failed" });
  }
  return { ok: true, added, failed };
}

/** Rows come from the client: keep only known fields, as bounded strings. */
function sanitize(kind: ImportKind, value: unknown): { row: number; raw: ImportRaw }[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_IMPORT_ROWS[kind]) return value.map(() => ({ row: 0, raw: {} }));
  const fields = IMPORT_COLUMNS[kind].map((c) => c.field);
  const out: { row: number; raw: ImportRaw }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { row, raw } = item as { row?: unknown; raw?: unknown };
    if (typeof row !== "number" || !Number.isInteger(row) || !raw || typeof raw !== "object") return null;
    const clean: ImportRaw = {};
    for (const f of fields) {
      const v = (raw as Record<string, unknown>)[f];
      clean[f] = (typeof v === "string" || typeof v === "number" ? String(v) : "").slice(0, 500);
    }
    out.push({ row, raw: clean });
  }
  return out;
}
