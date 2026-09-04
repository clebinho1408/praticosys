// functions/api/schedules.ts  →  GET|POST|PUT|DELETE /api/schedules
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examSchedules, cnhbrasilRequests, cfcRequests, pcdRequests } from '../../db/schema.js';
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm';

const calculateStatus = (dateStr: string, timeStr: string, currentStatus: string) => {
  if (currentStatus === 'CANCELLED') return 'CANCELLED';
  const cleanDate = dateStr.split('T')[0];
  const now = new Date();
  const examDate = new Date(`${cleanDate}T${timeStr}`);
  const msPerHr = 60 * 60 * 1000;
  if (now > new Date(examDate.getTime() + 4 * msPerHr)) return 'CONCLUDED';
  if (now > new Date(examDate.getTime() - 12 * msPerHr)) return 'CLOSED';
  return 'OPEN';
};

/** Atualiza um campo de data/horário em todas as tabelas de módulo */
async function updateAllModuleTables(
  db: any,
  updates: Record<string, any>,
  whereScheduleId: string
) {
  for (const t of [cnhbrasilRequests, cfcRequests, pcdRequests] as any[]) {
    await db.update(t).set(updates).where(eq(t.scheduleId, whereScheduleId));
  }
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      const schedules = await db.select().from(examSchedules);
      const updates: Promise<any>[] = [];
      for (const s of schedules) {
        const calc = calculateStatus(s.date, s.time, s.status);
        if (calc !== s.status) {
          if (calc === 'CONCLUDED' && s.status !== 'CONCLUDED') {
            // Atualiza nas 3 tabelas de módulo
            for (const t of [cnhbrasilRequests, cfcRequests, pcdRequests] as any[]) {
              await db.update(t)
                .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
                .where(and(eq(t.scheduleId, s.id), eq(t.status, 'SCHEDULED')));
            }
          }
          updates.push(db.update(examSchedules).set({ status: calc }).where(eq(examSchedules.id, s.id)));
          s.status = calc;
        }
      }
      if (updates.length) await Promise.all(updates);
      return json(schedules);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const cleanDate = body.date.split('T')[0];
      const initialStatus = calculateStatus(cleanDate, body.time, 'OPEN');
      const last = await db.select({ code: examSchedules.code }).from(examSchedules)
        .where(isNotNull(examSchedules.code)).orderBy(desc(examSchedules.createdAt)).limit(1);
      let nextCode = 'B1000';
      if (last.length > 0 && last[0].code) {
        const n = parseInt(last[0].code.replace('B', ''), 10);
        if (!isNaN(n)) nextCode = `B${n + 1}`;
      }
      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(), code: nextCode, status: initialStatus, ...body, date: cleanDate,
      }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, action, reason, createdAt, updatedAt, ...updates } = body;
      if (!id) return error('ID obrigatório', 400);
      if (
        (data as any)?.sessionUserRole === 'SUPERVISOR' &&
        (action === 'CANCEL' || updates.status === 'CANCELLED')
      ) {
        return error('Supervisores não podem cancelar bancas.', 403);
      }

      if (action === 'CANCEL') {
        const updated = await db.update(examSchedules)
          .set({ status: 'CANCELLED', cancellationReason: reason })
          .where(eq(examSchedules.id, id)).returning();

        // Devolve candidatos para a fila nas 3 tabelas de módulo
        const resetFields = {
          status: 'WAITING_SCHEDULING',
          scheduleId: null,
          scheduledDate: null,
          scheduledTime: null,
          scheduledCategory: null,
          examinerId: null,
          attendanceConfirmed: false,
          queueUpdatedAt: null,
          updatedAt: new Date(),
        };
        await updateAllModuleTables(db, resetFields, id);
        // Legada por segurança
        try {
          await db.execute(sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS fila_atualizado_em timestamptz`);
        } catch {}
        await db.execute(sql`
          UPDATE solicitacoes
          SET
            status              = 'WAITING_SCHEDULING',
            banca_id            = NULL,
            data_agendada       = NULL,
            hora_agendada       = NULL,
            categoria_agendada  = NULL,
            examinador_id       = NULL,
            presenca_confirmada = FALSE,
            atualizado_em = COALESCE(fila_atualizado_em, atualizado_em),
            fila_atualizado_em  = NULL
          WHERE banca_id = ${id}
        `);

        return json(updated[0] ?? { id, status: 'CANCELLED' });
      }

      if (updates.date) updates.date = updates.date.split('T')[0];
      const allowed = ['code','date','time','examinerIds','maxSlotsA','maxSlotsB','type','status','cancellationReason','locationId'];
      const filtered: any = {};
      for (const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];

      const updated = await db.update(examSchedules).set(filtered).where(eq(examSchedules.id, id)).returning();
      const current = updated[0] ?? { id, ...updates };
      const newStatus = calculateStatus((current as any).date, (current as any).time, (current as any).status);
      if (newStatus !== (current as any).status) {
        await db.update(examSchedules).set({ status: newStatus }).where(eq(examSchedules.id, id));
        (current as any).status = newStatus;
      }
      // Propaga data/hora atualizada para candidatos nas 3 tabelas de módulo
      if (updates.date || updates.time) {
        const dateTimeUpdate: any = {};
        if (updates.date) dateTimeUpdate.scheduledDate = updates.date;
        if (updates.time) dateTimeUpdate.scheduledTime = updates.time;
        await updateAllModuleTables(db, dateTimeUpdate, id);
      }
      return json(current);
    }

    if (method === 'DELETE') {
      if ((data as any)?.sessionUserRole === 'SUPERVISOR') {
        return error('Supervisores não podem excluir bancas.', 403);
      }
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(examSchedules).where(eq(examSchedules.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
