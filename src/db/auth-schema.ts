import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Read-only view of the tables Neon Auth manages in the `neon_auth` schema.
 * NOT part of drizzle.config.ts, so drizzle-kit never generates migrations for
 * them. Only the columns the app reads are declared. Don't write to these
 * tables from app code; go through the auth API (`auth.*`). The one exception
 * is the sign-up rollback in src/lib/business-setup.ts.
 */
const neonAuth = pgSchema("neon_auth");

export const authUser = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});

export const authOrganization = neonAuth.table("organization", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});

export const authMember = neonAuth.table("member", {
  id: uuid("id").primaryKey(),
  organizationId: uuid("organizationId").notNull(),
  userId: uuid("userId").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});
