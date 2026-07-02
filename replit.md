# PráticoSys

Sistema de Gestão de Exames Práticos para DETRAN — gerenciamento de candidatos, bancas de prova, examinadores e autoescolas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/praticosys run dev` — run the frontend (port configured via PORT env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui, HashRouter
- API: Express 5 (port 8080), served at `/api/*`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/praticosys/` — React+Vite frontend (Brazilian Portuguese UI)
- `artifacts/api-server/` — Express API server
- `artifacts/api-server/src/routes/praticosys.ts` — All PráticoSys API routes
- `lib/db/src/schema/praticosys.ts` — Database schema (Drizzle)
- `lib/db/src/schema/index.ts` — Re-exports praticosys schema
- `.migration-backup/` — Original Vercel/Cloudflare Pages source files

## Architecture decisions

- Frontend uses HashRouter (not BrowserRouter) to avoid server-side routing issues
- Frontend proxies `/api/*` to `http://localhost:8080` via Vite dev server proxy
- All Vercel-style `handler(req, res)` functions were converted to Express Router handlers
- SSE (Server-Sent Events) for real-time updates is in the same routes file
- Original Neon serverless DB replaced with Replit's node-postgres pool via `lib/db`
- `onConflictDoNothing()` used for idempotent user creation (instructors auto-create users)

## Product

- Login system with role-based access (ADMIN, EXAMINER, INSTRUCTOR, school users)
- Manage examiners, instructors, driving schools (CFCs), and cities
- Create and manage exam schedules (bancas) for practical driving tests
- Process exam requests from candidates (via school or direct)
- Real-time updates via SSE when schedules/requests are updated
- Vehicle plate lookup via external API (apicarros.com)
- System settings (agency name, default slots, WhatsApp message templates)
- Blocked dates management (holidays, manual blocks)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Admin user is created automatically on first `/api/setup` call
- First admin login sets the password (no default password enforced)
- `pnpm --filter @workspace/db run push` must be re-run after schema changes
- The `schedule-slots` table is separate from `exam_requests` — used for CFC/PCD slot bookings without real candidates

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
