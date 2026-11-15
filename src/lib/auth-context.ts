import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { activeOrganizationIdOf } from "@/lib/auth/org-api";
import { db } from "@/db";
import { authMember } from "@/db/auth-schema";

/**
 * App roles. Managed Neon Auth only supports the built-in organization roles
 * owner/admin/member, so an employee is stored as Better Auth "member".
 * Map roles here and nowhere else.
 */
export type AppRole = "owner" | "employee";

export function toAppRole(memberRole: string): AppRole {
  // "owner" is the only privileged role. Anything else (member, admin, unknown)
  // gets least privilege.
  return memberRole === "owner" ? "owner" : "employee";
}

export type TenantContext = {
  userId: string;
  /** Tenant id. Comes ONLY from the server-side session plus a member-table check. */
  orgId: string;
  role: AppRole;
};

export type AuthContextErrorCode = "UNAUTHENTICATED" | "NO_ORGANIZATION" | "FORBIDDEN";

export class AuthContextError extends Error {
  constructor(public readonly code: AuthContextErrorCode) {
    super(code);
    this.name = "AuthContextError";
  }
}

/**
 * Resolves the signed-in user's tenant from the server-side session.
 *
 * - Throws UNAUTHENTICATED if there is no valid session.
 * - Uses the session's activeOrganizationId and verifies the user is still a
 *   member of it in neon_auth.member.
 * - If the session has no valid active org, falls back to the user's earliest
 *   membership (still chosen on the server).
 * - Throws NO_ORGANIZATION if the user belongs to no org.
 *
 * Never accept an org id from the client, the URL or a request body. This
 * function takes no arguments on purpose. Cached per request.
 */
export const getContext = cache(async (): Promise<TenantContext> => {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AuthContextError("UNAUTHENTICATED");

  const activeOrgId = activeOrganizationIdOf(session);

  if (activeOrgId) {
    const [membership] = await db
      .select({ orgId: authMember.organizationId, role: authMember.role })
      .from(authMember)
      .where(and(eq(authMember.userId, userId), eq(authMember.organizationId, activeOrgId)))
      .limit(1);
    if (membership) return { userId, orgId: membership.orgId, role: toAppRole(membership.role) };
    // The active org points at an org the user no longer belongs to. Fall through.
  }

  // No (valid) active org: use the user's earliest membership, chosen
  // server-side from neon_auth.member. Login normally sets the active org via
  // activateOrganization(), so this is only a safety net.
  const [first] = await db
    .select({ orgId: authMember.organizationId, role: authMember.role })
    .from(authMember)
    .where(eq(authMember.userId, userId))
    .orderBy(asc(authMember.createdAt))
    .limit(1);

  if (first) return { userId, orgId: first.orgId, role: toAppRole(first.role) };
  throw new AuthContextError("NO_ORGANIZATION");
});

/** getContext(), but throws FORBIDDEN unless the user is the org's owner. */
export async function requireOwner(): Promise<TenantContext> {
  const ctx = await getContext();
  if (ctx.role !== "owner") throw new AuthContextError("FORBIDDEN");
  return ctx;
}

/**
 * For Server Components (pages). Turns context errors into redirects:
 * not signed in → /login, no business yet → /onboarding.
 */
export async function getPageContext(): Promise<TenantContext> {
  try {
    return await getContext();
  } catch (err) {
    if (err instanceof AuthContextError) {
      if (err.code === "UNAUTHENTICATED") redirect("/login");
      if (err.code === "NO_ORGANIZATION") redirect("/onboarding");
    }
    throw err;
  }
}
