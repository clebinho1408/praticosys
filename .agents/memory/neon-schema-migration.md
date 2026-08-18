---
name: Neon schema-rename migration (Cloudflare Pages)
description: Lessons from the EN→PT rename that broke production; how DB migrations must run on Neon HTTP from Workers.
---

# Migrações de schema no Neon via Cloudflare Workers

**Regra:** migrações com muitos statements devem ir em UM bloco `DO $$ ... $$` (uma requisição HTTP ao Neon), nunca centenas de `db.execute` sequenciais — Workers estouram tempo/subrequests no meio e deixam o schema pela metade.

**Why:** a renomeação EN→PT rodou parcialmente em produção (tabelas sim, colunas não) exatamente por isso; usuários viam `column "codigo" does not exist`.

**How to apply:**
- SQL em `functions/_migration-sql.mjs` (fonte única; também executável via `psql "$DATA_BASE_NEON"` para consertar produção na hora).
- TODO rename (tabela E coluna) embrulhado em `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END;` — em produção alvos podem coexistir (ex.: `sessions` e `sessoes` juntas), e um rename de tabela sem guarda aborta o bloco inteiro.
- Marcador de conclusão (`migracoes_schema.versao = 'pt_schema_v1'`) e flag em memória só depois de verificar colunas-chave via information_schema — nunca dentro do DO block que engole erros.
- Rotas públicas (login/OTP) também precisam disparar a migração; middleware só cobre rotas autenticadas.
- Produção pode ter tabelas legadas duplicadas (`sessions`, `exam_requests_cfc/pcd/cnh_brasil`) coexistindo com as novas — dados podem estar divididos.
