import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

/**
 * Route protection (first line of defence; pages and actions re-check with
 * getContext()):
 * - Every route not listed in PUBLIC_ROUTES needs a session. That covers
 *   /dashboard and everything under it, plus /onboarding. Logged-out users go
 *   to /login.
 * - Signed-in users opening /login or /signup are sent to /dashboard.
 */
const PUBLIC_ROUTES = ["/", "/language", "/login", "/signup", "/api/health", "/api/me"];
// Pages that signed-in users shouldn't see.
const GUEST_ONLY = new Set(["/login", "/signup"]);

const protect = auth.middleware({ loginUrl: "/login", publicRoutes: PUBLIC_ROUTES });

// Same Neon session check, with no public routes. It redirects (to this
// unused path) exactly when there is no valid session. We only read whether it
// redirected; nothing is ever served at this path.
const sessionProbe = auth.middleware({ loginUrl: "/__session-probe", publicRoutes: [] });

function withCookies(target: NextResponse, source: Response) {
  for (const cookie of source.headers.getSetCookie()) target.headers.append("Set-Cookie", cookie);
  return target;
}

export default async function proxy(request: NextRequest) {
  // Only real page loads/navigations. Server action POSTs to /login or
  // /signup must not be redirected: their re-render still carries the old
  // cookies, so a redirect would drop the action's result.
  if (request.method === "GET" && GUEST_ONLY.has(request.nextUrl.pathname)) {
    const probe = await sessionProbe(request);
    const signedIn = !probe.headers.get("location");
    return withCookies(
      signedIn ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next(),
      probe,
    );
  }
  return protect(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
