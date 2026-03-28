import { createServer } from '../lib/server';

let app: any;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async (req: any, res: any) => {
  console.log(`[API] Received request for ${req.url}`);
  try {
    if (!app) {
      console.log(`[API] Initializing server...`);
      app = await createServer();
      console.log(`[API] Server initialized.`);
    }
    return app(req, res);
  } catch (error) {
    console.error('[API] Error initializing server:', error);
    res.status(500).json({ error: 'Internal Server Error during initialization' });
  }
};
