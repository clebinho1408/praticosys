// functions/api/requests.ts  →  GET|POST|PUT|DELETE /api/requests
import { getDb, json, error, parseBody, getQuery, writeAuditLog, extractActor } from '../_db.js';
import { cnhbrasilRequests, cfcRequests, pcdRequests, examiners, systemSettings, blockedDates } from '../../db/schema.js';
import { eq, like, and } from 'drizzle-orm';
import { canManageConfirmed, isConfirmedCfc, confirmedAccessError, confirmedPatch, validateConfirmedEdit, hasCandidateIdentity, clearAppointment } from '../_cfc-confirmed.js';
import { extraEditError, extraPatch } from '../_cfc-extra.js';

const ALLOWED_FIELDS = [
  'id','studentName','socialName','cpf','phone','email','address','city',
  'requestType','examType','intendedCategory','source','schoolId',
  'paidFee','completedPracticalCourse','practicalHours','hasVehicle',
  'cnhRestriction','instructor','vehiclePlate','disabilityType',
  'specialNeeds','status','result','scheduleId','scheduledDate',
  'scheduledTime','scheduledCategory','examinerId','attendanceConfirmed',
  'cancellationReason','observation','categoryQuantities','examHistory',
  'queueUpdatedAt','checklistVehicle','practicalCourseInserted','taxaPaga',
  'scheduledBy','modulo','semDuploComando','rowColor',
];

/** Campos removidos de cada tabela de módulo — não podem ser gravados nelas */
const MODULE_DROPPED_FIELDS: Record<string, string[]> = {
  CNH_BRASIL: ['disabilityType', 'specialNeeds', 'categoryQuantities'],
  CFC:        ['disabilityType', 'specialNeeds'],
  PCD:        ['semDuploComando', 'categoryQuantities'],
};

/** Remove campos que não existem mais na tabela do módulo alvo */
function stripDroppedFields(obj: any, modulo: string): any {
  const dropped = MODULE_DROPPED_FIELDS[modulo] ?? [];
  if (dropped.length === 0) return obj;
  const out = { ...obj };
  for (const f of dropped) delete out[f];
  return out;
}

function deriveModulo(data: any): string {
  if (data.examType === 'PCD' || data.schoolId === 'PCD') return 'PCD';
  if (!data.schoolId || data.schoolId === '' || data.schoolId === 'CNH_BRASIL') return 'CNH_BRASIL';
  return 'CFC';
}

function filterFields(obj: any) {
  const out: any = {};
  for (const k of ALLOWED_FIELDS) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function getRequestTable(modulo: string) {
  if (modulo === 'PCD') return pcdRequests;
  if (modulo === 'CFC') return cfcRequests;
  return cnhbrasilRequests;
}

/** Encontra um request pelo ID em qualquer das 3 tabelas — retorna camelCase via ORM */
async function findRequestById(db: any, id: string): Promise<{ row: any; modulo: string } | null> {
  const [cnhRows, cfcRows, pcdRows] = await Promise.all([
    db.select().from(cnhbrasilRequests).where(eq(cnhbrasilRequests.id, id)).limit(1),
    db.select().from(cfcRequests).where(eq(cfcRequests.id, id)).limit(1),
    db.select().from(pcdRequests).where(eq(pcdRequests.id, id)).limit(1),
  ]);
  if (cnhRows.length > 0) return { row: cnhRows[0], modulo: 'CNH_BRASIL' };
  if (cfcRows.length > 0) return { row: cfcRows[0], modulo: 'CFC' };
  if (pcdRows.length > 0) return { row: pcdRows[0], modulo: 'PCD' };
  return null;
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      if (query.cpf) {
        const clean = query.cpf.replace(/\D/g, '');
        const pattern = `%${clean}%`;
        const [cnhRows, cfcRows, pcdRows] = await Promise.all([
          db.select().from(cnhbrasilRequests).where(like(cnhbrasilRequests.cpf, pattern)),
          db.select().from(cfcRequests).where(like(cfcRequests.cpf, pattern)),
          db.select().from(pcdRequests).where(like(pcdRequests.cpf, pattern)),
        ]);
        return json([...cnhRows, ...cfcRows, ...pcdRows]);
      }
      const [cnhRows, cfcRows, pcdRows] = await Promise.all([
        db.select().from(cnhbrasilRequests),
        db.select().from(cfcRequests),
        db.select().from(pcdRequests),
      ]);
      return json([...cnhRows, ...cfcRows, ...pcdRows]);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const filtered = filterFields(body);
      if (!filtered.modulo) filtered.modulo = deriveModulo(filtered);
      const safeFiltered = stripDroppedFields(filtered, filtered.modulo);
      const table = getRequestTable(safeFiltered.modulo);
      const newItem = await db.insert(table).values({
        id: safeFiltered.id || crypto.randomUUID(),
        ...safeFiltered,
        studentName: filtered.studentName || null,
        phone: filtered.phone || null,
        createdAt: filtered.createdAt ? new Date(filtered.createdAt) : new Date(),
        updatedAt: new Date(),
      }).returning();
      const record = newItem[0] as any;
      if (record?.modulo === 'CNH_BRASIL') {
        await writeAuditLog(db, extractActor(request), 'Foi cadastrado', 'CNH_BRASIL_CANDIDATO', record.id, {
          cpf: record.cpf ?? null,
          name: record.studentName ?? null,
        });
      }
      return json(record ?? { id: body.id, ...body });
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      if (!body?.id) return error('ID obrigatório', 400);
      const { id, updatedAt, createdAt, ...rawUpdates } = body;
      const filtered = filterFields(rawUpdates);
      if (filtered.queueUpdatedAt && typeof filtered.queueUpdatedAt === 'string') {
        filtered.queueUpdatedAt = new Date(filtered.queueUpdatedAt);
      }

      // Encontra registro atual (camelCase via ORM)
      const found = await findRequestById(db, id);
      const role = (data as any)?.sessionUserRole;
      if (body.extraEdit) {
        const invalid = extraEditError(found?.row, found?.modulo ?? '', role, body);
        if (invalid) return error(invalid.error, invalid.status);
        const rows = await db.update(cfcRequests).set({ ...extraPatch(body), updatedAt: new Date() })
          .where(and(eq(cfcRequests.id, id), eq(cfcRequests.status, 'WAITING_SCHEDULING'))).returning();
        if (!rows.length) return error('O pedido mudou. Atualize a lista.', 409);
        return json(rows[0]);
      }
      const denied = confirmedAccessError(found?.row, found?.modulo ?? '', false, role, body);
      if (denied) return error(denied, body.confirmedEdit && !isConfirmedCfc(found?.row, found?.modulo ?? '') ? 409 : 403);
      if (body.confirmedEdit) {
        if (!canManageConfirmed(role)) return error('Acesso negado.', 403);
        const invalid = await validateConfirmedEdit(db, { examiners, systemSettings, blockedDates }, found!.row, body);
        if (invalid) return error(invalid, 400);
        const rows = await db.update(cfcRequests).set({ ...confirmedPatch(body), updatedAt: new Date() })
          .where(and(eq(cfcRequests.id, id), eq(cfcRequests.status, 'SCHEDULED'), eq(cfcRequests.attendanceConfirmed, true))).returning();
        if (!rows.length) return error('O agendamento mudou. Atualize a lista.', 409);
        return json(rows[0]);
      }
      const isResultConfirmation =
        rawUpdates.result !== undefined &&
        Array.isArray(rawUpdates.examHistory);
      const isCurrentlyScheduled = found?.row?.status === 'SCHEDULED';
      if (
        (data as any)?.sessionUserRole === 'SUPERVISOR' &&
        (
          rawUpdates.scheduleId === null ||
          (
            isCurrentlyScheduled &&
            rawUpdates.scheduleId !== undefined &&
            rawUpdates.scheduleId !== found?.row?.scheduleId
          ) ||
          (
            isCurrentlyScheduled &&
            rawUpdates.status === 'WAITING_SCHEDULING' &&
            !isResultConfirmation
          )
        )
      ) {
        return error('Supervisores não podem remover candidatos da banca.', 403);
      }
      const oldModulo = found?.modulo ?? deriveModulo(rawUpdates);
      // Deriva módulo destino a partir dos dados mesclados (old + incoming)
      // para capturar mudanças em examType/schoolId mesmo sem campo modulo explícito
      const mergedExamType = rawUpdates.examType ?? found?.row?.examType;
      const mergedSchoolId = rawUpdates.schoolId ?? found?.row?.schoolId;
      const newModulo = filtered.modulo || deriveModulo({ examType: mergedExamType, schoolId: mergedSchoolId });
      if (
        (data as any)?.sessionUserRole === 'SUPERVISOR' &&
        isCurrentlyScheduled &&
        newModulo !== found?.modulo
      ) {
        return error('Supervisores não podem mover candidatos agendados para outro módulo.', 403);
      }
      const oldTable = getRequestTable(oldModulo);
      const newTable = getRequestTable(newModulo);

      let record: any;
      if (oldModulo !== newModulo) {
        // Módulo mudou: mover linha atomicamente para a tabela destino
        // Merge camelCase (ORM) + incoming updates + modulo correto
        const merged = stripDroppedFields(
          { ...found?.row, ...filtered, modulo: newModulo, updatedAt: new Date() },
          newModulo
        );
        await db.transaction(async (tx: any) => {
          await tx.insert(newTable).values(merged).onConflictDoNothing();
          await tx.delete(oldTable).where(eq(oldTable.id, id));
        });
        record = merged;
      } else {
        const safeFiltered = stripDroppedFields({ ...filtered, updatedAt: new Date() }, newModulo);
        const updated = await db.update(oldTable)
          .set(safeFiltered)
          .where(eq(oldTable.id, id))
          .returning();
        record = updated[0];
      }

      if ((record?.modulo ?? newModulo) === 'CNH_BRASIL') {
        let action = 'Foi modificado';
        if (body.scheduleId && body.status === 'SCHEDULED') action = 'Foi adicionado na Banca';
        else if (body.scheduleId === null && body.status === 'WAITING_SCHEDULING') action = 'Foi excluído da Banca';
        await writeAuditLog(db, extractActor(request), action, 'CNH_BRASIL_CANDIDATO', id, {
          cpf: (record ?? found?.row)?.cpf ?? null,
          name: (record ?? found?.row)?.studentName ?? null,
        });
      }
      return json(record ?? { id, ...rawUpdates });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      const found = await findRequestById(db, id);
      const role = (data as any)?.sessionUserRole;
      if (isConfirmedCfc(found?.row, found?.modulo ?? '') && !canManageConfirmed(role)) {
        return error('Somente administradores e supervisores podem excluir provas confirmadas.', 403);
      }
      if (query.confirmedDelete === 'true') {
        if (!canManageConfirmed(role)) return error('Acesso negado.', 403);
        if (!isConfirmedCfc(found?.row, found?.modulo ?? '')) return error('O agendamento não está mais confirmado.', 409);
        const condition = and(eq(cfcRequests.id, id), eq(cfcRequests.status, 'SCHEDULED'), eq(cfcRequests.attendanceConfirmed, true));
        const affected = hasCandidateIdentity(found!.row)
          ? await db.update(cfcRequests).set({ ...clearAppointment, updatedAt: new Date() }).where(condition).returning()
          : await db.delete(cfcRequests).where(condition).returning();
        if (!affected.length) return error('O agendamento mudou. Atualize a lista.', 409);
        return json({ success: true });
      }
      if ((data as any)?.sessionUserRole === 'SUPERVISOR') {
        return error('Supervisores não podem excluir candidatos.', 403);
      }
      // Busca antes de excluir para poder registrar no log
      // Apaga das 3 tabelas (apenas uma terá o registro)
      await db.delete(cnhbrasilRequests).where(eq(cnhbrasilRequests.id, id));
      await db.delete(cfcRequests).where(eq(cfcRequests.id, id));
      await db.delete(pcdRequests).where(eq(pcdRequests.id, id));
      if (found?.modulo === 'CNH_BRASIL') {
        await writeAuditLog(db, extractActor(request), 'Foi excluído', 'CNH_BRASIL_CANDIDATO', id, {
          cpf: found.row?.cpf ?? null,
          name: found.row?.studentName ?? null,
        });
      }
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    console.error('[requests] erro:', e);
    return error(e.message ?? 'Erro interno', 500);
  }
};
