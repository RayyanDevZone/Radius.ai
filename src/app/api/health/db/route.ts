import { pool } from "@/lib/db";
import { connection } from "next/server";

export async function GET() {
  await connection();
  try {
    const { rows } = await pool.query<{ now: Date; version: string }>(
      "select now() as now, version() as version",
    );
    return Response.json({ ok: true, now: rows[0].now, version: rows[0].version });
  } catch (err) {
    console.error("DB health check failed", err);
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
