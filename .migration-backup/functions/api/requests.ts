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
  // Campo para preservar posição na fila ao entrar/sair de banca
  'queueUpdatedAt',
  // Checklists de pré-agendamento (CNH do Brasil — Instrutor)
  'checklistVehicle','practicalCourseInserted','taxaPaga',
  // Usuário que colocou o candidato na banca
  'scheduledBy',
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

    // Migrations inline — rodam em TODOS os métodos para garantir que as colunas
    // existam antes de qualquer leitura ou escrita, inclusive PUT com queueUpdatedAt.
    try {
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'EXTRA'`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS queue_updated_at timestamptz`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS checklist_vehicle boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS practical_course_inserted boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS taxa_paga boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_by text`);
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
      // IMPORTANT: Do NOT use default fallbacks for studentName/cpf/phone.
      // Auto-generated slots (from schedule auto-generation) intentionally have no student data.
      // The frontend (RequestManager) filters out records with no studentName from the Candidates view.
      const newItem = await db.insert(examRequests).values({
        id: filtered.id || randomUUID(),
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
      // IMPORTANT: Do NOT overwrite studentName/cpf/phone with placeholders on update.
      // Only set them if they are explicitly provided by the caller.
      // IMPORTANT: Do NOT overwrite createdAt — it must reflect the real registration date.
      const filtered = filterFields(updates);

      // Converter queueUpdatedAt de string ISO → Date (ou null explícito via sql).
      // O Drizzle mapeia este campo como timestamp e o PostgreSQL rejeita
      // strings brutas no SET — causa o erro 500 ao confirmar agendamento.
      // Quando null, usar sql`NULL` para garantir que o Drizzle inclua o campo no SET.
      let queueUpdatedAtValue: Date | null | ReturnType<typeof sql> | undefined = undefined;
      if (filtered.queueUpdatedAt !== undefined) {
        if (filtered.queueUpdatedAt === null) {
          queueUpdatedAtValue = sql`NULL`; // força SET queue_updated_at = NULL no SQL
        } else {
          const parsed = new Date(filtered.queueUpdatedAt);
          queueUpdatedAtValue = isNaN(parsed.getTime()) ? sql`NULL` : parsed;
        }
        delete filtered.queueUpdatedAt; // será passado separadamente
      }

      const setPayload: any = { ...filtered, updatedAt: new Date() };
      if (queueUpdatedAtValue !== undefined) {
        setPayload.queueUpdatedAt = queueUpdatedAtValue;
      }

      const updated = await db.update(examRequests)
        .set(setPayload)
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

