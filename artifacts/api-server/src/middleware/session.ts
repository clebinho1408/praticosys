// Express session middleware — valida Bearer token e injeta sessionUser no request.
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';

const EXCLUDED = ['/auth', '/verify-otp', '/setup', '/test', '/health', '/events', '/session'];

export async function sessionAuth(req: Request, res: Response, next: NextFunction) {
  if (EXCLUDED.some(p => req.path === p || req.path.startsWith(p + '?'))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  }

  try {
    const rows = await db.execute(sql`
      SELECT u.id, u.perfil AS role
      FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = ${token} AND s.expira_em > NOW()
      LIMIT 1
    `);
    const data = (rows as any).rows ?? rows;
    if (!data || data.length === 0) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    (req as any).sessionUser = { id: data[0].id, role: data[0].role };
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao verificar sessão: ' + err.message });
  }
}
