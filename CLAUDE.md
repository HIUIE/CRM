# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartTrade AI CRM is a React 19 + TypeScript + Vite foreign-trade CRM/ERP application. It combines a Vite frontend with an Express API server, PostgreSQL persistence, file uploads, AI features, PDF/Excel export, and Socket.IO notifications. The main business areas are dashboard, orders, order detail, finance, logistics, tasks, customers, partners, settings, and audit logs.

## Common Commands

```sh
npm run dev              # Start the Express server with Vite middleware in watch mode
npm run dev:serve        # Start the server once via tsx
npm run lint             # Type-check the whole project with tsc --noEmit
npm test                 # Run backend/node tests under tests/**/*.test.ts
npm run test:frontend    # Run Vitest frontend tests
npm run build            # Build the Vite frontend into dist
npm run smoke:ui         # Run UI smoke checks
npm run release:check    # lint + backend tests + build + UI smoke checks
npm run migrate:up       # Run database migrations
npm run migrate:create   # Create a new migration
```

To run a single frontend test, use Vitest directly, for example:

```sh
npx vitest run src/components/ui/__tests__/Chip.test.tsx
```

To run a single backend test, use Node's test runner directly, for example:

```sh
node --import tsx --test tests/example.test.ts
```

## Architecture

The app entry point is `src/main.tsx`, with route definitions in `src/App.tsx`. Authenticated pages are rendered inside `src/components/layout/MainLayout.tsx`; unauthenticated users are redirected to `/login`. Most top-level business pages live in `src/pages` or `src/components`, with shared UI primitives in `src/components/ui`.

The order detail page is intentionally split across multiple files because it is the densest workflow in the app. `src/pages/OrderDetail.tsx` owns data loading, state, routing/search-param drawer state, lazy loading, and orchestration. `src/features/order-detail/types.ts` defines the local domain types. `utils.ts` contains form builders, defaults, formatting, and stage helpers. `handlers.ts` contains save/upload/delete/export handlers. `drawers.tsx` contains editing forms. `sections-primary.tsx` and `sections.tsx` contain the visible order-detail sections such as documents, finance, profit, production, customs, packing, logistics, tasks, follow-ups, and side navigation. `components.tsx` contains reusable order-detail UI atoms and dashboards.

The API server starts from `server.ts`, initializes PostgreSQL tables, bootstraps the initial admin, creates the Express app, and attaches Socket.IO. `server/app.ts` configures middleware, security, `/api` routes, brand asset serving, and Vite middleware in development. API route files live under `server/routes`, while cross-route business logic and payload normalization live under `server/services`. Database and auth helpers live under `server/lib` and `server/db-pg.ts`.

Shared CRM domain types are in `src/types/crm.ts`; API response helpers and fetching are in `src/lib/api.ts`. Uploads are stored under `data/uploads`, and server path constants live in `server/paths.ts`.

## CRM UI Design Standard

For SmartTrade CRM UI work, prioritize professional, simple, clear, and readable business interfaces. This is a daily CRM/ERP tool for quickly reviewing order status, finance, production, customs, packing, logistics, tasks, and risk; the goal is operational clarity, not decorative visual impact.

Keep primary surfaces white or very light gray with subtle borders, consistent typography, and predictable spacing. Do not use large colorful backgrounds, large blue/purple/green blocks, or strong colorful side borders to distinguish modules. Use color sparingly as a functional accent only: icon color, small tag backgrounds, status dots, small badges, or restrained text emphasis.

Limit the semantic palette. Blue can indicate information or process, green completion/success, amber waiting/reminder, and red exceptions/risk. Avoid introducing a new color family for every module. If differentiating domestic vs. international logistics, receipt vs. payment, or pending vs. completed states, prefer small local cues such as icon color, label background, and status dot rather than changing the whole card.

Preserve visual consistency across modules. Section titles, action buttons, field labels, data values, cards, tables, empty states, attachments, and drawers should feel like one design system. Business data such as amounts, dates, tracking numbers, declaration numbers, factories, customers, carriers, and counterparties should be more prominent than decorative elements.

For order detail page improvements, work one module at a time and avoid broad visual rewrites unless requested. Before changing a module, compare it with neighboring modules and reuse existing primitives such as `DocumentBoard`, `WorkSection`, `LightActionButton`, `GridItem`, `Chip`, `StatusFileRow`, `AttachmentEditor`, and shared drawer patterns. Maintain existing edit, upload, preview, delete, permission, routing, and responsive behavior.

After UI or TypeScript changes, run `npm run lint` at minimum. For broader changes, also run the relevant tests or `npm run release:check` when practical.
