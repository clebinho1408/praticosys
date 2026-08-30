---
name: Cloudflare Pages deployment for PráticoSys
description: Architecture decisions for dual-mode Express (dev) + Cloudflare Pages Functions (prod) setup
---

## Rule
PráticoSys runs dual-mode:
- **Dev (Replit)**: frontend Vite proxy → Express (port 8080) → Neon externo via `DATA_BASE_NEON` quando configurado; `DATABASE_URL` é fallback
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
- Replit gerencia `DATABASE_URL`; ela pode apontar para um banco diferente do Neon usado no Cloudflare, fazendo a prévia exibir dados divergentes.

## How to apply
- If adding a new API route: add to BOTH `artifacts/api-server/src/routes/praticosys.ts` (Express) AND `functions/api/<route>.ts` (Cloudflare)
- Use `crypto.randomUUID()` (not `import { randomUUID } from 'crypto'`) in functions — both are fine with `nodejs_compat` flag but globalThis.crypto.randomUUID() also works without it
- `wrangler.toml` has `compatibility_flags = ["nodejs_compat"]` which enables Node.js crypto imports
- Cloudflare Pages Dashboard config: Build command = `pnpm run cf-build`, Output = `artifacts/praticosys/dist/public`, DATABASE_URL = Neon connection string
- Quando `DATA_BASE_NEON` existir na Replit, a conexão do Express local deve priorizá-la para que a prévia e o Cloudflare leiam os mesmos feriados, configurações e registros.
