import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env.local the same way Next.js does.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (see .env.local)");

export default defineConfig({
  dialect: "postgresql",
  // Only app-owned tables live here. neon_auth.* is managed by Neon Auth and is
  // described separately in src/db/auth-schema.ts (read-only, never migrated).
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Never let drizzle-kit diff or touch the managed neon_auth schema.
  schemaFilter: ["public"],
  // Migrations use the direct (unpooled) connection.
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
