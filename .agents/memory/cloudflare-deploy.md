---
name: Cloudflare Pages deployment for PráticoSys
description: Architecture decisions for dual-mode Express (dev) + Cloudflare Pages Functions (prod) setup
---

## Rule
PráticoSys runs dual-mode:
- **Dev (Replit)**: frontend Vite proxy → Express (port 8080) → Replit Postgres (node-postgres)
- **Prod (Cloudflare)**: static Vite build + Cloudflare Pages Functions → Neon (neon-http / @neondatabase/serverless)

## Key files
- `functions/` at repo root = Cloudflare Pages Functions (NOT inside artifacts/)
- `db/schema.ts` at repo root = schema for Cloudflare functions (separate from lib/db which is for Express)
- `wrangler.toml` at repo root → `pages_build_output_dir = "artifacts/praticosys/dist/public"`
- Build script: `pnpm run cf-build` = `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/praticosys run build`

## Why
- Cloudflare Workers don't support node-postgres; must use @neondatabase/serverless (neon-http driver)
- Express server is kept for Replit dev convenience (hot reload, debugging)
- PAGE Functions live at repo root so Cloudflare auto-detects `functions/` directory

## How to apply
- If adding a new API route: add to BOTH `artifacts/api-server/src/routes/praticosys.ts` (Express) AND `functions/api/<route>.ts` (Cloudflare)
- Use `crypto.randomUUID()` (not `import { randomUUID } from 'crypto'`) in functions — both are fine with `nodejs_compat` flag but globalThis.crypto.randomUUID() also works without it
- `wrangler.toml` has `compatibility_flags = ["nodejs_compat"]` which enables Node.js crypto imports
- Cloudflare Pages Dashboard config: Build command = `pnpm run cf-build`, Output = `artifacts/praticosys/dist/public`, DATABASE_URL = Neon connection string
