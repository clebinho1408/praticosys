import { createServer } from '../lib/server.js';

export default async (req: any, res: any) => {
  const app = await createServer();
  return app(req, res);
};
