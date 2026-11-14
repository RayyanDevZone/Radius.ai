import { auth } from "@/lib/auth/server";
import { pool } from "@/lib/db";
import { connection } from "next/server";

// Protected endpoint: checks the session itself (not only via proxy), then
// reads the signed-in user's row from the neon_auth schema in Postgres.
export async function GET() {
  await connection();
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await pool.query<{ id: string; email: string; createdAt: Date }>(
    `select id, email, "createdAt" from neon_auth."user" where id = $1`,
    [session.user.id],
  );

  return Response.json({ sessionUser: session.user, dbUser: rows[0] ?? null });
}
