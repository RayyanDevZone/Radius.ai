// Creates test accounts for local testing. Safe to re-run: existing accounts
// are reused and only missing pieces are added. Never deletes data.
//
//   npm run db:seed-test
//
// Users, businesses and employee memberships are created through the real Neon
// Auth API (as the app does), so passwords are hashed and roles are set by the
// organization plugin:
//   - owner:    sign-up → organization/create (creator becomes "owner")
//   - employee: owner organization/invite-member (role "member") →
//               employee sign-up → organization/accept-invitation
// Business profiles and stores are then written with SQL.

import { randomBytes } from "node:crypto";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed test data with NODE_ENV=production.");
  process.exit(1);
}

const AUTH_URL = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, "");
// Same as src/lib/db-url.ts: state pg's current strict SSL mode explicitly.
const DB_URL = (() => {
  const raw = process.env.DATABASE_URL_UNPOOLED;
  if (!raw) return raw;
  const u = new URL(raw);
  if (["prefer", "require", "verify-ca"].includes(u.searchParams.get("sslmode"))) u.searchParams.set("sslmode", "verify-full");
  return u.toString();
})();
if (!AUTH_URL || !DB_URL) {
  console.error("NEON_AUTH_BASE_URL and DATABASE_URL_UNPOOLED must be set (run with --env-file=.env.local).");
  process.exit(1);
}
// Localhost origins are trusted by Neon Auth by default.
const ORIGIN = process.env.SEED_ORIGIN ?? "http://localhost:3000";

const PASSWORD = "Radius@Test123";

const BUSINESSES = [
  {
    owner: { name: "Ravi Mehta", email: "ravi.owner@radius-test.dev" },
    business: "Mehta Distribution Co",
    phone: "+919800000010",
    stores: [
      { name: "Andheri Depot", address: "Plot 21, Marol Industrial Area, Andheri East, Mumbai" },
      { name: "Thane Warehouse", address: "Unit 4, Wagle Estate, Thane" },
    ],
    employees: [{ name: "Suresh Yadav", email: "suresh.employee@radius-test.dev" }],
  },
  {
    owner: { name: "Asha Patel", email: "asha.owner@radius-test.dev" },
    business: "Asha Traders",
    phone: "+919800000001",
    stores: [
      { name: "Main Depot", address: "12 MG Road, Pune" },
      { name: "North Warehouse", address: "Plot 7, Bhosari MIDC, Pune" },
    ],
    employees: [],
  },
  {
    owner: { name: "Bharat Singh", email: "bharat.owner@radius-test.dev" },
    business: "Bharat Distributors",
    phone: "+919800000002",
    stores: [{ name: "Central Godown", address: "45 Station Road, Nagpur" }],
    employees: [],
  },
];

const slugify = (s) =>
  `${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${randomBytes(3).toString("hex")}`;

/** Calls Neon Auth with a tiny cookie jar, so later calls are authenticated. */
async function authCall(path, body, jar) {
  const res = await fetch(`${AUTH_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
    },
    body: JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

/** Signs up, or signs in if the account already exists. Returns a signed-in jar. */
async function ensureAccount(db, { name, email }) {
  const jar = new Map();
  let r = await authCall("sign-up/email", { name, email, password: PASSWORD }, jar);
  if (r.ok) {
    console.log(`• ${email}: account created`);
  } else {
    if (!String(r.json?.code ?? "").startsWith("USER_ALREADY_EXISTS")) {
      throw new Error(`sign-up ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    }
    r = await authCall("sign-in/email", { email, password: PASSWORD }, jar);
    if (!r.ok) throw new Error(`sign-in ${email}: ${r.status} ${JSON.stringify(r.json)} (password changed?)`);
    console.log(`• ${email}: account exists, reusing`);
  }
  const { rows } = await db.query(`select id from neon_auth."user" where email = $1`, [email]);
  return { jar, userId: rows[0].id };
}

async function ensureBusiness(db, b) {
  const { jar, userId } = await ensureAccount(db, b.owner);

  const { rows: orgs } = await db.query(
    `select "organizationId" as id from neon_auth.member where "userId" = $1 and role = 'owner' order by "createdAt" limit 1`,
    [userId],
  );
  let orgId = orgs[0]?.id;
  if (orgId) {
    console.log(`  business exists`);
  } else {
    const r = await authCall("organization/create", { name: b.business, slug: slugify(b.business) }, jar);
    if (!r.ok || !r.json?.id) throw new Error(`organization/create ${b.business}: ${r.status} ${JSON.stringify(r.json)}`);
    orgId = r.json.id;
    console.log(`  business "${b.business}" created`);
  }

  await db.query(
    `insert into organization_profile (organization_id, business_phone) values ($1, $2)
     on conflict (organization_id) do nothing`,
    [orgId, b.phone],
  );
  for (const s of b.stores) {
    await db.query(
      `insert into stores (organization_id, name, address) values ($1, $2, $3)
       on conflict (organization_id, name) do nothing`,
      [orgId, s.name, s.address],
    );
  }
  console.log(`  profile + ${b.stores.length} store(s) ensured`);

  for (const e of b.employees) await ensureEmployee(db, { ownerJar: jar, orgId, employee: e });
}

async function ensureEmployee(db, { ownerJar, orgId, employee }) {
  const { rows: existing } = await db.query(
    `select m.role from neon_auth.member m join neon_auth."user" u on u.id = m."userId"
     where m."organizationId" = $1 and u.email = $2`,
    [orgId, employee.email],
  );
  if (existing[0]) {
    console.log(`• ${employee.email}: already in this business as "${existing[0].role}"`);
    return;
  }

  // Reuse a pending invitation if a previous run stopped half-way.
  const { rows: pending } = await db.query(
    `select id from neon_auth.invitation
     where "organizationId" = $1 and lower(email) = lower($2) and status = 'pending' and "expiresAt" > now()
     order by "createdAt" desc limit 1`,
    [orgId, employee.email],
  );
  let invitationId = pending[0]?.id;
  if (!invitationId) {
    const r = await authCall("organization/invite-member", { email: employee.email, role: "member", organizationId: orgId }, ownerJar);
    if (!r.ok || !r.json?.id) throw new Error(`invite-member ${employee.email}: ${r.status} ${JSON.stringify(r.json)}`);
    invitationId = r.json.id;
  }

  const { jar } = await ensureAccount(db, employee);
  const r = await authCall("organization/accept-invitation", { invitationId }, jar);
  if (!r.ok) throw new Error(`accept-invitation ${employee.email}: ${r.status} ${JSON.stringify(r.json)}`);
  console.log(`  joined the business as "member" (employee)`);
}

const db = new pg.Client({ connectionString: DB_URL, connectionTimeoutMillis: 20000 });
await db.connect();
try {
  for (const b of BUSINESSES) await ensureBusiness(db, b);
  console.log(`\nDone. Password for every test account: ${PASSWORD} (details in test-accounts.txt)`);
} finally {
  await db.end();
}
