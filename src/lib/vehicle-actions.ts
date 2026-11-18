"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import { normalizeVehicleInput, validateVehicleInput, type VehicleField } from "@/lib/vehicles";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";

export type AddVehicleResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: VehicleField }
  /** This business already has a vehicle with this number. */
  | { ok: false; error: "taken" }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "failed" };

export type UpdateVehicleResult = AddVehicleResult | { ok: false; error: "not_found" };

/** Postgres unique_violation on the per-business vehicle number index. */
function isNumberTaken(err: unknown) {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const pg = e?.cause?.code ? e.cause : e;
  return pg?.code === "23505" && pg?.constraint === "vehicles_organization_id_number_key";
}

/**
 * Adds a vehicle to the current business. Owners only. The tenant comes from
 * the session (requireOwner()), never from the input.
 */
export async function addVehicle(raw: Record<string, unknown>): Promise<AddVehicleResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const input = normalizeVehicleInput(raw ?? {});
  const invalid = validateVehicleInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    await db.insert(vehicles).values({ ...input, organizationId: orgId });
  } catch (err) {
    if (isNumberTaken(err)) return { ok: false, error: "taken" };
    console.error("addVehicle failed", err);
    return { ok: false, error: "failed" };
  }

  // The popup refreshes the list itself (router.refresh()) after it closes,
  // so a slow page re-render never keeps the Save button spinning.
  return { ok: true };
}

/** Updates one vehicle of the current business. Owners only; one from another business is "not_found". */
export async function updateVehicle(id: string, raw: Record<string, unknown>): Promise<UpdateVehicleResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  const input = normalizeVehicleInput(raw ?? {});
  const invalid = validateVehicleInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    const rows = await db
      .update(vehicles)
      .set(input)
      .where(and(eq(vehicles.id, id), eq(vehicles.organizationId, orgId)))
      .returning({ id: vehicles.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    if (isNumberTaken(err)) return { ok: false, error: "taken" };
    console.error("updateVehicle failed", err);
    return { ok: false, error: "failed" };
  }
}

/** Deletes one vehicle of the current business. Owners only. */
export async function deleteVehicle(id: string): Promise<DeleteResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(id)) return { ok: false, error: "not_found" };

  try {
    const rows = await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.organizationId, orgId)))
      .returning({ id: vehicles.id });
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  } catch (err) {
    console.error("deleteVehicle failed", err);
    return { ok: false, error: "failed" };
  }
}
