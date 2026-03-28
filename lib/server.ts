import express from 'express';
import { createServer as createViteServer } from 'vite';
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

export async function createServer() {
  const app = express();

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
  
  // Run DB Setup on startup
  console.log("[Server] Executando setup do banco de dados...");
  const mockRes = { 
    status: (code: number) => ({ 
      json: (data: any) => console.log(`[Setup Startup] Status ${code}:`, data),
      send: (data: any) => console.log(`[Setup Startup] Status ${code}:`, data)
    }) 
  };
  setupHandler({ method: 'POST' }, mockRes).catch(err => console.error("[Setup Startup] Erro:", err));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed)
    app.use(express.static('dist'));
  }

  return app;
}

// Only start the server if this file is run directly
if (process.env.NODE_ENV !== 'production') {
  createServer().then(app => {
    app.listen(3000, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:3000`);
    });
  });
}
