# Radius.ai conventions

Radius.ai is multi-tenant. Each distribution business is a Better Auth
**organization** (a tenant), and one business's data must never be visible to
another. Follow the rules below for every table, query, page, server action and
route handler.

## 1. Roles

| App role   | Stored in `neon_auth.member.role` | Access                 |
| ---------- | --------------------------------- | ---------------------- |
| `owner`    | `owner`                           | Full access            |
| `employee` | `member`                          | Limited (deliveries)   |

Managed Neon Auth supports only the built-in `owner` / `admin` / `member` roles,
so employees are stored as `member`. Map roles **only** through `toAppRole()` in
`src/lib/auth-context.ts`. Any role other than `owner` is treated as `employee`.

## 2. The tenant comes from the server session, never from the client

```ts
import { getContext, requireOwner } from "@/lib/auth-context";

const { userId, orgId, role } = await getContext(); // any member
const ctx = await requireOwner();                    // owners only
```

- `getContext()` reads the session on the server and checks the user's
  membership in `neon_auth.member`. It throws `AuthContextError`
  (`UNAUTHENTICATED`, `NO_ORGANIZATION`, or `FORBIDDEN` from `requireOwner()`).
- In pages, use `getPageContext()`. It redirects to `/login` or `/onboarding`.
- **Never** take an organization id from client input: no URL params, search
  params, form fields, request bodies, headers or local storage. No server
  action or route handler accepts an `orgId` argument.
- Call `getContext()` / `requireOwner()` inside **every** server action and
  route handler, even when the proxy already protects the route. The proxy is
  only the first line of defence.

## 3. Every business table is tenant-scoped

Every business table (`stores`, `products`, `shops`, `vehicles`, `deliveries`,
`delivery_items`, and any future ones) **must** have a non-null
`organization_id` column with an index. Use the helpers in `src/db/tenant.ts`:

```ts
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { money, organizationId, tenantIndex } from "./tenant";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),          // uuid NOT NULL
    name: text("name").notNull(),
    price: money("price").notNull(),           // numeric(10,2)
  },
  (t) => [tenantIndex("products", t.organizationId)],
);
```

- Child tables (e.g. `delivery_items`) carry their own `organization_id` too.
  Don't rely on joining through the parent to know the tenant.
- Every query filters on `organization_id = ctx.orgId`: every `select`,
  `update` and `delete`. Every `insert` sets `organizationId: ctx.orgId`.
- Composite unique constraints should include `organization_id` (e.g. a SKU is
  unique per business, not globally).

## 4. Check every client-supplied id against the current org

Ids that arrive from the client (`shopId`, `productId`, `storeId`,
`vehicleId`, `deliveryId`, an employee's `userId`, …) are untrusted. Before you
use one, confirm it belongs to `ctx.orgId`:

```ts
const { orgId } = await getContext();
const [shop] = await db
  .select({ id: shops.id })
  .from(shops)
  .where(and(eq(shops.id, input.shopId), eq(shops.organizationId, orgId)))
  .limit(1);
if (!shop) throw new Error("Not found"); // same response as "doesn't exist"
```

For updates and deletes, put the org filter in the same statement
(`where id = $1 and organization_id = $2`) rather than checking first and
writing after. Return "not found" for ids from another tenant, not "forbidden",
so the response doesn't reveal that the record exists.

## 5. Money

All money columns use `numeric(10,2)` (the `money()` helper). Never use
`real`, `double precision` or JS floats for stored amounts. Drizzle returns
numeric values as strings, so do arithmetic in SQL or with a decimal library.

## 6. Database and migrations

- App tables live in `public` and are defined in `src/db/schema.ts`.
  `neon_auth.*` belongs to Neon Auth: `src/db/auth-schema.ts` describes it
  read-only, and drizzle-kit never migrates it (`schemaFilter: ["public"]`).
- Workflow: edit the schema → `npm run db:generate` → **review the SQL in
  `drizzle/`** → `npm run db:migrate`. Never use `drizzle-kit push` against a
  shared database.
- Migrations never drop tables or delete data. Destructive changes need an
  explicit, reviewed plan.
- Extra organization fields (business phone, WhatsApp, Telegram chat id) live in
  `organization_profile`, keyed by `organization_id`. Managed auth doesn't allow
  custom columns on `neon_auth.organization`.
