// Express session middleware — valida Bearer token e injeta sessionUser no request.
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { renewedExpiry } from '../../../../functions/_session-policy.js';

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
      SELECT u.id, u.perfil AS role, s.expira_em AS expires_at
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
    // Somente EXAMINER com sessão prolongada: renova para +30 dias a cada uso (no máx. 1x/hora)
    const renewed = renewedExpiry(data[0].expires_at, data[0].role);
    if (renewed) {
      void db.execute(sql`UPDATE sessoes SET expira_em = ${renewed.toISOString()} WHERE id = ${token}`).catch(() => {});
    }
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao verificar sessão: ' + err.message });
  }
}
