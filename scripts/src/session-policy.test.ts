import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Shared policy intentionally exercised outside the scripts rootDir.
import { SHORT_TTL_MS, LONG_TTL_MS, RENEW_THROTTLE_MS, canUseLongSession, sessionTtlMs, sessionExpiry, renewedExpiry } from '../../functions/_session-policy.js';

const now = new Date('2026-11-10T12:00:00.000Z');
const H = 60 * 60 * 1000;
const D = 24 * H;

const EX = 'EXAMINER';
const OTHERS = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'SCHOOL', 'INSTRUCTOR', undefined, null, ''];

test('only EXAMINER may use a long session', () => {
  assert.equal(canUseLongSession(EX), true);
  for (const role of OTHERS) assert.equal(canUseLongSession(role), false, String(role));
});

test('session TTL: EXAMINER with rememberMe gets 30 days; everyone else keeps 8h', () => {
  assert.equal(SHORT_TTL_MS, 8 * H);
  assert.equal(LONG_TTL_MS, 30 * D);
  assert.equal(sessionTtlMs(true, EX), LONG_TTL_MS);
  assert.equal(sessionTtlMs('true', EX), LONG_TTL_MS);
  for (const off of [undefined, null, false, 'false', 0, '', 'yes', {}]) assert.equal(sessionTtlMs(off, EX), SHORT_TTL_MS, String(off));
  // rememberMe enviado por outros perfis é ignorado (comportamento original: 8h)
  for (const role of OTHERS) assert.equal(sessionTtlMs(true, role), SHORT_TTL_MS, String(role));
  assert.equal(sessionExpiry(false, EX, now).getTime(), now.getTime() + 8 * H);
  assert.equal(sessionExpiry(true, EX, now).getTime(), now.getTime() + 30 * D);
  assert.equal(sessionExpiry(true, 'ADMIN', now).getTime(), now.getTime() + 8 * H);
});

test('non-examiner sessions are never renewed (previous behaviour preserved)', () => {
  for (const role of OTHERS) {
    assert.equal(renewedExpiry(new Date(now.getTime() + 20 * D), role, now), null, String(role));
    assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H), role, now), null, String(role));
  }
});

test('examiner short sessions (8h) are never renewed', () => {
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H), EX, now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() + 1 * H), EX, now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() - 1), EX, now), null); // já expirada
});

test('examiner long sessions slide to +30 days, throttled to once per hour', () => {
  // Criada agora: ainda dentro da janela de 1h → não renova
  assert.equal(renewedExpiry(new Date(now.getTime() + 30 * D), EX, now), null);
  // Renovada há 59 min → não renova
  assert.equal(renewedExpiry(new Date(now.getTime() + 30 * D - RENEW_THROTTLE_MS + 60_000), EX, now), null);
  // Renovada há 1h → renova para +30 dias a partir de agora
  assert.equal(renewedExpiry(new Date(now.getTime() + 30 * D - RENEW_THROTTLE_MS), EX, now)?.getTime(), now.getTime() + 30 * D);
  // Usada depois de 10 dias sem uso → renova
  assert.equal(renewedExpiry(new Date(now.getTime() + 20 * D), EX, now)?.getTime(), now.getTime() + 30 * D);
  // Faltando 8h ou menos é indistinguível de uma curta → não renova (expira naturalmente)
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H), EX, now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H + 1), EX, now)?.getTime(), now.getTime() + 30 * D);
});

test('accepts ISO strings (Neon/D1 rows) and ignores invalid values', () => {
  const iso = new Date(now.getTime() + 20 * D).toISOString();
  assert.equal(renewedExpiry(iso, EX, now)?.getTime(), now.getTime() + 30 * D);
  assert.equal(renewedExpiry('not-a-date', EX, now), null);
  assert.equal(renewedExpiry(null, EX, now), null);
  assert.equal(renewedExpiry(undefined, EX, now), null);
});
