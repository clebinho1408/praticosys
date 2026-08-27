import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    // ─── Migração de renomeação: inglês → português (versão pt_schema_v1) ────────
    // Marcador de conclusão: versão 'pt_schema_v1' na tabela migracoes_schema.
    // A migração é considerada completa APENAS quando:
    //   a) o marcador existe, E
    //   b) os 6 objetos-chave verificados existem com nomes em português.
    // Isso garante que uma migração parcial será retentada nas próximas inicializações.

    // Tenta ler o marcador (captura erro se a tabela ainda não existe)
    let renameMarkerFound = false;
    try {
      const r1 = await db.execute(sql`SELECT 1 FROM migracoes_schema WHERE versao = 'pt_schema_v1' LIMIT 1`);
      renameMarkerFound = (((r1 as any).rows ?? r1) as any[]).length > 0;
    } catch {}
    if (!renameMarkerFound) {
      // Tenta também o nome antigo (caso a tabela ainda não tenha sido renomeada)
      try {
        const r2 = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE version = 'pt_schema_v1' LIMIT 1`);
        renameMarkerFound = (((r2 as any).rows ?? r2) as any[]).length > 0;
      } catch {}
    }

    // Verifica 6 objetos-chave com nomes portugueses (tabelas e colunas diferentes)
    const verifyRenames = async (): Promise<boolean> => {
      try {
        const v = await db.execute(sql`
          SELECT
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios'        AND column_name='perfil')       AS c1,
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessoes'         AND column_name='usuario_id')   AS c2,
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bancas'          AND column_name='examinadores_ids') AS c3,
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='configuracoes'   AND column_name='nome_orgao')   AS c4,
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='solicitacoes'    AND column_name='nome_candidato') AS c5,
            (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='logs_auditoria' AND column_name='acao')          AS c6
        `);
        const row = (((v as any).rows ?? v) as any[])[0] ?? {};
        return !!(row.c1 && row.c2 && row.c3 && row.c4 && row.c5 && row.c6);
      } catch { return false; }
    };

    const alreadyMigrated = renameMarkerFound && await verifyRenames();

    if (!alreadyMigrated) {
      logger.info("Aplicando migração de renomeação: inglês → português...");
      const renameStmts: string[] = [
        // ── Renomear tabelas ───────────────────────────────────────────────────
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
        // ── backups: mantém nome, renomeia colunas ─────────────────────────────
        `DROP INDEX IF EXISTS backups_auto_daily`,
        `ALTER TABLE IF EXISTS backups RENAME COLUMN trigger_type TO tipo_gatilho`,
        `ALTER TABLE IF EXISTS backups RENAME COLUMN payload TO dados`,
        `ALTER TABLE IF EXISTS backups RENAME COLUMN size_bytes TO tamanho_bytes`,
        `ALTER TABLE IF EXISTS backups RENAME COLUMN created_at TO criado_em`,
        `CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto'`,
        // ── usuarios ──────────────────────────────────────────────────────────
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
        // ── codigos_otp ───────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN user_id TO usuario_id`,
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN code TO codigo`,
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN expires_at TO expira_em`,
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN used TO usado`,
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN failed_attempts TO tentativas_falhas`,
        `ALTER TABLE IF EXISTS codigos_otp RENAME COLUMN created_at TO criado_em`,
        // ── autoescolas ───────────────────────────────────────────────────────
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
        // ── examinadores ──────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN name TO nome`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN registration_number TO matricula`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN can_exam_common TO pode_examinar_comum`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN can_exam_pcd TO pode_examinar_pcd`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN categories TO categorias`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_a TO max_vagas_a_padrao`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_b TO max_vagas_b_padrao`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN default_max_slots_mudanca TO max_vagas_mudanca_padrao`,
        `ALTER TABLE IF EXISTS examinadores RENAME COLUMN created_at TO criado_em`,
        // ── instrutores ───────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS instrutores RENAME COLUMN name TO nome`,
        `ALTER TABLE IF EXISTS instrutores RENAME COLUMN phone TO telefone`,
        `ALTER TABLE IF EXISTS instrutores RENAME COLUMN category TO categoria`,
        `ALTER TABLE IF EXISTS instrutores RENAME COLUMN plate TO placa`,
        `ALTER TABLE IF EXISTS instrutores RENAME COLUMN created_at TO criado_em`,
        // ── veiculos ──────────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN instructor_id TO instrutor_id`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN type TO tipo`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN brand TO marca`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN model TO modelo`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN plate TO placa`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN active TO ativo`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN transmission TO transmissao`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN accessories TO acessorios`,
        `ALTER TABLE IF EXISTS veiculos RENAME COLUMN created_at TO criado_em`,
        // ── locais_exame ──────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN city_id TO cidade_id`,
        `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN address TO endereco`,
        `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN maps_url TO url_maps`,
        `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN regions_served TO regioes_atendidas`,
        `ALTER TABLE IF EXISTS locais_exame RENAME COLUMN created_at TO criado_em`,
        // ── bancas ────────────────────────────────────────────────────────────
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
        // ── solicitacoes + tabelas de módulo (colunas comuns) ─────────────────
        ...(['solicitacoes','solicitacoes_cnhbrasil','solicitacoes_cfc','solicitacoes_pcd'].flatMap(t => [
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
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN sem_duplo_comando TO sem_duplo_comando`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN checklist_vehicle TO checklist_veiculo`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN practical_course_inserted TO curso_pratico_inserido`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN row_color TO cor_linha`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN created_at TO criado_em`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN updated_at TO atualizado_em`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN queue_updated_at TO fila_atualizado_em`,
          `ALTER TABLE IF EXISTS ${t} RENAME COLUMN scheduled_by TO agendado_por`,
        ])),
        // ── configuracoes ─────────────────────────────────────────────────────
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
        // ── logs_auditoria ────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_id TO usuario_id`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_name TO nome_usuario`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN user_role TO perfil_usuario`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN action TO acao`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN entity TO entidade`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN entity_id TO entidade_id`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN details TO detalhes`,
        `ALTER TABLE IF EXISTS logs_auditoria RENAME COLUMN created_at TO criado_em`,
        // ── datas_bloqueadas ──────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN date TO data`,
        `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN description TO descricao`,
        `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN is_holiday TO feriado`,
        `ALTER TABLE IF EXISTS datas_bloqueadas RENAME COLUMN created_at TO criado_em`,
        // ── cidades ───────────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS cidades RENAME COLUMN name TO nome`,
        `ALTER TABLE IF EXISTS cidades RENAME COLUMN created_at TO criado_em`,
        // ── vagas_banca / vagas_cfc / vagas_pcd ───────────────────────────────
        ...(['vagas_banca','vagas_cfc','vagas_pcd'].flatMap(t => [
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
        // ── resultados_banca ──────────────────────────────────────────────────
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
        // ── migracoes_schema ──────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS migracoes_schema RENAME COLUMN version TO versao`,
        `ALTER TABLE IF EXISTS migracoes_schema RENAME COLUMN applied_at TO aplicado_em`,
        // ── sessoes ───────────────────────────────────────────────────────────
        `ALTER TABLE IF EXISTS sessoes RENAME COLUMN user_id TO usuario_id`,
        `ALTER TABLE IF EXISTS sessoes RENAME COLUMN expires_at TO expira_em`,
        `ALTER TABLE IF EXISTS sessoes RENAME COLUMN created_at TO criado_em`,
      ];

      for (const stmt of renameStmts) {
        try { await db.execute(sql.raw(stmt)); } catch {}
      }
      // Só marca como completo se os 6 objetos-chave estiverem todos renomeados.
      // Se algum falhou, o marcador NÃO é gravado → próxima inicialização retenta.
      const migratedOk = await verifyRenames();
      if (migratedOk) {
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS migracoes_schema (versao text PRIMARY KEY, aplicado_em timestamp DEFAULT now())
          `);
          await db.execute(sql`INSERT INTO migracoes_schema (versao) VALUES ('pt_schema_v1') ON CONFLICT DO NOTHING`);
          logger.info("Migração de renomeação concluída e marcada (pt_schema_v1).");
        } catch (err) {
          logger.warn({ err }, "Renames OK mas falha ao gravar marcador — será retentado na próxima inicialização.");
        }
      } else {
        logger.warn("Migração de renomeação parcialmente aplicada — será retentada na próxima inicialização.");
      }
    }

    // ─── Migrations regulares (nomes já em português) ─────────────────────────
    await db.execute(sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS quantidades_categoria jsonb`);
    await db.execute(sql`
      UPDATE solicitacoes
      SET
        quantidades_categoria = (
          SELECT COALESCE(jsonb_object_agg(m[1], (m[2])::int), '{}'::jsonb)
          FROM regexp_matches(
            substring(observacao from '^\\[Qtd:([A-Z0-9=,]+)\\]'),
            '([A-Z]+)=([0-9]+)',
            'g'
          ) AS m
        ),
        observacao = regexp_replace(observacao, '^\\[Qtd:[A-Z0-9=,]+\\] *', '')
      WHERE quantidades_categoria IS NULL
        AND observacao LIKE '[Qtd:%'
    `);
    // Tabela de locais + coluna local_id em bancas
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS locais_exame (
        id text PRIMARY KEY,
        cidade_id text NOT NULL,
        endereco text,
        url_maps text,
        regioes_atendidas jsonb DEFAULT '[]',
        criado_em timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE bancas ADD COLUMN IF NOT EXISTS local_id text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locais_permitidos_ids jsonb DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS procuracao boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS chave_area_risco text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_ativo boolean DEFAULT false`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS codigos_otp (
        id text PRIMARY KEY,
        usuario_id text NOT NULL,
        codigo text NOT NULL,
        expira_em timestamp NOT NULL,
        usado boolean DEFAULT false,
        tentativas_falhas integer DEFAULT 0,
        criado_em timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE codigos_otp ADD COLUMN IF NOT EXISTS tentativas_falhas integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS cor_linha text`);
    await db.execute(sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS modulo text`);
    await db.execute(sql`
      UPDATE solicitacoes
      SET modulo = CASE
        WHEN tipo_exame = 'PCD' THEN 'PCD'
        WHEN autoescola_id IS NULL OR autoescola_id = '' OR autoescola_id = 'CNH_BRASIL' THEN 'CNH_BRASIL'
        WHEN autoescola_id = 'PCD' THEN 'PCD'
        ELSE 'CFC'
      END
      WHERE modulo IS NULL OR modulo = ''
    `);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS backups (id text PRIMARY KEY, tipo_gatilho text NOT NULL DEFAULT 'manual', dados jsonb NOT NULL, tamanho_bytes integer DEFAULT 0, criado_em timestamp DEFAULT now())`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id text PRIMARY KEY,
        usuario_id text,
        nome_usuario text,
        perfil_usuario text,
        acao text NOT NULL,
        entidade text NOT NULL,
        entidade_id text,
        detalhes jsonb,
        criado_em timestamp DEFAULT now()
      )
    `);

    // ─── Módulo: criar tabelas separadas por módulo ────────────────────────────
    // Tabela de controle de migrações (evita re-execução de backfill)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migracoes_schema (
        versao text PRIMARY KEY,
        aplicado_em timestamp DEFAULT now()
      )
    `);

    // Cria as novas tabelas (sempre idempotente)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS solicitacoes_cnhbrasil (LIKE solicitacoes INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS solicitacoes_cfc (LIKE solicitacoes INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS solicitacoes_pcd (LIKE solicitacoes INCLUDING ALL)`);
    await db.execute(sql`ALTER TABLE solicitacoes_cnhbrasil ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS vagas_cfc (LIKE vagas_banca INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS vagas_pcd (LIKE vagas_banca INCLUDING ALL)`);
    await db.execute(sql`ALTER TABLE resultados_banca ADD COLUMN IF NOT EXISTS modulo text`);

    // Backfill: roda UMA ÚNICA VEZ via marcador transacional
    const migCheck = await db.execute(sql`SELECT 1 FROM migracoes_schema WHERE versao = 'module_tables_v1'`);
    const migDone = ((migCheck as any).rows ?? migCheck);
    if (!migDone || migDone.length === 0) {
      logger.info("Running one-time module tables backfill...");
      await db.transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO migracoes_schema (versao) VALUES ('module_tables_v1')`);
        await tx.execute(sql`INSERT INTO solicitacoes_cnhbrasil SELECT * FROM solicitacoes WHERE modulo = 'CNH_BRASIL' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO solicitacoes_cfc SELECT * FROM solicitacoes WHERE modulo = 'CFC' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO solicitacoes_pcd SELECT * FROM solicitacoes WHERE modulo = 'PCD' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO vagas_cfc SELECT * FROM vagas_banca WHERE tipo_exame != 'PCD' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO vagas_pcd SELECT * FROM vagas_banca WHERE tipo_exame = 'PCD' ON CONFLICT (id) DO NOTHING`);
      });
      logger.info("Module tables backfill complete.");
    }

    // ─── Remover colunas desnecessárias por módulo (idempotente) ──────────────
    await db.execute(sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS tipo_deficiencia`);
    await db.execute(sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS necessidades_especiais`);
    await db.execute(sql`ALTER TABLE solicitacoes_cnhbrasil DROP COLUMN IF EXISTS quantidades_categoria`);
    await db.execute(sql`ALTER TABLE solicitacoes_cfc DROP COLUMN IF EXISTS tipo_deficiencia`);
    await db.execute(sql`ALTER TABLE solicitacoes_cfc DROP COLUMN IF EXISTS necessidades_especiais`);
    await db.execute(sql`ALTER TABLE solicitacoes_pcd DROP COLUMN IF EXISTS sem_duplo_comando`);
    await db.execute(sql`ALTER TABLE solicitacoes_pcd DROP COLUMN IF EXISTS quantidades_categoria`);

    logger.info("DB migrations complete");
  } catch (err) {
    logger.warn({ err }, "DB migration step skipped or failed");
  }
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
