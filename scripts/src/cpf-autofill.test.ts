import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { localD1, seedD1, pagesHarness, DEMO_PASSWORD } from './d1-runtime.js';
// @ts-ignore Shared server integration.
import { lookupCpf, canLookupCpf, consumeCpfQuota, validCpf } from '../../functions/_cpf-lookup.js';
// @ts-ignore Pure frontend state machine (no React or DOM).
import { CpfAutofill, cleanCpf } from '../../artifacts/praticosys/src/services/cpfAutofill.js';
// @ts-ignore Frontend payload policy, exercised against the same backend contract.
import { settingsForSave } from '../../artifacts/praticosys/src/services/settingsPayload.js';
// @ts-ignore Shared schema.
import { systemSettings, users } from '../../db/schema.js';
// @ts-ignore Released D1 baseline.
import { d1Checksum, D1_INITIAL_CHECKSUM } from '../../db/d1-schema.js';

// Synthetic checksum-valid inputs, intercepted locally; never sent to APICPF.
const cpf = '12345678909', other = '11144477735';
const user = { id: 'synthetic', role: 'ADMIN' };
let checks = 0;
function equal(actual: unknown, expected: unknown) { assert.deepEqual(actual, expected); checks++; }
equal(validCpf(cpf), true); equal(validCpf('00000000000'), false); equal(validCpf('123'), false);
equal(cleanCpf('123.456.789-09'), cpf);
for (const role of ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'INSTRUCTOR']) equal(canLookupCpf({ ...user, role }), true);
for (const role of ['SCHOOL', 'EXAMINER', 'CONSULTANT']) equal(canLookupCpf({ ...user, role }), false);
equal(canLookupCpf({ ...user, role: 'OPERATOR', allowedModules: ['cfc'] }), false);
let calls = 0, quotaCalls = 0;
const consumeQuota = async () => { quotaCalls++; return true; };
const success: typeof fetch = async () => {
  calls++; return Response.json({ code: 200, data: { nome: 'Nome Sintético', genero: 'ignored', data_nascimento: 'ignored' } });
};
const base = { body: { cpf, module: 'CNH_BRASIL' }, user, enabled: true, key: 'synthetic-test-only', consumeQuota, fetcher: success };
equal((await lookupCpf(base)).body, { name: 'Nome Sintético' });
equal(calls, 1);
for (const [change, status] of [
  [{ user: undefined }, 401], [{ user: { ...user, role: 'CONSULTANT' } }, 403],
  [{ body: { cpf, module: 'CFC' } }, 403], [{ enabled: false }, 409],
  [{ body: { cpf: '00000000000', module: 'CNH_BRASIL' } }, 400],
  [{ key: undefined }, 503], [{ consumeQuota: async () => false }, 429],
] as const) equal((await lookupCpf({ ...base, ...change })).status, status);
equal(calls, 1); equal(quotaCalls, 1);
for (const code of [400, 404, 402, 401, 403, 429, 500]) {
  const result = await lookupCpf({ ...base, fetcher: async () => Response.json({ code }, { status: code }) });
  equal(result.status, [400, 404, 429].includes(code) ? code : 503);
  assert.ok('error' in result.body && result.body.error.includes('manualmente')); checks++;
}
equal((await lookupCpf({ ...base, fetcher: async () => Response.json({ data: {} }) })).status, 503);
equal((await lookupCpf({ ...base, fetcher: async () => { throw new Error('synthetic'); } })).status, 503);
const timed = await lookupCpf({ ...base, timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
  init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
}) });
assert.match((timed.body as any).error, /demorou/); checks++;

let name = '', status = '', lookups = 0;
const pending: Array<{ cpf: string; resolve: (v: { name: string }) => void; reject: (e: Error) => void }> = [];
const controller = new CpfAutofill((value: string) => {
  lookups++; return new Promise((resolve, reject) => pending.push({ cpf: value, resolve, reject }));
}, (v: string) => { name = v; }, (v: string) => { status = v; }, 5);
controller.reset(cpf, 'Nome existente', true);
await pause(10); equal(lookups, 0); // Opening existing record is free.
controller.reset('', '', true);
controller.changeCpf('123'); await pause(10); equal(lookups, 0);
controller.changeCpf('00000000000'); await pause(10); equal(lookups, 0);
controller.changeCpf('123.456.789-09'); controller.changeCpf(cpf);
await pause(10); equal(lookups, 1);
controller.changeCpf(other); await pause(10); equal(lookups, 2);
pending[0].resolve({ name: 'Nome antigo' }); await pause(0); equal(name, '');
pending[1].resolve({ name: 'Nome correto' }); await pause(0); equal(name, 'NOME CORRETO');
controller.changeCpf(cpf); equal(name, ''); // Clear old automatic association.
await pause(10);
controller.manualName('MANUAL'); name = 'MANUAL';
pending[2].resolve({ name: 'Não sobrescrever' }); await pause(0); equal(name, 'MANUAL');
controller.changeCpf(other); await pause(10);
controller.reset(cpf, '', true); pending[3].resolve({ name: 'Outro cadastro' });
await pause(0); equal(name, 'MANUAL');
controller.changeCpf(other); await pause(10); controller.setActive(false);
pending[4].resolve({ name: 'Desativado' }); await pause(0); equal(name, 'MANUAL');
controller.reset('', '', false); controller.changeCpf(cpf); await pause(10); equal(lookups, 5);
controller.reset('', '', true); controller.changeCpf(cpf); await pause(10);
pending[5].reject(new Error('Indisponível. Preencha manualmente.')); await pause(0);
assert.match(status, /manualmente/); checks++; controller.manualName(''); equal(status, ''); controller.cancel();

const runtime = await localD1();
try {
  equal(await d1Checksum(), D1_INITIAL_CHECKSUM);
  await seedD1(runtime.db);
  const env = { ...runtime.env, APICPF_API_KEY: 'synthetic-test-only' };
  const harness = await pagesHarness(env);
  const api = async (route: string, method = 'GET', body?: unknown, token?: string, expected = 200) => {
    const response = await harness.dispatch(new Request(`http://test/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    const data = await response.json() as any;
    equal(response.status, expected); return data;
  };
  const admin = (await api('auth', 'POST', { login: 'd1.admin', password: DEMO_PASSWORD })).sessionToken;
  const school = (await api('auth', 'POST', { login: 'd1.school', password: DEMO_PASSWORD })).sessionToken;
  const operator = (await api('auth', 'POST', { login: 'd1.operator', password: DEMO_PASSWORD })).sessionToken;
  equal((await api('settings', 'GET', undefined, admin)).cnhCpfAutofillEnabled, false);
  await api('cpf-lookup', 'POST', base.body, undefined, 401);
  await api('cpf-lookup', 'POST', base.body, school, 403);
  await api('cpf-lookup', 'POST', base.body, admin, 409);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: true }, school, 403);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: 'yes' }, admin, 400);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: true }, admin);
  equal((await api('settings', 'GET', undefined, admin)).cnhCpfAutofillEnabled, true);
  // Existing form saves must remain valid for non-admins. Their read-only CPF
  // preference is present on GET but must never be included in a PUT.
  const supervisor = (await api('auth', 'POST', { login: 'd1.supervisor', password: DEMO_PASSWORD })).sessionToken;
  for (const token of [operator, supervisor]) {
    const loaded = await api('settings', 'GET', undefined, token);
    const payload = settingsForSave({ ...loaded, agencyAddress: 'Endereço fictício editado' }, false);
    equal(Object.hasOwn(payload, 'cnhCpfAutofillEnabled'), false);
    await api('settings', 'PUT', payload, token);
    const saved = await api('settings', 'GET', undefined, token);
    equal(saved.agencyAddress, 'Endereço fictício editado');
    equal(saved.cnhCpfAutofillEnabled, true);
    await api('settings', 'PUT', { cnhCpfAutofillEnabled: false }, token, 403);
    equal((await api('settings', 'GET', undefined, token)).cnhCpfAutofillEnabled, true);
  }
  equal(settingsForSave({ cnhCpfAutofillEnabled: true } as any, true).cnhCpfAutofillEnabled, true);
  const previousFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://apicpf.com/api/consulta?'));
    assert.equal(new Headers(init?.headers).get('X-API-KEY'), 'synthetic-test-only');
    upstreamCalls++; return Response.json({ code: 200, data: { nome: 'Pessoa Fictícia' } });
  };
  try {
    equal(await api('cpf-lookup', 'POST', base.body, admin), { name: 'Pessoa Fictícia' });
    await runtime.db.update(users).set({ allowedModules: ['cfc'] }).where(eq(users.id, 'd1-operator'));
    await api('cpf-lookup', 'POST', base.body, operator, 403);
    await api('cpf-lookup', 'POST', { ...base.body, module: 'PCD' }, admin, 403);
    await api('cpf-lookup', 'POST', { ...base.body, cpf: '00000000000' }, admin, 400);
    await api('settings', 'PUT', { cnhCpfAutofillEnabled: false }, admin);
    await api('cpf-lookup', 'POST', base.body, admin, 409);
    equal(upstreamCalls, 1);
  } finally { globalThis.fetch = previousFetch; }
  equal((await runtime.db.select().from(systemSettings))[0].cnhCpfAutofillEnabled, false);
  const admissions = await Promise.all(Array.from({ length: 20 }, () => consumeCpfQuota(runtime.db, 'quota-test')));
  equal(admissions.filter(Boolean).length, 10);
  await runtime.db.execute(sql`UPDATE cotas_consulta_cpf SET janela_minuto = 0 WHERE id = 'quota-test'`);
  equal(await consumeCpfQuota(runtime.db, 'quota-test'), true);
  await harness.drain();
} finally { await runtime.mf.dispose(); }
process.stdout.write(`CPF: ${checks} verificações passaram com API simulada e D1 isolado; nenhuma consulta real.\n`);
