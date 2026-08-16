// functions/api/schedule-slots.ts  →  GET|POST|PUT|DELETE /api/schedule-slots
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { cfcScheduleSlots, pcdScheduleSlots } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

function getSlotTable(examType: string) {
  return examType === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
}

/** Encontra um slot pelo ID — retorna camelCase via ORM */
async function findSlotById(db: any, id: string): Promise<{ row: any; module: 'CFC' | 'PCD' } | null> {
  const [cfcRows, pcdRows] = await Promise.all([
    db.select().from(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, id)).limit(1),
    db.select().from(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, id)).limit(1),
  ]);
  if (cfcRows.length > 0) return { row: cfcRows[0], module: 'CFC' };
  if (pcdRows.length > 0) return { row: pcdRows[0], module: 'PCD' };
  return null;
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      // Busca nas tabelas CFC e PCD via ORM (retorna camelCase) — CNH Brasil não usa slots
      let cfcQ = db.select().from(cfcScheduleSlots) as any;
      let pcdQ = db.select().from(pcdScheduleSlots) as any;
      if (query.schoolId) {
        cfcQ = cfcQ.where(eq(cfcScheduleSlots.schoolId, query.schoolId));
        pcdQ = pcdQ.where(eq(pcdScheduleSlots.schoolId, query.schoolId));
      }
      if (query.scheduledDate) {
        cfcQ = cfcQ.where(eq(cfcScheduleSlots.scheduledDate, query.scheduledDate));
        pcdQ = pcdQ.where(eq(pcdScheduleSlots.scheduledDate, query.scheduledDate));
      }
      const [cfcRows, pcdRows] = await Promise.all([cfcQ, pcdQ]);
      return json([...(cfcRows as any[]), ...(pcdRows as any[])]);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const table = getSlotTable(body.examType || '');
      const newItem = await db.insert(table).values({
        id: body.id || crypto.randomUUID(),
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

      // Encontra o slot atual (camelCase via ORM)
      const found = await findSlotById(db, id);
      const oldModule = found?.module;
      const newExamType = filtered.examType ?? found?.row?.examType ?? '';
      const newModule: 'CFC' | 'PCD' = newExamType === 'PCD' ? 'PCD' : 'CFC';
      const oldTable = oldModule === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
      const newTable = newModule === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;

      let result: any;
      if (oldModule && oldModule !== newModule) {
        // examType mudou de categoria: mover slot atomicamente para a tabela correta
        // Merge camelCase (ORM) + incoming updates
        const merged = { ...found!.row, ...filtered, updatedAt: new Date() };
        await db.transaction(async (tx: any) => {
          await tx.insert(newTable).values(merged).onConflictDoNothing();
          await tx.delete(oldTable).where(eq(oldTable.id, id));
        });
        result = merged;
      } else {
        const updated = await db.update(oldTable)
          .set({ ...filtered, updatedAt: new Date() })
          .where(eq(oldTable.id, id))
          .returning();
        result = updated[0] ?? { id, ...updates };
      }
      return json(result);
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      // Apaga das 2 tabelas (apenas uma terá o registro)
      await db.delete(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, id));
      await db.delete(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
