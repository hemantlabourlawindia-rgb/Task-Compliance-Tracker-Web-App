# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Application: Task & Compliance Tracker

Built for Labour Laws India Associates Pvt. Ltd. — an internal compliance/task submission web app.

### Features
- **Form submission** with searchable autocomplete dropdowns for: Payroll, Company, Work, Pending, Officer, Assigned
- **Submissions list** with pagination, search, and delete
- **Dashboard** with summary stats: totals, today's count, work category breakdown, recent submissions
- **Dropdown management** — options seeded in DB, manageable via API

### Pages
- `/` — Submit Task form
- `/submissions` — All submissions list  
- `/dashboard` — Stats & analytics

### Database Tables
- `dropdown_options` — Stores dropdown option values by category (payroll, company, work, pending, officer, assigned)
- `submissions` — Stores all form submissions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
