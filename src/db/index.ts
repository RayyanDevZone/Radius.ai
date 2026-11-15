import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "@/lib/db";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

// Shares the existing pooled pg connection from src/lib/db.ts.
export const db = drizzle({ client: pool, schema: { ...appSchema, ...authSchema } });
