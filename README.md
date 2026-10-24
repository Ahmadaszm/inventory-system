# QR Inventory & Physical Stocktaking System
# نظام إدارة المخزون والجرد الفعلي بالباركود QR

**Complete production-structured source code** for a manufacturing & importing company inventory system.

---

## النسخة العربية
اقرأ **[README-AR.md](./README-AR.md)** للتعليمات الكاملة بالعربية.

---

## Quick Start

```bash
# 1. Extract / clone the project
cd inventory-system

# 2. Install dependencies
npm install

# 3. Copy .env.example to .env and fill in your Supabase database password
# Set NEXTAUTH_SECRET to a random value (at least 32 bytes).
cp .env.example .env
npm run db:generate
npm run db:migrate

# 4. Set ADMIN_EMAIL and ADMIN_PASSWORD in your shell, then create an admin
# ADMIN_PASSWORD must contain at least 16 characters.
npm run db:admin

# 5. Run
npm run dev
```

Open **http://localhost:3000**

### Supabase and Vercel

The database is Supabase PostgreSQL. Prisma 5 uses `DATABASE_URL` for application
queries through the transaction pooler on port 6543 and `DIRECT_URL` for migrations
through the IPv4 session pooler on port 5432. Replace `[YOUR-PASSWORD]` in both URLs
with the URL-encoded database password; the publishable key is not a database password.
Keep `.env` local; `.env.example` documents the required variables.

On Vercel, configure `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, and
`NEXTAUTH_URL` (your deployed HTTPS URL) in the project environment settings.
Use `npm run build`; it generates Prisma Client before building Next.js.
Run `npm run db:migrate` once against the target database before serving traffic.
Migrations are an explicit operation and do not run during every build.
Functions run in Singapore (`sin1`), alongside this Supabase project's database.
The transaction-pooler URL allows five Prisma connections per instance so that
parallel dashboard queries and concurrent sign-ins do not queue behind one connection.

Login continues to use NextAuth and the application's `User` table. Inventory
queries run on the server through Prisma, so no Supabase browser client is needed.
The optional `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
values are available for future Supabase browser features.
The initial migration enables RLS on inventory tables without public policies;
browser Data API requests cannot access these tables. The dedicated `inventory_app`
login owns the inventory tables and accesses them on the server. It has no global
superuser, role-creation, database-creation, or RLS-bypass privileges. Configure a
separate login with `USAGE, CREATE` on the inventory schema for another project.
Use that login's password in both URLs. The bundled public Supabase CA enables
strict certificate verification and is included in Vercel function bundles.
`.vercelignore` excludes local secret files. The second migration also protects
Prisma's migration history with RLS.

### Demo Login Accounts (only after db:seed)

For a disposable demonstration database, `npm run db:seed` creates the accounts
below and sample inventory. It DELETES existing inventory and users. Production
setup uses `db:admin`, which preserves existing data and never resets an existing
administrator's password. Demo credentials are not shown on the login page.

| Role                    | Email                        | Password     |
|-------------------------|------------------------------|--------------|
| System Admin            | admin@inventory.local        | Admin@123    |
| Inventory Manager       | manager@inventory.local      | Manager@123  |
| Warehouse Supervisor    | supervisor@inventory.local   | Super@123    |
| Stock Counter           | counter1@inventory.local     | Counter@123  |
| Independent Verifier    | verifier@inventory.local     | Verify@123   |
| Approver / Auditor      | approver@inventory.local     | Approve@123  |

---

## What is Included

### Database (Prisma Schema)
- Item Master (Arabic + English names, SKU, source type Factory/Import)
- Batches / Lots
- Cartons with **permanent unique QR codes**
- Warehouses → Locations (Zone / Aisle / Shelf / Bin)
- Inventory Balances (Item + Batch + Location)
- Full Stock Movement Ledger (atomic transactions)
- Stocktake Sessions (Periodic + Surprise + Blind)
- Count Records with double-count prevention
- Book Snapshots for reconciliation
- Stock Adjustments (require approval)
- Append-only Audit Log
- Scan Events history

### Backend Services
- `inventory.ts` – Atomic stock movements & balance updates
- `stocktake.ts` – Session lifecycle, QR counting, reconciliation engine
- Full RBAC with 6 roles enforced on the server

### Arabic RTL UI
- Login
- Dashboard with live stats
- Item Master list
- Stocktake sessions list + create form
- Stocktake detail + Start button
- Counting / Scanning workstation (mobile friendly)
- Reports index
- Navigation fully in Arabic

### QR System
- Permanent QR identifier (quantity is never encoded in the QR)
- Scan via keyboard wedge / USB scanner / manual entry
- Lookup + stocktake counting modes
- Duplicate / Unknown / Inactive detection

---

## Project Structure

```
inventory-system/
├── prisma/
│   ├── schema.prisma      # Complete relational model
│   └── seed.ts            # Realistic Arabic + English seed data
├── src/
│   ├── app/
│   │   ├── (dashboard)/   # Protected Arabic pages
│   │   ├── api/           # Auth, Scan, Stocktake APIs
│   │   ├── login/
│   │   └── scan/
│   ├── lib/
│   │   ├── auth/          # NextAuth + RBAC
│   │   ├── services/      # Business logic
│   │   └── prisma.ts
│   ├── components/
│   ├── middleware.ts
│   └── types/
├── .env.example
├── package.json
├── README.md
└── README-AR.md
```

---

## Production Notes

1. Set a strong `NEXTAUTH_SECRET` and the deployed `NEXTAUTH_URL`
2. Configure both Supabase PostgreSQL connection strings from `.env.example`
3. Run `npm run db:migrate` in production; do not run the destructive demo seed on existing data
4. Add HTTPS and proper rate limiting
5. Excel/PDF export endpoints can be completed with the already-included ExcelJS & PDFKit packages

---

## Acceptance Criteria Covered

- Unique QR per carton
- Multiple cartons / batches / locations per SKU
- Factory vs Import source separation with consolidated totals
- Double-count prevention
- Blind surprise stocktake
- Book snapshot + reconciliation
- Role-based access
- Full audit trail
- Arabic RTL interface

This is a **real working foundation**, not a static mockup. Extend the remaining report export endpoints and additional CRUD screens as needed.
