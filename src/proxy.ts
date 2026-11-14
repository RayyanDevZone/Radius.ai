import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
  // /api/me enforces its own session check and returns 401 JSON.
  publicRoutes: ["/", "/api/health", "/api/me"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
