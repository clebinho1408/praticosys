// functions/api/users.ts  →  GET|POST|PUT|DELETE /api/users
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../_password.js';

const ADMIN_ONLY_FIELDS = ['password', 'twoFactorEnabled', 'two_factor_enabled', 'role'];

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS autoescola_id text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS examinador_id text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS instrutor_id text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS forcar_troca_senha boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT '[]'::jsonb`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env, data } = context as any;
  const sessionUserRole: string = data?.sessionUserRole ?? '';

  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    // Listar usuários: Admin e Supervisor podem ver
    if (method === 'GET') {
      if (!['ADMIN', 'SUPERVISOR'].includes(sessionUserRole)) {
        return error('Acesso negado', 403);
      }
      await ensureSchema(db);
      const userData = await db.select().from(users);
      return json(userData.map(({ password, ...rest }: any) => rest));
    }

    // Criar, editar e excluir usuários: somente ADMIN
    if (!['POST', 'PUT', 'DELETE'].includes(method)) return error('Method Not Allowed', 405);
    if (sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores podem gerenciar usuários', 403);

    if (method === 'POST') {
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      // 2FA exige e-mail cadastrado
      if (body.twoFactorEnabled && !body.email) {
        return error('Verificação em 2 etapas requer e-mail cadastrado.', 400);
      }
      const hashedDefault = await hashPassword('123456');
      const newItem = await db.insert(users).values({ id: crypto.randomUUID(), password: hashedDefault, ...body }).returning();
      const { password, ...safe } = newItem[0] as any;
      return json(safe);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, createdAt, updatedAt, ...updates } = body;
      if (!id) return error('ID obrigatório', 400);

      // 2FA exige e-mail cadastrado
      if (updates.twoFactorEnabled && !updates.email) {
        // Verificar e-mail atual do usuário no banco
        const existing = await db.select().from(users).where(eq(users.id, id));
        const existingEmail = (existing[0] as any)?.email;
        if (!existingEmail && !updates.email) {
          return error('Verificação em 2 etapas requer e-mail cadastrado.', 400);
        }
      }

      // Se a atualização inclui senha em texto puro, criptografar antes de salvar
      if (updates.password && !updates.password.startsWith('$2b$') && !updates.password.startsWith('$2a$')) {
        updates.password = await hashPassword(updates.password);
      }
      const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      if (!updated.length) return error('Usuário não encontrado', 404);
      const { password, ...safe } = updated[0] as any;
      return json(safe);
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(users).where(eq(users.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
