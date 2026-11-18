import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { authMember, authUser } from "@/db/auth-schema";
import { employeeProfile } from "@/db/schema";
import { requireOwner } from "@/lib/auth-context";
import { EMPLOYEE_EMAIL_DOMAIN } from "@/lib/employees";
import { sortAlphabetically } from "@/lib/sort";

export type EmployeeRow = {
  id: string;
  name: string;
  /** Login phone for employees added in the app; null for older email-only accounts. */
  phone: string | null;
  designation: string | null;
  /** Only set for email-only accounts (app-added employees have a placeholder email). */
  email: string | null;
  /** App-created login (placeholder email): the owner can edit it. Older email-only accounts can only be removed. */
  editable: boolean;
};

/**
 * Employees of the current business (members whose role isn't "owner"),
 * sorted A→Z by name. Owner-only. The tenant comes from the session via requireOwner().
 */
export async function listEmployees(): Promise<EmployeeRow[]> {
  const { orgId } = await requireOwner();
  const rows = await db
    .select({
      id: authMember.id,
      name: authUser.name,
      email: authUser.email,
      phone: employeeProfile.phone,
      designation: employeeProfile.designation,
    })
    .from(authMember)
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .leftJoin(
      employeeProfile,
      and(eq(employeeProfile.userId, authMember.userId), eq(employeeProfile.organizationId, orgId)),
    )
    .where(and(eq(authMember.organizationId, orgId), ne(authMember.role, "owner")));
  return sortAlphabetically(
    rows.map((r) => ({
      ...r,
      email: r.phone ? null : r.email,
      editable: r.email.endsWith(`@${EMPLOYEE_EMAIL_DOMAIN}`),
    })),
    (r) => r.name,
  );
}
