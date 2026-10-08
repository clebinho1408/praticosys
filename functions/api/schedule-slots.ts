// functions/api/schedule-slots.ts  →  GET|POST|PUT|DELETE /api/schedule-slots
import { getDb, json, error, parseBody, getQuery, ensureSlotQuantities } from '../_db.js';
import { cfcScheduleSlots, pcdScheduleSlots, examiners, drivingSchools, cities, systemSettings, blockedDates } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { canManageConfirmed, isConfirmedCfc, confirmedAccessError, confirmedPatch, validateConfirmedEdit } from '../_cfc-confirmed.js';
import { extraEditError, extraPatch } from '../_cfc-extra.js';

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

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  try {
    const db = getDb(env as any);
    await ensureSlotQuantities(db);
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
      if (body?.automaticFixed) {
        if (!['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes((data as any)?.sessionUserRole)) {
          return error('Acesso negado para gerar escalas.', 403);
        }
        const { schoolId, date, slots } = body.automaticFixed;
        if (typeof schoolId !== 'string' || !schoolId || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Array.isArray(slots) || slots.length < 1 || slots.length > 20 ||
          slots.some((s: any) => !s || typeof s.examinerId !== 'string' || !s.examinerId ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.scheduledTime)) ||
          new Set(slots.map((s: any) => s.scheduledTime)).size !== slots.length) {
          return error('Dados inválidos para a escala fixa.', 400);
        }
        const school = (await db.select().from(drivingSchools)
          .where(eq(drivingSchools.id, schoolId)).limit(1))[0];
        if (!school) return error('Autoescola não encontrada.', 404);
        const day = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][new Date(`${date}T00:00:00`).getDay()];
        const schedule = school.provisionalSchedule?.active ? school.provisionalSchedule :
          school.mainSchedule?.active ? school.mainSchedule : null;
        const configured = schedule?.days?.includes(day)
          ? (schedule.slots ?? []).filter((s: any) => !s.day || s.day === day) : [];
        if (!configured.length || configured.length !== slots.length) {
          return error('A escala da autoescola mudou. Consulte a data novamente.', 409);
        }
        if (!school.examRotation) {
          const ordered = (items: string[]) => items.sort().join('|');
          if (ordered(configured.map((s: any) => `${s.examiner}:${s.time}`)) !==
            ordered(slots.map((s: any) => `${s.examinerId}:${s.scheduledTime}`))) {
            return error('Rodízio de Provas desativado para a autoescola; use os horários e examinadores da escala fixa.', 409);
          }
        }
        const city = school.examRotation
          ? (await db.select().from(cities)).find(c => c.name.trim() === school.city?.trim())
          : null;
        if (school.examRotation && !city) {
          return error('Cidade da autoescola não cadastrada para o rodízio.', 409);
        }
        const existing = await db.select().from(cfcScheduleSlots).where(and(
          eq(cfcScheduleSlots.schoolId, schoolId), eq(cfcScheduleSlots.scheduledDate, date),
          eq(cfcScheduleSlots.requestType, 'FIXA')));
        if (existing.some(s => s.status !== 'CANCELLED')) {
          return error('Esta autoescola já possui uma escala fixa nesta data.', 409);
        }
        for (const examinerId of new Set<string>(slots.map((s: any) => s.examinerId))) {
          const [booked, examinerRows] = await Promise.all([
            db.select().from(cfcScheduleSlots).where(and(
              eq(cfcScheduleSlots.examinerId, examinerId), eq(cfcScheduleSlots.scheduledDate, date))),
            db.select().from(examiners).where(eq(examiners.id, examinerId)).limit(1),
          ]);
          const active = booked.filter(s => s.status !== 'CANCELLED');
          const assigned = slots.filter((s: any) => s.examinerId === examinerId);
          if (school.examRotation) {
            const examiner = examinerRows[0];
            const availability = examiner?.rotationAvailability;
            const times = availability?.examsPerDay === 2
              ? [availability.defaultTime, availability.secondDefaultTime] : [availability?.defaultTime];
            if (!examiner?.examRotation || examiner.canExamCommon === false ||
              !availability?.days?.includes(day) || !availability.cityIds?.includes(city!.id) ||
              ![1, 2].includes(availability.examsPerDay) ||
              assigned.some((s: any) => !times.includes(s.scheduledTime))) {
              return error('Rodízio de Provas desativado ou disponibilidade incompatível para o examinador.', 409);
            }
          }
          const capacity = examinerRows[0]?.examRotation
            ? examinerRows[0].rotationAvailability?.examsPerDay : null;
          if (assigned.some((s: any) => active.some(b => b.scheduledTime === s.scheduledTime)) ||
            (capacity && active.length + assigned.length > capacity)) {
            return error('O examinador já possui prova nesse horário ou atingiu a capacidade diária.', 409);
          }
        }
        const created = await db.insert(cfcScheduleSlots).values(slots.map((s: any, index: number) => ({
          id: `auto-fixed:${schoolId}:${date}:${existing.length}:${index}`,
          schoolId, scheduledDate: date, scheduledTime: s.scheduledTime, examinerId: s.examinerId,
          examType: 'COMMON', requestType: 'FIXA', intendedCategory: 'A,B',
          status: 'SCHEDULED', attendanceConfirmed: true, observation: '',
          createdAt: new Date(), updatedAt: new Date(),
        }))).returning();
        return json(created);
      }
      if ((body?.requestType || 'FIXA') === 'FIXA' &&
        !['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes((data as any)?.sessionUserRole)) {
        return error('Acesso negado para criar escala fixa.', 403);
      }
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
      const role = (data as any)?.sessionUserRole;
      if (body.extraEdit) {
        const invalid = extraEditError(found?.row, found?.module ?? '', role, body);
        if (invalid) return error(invalid.error, invalid.status);
        const rows = await db.update(cfcScheduleSlots).set({ ...extraPatch(body), updatedAt: new Date() })
          .where(and(eq(cfcScheduleSlots.id, id), eq(cfcScheduleSlots.status, 'WAITING_SCHEDULING'))).returning();
        if (!rows.length) return error('O pedido mudou. Atualize a lista.', 409);
        return json(rows[0]);
      }
      const denied = confirmedAccessError(found?.row, found?.module ?? '', true, role, body);
      if (denied) return error(denied, body.confirmedEdit && !isConfirmedCfc(found?.row, '', true) ? 409 : 403);
      if (body.confirmedEdit) {
        if (!canManageConfirmed(role)) return error('Acesso negado.', 403);
        const invalid = await validateConfirmedEdit(db, { examiners, systemSettings, blockedDates }, found!.row, body);
        if (invalid) return error(invalid, 400);
        const table = found!.module === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
        const rows = await db.update(table).set({ ...confirmedPatch(body), updatedAt: new Date() })
          .where(and(eq(table.id, id), eq(table.status, 'SCHEDULED'), eq(table.attendanceConfirmed, true))).returning();
        if (!rows.length) return error('O agendamento mudou. Atualize a lista.', 409);
        return json(rows[0]);
      }
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
      const found = await findSlotById(db, id);
      if (isConfirmedCfc(found?.row, found?.module ?? '', true) && !canManageConfirmed((data as any)?.sessionUserRole)) {
        return error('Somente administradores e supervisores podem excluir provas confirmadas.', 403);
      }
      if (query.confirmedDelete === 'true') {
        if (!canManageConfirmed((data as any)?.sessionUserRole)) return error('Acesso negado.', 403);
        if (!isConfirmedCfc(found?.row, found?.module ?? '', true)) return error('O agendamento não está mais confirmado.', 409);
        const table = found!.module === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
        const removed = await db.delete(table).where(and(eq(table.id, id), eq(table.status, 'SCHEDULED'),
          eq(table.attendanceConfirmed, true))).returning();
        if (!removed.length) return error('O agendamento mudou. Atualize a lista.', 409);
        return json({ success: true });
      }
      // Apaga das 2 tabelas (apenas uma terá o registro)
      await db.delete(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, id));
      await db.delete(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    if (e.code === '23505' || e.cause?.code === '23505') {
      return error('A escala fixa já foi gerada por outra pessoa. Atualize os agendamentos.', 409);
    }
    return error(e.message ?? 'Erro interno', 500);
  }
};
