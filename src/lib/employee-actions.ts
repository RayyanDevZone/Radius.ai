"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { employeeProfile, organizationProfile } from "@/db/schema";
import { authInvitation, authMember, authUser } from "@/db/auth-schema";
import { organizationApi } from "@/lib/auth/org-api";
import { AuthContextError, requireOwner } from "@/lib/auth-context";
import {
  EMPLOYEE_EMAIL_DOMAIN,
  normalizeEmployeeInput,
  validateEmployeeInput,
  validateEmployeeUpdate,
  type EmployeeField,
} from "@/lib/employees";
import { isUuid, type DeleteResult } from "@/lib/row-action-result";

export type AddEmployeeResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: EmployeeField }
  /** The phone is already someone's login (an owner's or another employee's). */
  | { ok: false; error: "phone_taken" }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "failed" };

/**
 * Creates an employee login for the current business. Owners only; the tenant
 * comes from requireOwner(), never from the input.
 *
 * Employees sign in with phone + password (see src/lib/sign-in.ts), so their
 * Neon Auth email is a generated placeholder. Managed Auth has no "add member"
 * endpoint, so this follows the same path as scripts/seed-test-data.mjs:
 *
 *   1. Owner (via auth, with the owner's cookies) invites the placeholder
 *      email as role "member".
 *   2. The employee account is signed up, and
 *   3. accepts the invitation. Steps 2-3 call Neon Auth DIRECTLY with their
 *      own cookie jar. Going through `auth` would put the employee's session
 *      cookie on the owner's browser.
 *   4. The employee_profile row (phone, designation) is written last, then the
 *      employee's temporary session is signed out.
 *
 * On failure, everything created so far is removed (invitation, user; member
 * and session rows cascade from the user).
 */
export async function addEmployee(raw: Record<string, unknown>): Promise<AddEmployeeResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }

  const input = normalizeEmployeeInput(raw ?? {});
  const invalid = validateEmployeeInput(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  if (await isPhoneTaken(input.phone)) return { ok: false, error: "phone_taken" };

  const email = `employee-${randomUUID()}@${EMPLOYEE_EMAIL_DOMAIN}`;
  const jar = new Map<string, string>();
  const origin = await requestOrigin();
  let invitationId: string | null = null;
  let userId: string | null = null;

  try {
    const { data: invite, error: inviteError } = await organizationApi.inviteMember({ email, role: "member", organizationId: orgId });
    if (inviteError || !invite?.id) throw new Error(`invite-member failed: ${inviteError?.code ?? inviteError?.message ?? "no id"}`);
    invitationId = invite.id;

    const signUp = await authCall("sign-up/email", { name: input.name, email, password: input.password }, jar, origin);
    userId = (signUp.json as { user?: { id?: string } } | null)?.user?.id ?? null;
    if (!signUp.ok || !userId) throw new Error(`sign-up failed: ${signUp.status} ${JSON.stringify(signUp.json)}`);

    const accept = await authCall("organization/accept-invitation", { invitationId }, jar, origin);
    if (!accept.ok) throw new Error(`accept-invitation failed: ${accept.status} ${JSON.stringify(accept.json)}`);

    // Unique index on phone catches a race with another add of the same number.
    await db.insert(employeeProfile).values({ userId, organizationId: orgId, phone: input.phone, designation: input.designation });
  } catch (err) {
    const phoneTaken = isPhoneUniqueViolation(err);
    if (!phoneTaken) console.error("[addEmployee] failed, rolling back", err);
    await rollback({ orgId, invitationId, userId, email });
    return phoneTaken ? { ok: false, error: "phone_taken" } : { ok: false, error: "failed" };
  }

  // Best effort: the employee signs in on their own device later.
  await authCall("sign-out", {}, jar, origin).catch(() => {});

  // The popup refreshes the list itself (router.refresh()) after it closes.
  return { ok: true };
}

/**
 * Phones are login ids for owners and employees alike, so they're unique across both.
 * `exceptUserId` skips the employee being edited (keeping their own number is fine).
 */
async function isPhoneTaken(phone: string, exceptUserId?: string) {
  const samePhone = eq(employeeProfile.phone, phone);
  const [[owner], [employee]] = await Promise.all([
    db
      .select({ id: organizationProfile.organizationId })
      .from(organizationProfile)
      .where(eq(organizationProfile.businessPhone, phone))
      .limit(1),
    db
      .select({ id: employeeProfile.userId })
      .from(employeeProfile)
      .where(exceptUserId ? and(samePhone, ne(employeeProfile.userId, exceptUserId)) : samePhone)
      .limit(1),
  ]);
  return Boolean(owner || employee);
}

export type UpdateEmployeeResult =
  | { ok: true }
  | { ok: false; error: "invalid_input"; field: Exclude<EmployeeField, "password"> }
  | { ok: false; error: "phone_taken" }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "forbidden" }
  | { ok: false; error: "failed" };

/**
 * The employee (non-owner member) with this member id in the owner's business,
 * or null. Every edit/delete goes through here, so a member id from another
 * business, or the owner's own membership, is never touched.
 */
async function findEmployee(orgId: string, memberId: string) {
  const [row] = await db
    .select({ memberId: authMember.id, userId: authMember.userId, email: authUser.email })
    .from(authMember)
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .where(and(eq(authMember.id, memberId), eq(authMember.organizationId, orgId), ne(authMember.role, "owner")))
    .limit(1);
  return row ?? null;
}

/** App-created employees have a generated placeholder email; their account belongs to this business only. */
const isAppCreated = (email: string) => email.endsWith(`@${EMPLOYEE_EMAIL_DOMAIN}`);

/**
 * Changes an employee's name, phone (their login) and designation. The password
 * is left as is. Owners only. Older email-only accounts are the user's own
 * account, so they can't be edited here (the UI hides Edit for them).
 */
export async function updateEmployee(memberId: string, raw: Record<string, unknown>): Promise<UpdateEmployeeResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(memberId)) return { ok: false, error: "not_found" };

  const { name, phone, designation } = normalizeEmployeeInput(raw ?? {});
  const input = { name, phone, designation };
  const invalid = validateEmployeeUpdate(input);
  if (invalid) return { ok: false, error: "invalid_input", field: invalid };

  try {
    const employee = await findEmployee(orgId, memberId);
    if (!employee || !isAppCreated(employee.email)) return { ok: false, error: "not_found" };
    if (await isPhoneTaken(phone, employee.userId)) return { ok: false, error: "phone_taken" };

    await db.transaction(async (tx) => {
      await tx.update(authUser).set({ name }).where(eq(authUser.id, employee.userId));
      await tx
        .insert(employeeProfile)
        .values({ userId: employee.userId, organizationId: orgId, phone, designation })
        .onConflictDoUpdate({ target: employeeProfile.userId, set: { phone, designation, updatedAt: new Date() } });
    });
    return { ok: true };
  } catch (err) {
    if (isPhoneUniqueViolation(err)) return { ok: false, error: "phone_taken" };
    console.error("[updateEmployee] failed", err);
    return { ok: false, error: "failed" };
  }
}

/**
 * Removes an employee from the business. Owners only.
 *  - App-created employee: the whole login is deleted (member and session rows
 *    cascade from the user), so they can't sign in any more.
 *  - Older email-only account: it's the person's own account, so only their
 *    membership in this business is removed.
 */
export async function deleteEmployee(memberId: string): Promise<DeleteResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireOwner());
  } catch (err) {
    if (err instanceof AuthContextError) return { ok: false, error: "forbidden" };
    throw err;
  }
  if (!isUuid(memberId)) return { ok: false, error: "not_found" };

  try {
    const employee = await findEmployee(orgId, memberId);
    if (!employee) return { ok: false, error: "not_found" };

    await db.transaction(async (tx) => {
      await tx
        .delete(employeeProfile)
        .where(and(eq(employeeProfile.userId, employee.userId), eq(employeeProfile.organizationId, orgId)));
      if (isAppCreated(employee.email)) {
        await tx.delete(authUser).where(and(eq(authUser.id, employee.userId), eq(authUser.email, employee.email)));
        // The accepted invitation for the placeholder email is no longer useful.
        await tx.delete(authInvitation).where(and(eq(authInvitation.organizationId, orgId), eq(authInvitation.email, employee.email)));
      } else {
        await tx.delete(authMember).where(and(eq(authMember.id, employee.memberId), eq(authMember.organizationId, orgId)));
      }
    });
    return { ok: true };
  } catch (err) {
    console.error("[deleteEmployee] failed", err);
    return { ok: false, error: "failed" };
  }
}

function isPhoneUniqueViolation(err: unknown) {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const pg = e?.cause?.code ? e.cause : e;
  return pg?.code === "23505" && pg?.constraint === "employee_profile_phone_key";
}

/**
 * Removes only what this call created. The user id and invitation id came from
 * Neon Auth in this same request, and the placeholder email is unique to it.
 */
async function rollback({ orgId, invitationId, userId, email }: { orgId: string; invitationId: string | null; userId: string | null; email: string }) {
  try {
    await db.transaction(async (tx) => {
      if (userId) await tx.delete(authUser).where(and(eq(authUser.id, userId), eq(authUser.email, email)));
      if (invitationId) {
        await tx
          .delete(authInvitation)
          .where(and(eq(authInvitation.id, invitationId), eq(authInvitation.organizationId, orgId), eq(authInvitation.email, email)));
      }
    });
  } catch (err) {
    console.error("[addEmployee] rollback failed", { userId, invitationId, err });
  }
}

/** Same origin the auth SDK sends for this request (Neon Auth checks it). */
async function requestOrigin() {
  const h = await headers();
  return h.get("origin") || h.get("referer")?.split("/").slice(0, 3).join("/") || "";
}

/** Calls Neon Auth with a private cookie jar. Never touches the browser's cookies. */
async function authCall(path: string, body: unknown, jar: Map<string, string>, origin: string) {
  const base = process.env.NEON_AUTH_BASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
    },
    body: JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const json: unknown = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}
