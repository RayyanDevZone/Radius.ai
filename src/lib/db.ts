import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { withVerifiedSsl } from "./db-url";

// Pooled connection (DATABASE_URL has the -pooler host) for app traffic.
// Use DATABASE_URL_UNPOOLED for migrations / session-level work.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: withVerifiedSsl(process.env.DATABASE_URL), max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// On Vercel Fluid compute, lets idle connections close before the instance suspends.
// No-op elsewhere.
attachDatabasePool(pool);
