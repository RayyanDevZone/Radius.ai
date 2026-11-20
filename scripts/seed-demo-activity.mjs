// Fills the "Mehta Distribution Co" test business with ~60 days of demo
// activity (products, shops, vehicles, deliveries, payments, stock) so the
// dashboard has something to show. Run `npm run db:seed-test` first.
//
//   npm run db:seed-demo
//
// Only touches that one test business, and does nothing if it already has
// deliveries. Never deletes data. Numbers are pseudo-random but repeatable.

import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data with NODE_ENV=production.");
  process.exit(1);
}

// Same as src/lib/db-url.ts: state pg's current strict SSL mode explicitly.
const DB_URL = (() => {
  const raw = process.env.DATABASE_URL_UNPOOLED;
  if (!raw) return raw;
  const u = new URL(raw);
  if (["prefer", "require", "verify-ca"].includes(u.searchParams.get("sslmode"))) u.searchParams.set("sslmode", "verify-full");
  return u.toString();
})();
if (!DB_URL) {
  console.error("DATABASE_URL_UNPOOLED must be set (run with --env-file=.env.local).");
  process.exit(1);
}

const OWNER_EMAIL = "ravi.owner@radius-test.dev";
const EMPLOYEE_EMAIL = "suresh.employee@radius-test.dev";
const DAYS = 60;

const PRODUCTS = [
  { name: "Aashirvaad Atta", price: "460.00", size: "10", sizeUnit: "kg", unit: "bag", hsn: "1101" },
  { name: "Basmati Rice", price: "1850.00", size: "25", sizeUnit: "kg", unit: "bag", hsn: "1006" },
  { name: "Toor Dal", price: "155.00", size: "1", sizeUnit: "kg", unit: "packet", hsn: "0713" },
  { name: "Sunflower Oil", price: "1650.00", size: "15", sizeUnit: "l", unit: "crate", hsn: "1512" },
  { name: "Sugar", price: "2150.00", size: "50", sizeUnit: "kg", unit: "bag", hsn: "1701" },
  { name: "Tata Salt", price: "28.00", size: "1", sizeUnit: "kg", unit: "packet", hsn: "2501" },
  { name: "Parle-G Biscuits", price: "480.00", size: "800", sizeUnit: "g", unit: "crate", hsn: "1905" },
  { name: "Tea Powder", price: "260.00", size: "500", sizeUnit: "g", unit: "packet", hsn: "0902" },
  { name: "Mineral Water", price: "120.00", size: "1", sizeUnit: "l", unit: "crate", hsn: "2201" },
];

const SHOPS = [
  ["Sharma General Store", "Shop 4, Marol Naka, Andheri East, Mumbai", "Ramesh Sharma", "+919820000101"],
  ["Gupta Kirana", "12 JB Nagar, Andheri East, Mumbai", "Suresh Gupta", "+919820000102"],
  ["Patel Provisions", "Sahar Road, Vile Parle East, Mumbai", "Kiran Patel", "+919820000103"],
  ["New Balaji Stores", "Chakala Market, Andheri East, Mumbai", "Venkat Rao", "+919820000104"],
  ["Om Sai Traders", "Saki Naka Junction, Mumbai", "Prakash Jadhav", "+919820000105"],
  ["Jai Hind Supermart", "Powai Plaza, Hiranandani, Mumbai", "Harish Mehta", "+919820000106"],
  ["Lakshmi Kirana", "Wagle Estate Road 16, Thane", "Lakshmi Iyer", "+919820000107"],
  ["Shree Ganesh Stores", "Naupada, Thane West", "Ganesh Patil", "+919820000108"],
  ["Royal Mart", "Kopri Colony, Thane East", "Imran Shaikh", "+919820000109"],
  ["Annapurna Grocers", "Majiwada, Thane West", "Sunita Deshmukh", "+919820000110"],
  ["Krishna Daily Needs", "Kurla West Station Road, Mumbai", "Mohan Krishnan", "+919820000111"],
  ["Fresh Choice", "Ghatkopar East, Mumbai", "Neha Shah", "+919820000112"],
];

const VEHICLES = [
  ["MH02AB1234", "pickup"],
  ["MH04CD5678", "truck"],
  ["MH02EF4321", "bike"],
];

// Tiny repeatable random numbers (mulberry32).
let seed = 20261118;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));

const db = new pg.Client({ connectionString: DB_URL, connectionTimeoutMillis: 20000 });
await db.connect();
try {
  const { rows: owner } = await db.query(
    `select m."organizationId" as org_id, u.id as user_id
       from neon_auth."user" u join neon_auth.member m on m."userId" = u.id and m.role = 'owner'
      where u.email = $1 limit 1`,
    [OWNER_EMAIL],
  );
  if (!owner[0]) throw new Error(`${OWNER_EMAIL} has no business. Run npm run db:seed-test first.`);
  const { org_id: orgId, user_id: ownerId } = owner[0];

  const { rows: existing } = await db.query(`select count(*)::int as n from deliveries where organization_id = $1`, [orgId]);
  if (existing[0].n > 0) {
    console.log(`Mehta Distribution Co already has ${existing[0].n} deliveries. Nothing to do.`);
    process.exit(0);
  }

  const { rows: emp } = await db.query(
    `select u.id from neon_auth."user" u join neon_auth.member m on m."userId" = u.id
      where u.email = $1 and m."organizationId" = $2`,
    [EMPLOYEE_EMAIL, orgId],
  );
  const employeeId = emp[0]?.id ?? null;

  await db.query("begin");

  for (const p of PRODUCTS) {
    await db.query(
      `insert into products (organization_id, name, price, size_value, size_unit, unit, hsn_code)
       select $1, $2, $3, $4, $5, $6, $7
        where not exists (select 1 from products where organization_id = $1 and name = $2)`,
      [orgId, p.name, p.price, p.size, p.sizeUnit, p.unit, p.hsn],
    );
  }
  for (const [firm, address, ownerName, mobile] of SHOPS) {
    await db.query(
      `insert into shops (organization_id, firm_name, firm_address, owner_name, mobile)
       select $1, $2, $3, $4, $5
        where not exists (select 1 from shops where organization_id = $1 and firm_name = $2)`,
      [orgId, firm, address, ownerName, mobile],
    );
  }
  for (const [number, type] of VEHICLES) {
    await db.query(
      `insert into vehicles (organization_id, number, type) values ($1, $2, $3)
       on conflict (organization_id, number) do nothing`,
      [orgId, number, type],
    );
  }

  const products = (await db.query(`select id, price from products where organization_id = $1 order by name`, [orgId])).rows;
  const shops = (await db.query(`select id, firm_name from shops where organization_id = $1 order by firm_name`, [orgId])).rows;
  const vehicles = (await db.query(`select id from vehicles where organization_id = $1 order by number`, [orgId])).rows;
  const stores = (await db.query(`select id, name from stores where organization_id = $1 order by created_at`, [orgId])).rows;
  if (stores.length === 0) throw new Error("The business has no stores. Run npm run db:seed-test first.");

  // Two shops stay quiet (no orders for 30+ days), so that widget has something to show.
  const quiet = new Set(shops.slice(-2).map((s) => s.id));
  const { rows: todayRow } = await db.query(`select (now() at time zone 'Asia/Kolkata')::date::text as today`);
  const today = todayRow[0].today;
  const dayStr = (offset) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  let number = 0;
  let deliveredCount = 0;
  for (let offset = -DAYS; offset <= 1; offset++) {
    // Busier on recent days, so the trend goes up.
    const perDay = offset > 0 ? 2 : int(1, offset > -30 ? 5 : 3);
    for (let k = 0; k < perDay; k++) {
      const day = dayStr(offset);
      const store = rand() < 0.7 ? stores[0] : pick(stores);
      const eligible = shops.filter((s) => !(quiet.has(s.id) && offset > -40));
      const shop = pick(eligible);
      let status;
      if (offset < -1) status = rand() < 0.93 ? "delivered" : "cancelled";
      else if (offset === -1) status = rand() < 0.8 ? "delivered" : "pending";
      else if (offset === 0) status = pick(["pending", "out_for_delivery", "delivered", "delivered"]);
      else status = "pending";
      const assigned = employeeId && rand() < 0.6 ? employeeId : null;
      const vehicle = rand() < 0.85 ? pick(vehicles).id : null;
      const deliveredAt = status === "delivered" ? `${day} ${String(int(10, 18)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00+05:30` : null;

      number += 1;
      const { rows: d } = await db.query(
        `insert into deliveries (organization_id, number, store_id, shop_id, vehicle_id, assigned_to, status, scheduled_for, delivered_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, ($8::date - 1)::timestamp at time zone 'Asia/Kolkata' + interval '17 hours')
         returning id`,
        [orgId, number, store.id, shop.id, vehicle, assigned, status, day, deliveredAt, ownerId],
      );
      const chosen = [...products].sort(() => rand() - 0.5).slice(0, int(1, 4));
      for (const p of chosen) {
        await db.query(
          `insert into delivery_items (organization_id, delivery_id, product_id, product_name, unit_price, quantity, line_total)
           select $1, $2, p.id, p.name, p.price, $3::int, p.price * $3::int from products p where p.id = $4`,
          [orgId, d[0].id, int(1, 12), p.id],
        );
      }
      await db.query(
        `update deliveries set total = (select sum(line_total) from delivery_items where delivery_id = $1) where id = $1`,
        [d[0].id],
      );
      if (status === "delivered") deliveredCount += 1;
    }
  }

  // Payments: most shops pay most of what's older than ~10 days; a few lag behind (overdue).
  const { rows: billed } = await db.query(
    `select shop_id, sum(total) filter (where delivered_at < now() - interval '10 days')::numeric as old_billed
       from deliveries where organization_id = $1 and status = 'delivered' group by shop_id`,
    [orgId],
  );
  let paymentCount = 0;
  for (const b of billed) {
    const owed = Number(b.old_billed ?? 0);
    if (owed <= 0) continue;
    const ratio = rand() < 0.25 ? 0.35 : rand() < 0.5 ? 1 : 0.85;
    let left = Math.floor(owed * ratio);
    while (left > 0) {
      const amount = Math.min(left, int(2000, 15000));
      left -= amount;
      await db.query(
        `insert into payments (organization_id, shop_id, amount, method, received_on, received_by)
         values ($1, $2, $3, $4, ($5::date - $6::int), $7)`,
        [orgId, b.shop_id, amount.toFixed(2), pick(["cash", "cash", "upi", "upi", "cheque", "bank"]), today, int(1, 45), pick([ownerId, employeeId ?? ownerId])],
      );
      paymentCount += 1;
    }
  }
  // Today's cash collection.
  const { rows: todays } = await db.query(
    `select id, shop_id, total, assigned_to from deliveries
      where organization_id = $1 and status = 'delivered' and (delivered_at at time zone 'Asia/Kolkata')::date = $2::date`,
    [orgId, today],
  );
  for (const d of todays) {
    await db.query(
      `insert into payments (organization_id, shop_id, delivery_id, amount, method, received_on, received_by)
       values ($1, $2, $3, $4, 'cash', $5::date, $6)`,
      [orgId, d.shop_id, d.id, d.total, today, d.assigned_to ?? ownerId],
    );
    paymentCount += 1;
  }

  // Stock per store; a few products low or out.
  for (const s of stores) {
    for (const p of products) {
      const r = rand();
      const qty = r < 0.12 ? 0 : r < 0.3 ? int(1, 9) : int(20, 240);
      await db.query(
        `insert into stock (organization_id, store_id, product_id, quantity, low_stock_at) values ($1, $2, $3, $4, 10)
         on conflict (store_id, product_id) do nothing`,
        [orgId, s.id, p.id, qty],
      );
    }
  }

  await db.query("commit");
  console.log(
    `Mehta Distribution Co: ${number} deliveries (${deliveredCount} delivered), ${paymentCount} payments, stock for ${stores.length} store(s).`,
  );
} catch (err) {
  await db.query("rollback").catch(() => {});
  throw err;
} finally {
  await db.end();
}
