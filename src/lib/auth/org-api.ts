import "server-only";
import { auth } from "@/lib/auth/server";

/**
 * Typed access to the organization plugin on the server.
 *
 * @neon/auth's server object exposes the organization endpoints at runtime
 * (organization/create, organization/set-active, ...), but its TypeScript
 * types leave the plugin out (`auth.organization` is `unknown`, and the session
 * has no `activeOrganizationId`). This declares only what the app uses.
 */
type AuthApiError = { code?: string; message?: string; status?: number } | null;
type AuthApiResult<T> = Promise<{ data: T | null; error: AuthApiError }>;

type OrganizationApi = {
  create(body: { name: string; slug: string; keepCurrentActiveOrganization?: boolean }): AuthApiResult<{
    id: string;
    name: string;
    slug: string;
  }>;
  setActive(body: { organizationId: string | null }): AuthApiResult<{ id: string } | null>;
};

export const organizationApi = (auth as unknown as { organization: OrganizationApi }).organization;

/** The session's active organization id (set by the organization plugin). */
export function activeOrganizationIdOf(session: { session?: object | null } | null | undefined): string | null {
  const value = (session?.session as { activeOrganizationId?: unknown } | null | undefined)?.activeOrganizationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}
