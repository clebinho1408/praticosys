// Express session middleware — valida Bearer token e injeta sessionUser no request.
import { db, users } from '@workspace/db';
import * as schema from '@workspace/db';
import type { Request, Response, NextFunction } from 'express';
import { readSessionUser } from '../../../../functions/_session-user.js';
import { accessPolicy, sanitizeMutation, AccessDenied } from '../../../../functions/_access-policy.js';

const EXCLUDED = ['/auth', '/verify-otp', '/setup', '/test', '/health', '/session'];

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
    const user = await readSessionUser(db, users, token);
    if (!user) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    (req as any).sessionUser = user;
    const policy = await accessPolicy(db, schema, user);
    const route = req.path.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
    await policy.authorize(route, req.method, req.body ?? {}, req.query as any);
    (req as any).authorizedRoute = route;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) req.body = sanitizeMutation(route, req.body ?? {}, schema);
    const originalJson = res.json.bind(res);
    res.json = ((payload: any) => {
      if (res.statusCode >= 500) return originalJson({ error: 'Não foi possível concluir a operação.' });
      if (res.statusCode >= 400) return originalJson(payload);
      void policy.project(payload, route).then(safe => {
        res.setHeader('Cache-Control', 'no-store');
        originalJson(safe);
      }).catch(() => { res.status(503); originalJson({ error: 'Não foi possível autorizar a resposta.' }); });
      return res;
    }) as any;
    return next();
  } catch (err: any) {
    if (err instanceof AccessDenied) return res.status(err.status).json({ error: err.message });
    return res.status(503).json({ error: 'Não foi possível verificar as permissões. Tente novamente.' });
  }
}
