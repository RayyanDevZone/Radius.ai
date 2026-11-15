import type { Dictionary } from "@/i18n/dictionaries";

/** Anything an auth call can hand back as an error. */
type AuthErrorLike =
  | string
  | undefined
  | null
  | { code?: string; message?: string; error?: { code?: string; message?: string } | unknown };

/**
 * Maps auth errors to translated messages.
 *
 * @neon/auth renames Better Auth's error codes to Supabase-style ones
 * (INVALID_EMAIL_OR_PASSWORD → invalid_credentials), and codes it doesn't
 * know fall back to a generic one picked from the HTTP status. For example,
 * USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL (422) becomes "validation_failed". So:
 *   1. use the raw Better Auth code when the SDK keeps it (`error.error.code`),
 *   2. else the (possibly renamed) `code`,
 *   3. else recognise the original message, which the SDK keeps.
 */
export function authErrorMessage(err: AuthErrorLike, t: Dictionary["auth"]) {
  const obj = typeof err === "object" && err ? err : null;
  const raw = obj?.error && typeof obj.error === "object" ? (obj.error as { code?: string }).code : undefined;
  const code = raw ?? obj?.code ?? (typeof err === "string" ? err : undefined);
  const message = (obj?.message ?? "").toLowerCase();

  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "invalid_credentials":
      return t.errors.invalidCredentials;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
    case "user_already_exists":
    case "email_exists":
      return t.errors.userExists;
    case "PASSWORD_TOO_SHORT":
    case "weak_password":
      return t.errors.passwordTooShort;
  }

  if (message.includes("already exists")) return t.errors.userExists;
  if (message.includes("invalid email or password")) return t.errors.invalidCredentials;
  if (message.includes("password") && message.includes("short")) return t.errors.passwordTooShort;
  return t.errors.generic;
}
