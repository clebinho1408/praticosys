# PráticoSys

Sistema de Gestão de Exames Práticos para DETRAN — gerenciamento de candidatos, bancas de prova, examinadores e autoescolas.

## Run & Operate (Replit — desenvolvimento)

- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080)
- `pnpm --filter @workspace/praticosys run dev` — frontend (porta via PORT env)
- `pnpm run typecheck` — typecheck completo de todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm run cf-build` — build do frontend para deploy no Cloudflare Pages
- `pnpm --filter @workspace/db run push` — sincronizar schema com o banco (dev)
- Env obrigatória: `DATABASE_URL` — string de conexão Postgres

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui, HashRouter
- API (dev): Express 5 (porta 8080), servido em `/api/*`
- API (prod): Cloudflare Pages Functions em `functions/api/`
- DB: PostgreSQL + Drizzle ORM
- Build: esbuild (CJS bundle para API Express); Vite (frontend)

## Where things live

- `artifacts/praticosys/` — React+Vite frontend (UI em português)
- `artifacts/api-server/` — Express API server (usado SOMENTE em dev/Replit)
- `artifacts/api-server/src/routes/praticosys.ts` — todas as rotas Express
- `lib/db/src/schema/praticosys.ts` — schema Drizzle (usado pelo Express)
- `functions/` — **Cloudflare Pages Functions** (backend para produção)
- `functions/_db.ts` — helper DB para Cloudflare (usa @neondatabase/serverless)
- `functions/api/` — handlers de rotas para Cloudflare Pages
- `db/schema.ts` — schema Drizzle para as Cloudflare Functions
- `wrangler.toml` — configuração de deploy no Cloudflare Pages
- `.migration-backup/` — arquivos originais Vercel/Cloudflare Pages (referência)

## Cloudflare Pages — Deploy para Produção

### Pré-requisitos
- Conta no Cloudflare (cloudflare.com)
- Banco de dados **Neon** (neon.tech) com as mesmas tabelas do banco atual
- Repositório no GitHub (ou GitLab)

### Configuração no Cloudflare Dashboard

1. **Conectar repositório**: Cloudflare Pages → "Create a project" → conectar o repositório GitHub
2. **Configurações de build**:
   - Build command: `pnpm run cf-build`
   - Build output directory: `artifacts/praticosys/dist/public`
   - Root directory: *(deixar em branco — usar raiz do repositório)*
3. **Variáveis de ambiente** (Settings → Environment variables):
   - `DATABASE_URL` → string de conexão do Neon (ex: `postgresql://user:pass@host/db?sslmode=require`)
   - `NODE_ENV` → `production`
4. **Primeiro deploy**: Cloudflare vai detectar automaticamente o diretório `functions/` na raiz
5. **Inicializar o banco**: Após o deploy, fazer POST para `https://seu-site.pages.dev/api/setup`

### Migrar dados do Replit para o Neon

```bash
# Exportar do Replit
pg_dump "$DATABASE_URL" --no-owner --no-acl > backup.sql

# Importar no Neon
psql "postgresql://..." < backup.sql
```

### Deploy via CLI (alternativo)

```bash
# Build do frontend
pnpm run cf-build

# Deploy (requer wrangler instalado)
npx wrangler pages deploy artifacts/praticosys/dist/public --project-name=praticosys
```

## Architecture decisions

- Frontend usa HashRouter para evitar problemas de roteamento server-side
- Em **dev** (Replit): frontend faz proxy de `/api/*` para `http://localhost:8080` (Express)
- Em **prod** (Cloudflare): `/api/*` é interceptado pelas Cloudflare Pages Functions diretamente
- SSE em produção retorna apenas um ping (Workers não suportam SSE longo); frontend usa polling
- `@neondatabase/serverless` (neon-http) em produção; `pg` (node-postgres) em dev
- `onConflictDoNothing()` para criação idempotente de usuários

## Product

- Login com controle de acesso por papel (ADMIN, EXAMINER, INSTRUCTOR, escolas)
- Gerenciar examinadores, instrutores, autoescolas (CFCs) e cidades
- Criar e gerenciar bancas de exame prático
- Processar solicitações de candidatos (via autoescola ou direto)
- Consulta de placa veicular via API externa (apicarros.com)
- Configurações do sistema (nome da agência, slots padrão, templates WhatsApp)
- Gerenciamento de datas bloqueadas (feriados, bloqueios manuais)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Usuário admin criado automaticamente ao chamar `POST /api/setup`
- Primeiro login do admin define a senha (sem senha padrão)
- `pnpm --filter @workspace/db run push` deve ser re-executado após mudanças de schema (apenas em dev)
- A tabela `schedule-slots` é separada de `exam_requests` — usada para vagas de escala CFC/PCD sem candidato real
- O build do Cloudflare usa `pnpm run cf-build` (não `pnpm build`) para evitar erros de PORT/BASE_PATH

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, TypeScript e detalhes de pacotes
