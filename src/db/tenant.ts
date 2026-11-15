import { index, numeric, uuid } from "drizzle-orm/pg-core";

/**
 * Tenant building blocks for business tables. See CONVENTIONS.md.
 *
 *   export const products = pgTable(
 *     "products",
 *     {
 *       id: uuid("id").primaryKey().defaultRandom(),
 *       organizationId: organizationId(),
 *       price: money("price").notNull(),
 *     },
 *     (t) => [tenantIndex("products", t.organizationId)],
 *   );
 */

/** Non-null tenant column. Holds neon_auth.organization.id. */
export const organizationId = () => uuid("organization_id").notNull();

type IndexColumn = Parameters<ReturnType<typeof index>["on"]>[0];

/** Index on the tenant column, named `<table>_organization_id_idx`. */
export const tenantIndex = (table: string, column: IndexColumn) =>
  index(`${table}_organization_id_idx`).on(column);

/** Money: always numeric(10,2), never float/real/double. Drizzle returns it as a string. */
export const money = (name: string) => numeric(name, { precision: 10, scale: 2 });
