"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import { organizationProfile } from "@/db/schema";
import { authMember, authUser } from "@/db/auth-schema";
import { isValidPhone, normalizePhone } from "@/lib/validation";

export type SignInResult = { ok: true } | { ok: false; code: string };

const INVALID = "INVALID_EMAIL_OR_PASSWORD";

/**
 * Sign in with "Email / Phone Number" + password, entirely on the server.
 *
 * - Contains "@": treated as an email.
 * - Otherwise: normalized like a business phone, then mapped to the email of
 *   the OWNER of the business whose organization_profile.business_phone
 *   matches. The mapping never leaves the server, so owners' emails are never
 *   exposed to the browser.
 *
 * auth.signIn.email() here sets the session cookie on this action's response.
 * The next request (the client then calls activateOrganization()) sees it.
 *
 * An unknown phone number gets the same error as a wrong password, and still
 * makes one sign-in attempt against an address that can't exist, so the
 * response (and roughly its timing) doesn't reveal which numbers are registered.
 */
export async function signInWithIdentifier(raw: { identifier: string; password: string }): Promise<SignInResult> {
  const identifier = String(raw?.identifier ?? "").trim();
  const password = String(raw?.password ?? "");
  if (!identifier || !password) return { ok: false, code: INVALID };

  const isEmail = identifier.includes("@");
  let email: string | null = isEmail ? identifier : null;
  if (!isEmail) {
    const phone = normalizePhone(identifier);
    email = isValidPhone(phone) ? await ownerEmailForPhone(phone) : null;
  }

  try {
    const { error } = await auth.signIn.email({
      email: email ?? `no-account-${randomUUID()}@example.invalid`,
      password,
    });
    if (!error && email) return { ok: true };
    // Phone logins only ever see "invalid credentials", whatever went wrong.
    if (!isEmail || !email) return { ok: false, code: INVALID };
    return { ok: false, code: error?.code ?? "UNKNOWN" };
  } catch (err) {
    console.error("[signInWithIdentifier] sign-in request failed", err);
    return { ok: false, code: "UNKNOWN" };
  }
}

/** Email of the owner of the business with this (normalized) phone, or null. */
async function ownerEmailForPhone(phone: string): Promise<string | null> {
  const [row] = await db
    .select({ email: authUser.email })
    .from(organizationProfile)
    .innerJoin(
      authMember,
      and(eq(authMember.organizationId, organizationProfile.organizationId), eq(authMember.role, "owner")),
    )
    .innerJoin(authUser, eq(authUser.id, authMember.userId))
    .where(eq(organizationProfile.businessPhone, phone))
    .orderBy(asc(authMember.createdAt))
    .limit(1);
  return row?.email ?? null;
}
