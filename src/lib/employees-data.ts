import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { authMember, authUser } from "@/db/auth-schema";
import { requireOwner } from "@/lib/auth-context";

export type EmployeeRow = { id: string; name: string; email: string };

/**
 * Employees of the current business (members whose role isn't "owner").
 * Owner-only. The tenant comes from the session via requireOwner().
 */
export async function listEmployees(): Promise<EmployeeRow[]> {
  const { orgId } = await requireOwner();
  return db
    .select({ id: authMember.id, name: authUser.name, email: authUser.email })
    .from(authMember)
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .where(and(eq(authMember.organizationId, orgId), ne(authMember.role, "owner")))
    .orderBy(asc(authMember.createdAt));
}
