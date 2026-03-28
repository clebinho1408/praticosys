import { createServer } from '../lib/server.js';

let app: any;

export default async (req: any, res: any) => {
  if (!app) {
    app = await createServer();
  }
  return app(req, res);
};
