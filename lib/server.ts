import express from 'express';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
import { db } from '../db/index.js';

export const app = express();

app.use((req, _res, next) => {
  console.log(`[Server] Request: ${req.method} ${req.url}`);
  next();
});

export async function createServer() {
  return app;
}

app.get('/api/db-status', (_req, res) => {
  res.json({
    hasUrl: !!process.env.DATABASE_URL,
    hasViteUrl: !!process.env.VITE_NEON_DATABASE_URL,
    isMock: (db as any)._isMock || false,
  });
});

// Middleware to parse JSON bodies (needed for API handlers)
app.use(express.json());

// API Routes
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

app.all('/api/auth', wrap(authHandler));
app.all('/api/examiners', wrap(examinersHandler));
app.all('/api/instructors', wrap(instructorsHandler));
app.all('/api/requests', wrap(requestsHandler));
app.all('/api/schedules', wrap(schedulesHandler));
app.all('/api/banca-results', wrap(bancaResultsHandler));
app.all('/api/schools', wrap(schoolsHandler));
app.all('/api/settings', wrap(settingsHandler));
app.all('/api/setup', wrap(setupHandler));
app.all('/api/test', wrap(testHandler));
app.all('/api/users', wrap(usersHandler));
app.all('/api/blocked-dates', wrap(blockedDatesHandler));
app.all('/api/cities', wrap(citiesHandler));

export async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
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

// Only start the server if this file is run directly (not in Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  setupVite().then(() => {
    app.listen(3000, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:3000`);
    });
  });
}
