import express from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file (local dev only).
// On Railway, variables are already injected into process.env — dotenv is a no-op.
dotenv.config({ override: false });

// Import API handlers
import authHandler from './server-api/auth.js';
import examinersHandler from './server-api/examiners.js';
import instructorsHandler from './server-api/instructors.js';
import requestsHandler from './server-api/requests.js';
import schedulesHandler from './server-api/schedules.js';
import bancaResultsHandler from './server-api/banca-results.js';
import schoolsHandler from './server-api/schools.js';
import settingsHandler from './server-api/settings.js';
import setupHandler from './server-api/setup.js';
import testHandler from './server-api/test.js';
import usersHandler from './server-api/users.js';
import blockedDatesHandler from './server-api/blocked-dates.js';
import citiesHandler from './server-api/cities.js';
import riskAreaHandler from './server-api/risk-area.js';
import { db } from '../db/index.js';
import { addClient } from './sse.js';

export const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const diagnosticsEnabled = !isProduction || process.env.ENABLE_INTERNAL_DIAGNOSTICS === 'true';
const verboseHttpLogsEnabled = !isProduction || process.env.ENABLE_HTTP_LOGS === 'true';

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow the Cloudflare Pages frontend (set FRONTEND_URL in Railway env vars)
const allowedOrigins: string[] = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
// Also allow localhost for local development
allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (
    allowedOrigins.includes(origin) ||
    // allow any *.pages.dev subdomain (Cloudflare preview deployments)
    /^https:\/\/[^.]+\.pages\.dev$/.test(origin) ||
    // allow any *.up.railway.app (Railway preview)
    /^https:\/\/[^.]+\.up\.railway\.app$/.test(origin)
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
// ─────────────────────────────────────────────────────────────────────────────

const rejectDisabledRoute = (res: any) => res.status(404).json({ error: 'Not Found' });
const wrapWhen = (enabled: boolean, handler: any) => async (req: any, res: any) => {
  if (!enabled) return rejectDisabledRoute(res);
  return wrap(handler)(req, res);
};

app.use((req, _res, next) => {
  if (verboseHttpLogsEnabled) {
    console.log(`[Server] Request: ${req.method} ${req.url}`);
  }
  next();
});

export async function createServer() {
  return app;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/api/db-status', (_req, res) => {
  if (!diagnosticsEnabled) return rejectDisabledRoute(res);
  res.json({
    hasUrl: !!process.env.DATABASE_URL,
    hasLegacyViteUrl: !!process.env.VITE_NEON_DATABASE_URL,
    isMock: (db as any)._isMock || false,
  });
});

// Middleware to parse JSON bodies
app.use(express.json());

// Helper to wrap Vercel-style handlers for Express
const wrap = (handler: any) => async (req: any, res: any) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

// ─── API Routes ───────────────────────────────────────────────────────────────
app.all('/api/auth', wrap(authHandler));
app.all('/api/examiners', wrap(examinersHandler));
app.all('/api/instructors', wrap(instructorsHandler));
app.all('/api/requests', wrap(requestsHandler));
app.all('/api/schedules', wrap(schedulesHandler));
app.all('/api/banca-results', wrap(bancaResultsHandler));
app.all('/api/schools', wrap(schoolsHandler));
app.all('/api/settings', wrap(settingsHandler));
app.all('/api/setup', wrapWhen(diagnosticsEnabled, setupHandler));
app.all('/api/test', wrapWhen(diagnosticsEnabled, testHandler));
app.all('/api/users', wrap(usersHandler));
app.all('/api/blocked-dates', wrap(blockedDatesHandler));
app.all('/api/cities', wrap(citiesHandler));
app.all('/api/risk-area', wrap(riskAreaHandler));

// SSE Endpoint for real-time updates
app.get('/api/events', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addClient(res);
});
// ─────────────────────────────────────────────────────────────────────────────

export async function setupVite() {
  if (!isProduction) {
    try {
      const viteModule = 'vite';
      const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('[Server] Vite not found or failed to load, skipping middleware');
    }
  }
}

// ─── Server startup ───────────────────────────────────────────────────────────
// In production (Railway): always start the HTTP server
// In development: start with Vite middleware
if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  if (isProduction) {
    // In production, serve the built frontend from dist/
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // dist/ is at the project root, two levels up from dist-server/lib/
    const distPath = path.resolve(__dirname, '../../dist');
    app.use(express.static(distPath));
    // SPA fallback - any non-API route serves index.html
    // Note: Express 5 (path-to-regexp v8) requires named wildcards, not bare '*'
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[PráticoSys] Production server running on port ${PORT}`);
    });
  } else {
    setupVite().then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[PráticoSys] Dev server running on http://localhost:${PORT}`);
      });
    });
  }
}
