import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
// @ts-ignore Shared Pages sources are intentionally exercised by this harness.
import { migrateD1 } from '../../db/d1-schema.js';
// @ts-ignore Shared Pages sources.
import { getDb } from '../../functions/_db.js';
// @ts-ignore Shared Pages sources.
import * as schema from '../../db/schema.js';
import { hash } from 'bcryptjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEMO_PASSWORD = 'D1-teste-2026!';
export async function localD1(persist: boolean | string = false) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("D1 local"); } }',
    compatibilityDate: '2026-10-01',
    d1Databases: { DB: 'praticosys-d1-local-only' },
    d1Persist: persist === true ? path.join(root, '.local/d1-state') : persist,
  }));
  const binding = await mf.getD1Database('DB');
  await migrateD1(binding as any);
  const env = { DB_PROVIDER: 'd1', DB: binding };
  return { mf, binding, env, db: getDb(env) };
}

export async function seedD1(db: any) {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length) return;
  const password = await hash(DEMO_PASSWORD, 10);
  const users = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'SCHOOL', 'INSTRUCTOR', 'EXAMINER'].map(role => ({
    id: `d1-${role.toLowerCase()}`, login: `d1.${role.toLowerCase()}`, name: `Teste D1 ${role}`,
    password, role, forcePasswordChange: false, allowedModules: ['cnh', 'cfc', 'pcd'],
    schoolId: role === 'SCHOOL' ? 'd1-school' : null,
    examinerId: role === 'EXAMINER' ? 'd1-examiner' : null,
    instructorId: role === 'INSTRUCTOR' ? 'd1-instructor' : null,
  }));
  await db.batch([
    db.insert(schema.cities).values({ id: 'd1-city', name: 'Cidade de Teste D1' }),
    db.insert(schema.drivingSchools).values({
      id: 'd1-school', name: 'Autoescola de Teste D1', city: 'Cidade de Teste D1',
      examRotation: true, services: ['COMMON'],
      mainSchedule: { active: true, days: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], slots: [{ examiner: 'd1-examiner', time: '08:00' }] },
    }),
    db.insert(schema.examiners).values({
      id: 'd1-examiner', name: 'Examinador de Teste D1', registrationNumber: 'D1-001',
      categories: ['A', 'B'], canExamPCD: true, examRotation: true,
      rotationAvailability: { days: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], defaultTime: '08:00', examsPerDay: 1, cityIds: ['d1-city'] },
    }),
    db.insert(schema.instructors).values({ id: 'd1-instructor', name: 'Instrutor de Teste D1', cpf: '00000000000' }),
    db.insert(schema.vehicles).values({ id: 'd1-vehicle', instructorId: 'd1-instructor', type: 'CAR', brand: 'TESTE', model: 'D1', plate: 'D1T0000' }),
    db.insert(schema.examLocations).values({ id: 'd1-location', cityId: 'd1-city', address: 'Local fictício' }),
    db.insert(schema.systemSettings).values({ id: 1, agencyName: 'AMBIENTE D1 — DADOS FICTÍCIOS' }),
    ...users.map(u => db.insert(schema.users).values(u)),
    ...(['CNH_BRASIL', 'CFC', 'PCD'] as const).map((modulo, i) => db.insert(
      [schema.cnhbrasilRequests, schema.cfcRequests, schema.pcdRequests][i],
    ).values({
      id: `d1-candidate-${modulo}`, studentName: `Candidato fictício ${modulo}`, cpf: '00000000000',
      examType: modulo === 'PCD' ? 'PCD' : 'COMMON', source: 'MANUAL',
      schoolId: modulo === 'CFC' ? 'd1-school' : null, modulo, status: 'WAITING_SCHEDULING',
    })),
  ]);
}

export async function pagesHarness(env: Record<string, unknown>) {
  const handlers = new Map<string, any>();
  async function scan(dir: string, prefix: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await scan(path.join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name.endsWith('.ts') && !entry.name.startsWith('_')) {
        handlers.set(`${prefix}/${entry.name.slice(0, -3)}`, await import(path.join(dir, entry.name)));
      }
    }
  }
  await scan(path.join(root, 'functions/api'), '/api');
  const middleware = await import(path.join(root, 'functions/api/_middleware.ts'));
  const pending = new Set<Promise<unknown>>();
  const dispatch = async (request: Request) => {
    const pathname = new URL(request.url).pathname.replace(/\/$/, '');
    if (pathname === '/api/healthz') return Response.json({ status: 'ok', backend: 'd1-local', realData: false });
    const handler = handlers.get(pathname);
    if (!handler) return Response.json({ error: 'Rota não encontrada' }, { status: 404 });
    const target = handler[`onRequest${request.method[0]}${request.method.slice(1).toLowerCase()}`] ?? handler.onRequest;
    if (!target) return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
    const context: any = {
      request, env, data: {}, params: {}, functionPath: pathname,
      waitUntil(p: Promise<unknown>) { pending.add(p); void p.finally(() => pending.delete(p)); },
      next: () => target(context),
    };
    return middleware.onRequest(context);
  };
  return { dispatch, drain: () => Promise.all([...pending]) };
}
