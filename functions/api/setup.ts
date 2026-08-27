// functions/api/setup.ts  →  POST /api/setup
// Cria o usuário admin e garante existência de todas as tabelas via migrations inline.
import { getDb, json, error, ensurePortugueseSchema } from '../_db.js';
import { users } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ env }) => {
  try {
    const db = getDb(env as any);

    // ─── Migração de renomeação: inglês → português (versão pt_schema_v1) ────────
    // Fonte única: functions/_migration-sql.mjs via ensurePortugueseSchema().
    await ensurePortugueseSchema(db);

    // ─── Criar tabelas (usando nomes em português) ─────────────────────────────
    const tables = [
      sql`CREATE TABLE IF NOT EXISTS instrutores (id text PRIMARY KEY, nome text NOT NULL, cpf text, telefone text, categoria text, placa text, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS veiculos (id text PRIMARY KEY, instrutor_id text NOT NULL, tipo text NOT NULL, marca text NOT NULL, modelo text NOT NULL, placa text NOT NULL, ativo boolean DEFAULT true, transmissao text, acessorios jsonb DEFAULT '[]'::jsonb, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS autoescolas (id text PRIMARY KEY, nome text NOT NULL, telefone text, endereco text, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS examinadores (id text PRIMARY KEY, nome text NOT NULL, matricula text NOT NULL, pode_examinar_comum boolean DEFAULT true, pode_examinar_pcd boolean DEFAULT false, categorias jsonb DEFAULT '[]'::jsonb, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS bancas (id text PRIMARY KEY, data text NOT NULL, hora text NOT NULL, examinadores_ids jsonb DEFAULT '[]'::jsonb, max_vagas_a integer DEFAULT 10, max_vagas_b integer DEFAULT 10, tipo text NOT NULL, status text NOT NULL, motivo_cancelamento text, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS solicitacoes (id text PRIMARY KEY, nome_candidato text, nome_social text, cpf text, telefone text, status text NOT NULL, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS configuracoes (id integer PRIMARY KEY DEFAULT 1, nome_orgao text DEFAULT 'DETRAN', modo_manutencao boolean DEFAULT false, min_dias_agendamento integer DEFAULT 2, max_vagas_diarias integer DEFAULT 50, max_vagas_a_padrao integer DEFAULT 10, max_vagas_b_padrao integer DEFAULT 10)`,
      sql`CREATE TABLE IF NOT EXISTS usuarios (id text PRIMARY KEY, nome text NOT NULL, login text NOT NULL UNIQUE, senha text, perfil text NOT NULL, autoescola_id text, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS cidades (id text PRIMARY KEY, nome text NOT NULL UNIQUE, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS datas_bloqueadas (id text PRIMARY KEY, data text NOT NULL, descricao text, feriado boolean DEFAULT false, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS resultados_banca (id text PRIMARY KEY, banca_id text, autoescola_id text, categoria text, criado_em timestamp DEFAULT now(), atualizado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS vagas_banca (id text PRIMARY KEY, autoescola_id text NOT NULL, tipo_exame text NOT NULL, tipo_solicitacao text NOT NULL DEFAULT 'FIXA', categoria_pretendida text, data_agendada text, hora_agendada text, examinador_id text, banca_id text, categoria_agendada text, status text NOT NULL DEFAULT 'SCHEDULED', presenca_confirmada boolean DEFAULT false, motivo_cancelamento text, observacao text, criado_em timestamp DEFAULT now(), atualizado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS locais_exame (id text PRIMARY KEY, cidade_id text NOT NULL, endereco text, url_maps text, regioes_atendidas jsonb DEFAULT '[]'::jsonb, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS logs_auditoria (id text PRIMARY KEY, usuario_id text, nome_usuario text, perfil_usuario text, acao text NOT NULL, entidade text NOT NULL, entidade_id text, detalhes jsonb, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS codigos_otp (id text PRIMARY KEY, usuario_id text NOT NULL, codigo text NOT NULL, expira_em timestamp NOT NULL, usado boolean DEFAULT false, tentativas_falhas integer DEFAULT 0, criado_em timestamp DEFAULT now())`,
      sql`ALTER TABLE codigos_otp ADD COLUMN IF NOT EXISTS tentativas_falhas integer DEFAULT 0`,
      sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS backups (id text PRIMARY KEY, tipo_gatilho text NOT NULL DEFAULT 'manual', dados jsonb NOT NULL, tamanho_bytes integer DEFAULT 0, criado_em timestamp DEFAULT now())`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto'`,
    ];

    const columns = [
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS endereco text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS cidade text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS tipo_exame text DEFAULT 'COMMON'`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS categoria_pretendida text DEFAULT 'B'`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS origem text DEFAULT 'SCHOOL'`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS autoescola_id text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS taxa_paga_bool boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS curso_pratico_concluido boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS horas_praticas integer DEFAULT 0`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS tem_veiculo boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS restricao_cnh text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS instrutor text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS placa_veiculo text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS tipo_deficiencia text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS necessidades_especiais text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS resultado text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS banca_id text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS data_agendada text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS hora_agendada text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS categoria_agendada text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS presenca_confirmada boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS motivo_cancelamento text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS observacao text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS historico_exames jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS atualizado_em timestamp DEFAULT now()`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS fila_atualizado_em timestamptz`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS examinador_id text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS tipo_solicitacao text DEFAULT 'EXTRA'`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS checklist_veiculo boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS curso_pratico_inserido boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS taxa_paga boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS agendado_por text`,
      sql`ALTER TABLE bancas ADD COLUMN IF NOT EXISTS codigo text`,
      sql`ALTER TABLE bancas ADD COLUMN IF NOT EXISTS local_id text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS examinador_id text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS instrutor_id text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS forcar_troca_senha boolean DEFAULT true`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locais_permitidos_ids jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE instrutores ADD COLUMN IF NOT EXISTS categoria text`,
      sql`ALTER TABLE instrutores ADD COLUMN IF NOT EXISTS placa text`,
      sql`ALTER TABLE instrutores ADD COLUMN IF NOT EXISTS cpf text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS cidade text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS servicos jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_moto text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_carro text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_mudanca text`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS banca_principal jsonb`,
      sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS banca_provisoria jsonb`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS endereco_orgao text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS url_logo text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS template_whatsapp_cfc text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS template_whatsapp text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS endereco_exame_padrao text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS link_exame_padrao text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS nome_exame_pcd text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS endereco_exame_pcd_padrao text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS link_exame_pcd_padrao text`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS banca_principal_pcd jsonb`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS banca_principal_cnh_brasil jsonb`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS bloquear_fins_semana boolean DEFAULT false`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS max_vagas_mudanca_padrao integer DEFAULT 10`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS total_vagas integer DEFAULT 0`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS vagas_usadas integer DEFAULT 0`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS aprovados integer DEFAULT 0`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS reprovados integer DEFAULT 0`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS ausentes integer DEFAULT 0`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS cancelados integer DEFAULT 0`,
      sql`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS procuracao boolean DEFAULT false`,
      sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS chave_area_risco text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text`,
      sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_ativo boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS cor_linha text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS modulo text`,
      sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS quantidades_categoria jsonb DEFAULT '{}'::jsonb`,
    ];

    for (const q of tables) { try { await db.execute(q); } catch {} }
    for (const q of columns) { try { await db.execute(q); } catch {} }

    // ─── Tabelas por módulo: criação estrutural (sempre idempotente) ──────────
    const structuralMigrations = [
      sql`CREATE TABLE IF NOT EXISTS migracoes_schema (versao text PRIMARY KEY, aplicado_em timestamp DEFAULT now())`,
      sql`UPDATE solicitacoes SET modulo = CASE
            WHEN tipo_exame = 'PCD' THEN 'PCD'
            WHEN autoescola_id IS NULL OR autoescola_id = '' OR autoescola_id = 'CNH_BRASIL' THEN 'CNH_BRASIL'
            WHEN autoescola_id = 'PCD' THEN 'PCD'
            ELSE 'CFC'
          END WHERE modulo IS NULL OR modulo = ''`,
      sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS modulo text`,
      sql`CREATE TABLE IF NOT EXISTS solicitacoes_cnhbrasil (LIKE solicitacoes INCLUDING ALL)`,
      sql`CREATE TABLE IF NOT EXISTS solicitacoes_cfc (LIKE solicitacoes INCLUDING ALL)`,
      sql`CREATE TABLE IF NOT EXISTS solicitacoes_pcd (LIKE solicitacoes INCLUDING ALL)`,
      sql`ALTER TABLE solicitacoes_cnhbrasil ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`,
      sql`CREATE TABLE IF NOT EXISTS vagas_cfc (LIKE vagas_banca INCLUDING ALL)`,
      sql`CREATE TABLE IF NOT EXISTS vagas_pcd (LIKE vagas_banca INCLUDING ALL)`,
    ];
    for (const q of structuralMigrations) { try { await db.execute(q); } catch {} }

    // ─── Backfill legado: roda UMA ÚNICA VEZ via marcador transacional ───────
    try {
      const check = await db.execute(sql`SELECT 1 FROM migracoes_schema WHERE versao = 'module_tables_v1'`);
      const already = ((check as any).rows ?? check);
      if (!already || already.length === 0) {
        await db.transaction(async (tx: any) => {
          await tx.execute(sql`INSERT INTO migracoes_schema (versao) VALUES ('module_tables_v1')`);
          await tx.execute(sql`INSERT INTO solicitacoes_cnhbrasil SELECT * FROM solicitacoes WHERE modulo = 'CNH_BRASIL' ON CONFLICT (id) DO NOTHING`);
          await tx.execute(sql`INSERT INTO solicitacoes_cfc SELECT * FROM solicitacoes WHERE modulo = 'CFC' ON CONFLICT (id) DO NOTHING`);
          await tx.execute(sql`INSERT INTO solicitacoes_pcd SELECT * FROM solicitacoes WHERE modulo = 'PCD' ON CONFLICT (id) DO NOTHING`);
          await tx.execute(sql`INSERT INTO vagas_cfc SELECT * FROM vagas_banca WHERE tipo_exame != 'PCD' ON CONFLICT (id) DO NOTHING`);
          await tx.execute(sql`INSERT INTO vagas_pcd SELECT * FROM vagas_banca WHERE tipo_exame = 'PCD' ON CONFLICT (id) DO NOTHING`);
        });
      }
    } catch {}

    // ─── Remover colunas desnecessárias por módulo (idempotente) ─────────────
    const dropColumns = [
      sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS tipo_deficiencia`,
      sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS necessidades_especiais`,
      sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS quantidades_categoria`,
      sql`ALTER TABLE solicitacoes_cfc DROP COLUMN IF EXISTS tipo_deficiencia`,
      sql`ALTER TABLE solicitacoes_cfc DROP COLUMN IF EXISTS necessidades_especiais`,
      sql`ALTER TABLE solicitacoes_pcd DROP COLUMN IF EXISTS sem_duplo_comando`,
      sql`ALTER TABLE solicitacoes_pcd DROP COLUMN IF EXISTS quantidades_categoria`,
    ];
    for (const q of dropColumns) { try { await db.execute(q); } catch {} }

    // Criar usuário admin se não existir
    try {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name: 'Administrador',
        login: 'admin',
        role: 'ADMIN',
        forcePasswordChange: false,
      }).onConflictDoNothing();
    } catch {}

    return json({ success: true, message: 'Tabelas criadas e sincronizadas com sucesso!' });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
