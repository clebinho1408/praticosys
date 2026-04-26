// functions/api/requests.ts  →  GET|POST|PUT|DELETE /api/requests
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examRequests } from '../../db/schema.js';
import { eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const ALLOWED_FIELDS = [
  'id','studentName','socialName','cpf','phone','email','address','city',
  'requestType','examType','intendedCategory','source','schoolId',
  'paidFee','completedPracticalCourse','practicalHours','hasVehicle',
  'cnhRestriction','instructor','vehiclePlate','disabilityType',
  'specialNeeds','status','result','scheduleId','scheduledDate',
  'scheduledTime','scheduledCategory','examinerId','attendanceConfirmed',
  'cancellationReason','observation','examHistory',
];

function filterFields(obj: any, extra: string[] = []) {
  const fields = [...ALLOWED_FIELDS, ...extra];
  const out: any = {};
  for (const k of fields) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      try {
        await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`);
        await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'EXTRA'`);
      } catch {}
      if (query.cpf) {
        const clean = query.cpf.replace(/\D/g, '');
        return json(await db.select().from(examRequests).where(like(examRequests.cpf, `%${clean}%`)));
      }
      return json(await db.select().from(examRequests));
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const filtered = filterFields(body);
      const newItem = await db.insert(examRequests).values({
        id: filtered.id || randomUUID(),
        ...filtered,
        studentName: filtered.studentName || 'Vaga Disponível',
        cpf: filtered.cpf || '00000000000',
        phone: filtered.phone || '00000000000',
        createdAt: filtered.createdAt ? new Date(filtered.createdAt) : new Date(),
        updatedAt: new Date(),
      }).returning();
      return json(newItem[0] ?? { id: body.id, ...body });
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      if (!body?.id) return error('ID obrigatório', 400);
      const { id, updatedAt, ...updates } = body;
      if (!updates.studentName) updates.studentName = 'Vaga Disponível';
      if (!updates.cpf) updates.cpf = '00000000000';
      if (!updates.phone) updates.phone = '00000000000';
      const filtered = filterFields(updates, ['createdAt']);
      if (filtered.createdAt) filtered.createdAt = new Date(filtered.createdAt);
      const updated = await db.update(examRequests)
        .set({ ...filtered, updatedAt: new Date() })
        .where(eq(examRequests.id, id))
        .returning();
      return json(updated[0] ?? { id, ...updates });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(examRequests).where(eq(examRequests.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

