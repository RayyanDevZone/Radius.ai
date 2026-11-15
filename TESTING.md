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

1. **Logged-out users can't reach the dashboard.** In a private window, open
   `/dashboard` and then `/dashboard/anything`. Both land on `/login`.
2. **Owner 1, by email.** Sign in as `asha.owner@radius-test.dev`. The
   dashboard header shows **Asha Traders**, the role is **Owner**, and Stores
   lists Main Depot and North Warehouse only.
3. **Signed-in users skip login.** While signed in, open `/login` and
   `/signup`. Both go straight to `/dashboard`.
4. **Sign out.** Tap **Sign out**. You land on `/login`, and opening
   `/dashboard` again sends you back to `/login`.
5. **Owner 2, by phone.** Sign in with `+91 98000 00002`. The header shows
   **Bharat Distributors**, and Stores lists only Central Godown, with nothing
   from Asha Traders.
6. **Wrong details look the same.** Try a wrong password, an unregistered
   phone (`+91 98111 11111`) and an unknown email. Each shows the same
   "Incorrect email/phone number or password." message.
7. **New owner sign-up.** Sign up with the Chetan details above. You land on
   the dashboard for **Chetan Supplies** with no stores, then add a store.
   Adding a second store with the same name is rejected.
8. **Employee view.** Sign in as `suresh.employee@radius-test.dev`. The
   header shows **Mehta Distribution Co**, the role is **Employee**, and the
   stores are listed but there's no "Add store" form. Phone login is for
   owners only, so employees use their email.
9. **Language.** Choose हिन्दी on `/language`. The login, sign-up and dashboard
   text switches to Hindi.

## Re-testing sign-up with the same details

Once you've signed up as Chetan, that email and phone are taken. To try again,
change the email and phone (e.g. `chetan2.owner@radius-test.dev`,
`+91 98000 00004`).
