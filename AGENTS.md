# SKYNOVA CRM — Agent Guide

> This file is intended for AI coding agents. It describes the project architecture, conventions, and critical details you need before modifying code.

---

## Project Overview

**SKYNOVA CRM** is a full-stack CRM / ERP web application built with Next.js 14 (App Router). It supports multi-role user management, order lifecycle tracking, warehouse inventory across two countries (Turkey and Syria), employee targets & salaries, expense tracking, customer management, analytics, and an e-commerce affiliate platform.

The UI is primarily **Arabic** and rendered **RTL** (`dir="rtl"`). Most user-facing labels, toast messages, and inline comments are in Arabic. Code identifiers (variables, functions, filenames) remain in English.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14.2.35 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI Library | React 18 |
| Styling | Tailwind CSS 3.4.1 |
| Database | PostgreSQL |
| ORM | Prisma 7.3.0 (custom output: `generated/prisma`) |
| Auth | JWT (`jose`) + `bcryptjs` + HTTP-only cookie (`skynova`) |
| State Management | Zustand (minimal stores) |
| Forms | React Hook Form + Zod |
| Charts | Recharts + Tremor |
| PDF/Print | `jspdf`, `jspdf-autotable`, `html2canvas`, `react-to-print` |
| PWA | `@ducanh2912/next-pwa` |
| Image Storage | `@vercel/blob` |
| Cron | `node-cron` (server-side monthly target freeze) |

---

## Project Structure

```
app/                    # Next.js App Router
  api/                  # API routes (login, users, permissions, settings, orders)
  dashboard/            # Protected dashboard pages
    layout.tsx          # Dashboard shell (Sidebar + Navbar, RTL, ThemeProvider)
    page.tsx            # Main dashboard (analytics, targets, activity)
    analytics/
    categories/
    collections/
    customers/
    employee-salaries/
    expenses/
    inventories/
    move-product/
    orders/
    permissions/
    products/
    settings/
    shipping/
    users/
    warranty/
  layout.tsx            # Root layout (fonts, AuthProvider, Toaster)
  page.tsx              # Login page (redirects to /dashboard if session exists)
  manifest.ts           # PWA manifest

server/                 # Server Actions (`'use server'`)
  user.ts               # Auth, user CRUD, targets, impersonation
  order.ts              # Order CRUD, stock adjustments, analytics helpers
  customer.ts
  product.ts
  category.ts
  warehouse.ts
  shipping.ts
  expenses.ts
  analytics.ts
  image.ts              # Vercel Blob image upload
  collections.ts
  employee-salaries.ts
  warranty.ts
  move.ts
  general-settings.ts

components/             # React components
  pages/                # Page-specific sections
  shared/               # Reusable cross-page components (DataTable, DynamicForm, etc.)
  system/               # Toaster providers
  ui/                   # Low-level UI primitives (Button, Modal, Inputs, Cards)
  navbar.tsx
  sidebar.tsx

orders/                 # Order domain split out from components/
  OrderTable.tsx
  SearchAndFilter.tsx
  ShippingModal.tsx
  StatusCards.tsx
  ViewOrder.tsx
  ViewOrderCustomer.tsx
  orderHelpers.ts
  orderPdf.ts
  useOrderData.ts
  useOrderExport.ts
  useOrderFilters.ts
  useOrderForm.ts

lib/                    # Utilities & configuration
  auth.ts               # JWT encrypt/decrypt (uses hardcoded secret key)
  prisma.ts             # PrismaClient with pg adapter
  utils.ts              # cn() (Tailwind merge), permission helpers, phone formatter
  type.ts               # Shared TypeScript interfaces (User, Permission, NavItem)
  themeProvider.tsx     # Re-exports next-themes provider
  cron.ts               # Monthly target freeze cron job

context/
  AuthContext.tsx       # React context: auth state, impersonation, refreshUser

store/
  customer.ts           # Zustand store for order cash/grand-total state

prisma/
  schema.prisma         # Full schema (Users, Orders, Products, Affiliates, etc.)
  migrations/           # Prisma migrations
```

---

## Build & Development Commands

```bash
# Install dependencies
npm install

# Dev server (runs on port 4000)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint
npm run lint
```

> **Note:** There is no test suite configured in this project. `npm run lint` maps to `next lint`.

---

## Database & Migrations

The project uses **PostgreSQL** via Prisma with the `@prisma/adapter-pg` adapter. The Prisma client is generated to `generated/prisma/`.

```bash
# Generate Prisma client
npx prisma generate

# Create a migration
npx prisma migrate dev --create-only

# Deploy migrations
npx prisma migrate deploy
```

Connection is configured via `DATABASE_URL` in `.env`. A `prisma.config.ts` file is also present for Prisma's new configuration format.

**Important models:** `User`, `Permission`, `Order`, `OrderItem`, `Product`, `ProductStock`, `Warehouse`, `Customer`, `Expense`, `Shipping`, `Warranty`, `AffiliateLink`, `Commission`.

---

## Authentication & Authorization

- **Session:** JWT stored in an HTTP-only cookie named `skynova`. Expires in 30 days.
- **Middleware (`middleware.ts`):**
  - Redirects unauthenticated users from `/dashboard/*` to `/`.
  - Redirects authenticated users from `/` to `/dashboard`.
- **Roles:** `ADMIN`, `MANAGER`, `STAFF`.
- **Permissions:** Granular CRUD permissions per module (products, orders, customers, employees, expenses, categories, permissions, analytics). Admins bypass all permission checks.
- **Impersonation:** Admins can impersonate other users via `?asUser=<id>` query param or session storage key `skynova_as_user_id`. Stop impersonation with `?asUser=me`.

### Security Considerations
- **JWT secret is hardcoded** in `lib/auth.ts` as `"secret"`. In production this should be moved to `process.env.JWT_SECRET`.
- No visible rate-limiting or CSRF token implementation.
- Passwords are hashed with `bcryptjs`.

---

## Code Style Guidelines

1. **TypeScript:** Strict mode enabled. Write types for all function inputs/outputs.
2. **Path Aliases:** Use `@/` for imports from the project root (e.g., `@/lib/prisma`, `@/components/ui/button`).
3. **Server vs Client:**
   - Default to **Server Components**.
   - Mark interactive components with `'use client'`.
   - Mark server-only data mutations with `'use server'`.
4. **Styling:** Tailwind CSS. Use `cn()` from `@/lib/utils` for conditional class merging.
5. **RTL:** Dashboard layout sets `dir="rtl"`. All forms, tables, and modals should remain RTL-aware.
6. **Language:** UI text and comments are mostly **Arabic**. Keep new user-facing text in Arabic to match the existing UX.
7. **Forms:** Use `DynamicForm` + `FormInput` / `select-form` + Zod schemas.
8. **Toast Feedback:** Use `react-hot-toast` with Arabic messages (`toast.success("...")`, `toast.error("...")`).

---

## Key Architectural Patterns

### Server Actions
Heavy business logic lives in `server/*.ts` files as async exported functions with `'use server'`. These are imported directly into Server Components or called from Client Components for mutations.

### API Routes
Lightweight API routes exist under `app/api/` for specific needs (login, logout, impersonation, user profile, settings data-transfer, WhatsApp sharing).

### Stock Management
Orders affect stock in real time via `applyOrderStockChange` in `server/order.ts`:
- Sold/delivered statuses **decrease** stock.
- Cancelled/returned statuses **restore** stock.
- Warehouses are located in either Turkey or Syria; stock lookups fall back by location name when `warehouseId` is absent.

### Cron Jobs
`lib/cron.ts` runs a monthly job (1st of month at 00:00 UTC) that deactivates active `UserTarget` records. It is imported in the root layout so it initializes once per server process.

---

## Deployment Notes

- The project includes PWA configuration (`next-pwa`) with service worker generation to `public/`.
- Vercel deployment is implied by the presence of `.vercel/` and `@vercel/blob` usage.
- `dev.db` exists in the repo but the app targets PostgreSQL in production.

---

## Quick Checklist Before Editing

- [ ] Does the file need `'use client'` or `'use server'`?
- [ ] Are you using `@/` aliases instead of relative `../../` paths?
- [ ] Are permission checks applied for non-admin users (`hasPermission` / `isAdmin`)?
- [ ] Is user-facing text in Arabic?
- [ ] Did you verify the Prisma schema reflects any new fields?
- [ ] Did you run `npx prisma generate` after schema changes?
