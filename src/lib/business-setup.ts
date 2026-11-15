"use server";

import { randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { activeOrganizationIdOf, organizationApi } from "@/lib/auth/org-api";
import { db } from "@/db";
import { organizationProfile, stores } from "@/db/schema";
import { authMember, authOrganization, authUser } from "@/db/auth-schema";
import { normalizeBusinessInput, validateBusinessInput, type BusinessField } from "@/lib/validation";

/**
 * Sign-up runs in two steps, because the Neon Auth server SDK reads cookies
 * from the incoming request. A session created in a server action isn't
 * visible to later auth calls in that same action.
 *
 *   1. Browser: authClient.signUp.email(...). The session cookie is now set.
 *   2. Server:  setupBusiness(...). Creates the org (the caller becomes
 *      "owner"), makes it the active org, then writes its profile. On any
 *      failure it rolls back: deletes the org it created and, for a brand-new
 *      account, deletes the user too. No user is left without an org.
 *
 * A signup counts as complete once the organization_profile row exists. It's
 * written last.
 */

export type SetupResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: BusinessField }
  | { ok: false; error: "unauthenticated" }
  /** Another business already uses this phone number (it's a login id). */
  | { ok: false; error: "phone_taken"; accountRemoved: boolean }
  | { ok: false; error: "setup_failed"; accountRemoved: boolean };

class PhoneTakenError extends Error {}

/** Postgres unique_violation on the business phone index. */
function isPhoneUniqueViolation(err: unknown) {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const pg = e?.cause?.code ? e.cause : e;
  return pg?.code === "23505" && pg?.constraint === "organization_profile_business_phone_key";
}

/** Accounts newer than this with no complete business get deleted on rollback. */
const NEW_ACCOUNT_WINDOW = sql`now() - interval '1 hour'`;

function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "business"}-${randomBytes(3).toString("hex")}`;
}

export async function setupBusiness(raw: { businessName: string; phone: string }): Promise<SetupResult> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "unauthenticated" };

  const input = normalizeBusinessInput(raw);
  const invalidField = validateBusinessInput(input);
  if (invalidField) {
    // Bad input after the account already exists (the browser checks first,
    // so this only happens with a tampered request). Same rollback rule.
    const accountRemoved = await cleanupIncompleteSignup(userId);
    return accountRemoved
      ? { ok: false, error: "setup_failed", accountRemoved }
      : { ok: false, error: "invalid_input", field: invalidField };
  }

  // Double submit / retry: if the user already has a complete business, finish.
  if (await hasCompleteBusiness(userId)) {
    await activateOrganization();
    return { ok: true };
  }

  try {
    // Phone numbers are unique (owners sign in with them). Check before
    // creating anything. The unique index catches races at insert time.
    const [taken] = await db
      .select({ id: organizationProfile.organizationId })
      .from(organizationProfile)
      .where(eq(organizationProfile.businessPhone, input.phone))
      .limit(1);
    if (taken) throw new PhoneTakenError();

    const { data: org, error } = await organizationApi.create({
      name: input.businessName,
      slug: makeSlug(input.businessName),
    });
    if (error || !org?.id) throw new Error(`organization.create failed: ${error?.code ?? error?.message ?? "no org returned"}`);

    // The org plugin adds the creator with creatorRole "owner". Check that.
    const [owner] = await db
      .select({ role: authMember.role })
      .from(authMember)
      .where(and(eq(authMember.organizationId, org.id), eq(authMember.userId, userId)))
      .limit(1);
    if (owner?.role !== "owner") throw new Error("creator was not added as owner");

    const { error: activeError } = await organizationApi.setActive({ organizationId: org.id });
    if (activeError) throw new Error(`organization.setActive failed: ${activeError.code ?? activeError.message}`);

    // Last step. Once this row exists, the signup is complete.
    await db.insert(organizationProfile).values({ organizationId: org.id, businessPhone: input.phone });
    return { ok: true };
  } catch (err) {
    const phoneTaken = err instanceof PhoneTakenError || isPhoneUniqueViolation(err);
    if (!phoneTaken) console.error("[setupBusiness] failed, rolling back", err);
    // Same rollback either way. A brand-new account is removed, so the
    // sign-up form can simply be resubmitted with a different number.
    const accountRemoved = await cleanupIncompleteSignup(userId);
    return { ok: false, error: phoneTaken ? "phone_taken" : "setup_failed", accountRemoved };
  }
}

/**
 * Called by the sign-up form if setupBusiness() didn't return a result (e.g.
 * the network dropped). Applies the same rollback rule.
 */
export async function abandonSignup(): Promise<{ status: "complete" | "removed" | "kept" | "signed_out" }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { status: "signed_out" };
  if (await hasCompleteBusiness(userId)) return { status: "complete" };
  return { status: (await cleanupIncompleteSignup(userId)) ? "removed" : "kept" };
}

/**
 * After sign-in: make one of the user's orgs the session's active org. The org
 * id is picked on the server from neon_auth.member, never sent by the client.
 */
export async function activateOrganization(): Promise<{ next: "/dashboard" | "/onboarding" | "/login" }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { next: "/login" };

  const memberships = await db
    .select({ orgId: authMember.organizationId })
    .from(authMember)
    .where(eq(authMember.userId, userId))
    .orderBy(asc(authMember.createdAt));
  if (memberships.length === 0) return { next: "/onboarding" };

  const current = activeOrganizationIdOf(session);
  if (current && memberships.some((m) => m.orgId === current)) return { next: "/dashboard" };

  const { error } = await organizationApi.setActive({ organizationId: memberships[0].orgId });
  if (error) console.error("[activateOrganization] setActive failed", error);
  // getContext() falls back to the single membership if this didn't stick.
  return { next: "/dashboard" };
}

async function hasCompleteBusiness(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(authMember)
    .innerJoin(organizationProfile, eq(organizationProfile.organizationId, authMember.organizationId))
    .where(eq(authMember.userId, userId));
  return (row?.n ?? 0) > 0;
}

/**
 * Rollback for a failed or abandoned signup. Never touches a complete business.
 *
 * - Deletes orgs where this user is the ONLY member and no profile row exists
 *   (i.e. orgs that setupBusiness created but didn't finish). member and
 *   invitation rows are removed by ON DELETE CASCADE.
 * - If the user then belongs to no org and the account is less than an hour
 *   old, signs them out and deletes the user (session and account rows
 *   cascade). Older accounts are kept and sent to /onboarding to retry.
 *
 * Returns true if the user account was deleted. This writes to neon_auth
 * directly because Managed Auth has no server hook or transaction around
 * signup. It only ever deletes rows tied to this user's own incomplete signup.
 */
async function cleanupIncompleteSignup(userId: string): Promise<boolean> {
  try {
    const userOrgIds = db
      .select({ id: authMember.organizationId })
      .from(authMember)
      .where(eq(authMember.userId, userId));

    const incompleteOrgs = await db
      .select({ id: authOrganization.id })
      .from(authOrganization)
      .leftJoin(organizationProfile, eq(organizationProfile.organizationId, authOrganization.id))
      .where(and(inArray(authOrganization.id, userOrgIds), isNull(organizationProfile.organizationId)));

    // Only orgs with no other members.
    const orgIdsToDelete: string[] = [];
    for (const { id } of incompleteOrgs) {
      const [others] = await db
        .select({ n: count() })
        .from(authMember)
        .where(and(eq(authMember.organizationId, id), ne(authMember.userId, userId)));
      if ((others?.n ?? 0) === 0) orgIdsToDelete.push(id);
    }

    const [remaining] = await db
      .select({ n: count() })
      .from(authMember)
      .where(
        orgIdsToDelete.length
          ? and(eq(authMember.userId, userId), notInArray(authMember.organizationId, orgIdsToDelete))
          : eq(authMember.userId, userId),
      );
    const [isNew] = await db
      .select({ id: authUser.id })
      .from(authUser)
      .where(and(eq(authUser.id, userId), gt(authUser.createdAt, NEW_ACCOUNT_WINDOW)))
      .limit(1);
    const deleteUser = (remaining?.n ?? 0) === 0 && Boolean(isNew);

    // Clear the auth cookies while the session still exists.
    if (deleteUser) {
      const { error } = await auth.signOut();
      if (error) console.error("[cleanupIncompleteSignup] signOut failed", error);
    }

    await db.transaction(async (tx) => {
      if (orgIdsToDelete.length) {
        // App rows first (no FK to neon_auth), then the org itself.
        await tx.delete(stores).where(inArray(stores.organizationId, orgIdsToDelete));
        await tx.delete(authOrganization).where(inArray(authOrganization.id, orgIdsToDelete));
      }
      if (deleteUser) {
        await tx.delete(authUser).where(eq(authUser.id, userId));
      }
    });
    return deleteUser;
  } catch (err) {
    console.error("[cleanupIncompleteSignup] rollback failed", { userId, err });
    return false;
  }
}
