# 🚀 Guia de Deploy — PráticoSys
## Railway (Backend) + Cloudflare Pages (Frontend)

---

## Visão Geral da Arquitetura

```
Browser → Cloudflare Pages (React/Vite — GRÁTIS)
                    ↕ chamadas /api/*
         Railway (Express + Node.js — ~$5/mês)
                    ↕
         Neon Postgres (banco de dados — sem mudança)
```

---

## PARTE 1 — Deploy do Backend no Railway

### 1.1 Criar conta e projeto

1. Acesse **https://railway.app** e faça login com sua conta GitHub
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione o repositório **`clebinho1408/praticosys`**
4. Railway detectará automaticamente o `nixpacks.toml` e fará o build

### 1.2 Configurar variáveis de ambiente

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(copie do seu .env.local — a URL do Neon)* |
| `APP_SESSION_SECRET` | *(gere uma string aleatória longa, ex: `openssl rand -hex 32`)* |
| `ENABLE_INTERNAL_DIAGNOSTICS` | `false` |
| `ENABLE_DESTRUCTIVE_OPERATIONS` | `false` |
| `ENABLE_HTTP_LOGS` | `false` |

> ⚠️ **Não configure `FRONTEND_URL` ainda** — você vai obter a URL do Cloudflare no próximo passo.

### 1.3 Aguardar o deploy

- Railway irá executar `npm run build:server` e depois `node dist-server/lib/server.js`
- O deploy leva ~2 minutos
- Após concluído, você verá uma URL como:
  ```
  https://praticosys-api.up.railway.app
  ```
- **Guarde essa URL** — você vai precisar dela no Passo 2

### 1.4 Adicionar FRONTEND_URL depois

Após o deploy do Cloudflare Pages, volte ao Railway e adicione:

| Variável | Valor |
|---|---|
| `FRONTEND_URL` | `https://praticosys.pages.dev` *(sua URL do CF Pages)* |

---

## PARTE 2 — Deploy do Frontend no Cloudflare Pages

### 2.1 Criar conta e projeto

1. Acesse **https://pages.cloudflare.com** e faça login com sua conta
2. Clique em **"Create a project"** → **"Connect to Git"**
3. Selecione o repositório **`clebinho1408/praticosys`**

### 2.2 Configurar o build

Na tela de configuração do Cloudflare Pages, use:

| Campo | Valor |
|---|---|
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | *(deixe vazio)* |

### 2.3 Configurar variáveis de ambiente

Ainda na tela de configuração, em **Environment variables**, adicione:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `https://praticosys-api.up.railway.app` *(URL do Railway do Passo 1.3)* |

> ⚠️ Essa variável **deve começar com `VITE_`** para ser injetada no build do Vite.

### 2.4 Aguardar o deploy

- Cloudflare Pages fará o build com `npm run build` e publicará a pasta `dist/`
- O deploy leva ~1–2 minutos
- Você receberá uma URL como:
  ```
  https://praticosys.pages.dev
  ```

### 2.5 Configurar domínio personalizado (opcional)

Em **Custom domains**, você pode vincular um domínio próprio gratuitamente.

---

## PARTE 3 — Finalização

### 3.1 Atualizar FRONTEND_URL no Railway

Volte ao painel do Railway → seu projeto → **Variables** e adicione/atualize:

```
FRONTEND_URL=https://praticosys.pages.dev
```

Clique em **Deploy** para reiniciar o servidor com a variável atualizada.

### 3.2 Testar

1. Abra `https://praticosys.pages.dev`
2. Faça login com seu usuário admin
3. Verifique que os dados carregam normalmente

---

## Custos Estimados

| Serviço | Plano | Custo |
|---|---|---|
| Cloudflare Pages | Free | **R$ 0/mês** |
| Railway | Hobby ($5 incluso) | **~R$ 28–80/mês** |
| Neon Postgres | Free (0.5 GB) | **R$ 0/mês** |
| **Total** | | **~R$ 28–80/mês** |

> 💡 Com 60 usuários ativos (uso moderado), o Railway ficará em torno de $5–$10/mês.

---

## Estrutura de Arquivos Relevantes

```
.env.railway        → template de variáveis para o Railway
.env.cloudflare     → template de variáveis para o Cloudflare Pages
railway.json        → configuração do Railway
nixpacks.toml       → instruções de build para o Railway
tsconfig.server.json → compilação TypeScript do backend
public/_redirects   → regras SPA para o Cloudflare Pages
```

---

## Solução de Problemas

### API retorna erro CORS
- Verifique se `FRONTEND_URL` no Railway está com a URL correta do Cloudflare Pages
- Reinicie o serviço no Railway após atualizar a variável

### Página em branco no Cloudflare
- Verifique se `VITE_API_URL` está definido nas variáveis de ambiente do Cloudflare Pages
- Rebuilde o projeto (Cloudflare Pages → Deployments → Retry)

### Banco de dados não conecta
- Verifique se `DATABASE_URL` no Railway é igual à do `.env.local`
- Confirme que a URL do Neon tem `?sslmode=require` no final
