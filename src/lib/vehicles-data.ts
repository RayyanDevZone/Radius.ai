import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { getContext } from "@/lib/auth-context";
import { sortAlphabetically } from "@/lib/sort";
import type { VehicleType } from "@/lib/vehicles";

export type VehicleRow = { id: string; number: string; type: VehicleType };

/** Vehicles of the current business, sorted A→Z by number. The tenant comes from the session only. */
export async function listVehicles(): Promise<VehicleRow[]> {
  const { orgId } = await getContext();
  const rows = await db
    .select({ id: vehicles.id, number: vehicles.number, type: vehicles.type })
    .from(vehicles)
    .where(eq(vehicles.organizationId, orgId));
  // The check constraint guarantees `type`.
  return sortAlphabetically(rows as VehicleRow[], (r) => r.number);
}
