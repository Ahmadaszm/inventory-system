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

# 3. Setup database (SQLite for development)
npx prisma generate
npx prisma db push

# 4. Seed realistic data (items, batches, cartons with QR, users)
npx tsx prisma/seed.ts

# 5. Run
npm run dev
```

Open **http://localhost:3000**

### Login Accounts
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

1. Change `NEXTAUTH_SECRET` in `.env`
2. For PostgreSQL replace `DATABASE_URL` and change provider in `schema.prisma`
3. Run `npx prisma migrate deploy` in production
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
