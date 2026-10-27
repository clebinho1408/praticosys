import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localD1 } from './d1-runtime.js';
// @ts-ignore Shared released baseline.
import { initialD1Statements, D1_VERSION, D1_INITIAL_CHECKSUM, d1Checksum, migrateD1, d1Tables } from '../../db/d1-schema.js';
// @ts-ignore Shared released CPF migration.
import { CPF_D1_VERSION, CPF_D1_STATEMENTS, migrateCpfD1 } from '../../db/cpf-migration.js';
// @ts-ignore Shared additive migration.
import { CADASTRO_TABS_D1_VERSION, CADASTRO_TABS_D1_CHECKSUM, cadastroTabsD1Checksum, migrateCadastroTabsD1 } from '../../db/cadastro-tabs-migration.js';
// @ts-ignore Shared request-time verification.
import { createD1Db, verifyD1Schema } from '../../functions/_d1.js';
// @ts-ignore Shared legacy import compiler.
import { d1ImportStatements } from '../../functions/_d1-backup.js';

export async function testD1Migrations() {
  assert.equal(await d1Checksum(), D1_INITIAL_CHECKSUM);
  assert.equal(await cadastroTabsD1Checksum(), CADASTRO_TABS_D1_CHECKSUM);
  assert.ok(d1Tables.usuarios.some((c: any) => c.name === 'abas_cadastro_permitidas'));
  assert.ok(!initialD1Statements().join('\n').includes('abas_cadastro_permitidas'));
  // Pin the already-released CPF SQL independently of its runtime checksum.
  assert.equal(createHash('sha256').update(CPF_D1_STATEMENTS.join(';\n')).digest('hex'),
    '33f6efaa4252d52db341f33ca9638bfea3a93502ef2b5fe8dfdb137e2ed1051d');

  const runtime = await localD1(false, false);
  const binding = runtime.binding;
  const row = () => binding.prepare("SELECT * FROM usuarios WHERE id = 'legacy'").first<any>();
  const markers = async () => (await binding.prepare('SELECT * FROM migracoes_d1 ORDER BY versao').all()).results;
  try {
    // Reconstruct the released baseline plus CPF, with a pre-existing user.
    await binding.batch([
      ...initialD1Statements().map((s: string) => binding.prepare(s)),
      binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)').bind(D1_VERSION, D1_INITIAL_CHECKSUM, '2026-01-01'),
      binding.prepare('INSERT INTO usuarios (id, nome, login, perfil, senha) VALUES (?, ?, ?, ?, ?)')
        .bind('legacy', 'Usuário sintético', 'legacy', 'OPERATOR', 'synthetic-hash'),
    ]);
    await migrateCpfD1(binding);
    const before = await markers();
    const legacy = await row();
    await assert.rejects(() => verifyD1Schema(createD1Db(binding as any)), /abas de cadastro/);
    assert.equal((await binding.prepare('PRAGMA table_info(usuarios)').all()).results
      .some((c: any) => c.name === 'abas_cadastro_permitidas'), false);
    // A marker-write failure must roll back the preceding ALTER as well.
    await binding.prepare(`CREATE TRIGGER reject_tabs_marker BEFORE INSERT ON migracoes_d1
      WHEN NEW.versao = '${CADASTRO_TABS_D1_VERSION}'
      BEGIN SELECT RAISE(ABORT, 'synthetic migration failure'); END`).run();
    await assert.rejects(() => migrateCadastroTabsD1(binding as any));
    assert.deepEqual(await markers(), before);
    assert.equal((await binding.prepare('PRAGMA table_info(usuarios)').all()).results
      .some((c: any) => c.name === 'abas_cadastro_permitidas'), false);
    await binding.prepare('DROP TRIGGER reject_tabs_marker').run();
    await migrateD1(binding as any);
    assert.deepEqual(await row(), { ...legacy, abas_cadastro_permitidas: '[]' });
    assert.deepEqual((await markers()).filter((m: any) => m.versao !== CADASTRO_TABS_D1_VERSION), before);
    await verifyD1Schema(createD1Db(binding as any));
    const after = await markers();
    await migrateD1(binding as any);
    assert.deepEqual(await markers(), after);

    // Old imports omit the new optional field: existing permissions survive;
    // newly imported users receive the ORM-compatible default.
    await binding.prepare("UPDATE usuarios SET abas_cadastro_permitidas = ? WHERE id = 'legacy'")
      .bind('["instrutores"]').run();
    await binding.batch(d1ImportStatements(binding, 'usuarios', [
      { id: 'legacy', nome: 'Nome atualizado', login: 'legacy', perfil: 'OPERATOR' },
      { id: 'old-import', nome: 'Importado', login: 'old-import', perfil: 'SUPERVISOR' },
      { id: 'new-import', nome: 'Atual', login: 'new-import', perfil: 'OPERATOR', abas_cadastro_permitidas: ['examinadores'] },
    ]));
    assert.equal((await row()).abas_cadastro_permitidas, '["instrutores"]');
    assert.equal((await row()).senha, 'synthetic-hash');
    assert.equal((await binding.prepare("SELECT abas_cadastro_permitidas AS tabs FROM usuarios WHERE id = 'old-import'").first<any>()).tabs, '[]');
    assert.equal((await binding.prepare("SELECT abas_cadastro_permitidas AS tabs FROM usuarios WHERE id = 'new-import'").first<any>()).tabs, '["examinadores"]');
    await assert.rejects(() => binding.prepare("UPDATE usuarios SET abas_cadastro_permitidas = 'invalid-json' WHERE id = 'legacy'").run());

    // Incompatible checksums are rejected by maintenance and request paths.
    await binding.prepare('UPDATE migracoes_d1 SET checksum = ? WHERE versao = ?').bind('bad', CADASTRO_TABS_D1_VERSION).run();
    await assert.rejects(() => migrateD1(binding as any), /abas de cadastro incompatível/);
    await assert.rejects(() => verifyD1Schema(createD1Db(binding as any)), /abas de cadastro/);
    await binding.prepare('UPDATE migracoes_d1 SET checksum = ? WHERE versao = ?').bind(CADASTRO_TABS_D1_CHECKSUM, CADASTRO_TABS_D1_VERSION).run();
    for (const version of [D1_VERSION, CPF_D1_VERSION]) {
      await binding.prepare('UPDATE migracoes_d1 SET checksum = ? WHERE versao = ?').bind('bad', version).run();
      await assert.rejects(() => migrateD1(binding as any), /modificada|incompatível/);
      await assert.rejects(() => verifyD1Schema(createD1Db(binding as any)));
      await binding.prepare('UPDATE migracoes_d1 SET checksum = ? WHERE versao = ?')
        .bind((before.find((m: any) => m.versao === version) as any).checksum, version).run();
    }
    // Never silently adopt a column with no migration marker.
    await binding.prepare('DELETE FROM migracoes_d1 WHERE versao = ?').bind(CADASTRO_TABS_D1_VERSION).run();
    await assert.rejects(() => migrateCadastroTabsD1(binding as any));
    assert.equal((await binding.prepare('SELECT count(*) AS n FROM migracoes_d1 WHERE versao = ?')
      .bind(CADASTRO_TABS_D1_VERSION).first<any>()).n, 0);
    assert.equal((await row()).abas_cadastro_permitidas, '["instrutores"]');
  } finally { await runtime.mf.dispose(); }
  const state = await mkdtemp(path.join(tmpdir(), 'd1-persistence-'));
  try {
    const first = await localD1(state);
    let savedMarkers: unknown;
    try {
      await first.binding.prepare('INSERT INTO usuarios (id, nome, login, perfil, abas_cadastro_permitidas) VALUES (?, ?, ?, ?, ?)')
        .bind('persistent', 'Sintético', 'persistent', 'OPERATOR', '["instrutores"]').run();
      savedMarkers = (await first.binding.prepare('SELECT * FROM migracoes_d1 ORDER BY versao').all()).results;
    } finally { await first.mf.dispose(); }
    const reopened = await localD1(state);
    try {
      assert.equal((await reopened.binding.prepare("SELECT abas_cadastro_permitidas AS tabs FROM usuarios WHERE id = 'persistent'").first<any>()).tabs, '["instrutores"]');
      assert.deepEqual((await reopened.binding.prepare('SELECT * FROM migracoes_d1 ORDER BY versao').all()).results, savedMarkers);
      await verifyD1Schema(reopened.db);
    } finally { await reopened.mf.dispose(); }
  } finally { await rm(state, { recursive: true, force: true }); }
  process.stdout.write('D1 migrations: released checksums, existing database, legacy imports and fail-closed verification passed.\n');
}
