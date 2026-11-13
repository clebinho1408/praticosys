/**
 * Shared server boundary for Pages and Express. Identity is a fresh database
 * user. The same policy scopes list responses and checks stored AND proposed
 * ownership before a mutation reaches a handler.
 */
import { eq } from 'drizzle-orm';
import { examinerCoversRequest } from './_cfc-interest.js';

export class AccessDenied extends Error {
  constructor(public status = 403, message = 'Acesso negado para esta operação.') { super(message); }
}
const staffRoles = ['ADMIN', 'SUPERVISOR', 'OPERATOR'];
const modules: Record<string, string> = { CNH_BRASIL: 'cnh', CFC: 'cfc', PCD: 'pcd' };
const registryTabs: Record<string, string> = {
  schools: 'autoescolas', examiners: 'examinadores', instructors: 'instrutores',
};
const settingsFields = [
  'id', 'agencyName', 'agencyAddress', 'logoUrl', 'maintenanceMode', 'minDaysForScheduling',
  'maxDailySlots', 'defaultMaxSlotsA', 'defaultMaxSlotsB', 'defaultMaxSlotsMudanca',
  'whatsappMessageTemplate', 'cfcWhatsappMessageTemplate', 'defaultExamAddress',
  'defaultExamAddressLink', 'restrictions', 'pcdExamName', 'pcdDefaultExamAddress',
  'pcdDefaultExamAddressLink', 'pcdMainSchedule', 'cnhBrasilMainSchedule',
  'blockWeekends', 'anoFabricacaoMaximo', 'cnhCpfAutofillEnabled',
];
const userFields = ['name', 'login', 'password', 'role', 'schoolId', 'examinerId', 'instructorId',
  'allowedModules', 'allowedLocationIds', 'allowedCadastroTabs', 'email', 'phone',
  'twoFactorEnabled', 'forcePasswordChange'];
const vehicleFields = ['id', 'type', 'brand', 'model', 'plate', 'active', 'transmission',
  'accessories', 'duploComando', 'procuracao', 'anoFabricacao'];
export const pickFields = (data: any, keys: string[]) =>
  Object.fromEntries(keys.filter(k => Object.hasOwn(data, k)).map(k => [k, data[k]]));

export function moduleAllowed(user: any, module: string) {
  if (!['SUPERVISOR', 'OPERATOR'].includes(user.role)) return true;
  const allowed = user.allowedModules;
  return !allowed?.length || allowed.includes(modules[module]);
}
function registroAllowed(user: any, route: string) {
  if (user.role === 'ADMIN') return true;
  // Operator has no reachable Cadastros route in the approved router.
  return user.role === 'SUPERVISOR' && user.allowedModules?.includes('cadastro') &&
    (user.allowedCadastroTabs ?? Object.values(registryTabs)).includes(registryTabs[route]);
}
export function recordModule(row: any, route = 'requests') {
  if (row.modulo) return row.modulo;
  if (row.examType === 'PCD' || row.type === 'PCD' || row.schoolId === 'PCD') return 'PCD';
  if (route === 'schedule-slots') return 'CFC';
  if (!row.schoolId || row.schoolId === 'CNH_BRASIL') return 'CNH_BRASIL';
  return 'CFC';
}
export async function accessPolicy(db: any, schema: any, user: any) {
  const staff = staffRoles.includes(user.role);
  const globalReader = staff || user.role === 'CONSULTANT';
  let graphPromise: Promise<any> | undefined;
  const graph = () => graphPromise ??= (async () => {
    const [schedules, instructors, schools, examiners, cnh, cfc, pcd, cfcSlots, pcdSlots] =
      await Promise.all(['examSchedules', 'instructors', 'drivingSchools', 'examiners',
        'cnhbrasilRequests', 'cfcRequests', 'pcdRequests', 'cfcScheduleSlots', 'pcdScheduleSlots']
        .map(name => db.select().from(schema[name])));
    return { schedules, instructors, schools, examiners, requests: [...cnh, ...cfc, ...pcd],
      slots: [...cfcSlots, ...pcdSlots] };
  })();
  const hasValidLink = async () => {
    if (globalReader) return true;
    const g = await graph();
    if (user.role === 'SCHOOL') return !!user.schoolId && g.schools.some((r: any) => r.id === user.schoolId);
    if (user.role === 'EXAMINER') return !!user.examinerId && g.examiners.some((r: any) => r.id === user.examinerId);
    if (user.role === 'INSTRUCTOR') return !!user.instructorId && g.instructors.some((r: any) => r.id === user.instructorId);
    return false;
  };
  const locationAllowed = (schedule: any) =>
    !['SUPERVISOR', 'OPERATOR'].includes(user.role) || !user.allowedLocationIds?.length ||
    user.allowedLocationIds.includes(schedule?.locationId);
  const instructorLinked = (row: any, g: any) => {
    const instructor = g.instructors.find((i: any) => i.id === user.instructorId);
    if (!instructor) return false;
    // Legacy A/B records store exact display names, with a labelled part per category.
    const names = String(row.instructor ?? '').split(' / ').map(s => s.replace(/^(Moto|Carro):\s*/, '').trim());
    return names.includes(instructor.id) || (names.includes(instructor.name) &&
      g.instructors.filter((i: any) => i.name === instructor.name).length === 1);
  };
  const visible = async (row: any, route: string): Promise<boolean> => {
    if (route === 'banca-results') {
      const g = await graph();
      const parent = [...g.requests, ...g.slots].find((r: any) => r.id === row.scheduleId && r.schoolId === row.schoolId);
      if (parent) return visible(parent, g.slots.includes(parent) ? 'schedule-slots' : 'requests');
    }
    const module = recordModule(row, route);
    if (!moduleAllowed(user, module)) return false;
    const g = await graph();
    const schedule = g.schedules.find((s: any) => s.id === row.scheduleId);
    if (module === 'CNH_BRASIL' && row.scheduleId && !locationAllowed(schedule)) return false;
    if (globalReader) return true;
    if (!await hasValidLink()) return false;
    if (user.role === 'SCHOOL') return row.schoolId === user.schoolId;
    if (user.role === 'INSTRUCTOR') return module === 'CNH_BRASIL' && instructorLinked(row, g);
    if (user.role === 'EXAMINER') {
      if (row.examinerId === user.examinerId || schedule?.examinerIds?.includes(user.examinerId)) return true;
      const examiner = g.examiners.find((e: any) => e.id === user.examinerId);
      return module === 'CFC' && row.status === 'WAITING_SCHEDULING' && !row.attendanceConfirmed &&
        examinerCoversRequest(examiner?.categories, row.intendedCategory);
    }
    return false;
  };
  const scheduleVisible = async (row: any) => {
    if (!moduleAllowed(user, recordModule(row)) || !locationAllowed(row)) return false;
    if (globalReader) return true;
    if (!await hasValidLink()) return false;
    if (user.role === 'EXAMINER') return row.examinerIds?.includes(user.examinerId) ?? false;
    const g = await graph();
    for (const r of [...g.requests, ...g.slots]) if (r.scheduleId === row.id && await visible(r, 'requests')) return true;
    // Instructors need the open CNH boards to view available exam dates.
    return user.role === 'INSTRUCTOR' && row.type === 'COMMON' && row.status === 'OPEN';
  };
  const rowVisible = async (row: any, route: string) => {
    if (['requests', 'schedule-slots', 'banca-results'].includes(route)) return visible(row, route);
    if (route === 'schedules') return scheduleVisible(row);
    if (route === 'cnh-logs') {
      if (user.role === 'ADMIN') return true;
      const g = await graph();
      const id = row.entity_id ?? row.entityId;
      const r = g.requests.find((r: any) => r.id === id);
      const s = g.schedules.find((s: any) => s.id === id);
      return r ? visible(r, 'requests') : s ? scheduleVisible(s) : false;
    }
    if (!registryTabs[route] || globalReader) return true;
    if (!await hasValidLink()) return false;
    const g = await graph();
    if (route === 'schools') {
      if (user.role === 'SCHOOL') return row.id === user.schoolId;
      for (const r of [...g.requests, ...g.slots]) if (r.schoolId === row.id && await visible(r, 'requests')) return true;
      return false;
    }
    if (route === 'instructors') {
      if (user.role === 'INSTRUCTOR') return row.id === user.instructorId;
      for (const r of g.requests) {
        if (await visible(r, 'requests') && String(r.instructor ?? '').split(' / ')
          .map(s => s.replace(/^(Moto|Carro):\s*/, '').trim()).some(s => s === row.id || s === row.name)) return true;
      }
      return false;
    }
    // Names/categories of examiners are needed to render and request examinations.
    return true;
  };
  const project = async (payload: any, route: string): Promise<any> => {
    if (route === 'settings' && user.role !== 'ADMIN') return pickFields(payload, settingsFields);
    // Mutations must not disclose fields hidden by the corresponding GET.
    if (!Array.isArray(payload)) {
      if (payload?.id && ['requests', 'schedule-slots', 'schedules', 'instructors', 'schools', 'examiners', 'banca-results'].includes(route)) {
        const allowed = await project([payload], route);
        return allowed[0] ?? null;
      }
      return payload;
    }
    const result = [];
    for (const row of payload) {
      if (!await rowVisible(row, route)) continue;
      if (!globalReader && route === 'examiners') {
        result.push(pickFields(row, ['id', 'name', 'categories', 'canExamCommon', 'canExamPCD']));
      } else if (!globalReader && route === 'schools') {
        result.push(user.role === 'SCHOOL' && row.id === user.schoolId ? row : pickFields(row, ['id', 'name', 'city']));
      } else if (user.role === 'EXAMINER' && ['requests', 'schedule-slots'].includes(route) &&
        row.status === 'WAITING_SCHEDULING') {
        result.push({
          ...pickFields(row, ['id', 'modulo', 'examType', 'schoolId', 'requestType', 'intendedCategory',
            'categoryQuantities', 'status', 'attendanceConfirmed', 'createdAt']),
          interestedExaminers: (row.interestedExaminers ?? []).filter((i: any) => i.examinerId === user.examinerId),
        });
      } else result.push(row);
    }
    return result;
  };
  const authorize = async (route: string, method: string, body: any, query: Record<string, any>) => {
    if (!user || !staffRoles.concat(['CONSULTANT', 'SCHOOL', 'EXAMINER', 'INSTRUCTOR']).includes(user.role)) throw new AccessDenied();
    if (route === 'users/change-own-password' && method === 'POST') return;
    if (user.forcePasswordChange) throw new AccessDenied(403, 'Troque sua senha inicial antes de continuar.');
    const read = method === 'GET' || method === 'HEAD';
    if (['users', 'backups', 'risk-area'].includes(route) && user.role !== 'ADMIN') throw new AccessDenied();
    if (route === 'cnh-logs' && user.role !== 'ADMIN') throw new AccessDenied();
    if (!globalReader && !await hasValidLink()) throw new AccessDenied();
    if (read) return;
    if (user.role === 'CONSULTANT') throw new AccessDenied();
    if (route === 'settings') {
      if (user.role !== 'ADMIN') throw new AccessDenied();
      return;
    }
    if (['cities', 'blocked-dates', 'exam-locations', 'backups', 'risk-area', 'users'].includes(route)) {
      if (user.role !== 'ADMIN') throw new AccessDenied();
      if (route === 'risk-area' && body.confirmation !== 'APAGAR DADOS OPERACIONAIS') throw new AccessDenied(409, 'Confirme a exclusão dos dados operacionais.');
      if (route === 'backups' && (body.payload !== undefined || body.backupId) && body.confirmation !== 'RESTAURAR BACKUP') throw new AccessDenied(409, 'Confirme a restauração do backup.');
      return;
    }
    if (registryTabs[route]) {
      if (!registroAllowed(user, route)) throw new AccessDenied();
      // Prevent a nested vehicle ID from escaping the parent instructor.
      if (route === 'instructors' && Array.isArray(body.vehicles)) {
        for (const v of body.vehicles) {
          if (v.id && !v.id.startsWith('temp_')) {
            const [stored] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, v.id));
            if (stored && stored.instructorId !== body.id) throw new AccessDenied();
          }
        }
      }
      return;
    }
    if (route === 'schedules') {
      if (!['ADMIN', 'SUPERVISOR'].includes(user.role)) throw new AccessDenied();
      const current = body.id || query.id ? (await graph()).schedules.find((s: any) => s.id === (body.id || query.id)) : null;
      if (current && !await scheduleVisible(current)) throw new AccessDenied();
      const next = { ...current, ...body };
      if (!moduleAllowed(user, recordModule(next)) || !locationAllowed(next)) throw new AccessDenied();
      return;
    }
    if (['requests', 'schedule-slots', 'banca-results'].includes(route)) {
      const g = await graph();
      const rows = route === 'requests' ? g.requests : route === 'schedule-slots' ? g.slots :
        await db.select().from(schema.bancaResults);
      const id = body.id ?? query.id;
      const current = id ? rows.find((r: any) => r.id === id) : null;
      if (method !== 'POST' && !current) throw new AccessDenied(404, 'Registro não encontrado.');
      if (current && !await visible(current, route)) throw new AccessDenied();
      if (body.automaticFixed) {
        if (!staff || !moduleAllowed(user, 'CFC')) throw new AccessDenied();
        return;
      }
      const next = { ...current, ...body };
      // Derive the destination independently of any attacker-supplied modulo.
      if (body.examType !== undefined || body.schoolId !== undefined) {
        next.modulo = recordModule({ ...next, modulo: undefined }, route);
      }
      if (body.modulo !== undefined && !['CFC', 'PCD', 'CNH_BRASIL'].includes(body.modulo)) throw new AccessDenied(400, 'Módulo inválido.');
      if (next.schoolId && !['PCD', 'CNH_BRASIL'].includes(next.schoolId) && !g.schools.some((s: any) => s.id === next.schoolId)) throw new AccessDenied(400, 'Autoescola inválida.');
      if (next.examinerId && !g.examiners.some((e: any) => e.id === next.examinerId)) throw new AccessDenied(400, 'Examinador inválido.');
      if (!await visible(next, route)) throw new AccessDenied();
      if (next.scheduleId) {
        const schedule = g.schedules.find((s: any) => s.id === next.scheduleId);
        const parent = route === 'banca-results' ? [...g.requests, ...g.slots].find((r: any) => r.id === next.scheduleId && r.schoolId === next.schoolId) : null;
        if (parent) {
          if (!await visible(parent, g.slots.includes(parent) ? 'schedule-slots' : 'requests')) throw new AccessDenied();
        } else if (!schedule || !await scheduleVisible(schedule)) throw new AccessDenied();
      }
      if (staff) return; // Fine-grained confirmed/extra/state rules remain in the handlers.
      if (route === 'banca-results') {
        if (user.role !== 'EXAMINER') throw new AccessDenied();
        const assigned = g.schedules.some((s: any) => s.id === next.scheduleId && s.examinerIds?.includes(user.examinerId)) ||
          [...g.requests, ...g.slots].some((r: any) => r.id === next.scheduleId && r.schoolId === next.schoolId && r.examinerId === user.examinerId);
        if (!next.scheduleId || !assigned) throw new AccessDenied();
        return;
      }
      if (user.role === 'EXAMINER') {
        if (method !== 'PUT' || !(body.registerInterest || body.removeInterest || body.result !== undefined)) throw new AccessDenied();
        const allowed = body.registerInterest || body.removeInterest ? ['id', 'registerInterest', 'removeInterest'] :
          ['id', 'result', 'examHistory', 'status', 'attendanceConfirmed'];
        if (Object.keys(body).some(k => !allowed.includes(k))) throw new AccessDenied();
        if (body.result !== undefined && current.examinerId !== user.examinerId &&
          !g.schedules.some((s: any) => s.id === current.scheduleId && s.examinerIds?.includes(user.examinerId))) throw new AccessDenied();
      } else if (user.role === 'SCHOOL') {
        if (method === 'POST') {
          if (next.status !== 'WAITING_SCHEDULING' || next.attendanceConfirmed || next.scheduleId || next.examinerId) throw new AccessDenied();
        } else if (method === 'DELETE') {
          if (current.status !== 'WAITING_SCHEDULING') throw new AccessDenied();
        } else {
          if (Object.keys(body).some(k => !['id', 'attendanceConfirmed', 'status', 'cancellationReason', 'observation', 'updatedAt'].includes(k))) throw new AccessDenied();
          if (body.attendanceConfirmed === true && current.status !== 'SCHEDULED') throw new AccessDenied();
          if (body.status && body.status !== current.status && body.status !== 'CANCELLED') throw new AccessDenied();
        }
      } else if (user.role === 'INSTRUCTOR') {
        if (route !== 'requests' || recordModule(next) !== 'CNH_BRASIL' || method === 'DELETE') throw new AccessDenied();
        if (Object.keys(body).some(k => ['result', 'examHistory', 'examinerId', 'scheduleId', 'scheduledDate', 'scheduledTime', 'scheduledCategory', 'modulo', 'source'].includes(k) &&
          body[k] !== current?.[k] && !(method === 'POST' && ['modulo', 'source'].includes(k)))) throw new AccessDenied();
        if (method === 'POST' && !['IN_ANALYSIS', 'WAITING_SCHEDULING'].includes(body.status)) throw new AccessDenied();
        if (method === 'PUT' && body.status && body.status !== current.status && body.status !== 'CANCELLED') throw new AccessDenied();
        if (body.attendanceConfirmed === true && current?.status !== 'SCHEDULED') throw new AccessDenied();
      } else throw new AccessDenied();
      return;
    }
    if (!['cpf-lookup', 'vehicle-lookup'].includes(route)) throw new AccessDenied();
  };
  return { authorize, project };
}

export function sanitizeMutation(route: string, body: any, schema: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccessDenied(400, 'Corpo inválido.');
  let fields: string[] | undefined;
  if (route === 'users') fields = ['id', ...userFields, 'confirmSessionRevocation'];
  if (route === 'settings') fields = [...settingsFields, 'riskAreaKey', 'enableEmailNotifications', 'enableSmsNotifications', 'createdAt', 'updatedAt'];
  if (route === 'requests') fields = [
    'id', 'studentName', 'socialName', 'cpf', 'phone', 'email', 'address', 'city',
    'requestType', 'examType', 'intendedCategory', 'source', 'schoolId', 'paidFee',
    'completedPracticalCourse', 'practicalHours', 'hasVehicle', 'cnhRestriction',
    'instructor', 'vehiclePlate', 'disabilityType', 'specialNeeds', 'status', 'result',
    'scheduleId', 'scheduledDate', 'scheduledTime', 'scheduledCategory', 'examinerId',
    'attendanceConfirmed', 'cancellationReason', 'observation', 'categoryQuantities',
    'examHistory', 'queueUpdatedAt', 'checklistVehicle', 'practicalCourseInserted',
    'taxaPaga', 'scheduledBy', 'modulo', 'semDuploComando', 'rowColor',
    'examModalityA', 'examModalityB', 'createdAt', 'updatedAt', 'confirmedEdit',
    'extraEdit', 'examGroup', 'registerInterest', 'removeInterest',
  ];
  if (route === 'schedule-slots') fields = [
    'id', 'schoolId', 'examType', 'requestType', 'intendedCategory', 'scheduledDate',
    'scheduledTime', 'examinerId', 'scheduleId', 'scheduledCategory', 'status',
    'attendanceConfirmed', 'cancellationReason', 'observation', 'categoryQuantities',
    'automaticFixed', 'confirmedEdit', 'extraEdit', 'examGroup', 'createdAt', 'updatedAt',
  ];
  if (route === 'banca-results') {
    fields = ['id', 'scheduleId', 'schoolId', 'category', 'totalSlots', 'usedSlots',
      'approved', 'failed', 'absent', 'cancelled', 'modulo', 'createdAt', 'updatedAt'];
    for (const key of ['totalSlots', 'usedSlots', 'approved', 'failed', 'absent', 'cancelled']) {
      if (body[key] !== undefined && (!Number.isSafeInteger(body[key]) || body[key] < 0)) throw new AccessDenied(400, 'Contagem de resultados inválida.');
    }
  }
  const tables: Record<string, string> = { schools: 'drivingSchools', examiners: 'examiners',
    instructors: 'instructors', cities: 'cities', 'blocked-dates': 'blockedDates', 'exam-locations': 'examLocations', schedules: 'examSchedules' };
  if (tables[route]) {
    fields = [...Object.keys(schema[tables[route]]).filter(k => !['createdAt', 'updatedAt'].includes(k)), 'createdAt', 'updatedAt'];
    if (route === 'instructors') fields.push('vehicles');
    if (route === 'schedules') fields.push('sourceSchoolId');
  }
  if (fields && Object.keys(body).some(k => !fields!.includes(k))) throw new AccessDenied(400, 'Campo não permitido.');
  const result = fields ? pickFields(body, fields.filter(k => !['createdAt', 'updatedAt'].includes(k))) : body;
  if (route === 'instructors' && Array.isArray(result.vehicles)) {
    result.vehicles = result.vehicles.map((v: any) => pickFields(v, vehicleFields));
  }
  return result;
}
