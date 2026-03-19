import express from 'express';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import API handlers
import authHandler from './api/auth.js';
import examinersHandler from './api/examiners.js';
import instructorsHandler from './api/instructors.js';
import requestsHandler from './api/requests.js';
import schedulesHandler from './api/schedules.js';
import schoolsHandler from './api/schools.js';
import settingsHandler from './api/settings.js';
import setupHandler from './api/setup.js';
import testHandler from './api/test.js';
import usersHandler from './api/users.js';
import { db } from './db/index.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
  app.all('/api/schools', wrap(schoolsHandler));
  app.all('/api/settings', wrap(settingsHandler));
  app.all('/api/setup', wrap(setupHandler));
  app.all('/api/test', wrap(testHandler));
  app.all('/api/users', wrap(usersHandler));
  
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
