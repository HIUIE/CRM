# SmartTrade AI CRM - AI Agent Context

This document serves as a high-level technical map for AI agents (LLMs) working on the SmartTrade AI CRM project. It provides the architectural context, domain logic, and technical constraints required to make safe and effective contributions.

## 🚀 Tech Stack
- **Frontend**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS v4 (Modern, minimalist industrial aesthetic).
- **Backend**: Node.js + Express (Runtime: `tsx` for direct TS execution).
- **Database**: SQLite (`sqlite3` / `sqlite` wrapper).
- **Authentication**: JWT-based, managed via `httpOnly` cookies.
- **AI Integration**: Google Generative AI (@google/genai).

## 📁 Project Structure
- `server/`: Backend implementation.
    - `db.ts`: **Source of Truth for Schema**. Handles table creation and migrations.
    - `routes/`: API endpoint definitions (e.g., `customers.ts`, `orders.ts`).
    - `lib/`: Core utilities (Auth, Audit Logging, HTTP helpers).
    - `data.db`: Local SQLite database file (git-ignored).
- `src/`: Frontend implementation.
    - `pages/`: Main route components (CustomerDetail, OrderDetail, Dashboard).
    - `components/`: Shared UI components (Layout, MainLayout).
    - `features/`: Logic-heavy modular components (Order-detail, etc.).
    - `lib/`: Frontend-only utilities (API fetching, shared types).
- `package.json`: Dependency map and scripts.

## 🏗️ Core Architectural Patterns

### 1. Identity & Masking (IDOR Prevention)
- **Database IDs**: Standard integer PKs (e.g., `1, 2, 3`).
- **Display IDs**: Public-facing identifiers (e.g., `CUST-2026-000005`, `ORD-YYYY-NNNNNN`).
- **Rule**: Frontend navigation and API lookup *must* prioritize `display_id`. Backend routes should support both but always return `display_id` to the client.

### 2. CRM Lifecycle & Tables
- **Customers**: Standardized via `CountrySelect` (ISO 3166). Includes `source_channel` and `intent_products`.
- **Contacts**: Matrix of key personnel per enterprise customer.
- **Follow-ups**: Timeline-based activity tracking.
- **Orders**: Linked to customers. Tracks status from draft to completed.
- **Finance**: `finance_records` table tracks receipts (`receipt`) and payments (`payment`).
- **Logistics**: Tracks carrier, ETD, ETA, and trajectory nodes.

### 3. Visual Language (Premium Geek-Minimalist)
- **Colors**: Primary Navy (`#0F172A`), Emerald for success, Error Red.
- **Icons**: `lucide-react` only.
- **Typography**: Inter / Outfit (Modern sans).
- **Components**: Heavy use of `Chip`, `EmptyStateBoard`, and glassmorphism.

## 🛠️ Common Workflows for AI
- **Adding a field**: 
    1. Update `server/db.ts` (add `ensureColumn` or update `CREATE TABLE`).
    2. Update routes in `server/routes/`.
    3. Update interfaces in `src/pages/` or `src/lib/`.
    4. Update UI forms.
- **Handling Auth**: Use `requireAuth` or `requireAdmin` middlewares in backend routes.
- **Audit Logging**: Every mutation (POST/PATCH/DELETE) should call `logAction` from `server/lib/audit.ts`.

## ⚠️ Important Constraints
- **Database**: Do NOT use `ALTER TABLE` for drops (SQLite limitation). Use the existing `ensureColumn` pattern.
- **Icons**: Always check `lucide-react` documentation; avoid custom SVGs unless necessary.
- **Response Format**: Use the `fail` and `handleRouteError` helpers in `server/lib/http.ts` for consistent API errors.

## 📍 Current State (Rounds 37-38)
- [x] Standardized Country Selection.
- [x] Contact Matrix CRUD.
- [x] Follow-up Timeline.
- [x] ID Masking (`display_id` for routing).
- [x] Direct linking from OrderDetail to Customer profile via `display_id`.
- [ ] UI Polish for Audit Logs empty state.
