// functions/api/setup.ts  →  POST /api/setup
// Cria o usuário admin e garante existência de todas as tabelas via migrations inline.
import { getDb, json, error } from '../_db.js';
import { users } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ env }) => {
  try {
    const db = getDb(env as any);

    // ─── Migração de renomeação: inglês → português (versão pt_schema_v1) ────────
    // Marcador de conclusão: versão 'pt_schema_v1' em migracoes_schema.
    // Só marcamos como completo após verificar 6 objetos-chave com nomes em PT.
    try {
      // Tenta ler o marcador (captura erro se tabela ainda não existe)
      let renameMarkerFound = false;
      try {
        const r1 = await db.execute(sql`SELECT 1 FROM migracoes_schema WHERE versao = 'pt_schema_v1' LIMIT 1`);
        renameMarkerFound = (((r1 as any).rows ?? r1) as any[]).length > 0;
      } catch {}
      if (!renameMarkerFound) {
        try {
          const r2 = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE version = 'pt_schema_v1' LIMIT 1`);
          renameMarkerFound = (((r2 as any).rows ?? r2) as any[]).length > 0;
        } catch {}
      }

      // Verifica 6 objetos-chave com nomes em português (tabelas e colunas distintas)
      const verifyRenames6 = async (): Promise<boolean> => {
        try {
          const v = await db.execute(sql`
            SELECT
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios'        AND column_name='perfil')           AS c1,
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessoes'         AND column_name='usuario_id')       AS c2,
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bancas'          AND column_name='examinadores_ids') AS c3,
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='configuracoes'   AND column_name='nome_orgao')       AS c4,
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='solicitacoes'    AND column_name='nome_candidato')   AS c5,
              (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='logs_auditoria' AND column_name='acao')              AS c6
          `);
          const row = (((v as any).rows ?? v) as any[])[0] ?? {};
          return !!(row.c1 && row.c2 && row.c3 && row.c4 && row.c5 && row.c6);
        } catch { return false; }
      };

      const alreadyMigrated = renameMarkerFound && await verifyRenames6();

      if (!alreadyMigrated) {
        const renameStmts: string[] = [
          `ALTER TABLE IF EXISTS users RENAME TO usuarios`,
          `ALTER TABLE IF EXISTS otp_codes RENAME TO codigos_otp`,
          `ALTER TABLE IF EXISTS driving_schools RENAME TO autoescolas`,
          `ALTER TABLE IF EXISTS examiners RENAME TO examinadores`,
          `ALTER TABLE IF EXISTS instructors RENAME TO instrutores`,
          `ALTER TABLE IF EXISTS vehicles RENAME TO veiculos`,
          `ALTER TABLE IF EXISTS exam_locations RENAME TO locais_exame`,
          `ALTER TABLE IF EXISTS exam_schedules RENAME TO bancas`,
          `ALTER TABLE IF EXISTS exam_requests RENAME TO solicitacoes`,
          `ALTER TABLE IF EXISTS system_settings RENAME TO configuracoes`,
          `ALTER TABLE IF EXISTS audit_logs RENAME TO logs_auditoria`,
          `ALTER TABLE IF EXISTS blocked_dates RENAME TO datas_bloqueadas`,
          `ALTER TABLE IF EXISTS cities RENAME TO cidades`,
          `ALTER TABLE IF EXISTS exam_schedule_slots RENAME TO vagas_banca`,
          `ALTER TABLE IF EXISTS banca_results RENAME TO resultados_banca`,
          `ALTER TABLE IF EXISTS cnhbrasil_requests RENAME TO solicitacoes_cnhbrasil`,
          `ALTER TABLE IF EXISTS cfc_requests RENAME TO solicitacoes_cfc`,
          `ALTER TABLE IF EXISTS pcd_requests RENAME TO solicitacoes_pcd`,
          `ALTER TABLE IF EXISTS cfc_schedule_slots RENAME TO vagas_cfc`,
          `ALTER TABLE IF EXISTS pcd_schedule_slots RENAME TO vagas_pcd`,
          `ALTER TABLE IF EXISTS schema_migrations RENAME TO migracoes_schema`,
          `ALTER TABLE IF EXISTS sessions RENAME TO sessoes`,
          `DROP INDEX IF EXISTS backups_auto_daily`,
          `ALTER TABLE IF EXISTS backups RENAME COLUMN trigger_type TO tipo_gatilho`,
          `ALTER TABLE IF EXISTS backups RENAME COLUMN payload TO dados`,
          `ALTER TABLE IF EXISTS backups RENAME COLUMN size_bytes TO tamanho_bytes`,
          `ALTER TABLE IF EXISTS backups RENAME COLUMN created_at TO criado_em`,
          `CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto'`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN name TO nome`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN password TO senha`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN role TO perfil`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN school_id TO autoescola_id`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN examiner_id TO examinador_id`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN instructor_id TO instrutor_id`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN force_password_change TO forcar_troca_senha`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN allowed_modules TO modulos_permitidos`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN allowed_location_ids TO locais_permitidos_ids`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN phone TO telefone`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN two_factor_enabled TO dois_fatores_ativo`,
          `ALTER TABLE IF EXISTS usuarios RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN user_id TO usuario_id`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN code TO codigo`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN expires_at TO expira_em`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN used TO usado`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN failed_attempts TO tentativas_falhas`,
          `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN name TO nome`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN phone TO telefone`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN address TO endereco`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN city TO cidade`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN services TO servicos`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN moto_yard_address TO endereco_patio_moto`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN car_yard_address TO endereco_patio_carro`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN category_change_yard_address TO endereco_patio_mudanca`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN main_schedule TO banca_principal`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN provisional_schedule TO banca_provisoria`,
          `ALTER TABLE IF EXISTS autoescolas RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN name TO nome`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN registration_number TO matricula`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN can_exam_common TO pode_examinar_comum`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN can_exam_pcd TO pode_examinar_pcd`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN categories TO categorias`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_a TO max_vagas_a_padrao`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_b TO max_vagas_b_padrao`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_mudanca TO max_vagas_mudanca_padrao`,
          `ALTER TABLE IF EXISTS examinadores RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS instrutores RENAME COLUMN name TO nome`,
          `ALTER TABLE IF EXISTS instrutores RENAME COLUMN phone TO telefone`,
          `ALTER TABLE IF EXISTS instrutores RENAME COLUMN category TO categoria`,
          `ALTER TABLE IF EXISTS instrutores RENAME COLUMN plate TO placa`,
          `ALTER TABLE IF EXISTS instrutores RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN instructor_id TO instrutor_id`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN type TO tipo`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN brand TO marca`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN model TO modelo`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN plate TO placa`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN active TO ativo`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN transmission TO transmissao`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN accessories TO acessorios`,
          `ALTER TABLE IF EXISTS veiculos RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN city_id TO cidade_id`,
          `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN address TO endereco`,
          `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN maps_url TO url_maps`,
          `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN regions_served TO regioes_atendidas`,
          `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN code TO codigo`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN date TO data`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN time TO hora`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN examiner_ids TO examinadores_ids`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN max_slots_a TO max_vagas_a`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN max_slots_b TO max_vagas_b`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN type TO tipo`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN cancellation_reason TO motivo_cancelamento`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN location_id TO local_id`,
          `ALTER TABLE IF EXISTS bancas RENAME COLUMN created_at TO criado_em`,
          ...(['solicitacoes','solicitacoes_cnhbrasil','solicitacoes_cfc','solicitacoes_pcd'].flatMap((t: string) => [
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN student_name TO nome_candidato`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN social_name TO nome_social`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN phone TO telefone`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN address TO endereco`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN city TO cidade`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN request_type TO tipo_solicitacao`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN exam_type TO tipo_exame`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN intended_category TO categoria_pretendida`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN source TO origem`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN school_id TO autoescola_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN paid_fee TO taxa_paga_bool`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN completed_practical_course TO curso_pratico_concluido`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN practical_hours TO horas_praticas`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN has_vehicle TO tem_veiculo`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN cnh_restriction TO restricao_cnh`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN instructor TO instrutor`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN vehicle_plate TO placa_veiculo`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN disability_type TO tipo_deficiencia`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN special_needs TO necessidades_especiais`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN result TO resultado`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN schedule_id TO banca_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_date TO data_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_time TO hora_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_category TO categoria_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN examiner_id TO examinador_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN attendance_confirmed TO presenca_confirmada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN cancellation_reason TO motivo_cancelamento`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN observation TO observacao`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN exam_history TO historico_exames`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN category_quantities TO quantidades_categoria`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN checklist_vehicle TO checklist_veiculo`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN practical_course_inserted TO curso_pratico_inserido`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN row_color TO cor_linha`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN created_at TO criado_em`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN updated_at TO atualizado_em`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN queue_updated_at TO fila_atualizado_em`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_by TO agendado_por`,
          ])),
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN agency_name TO nome_orgao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN agency_address TO endereco_orgao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN logo_url TO url_logo`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN maintenance_mode TO modo_manutencao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN min_days_scheduling TO min_dias_agendamento`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN max_daily_slots TO max_vagas_diarias`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN default_max_slots_a TO max_vagas_a_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN default_max_slots_b TO max_vagas_b_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN default_max_slots_mudanca TO max_vagas_mudanca_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN whatsapp_message_template TO template_whatsapp`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN cfc_whatsapp_template TO template_whatsapp_cfc`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN default_exam_address TO endereco_exame_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN default_exam_address_link TO link_exame_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN restrictions TO restricoes`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN pcd_exam_name TO nome_exame_pcd`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN pcd_default_exam_address TO endereco_exame_pcd_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN pcd_default_exam_address_link TO link_exame_pcd_padrao`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN pcd_main_schedule TO banca_principal_pcd`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN cnh_brasil_main_schedule TO banca_principal_cnh_brasil`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN block_weekends TO bloquear_fins_semana`,
          `ALTER TABLE IF EXISTS configuracoes RENAME COLUMN risk_area_key TO chave_area_risco`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_id TO usuario_id`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_name TO nome_usuario`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_role TO perfil_usuario`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN action TO acao`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN entity TO entidade`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN entity_id TO entidade_id`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN details TO detalhes`,
          `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN date TO data`,
          `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN description TO descricao`,
          `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN is_holiday TO feriado`,
          `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS cidades RENAME COLUMN name TO nome`,
          `ALTER TABLE IF EXISTS cidades RENAME COLUMN created_at TO criado_em`,
          ...(['vagas_banca','vagas_cfc','vagas_pcd'].flatMap((t: string) => [
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN school_id TO autoescola_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN exam_type TO tipo_exame`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN request_type TO tipo_solicitacao`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN intended_category TO categoria_pretendida`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_date TO data_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_time TO hora_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN examiner_id TO examinador_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN schedule_id TO banca_id`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_category TO categoria_agendada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN attendance_confirmed TO presenca_confirmada`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN cancellation_reason TO motivo_cancelamento`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN observation TO observacao`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN created_at TO criado_em`,
            `ALTER TABLE IF EXISTS ${t} RENAME COLUMN updated_at TO atualizado_em`,
          ])),
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN schedule_id TO banca_id`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN school_id TO autoescola_id`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN category TO categoria`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN total_slots TO total_vagas`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN used_slots TO vagas_usadas`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN approved TO aprovados`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN failed TO reprovados`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN absent TO ausentes`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN cancelled TO cancelados`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS resultados_banca RENAME COLUMN updated_at TO atualizado_em`,
          `ALTER TABLE IF EXISTS migracoes_schema RENAME COLUMN version TO versao`,
          `ALTER TABLE IF EXISTS migracoes_schema RENAME COLUMN applied_at TO aplicado_em`,
          `ALTER TABLE IF EXISTS sessoes RENAME COLUMN user_id TO usuario_id`,
          `ALTER TABLE IF EXISTS sessoes RENAME COLUMN expires_at TO expira_em`,
          `ALTER TABLE IF EXISTS sessoes RENAME COLUMN created_at TO criado_em`,
        ];
        for (const stmt of renameStmts) {
          try { await db.execute(sql.raw(stmt)); } catch {}
        }
        // Só marca como completo se os 6 objetos-chave estiverem todos renomeados.
        // Se algum falhou, o marcador NÃO é gravado → próxima chamada retenta.
        if (await verifyRenames6()) {
          try {
            await db.execute(sql`CREATE TABLE IF NOT EXISTS migracoes_schema (versao text PRIMARY KEY, aplicado_em timestamp DEFAULT now())`);
            await db.execute(sql`INSERT INTO migracoes_schema (versao) VALUES ('pt_schema_v1') ON CONFLICT DO NOTHING`);
          } catch {}
        }
      }
    } catch {}

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
      sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS sem_duplo_comando`,
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
