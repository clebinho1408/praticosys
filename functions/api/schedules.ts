// functions/api/schedules.ts  →  GET|POST|PUT|DELETE /api/schedules
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examSchedules, examRequests } from '../../db/schema.js';
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

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
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
            await db.update(examRequests)
              .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
              .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, 'SCHEDULED')));
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

      if (action === 'CANCEL') {
        const updated = await db.update(examSchedules)
          .set({ status: 'CANCELLED', cancellationReason: reason })
          .where(eq(examSchedules.id, id)).returning();

        try { await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS queue_updated_at timestamptz`); } catch {}

        await db.execute(sql`
          UPDATE exam_requests
          SET
            status              = 'WAITING_SCHEDULING',
            schedule_id         = NULL,
            scheduled_date      = NULL,
            scheduled_time      = NULL,
            scheduled_category  = NULL,
            examiner_id         = NULL,
            attendance_confirmed = FALSE,
            updated_at = COALESCE(queue_updated_at, updated_at),
            queue_updated_at    = NULL
          WHERE schedule_id = ${id}
        `);

        return json(updated[0] ?? { id, status: 'CANCELLED' });
      }

      if (updates.date) updates.date = updates.date.split('T')[0];
      const allowed = ['code','date','time','examinerIds','maxSlotsA','maxSlotsB','type','status','cancellationReason'];
      const filtered: any = {};
      for (const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];

      const updated = await db.update(examSchedules).set(filtered).where(eq(examSchedules.id, id)).returning();
      const current = updated[0] ?? { id, ...updates };
      const newStatus = calculateStatus((current as any).date, (current as any).time, (current as any).status);
      if (newStatus !== (current as any).status) {
        await db.update(examSchedules).set({ status: newStatus }).where(eq(examSchedules.id, id));
        (current as any).status = newStatus;
      }
      if (updates.date || updates.time) {
        await db.update(examRequests).set({ scheduledDate: updates.date, scheduledTime: updates.time })
          .where(eq(examRequests.scheduleId, id));
      }
      return json(current);
    }

    if (method === 'DELETE') {
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
