// functions/api/requests.ts  →  GET|POST|PUT|DELETE /api/requests
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examRequests } from '../../db/schema.js';
import { eq, like, sql } from 'drizzle-orm';

const ALLOWED_FIELDS = [
  'id','studentName','socialName','cpf','phone','email','address','city',
  'requestType','examType','intendedCategory','source','schoolId',
  'paidFee','completedPracticalCourse','practicalHours','hasVehicle',
  'cnhRestriction','instructor','vehiclePlate','disabilityType',
  'specialNeeds','status','result','scheduleId','scheduledDate',
  'scheduledTime','scheduledCategory','examinerId','attendanceConfirmed',
  'cancellationReason','observation','categoryQuantities','examHistory',
  'queueUpdatedAt',
  'checklistVehicle','practicalCourseInserted','taxaPaga',
  'scheduledBy','modulo','semDuploComando',
];

function deriveModulo(data: any): string {
  if (data.examType === 'PCD' || data.schoolId === 'PCD') return 'PCD';
  if (!data.schoolId || data.schoolId === '' || data.schoolId === 'CNH_BRASIL') return 'CNH_BRASIL';
  return 'CFC';
}

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

    try {
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'EXTRA'`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS queue_updated_at timestamptz`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS checklist_vehicle boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS practical_course_inserted boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS taxa_paga boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_by text`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS category_quantities jsonb`);
      await db.execute(sql`
        UPDATE exam_requests
        SET
          category_quantities = (
            SELECT COALESCE(jsonb_object_agg(m[1], (m[2])::int), '{}'::jsonb)
            FROM regexp_matches(
              substring(observation from '^\\[Qtd:([A-Z0-9=,]+)\\]'),
              '([A-Z]+)=([0-9]+)',
              'g'
            ) AS m
          ),
          observation = regexp_replace(observation, '^\\[Qtd:[A-Z0-9=,]+\\] *', '')
        WHERE category_quantities IS NULL
          AND observation LIKE '[Qtd:%'
      `);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS modulo text`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`);
      await db.execute(sql`
        UPDATE exam_requests
        SET modulo = CASE
          WHEN exam_type = 'PCD' THEN 'PCD'
          WHEN school_id IS NULL OR school_id = '' OR school_id = 'CNH_BRASIL' THEN 'CNH_BRASIL'
          WHEN school_id = 'PCD' THEN 'PCD'
          ELSE 'CFC'
        END
        WHERE modulo IS NULL OR modulo = ''
      `);
    } catch {}

    if (method === 'GET') {
      if (query.cpf) {
        const clean = query.cpf.replace(/\D/g, '');
        return json(await db.select().from(examRequests).where(like(examRequests.cpf, `%${clean}%`)));
      }
      return json(await db.select().from(examRequests));
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const filtered = filterFields(body);
      if (!filtered.modulo) filtered.modulo = deriveModulo(filtered);
      const newItem = await db.insert(examRequests).values({
        id: filtered.id || crypto.randomUUID(),
        ...filtered,
        studentName: filtered.studentName || null,
        cpf: filtered.cpf || null,
        phone: filtered.phone || null,
        createdAt: filtered.createdAt ? new Date(filtered.createdAt) : new Date(),
        updatedAt: new Date(),
      }).returning();
      return json(newItem[0] ?? { id: body.id, ...body });
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      if (!body?.id) return error('ID obrigatório', 400);
      const { id, updatedAt, createdAt, ...updates } = body;
      const filtered = filterFields(updates);
      // Converte campos timestamp de string para Date (drizzle neon-http requer Date)
      if (filtered.queueUpdatedAt && typeof filtered.queueUpdatedAt === 'string') {
        filtered.queueUpdatedAt = new Date(filtered.queueUpdatedAt);
      }
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
    console.error('[requests] erro:', e);
    return error(e.message ?? 'Erro interno', 500);
  }
};
