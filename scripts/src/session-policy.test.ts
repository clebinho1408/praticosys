import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Shared policy intentionally exercised outside the scripts rootDir.
import { SHORT_TTL_MS, LONG_TTL_MS, RENEW_THROTTLE_MS, sessionTtlMs, sessionExpiry, renewedExpiry } from '../../functions/_session-policy.js';

const now = new Date('2026-11-10T12:00:00.000Z');
const H = 60 * 60 * 1000;
const D = 24 * H;

test('session TTL: 8h by default, 30 days with "Manter conectado"', () => {
  assert.equal(SHORT_TTL_MS, 8 * H);
  assert.equal(LONG_TTL_MS, 30 * D);
  for (const off of [undefined, null, false, 'false', 0, '', 'yes', {}]) assert.equal(sessionTtlMs(off), SHORT_TTL_MS, String(off));
  assert.equal(sessionTtlMs(true), LONG_TTL_MS);
  assert.equal(sessionTtlMs('true'), LONG_TTL_MS);
  assert.equal(sessionExpiry(false, now).getTime(), now.getTime() + 8 * H);
  assert.equal(sessionExpiry(true, now).getTime(), now.getTime() + 30 * D);
});

test('short sessions are never renewed (previous behaviour preserved)', () => {
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H), now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() + 1 * H), now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() - 1), now), null); // já expirada
});

test('long sessions slide to +30 days, throttled to once per hour', () => {
  // Criada agora: ainda dentro da janela de 1h → não renova
  assert.equal(renewedExpiry(new Date(now.getTime() + 30 * D), now), null);
  // Renovada há 59 min → não renova
  assert.equal(renewedExpiry(new Date(now.getTime() + 30 * D - RENEW_THROTTLE_MS + 60_000), now), null);
  // Renovada há 1h → renova para +30 dias a partir de agora
  const afterHour = renewedExpiry(new Date(now.getTime() + 30 * D - RENEW_THROTTLE_MS), now);
  assert.equal(afterHour?.getTime(), now.getTime() + 30 * D);
  // Usada depois de 10 dias sem uso → renova
  const afterTenDays = renewedExpiry(new Date(now.getTime() + 20 * D), now);
  assert.equal(afterTenDays?.getTime(), now.getTime() + 30 * D);
  // Faltando 8h ou menos a sessão é indistinguível de uma curta → não renova (expira naturalmente)
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H), now), null);
  assert.equal(renewedExpiry(new Date(now.getTime() + 8 * H + 1), now)?.getTime(), now.getTime() + 30 * D);
});

test('accepts ISO strings (Neon/D1 rows) and ignores invalid values', () => {
  const iso = new Date(now.getTime() + 20 * D).toISOString();
  assert.equal(renewedExpiry(iso, now)?.getTime(), now.getTime() + 30 * D);
  assert.equal(renewedExpiry('not-a-date', now), null);
  assert.equal(renewedExpiry(null, now), null);
  assert.equal(renewedExpiry(undefined, now), null);
});
