# Stargod Perfumes

A perfume e-commerce store for India.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Storage) · Cashfree Payments · Shipmozo · Vercel

> **Status:** feature-complete for launch except the Shipmozo API integration (waiting for API docs). Integrations switch on as soon as their credentials are added. See [Integrations](#integrations) and [Roadmap](#roadmap).

## Features

- **Store:** landing page, shop with category / fragrance family / price filters, search, sorting, product pages (gallery, sizes, notes pyramid, reviews, pincode estimate, wishlist, Product JSON-LD), sitemap and robots.txt.
- **Cart:** guest cart in the browser, saved cart for signed-in users, guest cart merged on login, server-priced totals, coupons, free-shipping progress.
- **Checkout:** saved addresses, Cash on Delivery (fee + order limit), Cashfree online payment (create order → JS SDK → server verification → webhook), retry payment, idempotent "Place order".
- **Account:** orders with progress, tracking and history; cancel with automatic refund; GST invoice (print / PDF); addresses; wishlist; profile; password; sign out everywhere; DPDP-compliant account deletion.
- **Admin (admin + staff roles):**
  - dashboard
  - orders (pack, manual ship with AWB, tracking updates, deliver, RTO/return, cancel, refund, internal notes)
  - shipments queue, inventory with audited stock movements, review moderation, customers and roles
  - products (details, notes, collections, sizes/prices, image uploads), coupons, refunds queue
  - store settings (GSTIN, address, shipping/COD fees, stock hold) and activity log
- **Emails:** order placed, payment received, shipped, delivered, cancelled, refunded (Resend; logged to the console until a key is set).
- **Security:**
  - RLS on every table
  - server-only pricing and order state changes
  - Cashfree webhook HMAC check, timestamp window and de-duplication
  - rate limiting (coupons, checkout, pincode, reviews, cancellations)
  - CSP and security headers, audit log, open-redirect-safe login

---

## Prerequisites

- Node.js 20.9+ (tested on 24)
- Docker Desktop, running (for the local Supabase stack)
- The Supabase CLI is installed as a dev dependency and run with `npx supabase`, so no global install is needed

## Local setup

```bash
npm install
npm run db:start          # starts local Supabase, applies migrations, runs supabase/seed.sql
cp .env.example .env.local
```

Fill `.env.local` with the values printed by `npm run db:start` (or `npx supabase status`):

| `.env.local`                           | from `supabase status` |
| -------------------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `API_URL`              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`      |
| `SUPABASE_SECRET_KEY`                  | `SECRET_KEY`           |

```bash
npm run dev               # http://localhost:3000
```

Local services: Studio http://127.0.0.1:54323 · Mailpit (auth emails) http://127.0.0.1:54324

### Demo accounts (local seed only)

| Email                                                        | Password       | Role     |
| ------------------------------------------------------------ | -------------- | -------- |
| `admin@stargod.test`                                         | `Password@123` | admin    |
| `staff@stargod.test`                                         | `Password@123` | staff    |
| `aarav@stargod.test`, `diya@stargod.test`, `kabir@stargod.test` | `Password@123` | customer |

New sign-ups must confirm their email. Locally, every auth email (confirmation, password reset) lands in **Mailpit**: http://127.0.0.1:54324.

Demo coupons: `WELCOME10` (10% off first order, max ₹300), `FLAT200` (₹200 off above ₹1,499), `FREESHIP`.

## Scripts

| Script                | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Next.js dev server                                             |
| `npm run build`       | Production build                                               |
| `npm run typecheck`   | `tsc --noEmit`                                                 |
| `npm run lint`        | ESLint                                                         |
| `npm run db:start`    | Start local Supabase (unused services excluded)                |
| `npm run db:stop`     | Stop local Supabase                                            |
| `npm run db:reset`    | Drop and recreate the local DB from migrations + seed          |
| `npm run db:test`     | Run pgTAP tests in `supabase/tests` (pricing, stock, payments, refunds, RLS) |
| `npm run db:types`    | Regenerate `src/types/database.ts` after a schema change       |
| `npm run db:push`     | Apply migrations to the linked hosted project                  |

## Hosted Supabase (staging / production)

1. Create a project at supabase.com (region: **Mumbai, ap-south-1**).
2. Link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
   `db push` does **not** run `seed.sql`. The seed creates demo users with a known password, so never run it in production. In production, insert `store_settings` yourself; the SQL is at the top of `supabase/seed.sql`.
3. Make yourself admin after signing up:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
4. **Auth → URL Configuration:** set the Site URL to your domain and add `https://<domain>/auth/callback` to Redirect URLs.
5. Copy the API URL, the publishable key and the secret key into your Vercel environment variables.

## Integrations

| Integration | Status | To enable |
| --- | --- | --- |
| Cashfree payments | Code complete (`src/lib/payments/`), switched off | Set `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `NEXT_PUBLIC_CASHFREE_MODE`. In the Cashfree dashboard, set the webhook URL to `https://<domain>/api/webhooks/cashfree`. Check `CASHFREE_API_VERSION` against your dashboard. |
| Email (Resend) | Code complete, logs to the console | Set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain). Optional: `ADMIN_NOTIFICATION_EMAIL`. |
| Shipmozo | **Not integrated: waiting for API docs.** Staff enter courier + AWB manually; pincode check returns an estimate | Implement `ShippingProvider` in `src/lib/shipping/provider.ts` (rates, AWB, pickup, label, tracking, cancel) |
| Google sign-in | Code complete, provider disabled | See "Google sign-in" below |
| Cron (release unpaid stock holds) | `/api/cron/expire-holds`, scheduled in `vercel.json` | Set `CRON_SECRET`. A 10-minute schedule needs Vercel Pro; on Hobby, use a daily schedule or an external cron calling the URL with `Authorization: Bearer <CRON_SECRET>`. |

## Auth & roles

| Flow | Route(s) |
| --- | --- |
| Sign up → confirm email → signed in | `/signup` → `/verify-email` → emailed link → `/auth/confirm` |
| Sign in (email + password, Google) | `/login` (`?next=` is honoured for same-site paths only) |
| Forgot / reset password | `/forgot-password` → emailed link → `/auth/confirm` → `/reset-password` |
| Google OAuth return | `/auth/callback` |

After sign-in, **admin/staff → `/admin`**, **customers → `next` or `/`**. Roles:

- **customer**: the store and their own `/account`.
- **staff**: back office for operations (orders, shipments, inventory, reviews, customers read-only). No revenue, prices, coupons, refunds or settings.
- **admin**: everything, including role management (`/admin/customers`). Role changes are audited in `admin_audit_log`.

Enforced in three layers:
1. `src/proxy.ts` makes optimistic redirects, and returns a 404 status on `/admin` for non-staff.
2. `src/lib/auth/dal.ts` (`requireUser` / `requireStaff` / `requirePermission`) runs in every protected layout, page and server action. The permission map is in `src/lib/auth/roles.ts`.
3. Postgres RLS uses `is_staff()` / `is_admin()`.

**Google sign-in:** create an OAuth client in Google Cloud. Add `http://127.0.0.1:54321/auth/v1/callback` (local) and `https://<ref>.supabase.co/auth/v1/callback` (hosted) as redirect URIs. Put the ID and secret in `supabase/.env` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`, set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`, then restart Supabase. On hosted Supabase, enable it under Auth → Providers.

**Production email:** Supabase's built-in mailer is heavily rate-limited. Configure custom SMTP (e.g. Resend) under Auth → SMTP, and paste the templates from `supabase/templates/` into Auth → Email Templates.

## Architecture notes

- **Money:** stored everywhere as integer **paise**. Prices are GST-inclusive. `src/lib/money.ts` formats them.
- **Pricing authority:** `public.quote_cart()` in Postgres is the only place prices, coupons, shipping and the COD fee are calculated. The browser only sends `variant_id` + `qty`.
- **Atomic orders:** `public.place_order()` locks the variant rows (in id order), checks the quote again, decrements stock with `stock >= qty`, redeems the coupon and inserts the order in a single transaction. It is idempotent per `checkout_key`.
- **Prepaid stock hold:** prepaid orders hold stock until `reserved_until` (30 minutes by default). Expired holds are released by `expire_order_hold()` after the server has double-checked Cashfree. A late payment either takes the stock again or is flagged `needs_refund`.
- **Payment confirmation:** only `mark_order_paid()` (service role) can confirm an order. It checks the amount and is idempotent. Webhooks are deduplicated through `webhook_events (provider, event_key)`.
- **RLS:** enabled on every table. Anonymous users can read the active catalog. Users read and write their own cart, wishlist and addresses, and read their own orders. Orders, payments, refunds and shipments are written only by the server (service role) through `security definer` functions that `anon`/`authenticated` cannot execute.
- **Supabase clients** (`src/lib/supabase/`):
  - `server.ts`: user session (RLS), for Server Components, Actions and Route Handlers
  - `client.ts`: user session in the browser
  - `public.ts`: cookieless anon client for cached (`"use cache"`) catalog reads
  - `admin.ts`: service role, server-only, bypasses RLS
  - `proxy.ts`: refreshes the session on each request and redirects signed-out users away from `/account`, `/checkout` and `/admin`
- **Next.js 16:** `middleware` is now `src/proxy.ts`. Request APIs (`cookies()`, `params`) are async. Cache Components are on, so request-time data must sit inside `<Suspense>` or in a `"use cache"` function.

## Database

Migrations live in `supabase/migrations/`:

| File                    | Contents                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `…01_schema.sql`        | enums, tables, indexes, `updated_at` triggers                            |
| `…02_functions.sql`     | auth triggers, review triggers, `quote_cart`, `place_order`, payment/expiry/cancel/refund/status functions, privileges |
| `…03_rls.sql`           | RLS policies and column-level grants                                     |
| `…04_storage.sql`       | `product-images` bucket (public read, admin write)                       |
| `…05/06_*.sql`          | `staff` role, `is_staff()`, consent fields, `admin_audit_log`, `set_user_role()` |
| `…07_public_reviews.sql`| privacy-safe public reviews view                                          |
| `…08_operations.sql`    | stock adjustments, shipments + tracking events, rate limiting, account anonymisation, audit helper |

After changing the schema, add a new migration (`npx supabase migration new <name>`), then run `npm run db:reset && npm run db:types && npm run db:test`.

## Roadmap

1. ✅ Foundation: schema, RLS, pricing and stock functions, seed, DB tests
2. ✅ App shell, auth (email + Google), roles (customer / staff / admin)
3. ✅ Catalog: search, filters, product page, reviews, wishlist, pincode estimate
4. ✅ Cart, coupons, addresses, checkout (COD + Cashfree), order pages, invoices, emails
5. ✅ Admin operations
6. ⬜ Shipmozo integration (needs API docs)
7. ⬜ Go-live: add credentials, hosted Supabase + Vercel, custom SMTP, Turnstile captcha, Sentry/analytics, legal review of policy pages, real product photos

## Testing

- `npm run db:test`: 81 pgTAP tests (pricing, stock races, payments, refunds, roles/RLS, shipments, rate limits, account deletion).
- End-to-end flows were verified in a real browser against a production build: sign-up/verify/reset, guest cart → login merge → COD checkout, cancel/restock, admin pack → ship → deliver, product/size/image management, inventory, coupons, review moderation, settings, staff restrictions, webhook signature and replay handling.
