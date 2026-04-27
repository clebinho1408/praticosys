// functions/api/schedule-slots.ts  →  GET|POST|PUT|DELETE /api/schedule-slots
// Tabela separada de exam_requests: armazena SOMENTE vagas de escala CFC/PCD
// sem dados de candidato real (sem studentName/cpf/phone).
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examScheduleSlots } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    // Garante que a tabela existe com todos os campos
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS exam_schedule_slots (
          id text PRIMARY KEY,
          school_id text NOT NULL,
          exam_type text NOT NULL,
          request_type text NOT NULL DEFAULT 'FIXA',
          intended_category text,
          scheduled_date text,
          scheduled_time text,
          examiner_id text,
          schedule_id text,
          scheduled_category text,
          status text NOT NULL DEFAULT 'SCHEDULED',
          attendance_confirmed boolean DEFAULT false,
          cancellation_reason text,
          observation text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      // Adiciona coluna se já existia sem ela
      await db.execute(sql`ALTER TABLE exam_schedule_slots ADD COLUMN IF NOT EXISTS attendance_confirmed boolean DEFAULT false`);
    } catch { /* já existe */ }

    if (method === 'GET') {
      let q = db.select().from(examScheduleSlots) as any;
      if (query.schoolId) q = q.where(eq(examScheduleSlots.schoolId, query.schoolId));
      if (query.scheduledDate) q = q.where(eq(examScheduleSlots.scheduledDate, query.scheduledDate));
      return json(await q);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const newItem = await db.insert(examScheduleSlots).values({
        id: body.id || randomUUID(),
        schoolId: body.schoolId,
        examType: body.examType,
        requestType: body.requestType || 'FIXA',
        intendedCategory: body.intendedCategory,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        examinerId: body.examinerId,
        scheduleId: body.scheduleId,
        scheduledCategory: body.scheduledCategory,
        status: body.status || 'SCHEDULED',
        attendanceConfirmed: body.attendanceConfirmed ?? false,
        cancellationReason: body.cancellationReason,
        observation: body.observation,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      if (!body?.id) return error('ID obrigatório', 400);
      const { id, createdAt, ...updates } = body;
      const allowed = ['schoolId','examType','requestType','intendedCategory',
        'scheduledDate','scheduledTime','examinerId','scheduleId','scheduledCategory',
        'status','attendanceConfirmed','cancellationReason','observation'];
      const filtered: any = {};
      for (const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];
      const updated = await db.update(examScheduleSlots)
        .set({ ...filtered, updatedAt: new Date() })
        .where(eq(examScheduleSlots.id, id))
        .returning();
      return json(updated[0] ?? { id, ...updates });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(examScheduleSlots).where(eq(examScheduleSlots.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
