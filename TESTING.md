# Testing Radius.ai locally

These test accounts live in the **development** Neon database (the one in
`.env.local`). They aren't real users. Don't reuse these passwords anywhere
else.

## Test logins (already created)

Create or refresh them at any time with `npm run db:seed-test`. It's safe to
re-run: it reuses existing accounts and never deletes anything.

Password for all test accounts: **`Radius@Test123`**

All login details are also in `test-accounts.txt` (git-ignored).

| Business              | User                     | Email (login)                     | Phone (login)     | Stores                          |
| --------------------- | ------------------------ | --------------------------------- | ----------------- | ------------------------------- |
| Mehta Distribution Co | Ravi Mehta (owner)       | `ravi.owner@radius-test.dev`      | `+91 98000 00010` | Andheri Depot, Thane Warehouse  |
| Mehta Distribution Co | Suresh Yadav (employee)  | `suresh.employee@radius-test.dev` | (email only)      | (sees the business's stores)    |
| Asha Traders          | Asha Patel (owner)       | `asha.owner@radius-test.dev`   | `+91 98000 00001` | Main Depot, North Warehouse    |
| Bharat Distributors   | Bharat Singh (owner)     | `bharat.owner@radius-test.dev` | `+91 98000 00002` | Central Godown                 |

On `/login`, the "Email / Phone Number" field accepts either form. Spaces and
dashes in the phone number are fine (`+91 98000 00001` = `+919800000001`).

## Test sign-up (not created yet; use it on `/signup`)

| Field         | Value                          |
| ------------- | ------------------------------ |
| Full name     | `Chetan Kumar`                 |
| Email         | `chetan.owner@radius-test.dev` |
| Password      | `Radius@Test123`               |
| Business name | `Chetan Supplies`              |
| Phone number  | `+91 98000 00003`              |

To see the "phone already used" error, sign up with phone `+91 98000 00001`
(Asha's). The account isn't kept, so you can fix the number and submit the
same form again.

## Step-by-step checks

Start the app with `npm run dev` and open http://localhost:3000. Use a private
window (or sign out) between owners.

Dashboard layout: the Radius.ai logo and a menu button are on the left of the
top bar. The green **person icon** on the right opens your account details
(name, email, business, role) and **Sign out**. The left drawer menu (opened
and closed with the menu button) has Dashboard (empty for now), **Stores**
(store cards), **Products**, **Shops** and **Vehicles** (empty for now), and
**Employees** (owners only; lists the business's employees). On each of these,
owners see an "Add …" button on the right of the title and count. It shows "Coming soon"
for now.

1. **Logged-out users can't reach the dashboard.** In a private window, open
   `/dashboard` and then `/dashboard/anything`. Both land on `/login`.
2. **Owner 1, by email.** Sign in as `asha.owner@radius-test.dev`, then
   open **Stores** in the menu. It shows "2 stores" and two cards, Main Depot and North Warehouse. The person icon shows
   business **Asha Traders** and role **Owner**.
3. **Signed-in users skip login.** While signed in, open `/login` and
   `/signup`. Both go straight to `/dashboard`.
4. **Sign out.** Open the person icon and tap **Sign out**. You land on
   `/login`, and opening `/dashboard` again sends you back to `/login`.
5. **Owner 2, by phone.** Sign in with `98000 00002` (with or without +91).
   **Stores** shows only Central Godown, and the person icon shows **Bharat
   Distributors**. Nothing from Asha Traders appears.
6. **Wrong details look the same.** Try a wrong password, an unregistered
   phone (`98111 11111`) and an unknown email. Each shows the same
   "Incorrect email/phone number or password." message.
7. **New owner sign-up.** Sign up with the Chetan details above. You land on
   the dashboard for **Chetan Supplies**, and **Stores** says "No stores yet."
8. **Employee view.** Sign in as `suresh.employee@radius-test.dev`.
   **Stores** shows Mehta Distribution Co's two stores, the person icon shows
   role **Employee**, and there are no "Add …" buttons. Suresh is an older
   email-only account, so he signs in with his email.
9. **Drawer.** On a computer, the menu button collapses and reopens the left
   drawer. On a phone, the drawer starts closed and slides over the page.
10. **Language.** Choose हिन्दी on `/language`. The login, sign-up and
    dashboard text switches to Hindi.
11. **Add an employee (phone login).** As `ravi.owner@radius-test.dev`, open
    **Employees** → **Add employee**: name, phone `98000 00020`, designation
    `Driver`, a password. The card shows the phone and "Driver". Sign out and
    sign in with `98000 00020` + that password: you're an **Employee** of
    Mehta Distribution Co. Adding `98000 00002` (an owner's phone) or the same
    number again shows "already used to sign in".
12. **Import from CSV / Excel.** As `asha.owner@radius-test.dev`, open
    **Products** and tap the upload icon (left of **+**). Tap **Download
    template**, add a few rows in Excel and save as `.xlsx` (or keep `.csv`),
    then **Choose file**. **Match your columns** lists each field with a
    dropdown of the sheet's columns (pre-filled where the names match; rename
    a header, e.g. "Size unit" → "Packing", and pick it by hand). **Continue**
    says "N rows ready" → **Import N**, and the products appear. Put `abc` in a Price cell and choose the file again: it
    lists "Row 3: Enter a valid price…" and nothing is imported. The same
    works on **Shops**, **Vehicles** (a number that already exists is
    reported, nothing is saved) and **Employees** (each row becomes a
    phone + password login; at most 50 per file).

## Re-testing sign-up with the same details

Once you've signed up as Chetan, that email and phone are taken. To try again,
change the email and phone (e.g. `chetan2.owner@radius-test.dev`,
`+91 98000 00004`).
