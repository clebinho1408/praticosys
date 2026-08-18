// Shared DB helper for Cloudflare Pages Functions
// Uses env.DATABASE_URL injected by the Workers runtime (no dotenv needed)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';

// ─── Migração de renomeação: inglês → português ────────────────────────────────
// Usa um único bloco DO $$ para enviar todas as renomeações em UMA requisição
// HTTP ao Neon, evitando timeout por múltiplas chamadas sequenciais.
// Cache de módulo: só roda uma vez por instância de Worker (cold start).
let _schemaMigrated = false;

// Helper: coluna antiga → BEGIN ALTER ... EXCEPTION WHEN OTHERS THEN NULL; END;
function colRename(table: string, oldCol: string, newCol: string): string {
  return `BEGIN ALTER TABLE IF EXISTS ${table} RENAME COLUMN ${oldCol} TO ${newCol}; EXCEPTION WHEN OTHERS THEN NULL; END;`;
}

export async function ensurePortugueseSchema(db: any): Promise<void> {
  if (_schemaMigrated) return;

  // Verificação rápida do marcador (2 tentativas: novo nome e nome antigo da tabela)
  let markerFound = false;
  try {
    const r = await db.execute(sql`SELECT 1 FROM migracoes_schema WHERE versao = 'pt_schema_v1' LIMIT 1`);
    markerFound = (((r as any).rows ?? r) as any[]).length > 0;
  } catch {}
  if (!markerFound) {
    try {
      const r = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE version = 'pt_schema_v1' LIMIT 1`);
      markerFound = (((r as any).rows ?? r) as any[]).length > 0;
    } catch {}
  }
  if (markerFound) { _schemaMigrated = true; return; }

  // Monta e executa um único bloco DO $$ com todas as renomeações.
  // ALTER TABLE IF EXISTS: silencioso quando a tabela não existe.
  // BEGIN...EXCEPTION WHEN OTHERS THEN NULL; END: silencioso quando a coluna já foi renomeada ou não existe.
  const solicitacoesTables = ['solicitacoes','solicitacoes_cnhbrasil','solicitacoes_cfc','solicitacoes_pcd'];
  const vagasTables = ['vagas_banca','vagas_cfc','vagas_pcd'];

  const colRenames = [
    // backups
    colRename('backups','trigger_type','tipo_gatilho'),
    colRename('backups','payload','dados'),
    colRename('backups','size_bytes','tamanho_bytes'),
    colRename('backups','created_at','criado_em'),
    // usuarios
    colRename('usuarios','name','nome'),
    colRename('usuarios','password','senha'),
    colRename('usuarios','role','perfil'),
    colRename('usuarios','school_id','autoescola_id'),
    colRename('usuarios','examiner_id','examinador_id'),
    colRename('usuarios','instructor_id','instrutor_id'),
    colRename('usuarios','force_password_change','forcar_troca_senha'),
    colRename('usuarios','allowed_modules','modulos_permitidos'),
    colRename('usuarios','allowed_location_ids','locais_permitidos_ids'),
    colRename('usuarios','phone','telefone'),
    colRename('usuarios','two_factor_enabled','dois_fatores_ativo'),
    colRename('usuarios','created_at','criado_em'),
    // codigos_otp
    colRename('codigos_otp','user_id','usuario_id'),
    colRename('codigos_otp','code','codigo'),
    colRename('codigos_otp','expires_at','expira_em'),
    colRename('codigos_otp','used','usado'),
    colRename('codigos_otp','failed_attempts','tentativas_falhas'),
    colRename('codigos_otp','created_at','criado_em'),
    // sessoes
    colRename('sessoes','user_id','usuario_id'),
    colRename('sessoes','expires_at','expira_em'),
    colRename('sessoes','created_at','criado_em'),
    // autoescolas
    colRename('autoescolas','name','nome'),
    colRename('autoescolas','phone','telefone'),
    colRename('autoescolas','address','endereco'),
    colRename('autoescolas','city','cidade'),
    colRename('autoescolas','services','servicos'),
    colRename('autoescolas','moto_yard_address','endereco_patio_moto'),
    colRename('autoescolas','car_yard_address','endereco_patio_carro'),
    colRename('autoescolas','category_change_yard_address','endereco_patio_mudanca'),
    colRename('autoescolas','main_schedule','banca_principal'),
    colRename('autoescolas','provisional_schedule','banca_provisoria'),
    colRename('autoescolas','created_at','criado_em'),
    // examinadores
    colRename('examinadores','name','nome'),
    colRename('examinadores','registration_number','matricula'),
    colRename('examinadores','can_exam_common','pode_examinar_comum'),
    colRename('examinadores','can_exam_pcd','pode_examinar_pcd'),
    colRename('examinadores','categories','categorias'),
    colRename('examinadores','default_max_slots_a','max_vagas_a_padrao'),
    colRename('examinadores','default_max_slots_b','max_vagas_b_padrao'),
    colRename('examinadores','default_max_slots_mudanca','max_vagas_mudanca_padrao'),
    colRename('examinadores','created_at','criado_em'),
    // instrutores
    colRename('instrutores','name','nome'),
    colRename('instrutores','phone','telefone'),
    colRename('instrutores','category','categoria'),
    colRename('instrutores','plate','placa'),
    colRename('instrutores','created_at','criado_em'),
    // veiculos
    colRename('veiculos','instructor_id','instrutor_id'),
    colRename('veiculos','type','tipo'),
    colRename('veiculos','brand','marca'),
    colRename('veiculos','model','modelo'),
    colRename('veiculos','plate','placa'),
    colRename('veiculos','active','ativo'),
    colRename('veiculos','transmission','transmissao'),
    colRename('veiculos','accessories','acessorios'),
    colRename('veiculos','created_at','criado_em'),
    // locais_exame
    colRename('locais_exame','city_id','cidade_id'),
    colRename('locais_exame','address','endereco'),
    colRename('locais_exame','maps_url','url_maps'),
    colRename('locais_exame','regions_served','regioes_atendidas'),
    colRename('locais_exame','created_at','criado_em'),
    // bancas
    colRename('bancas','code','codigo'),
    colRename('bancas','date','data'),
    colRename('bancas','time','hora'),
    colRename('bancas','examiner_ids','examinadores_ids'),
    colRename('bancas','max_slots_a','max_vagas_a'),
    colRename('bancas','max_slots_b','max_vagas_b'),
    colRename('bancas','type','tipo'),
    colRename('bancas','cancellation_reason','motivo_cancelamento'),
    colRename('bancas','location_id','local_id'),
    colRename('bancas','created_at','criado_em'),
    // solicitacoes (4 tabelas)
    ...solicitacoesTables.flatMap(t => [
      colRename(t,'student_name','nome_candidato'),
      colRename(t,'social_name','nome_social'),
      colRename(t,'phone','telefone'),
      colRename(t,'address','endereco'),
      colRename(t,'city','cidade'),
      colRename(t,'request_type','tipo_solicitacao'),
      colRename(t,'exam_type','tipo_exame'),
      colRename(t,'intended_category','categoria_pretendida'),
      colRename(t,'source','origem'),
      colRename(t,'school_id','autoescola_id'),
      colRename(t,'paid_fee','taxa_paga_bool'),
      colRename(t,'completed_practical_course','curso_pratico_concluido'),
      colRename(t,'practical_hours','horas_praticas'),
      colRename(t,'has_vehicle','tem_veiculo'),
      colRename(t,'cnh_restriction','restricao_cnh'),
      colRename(t,'instructor','instrutor'),
      colRename(t,'vehicle_plate','placa_veiculo'),
      colRename(t,'disability_type','tipo_deficiencia'),
      colRename(t,'special_needs','necessidades_especiais'),
      colRename(t,'result','resultado'),
      colRename(t,'schedule_id','banca_id'),
      colRename(t,'scheduled_date','data_agendada'),
      colRename(t,'scheduled_time','hora_agendada'),
      colRename(t,'scheduled_category','categoria_agendada'),
      colRename(t,'examiner_id','examinador_id'),
      colRename(t,'attendance_confirmed','presenca_confirmada'),
      colRename(t,'cancellation_reason','motivo_cancelamento'),
      colRename(t,'observation','observacao'),
      colRename(t,'exam_history','historico_exames'),
      colRename(t,'category_quantities','quantidades_categoria'),
      colRename(t,'checklist_vehicle','checklist_veiculo'),
      colRename(t,'practical_course_inserted','curso_pratico_inserido'),
      colRename(t,'row_color','cor_linha'),
      colRename(t,'created_at','criado_em'),
      colRename(t,'updated_at','atualizado_em'),
      colRename(t,'queue_updated_at','fila_atualizado_em'),
      colRename(t,'scheduled_by','agendado_por'),
    ]),
    // configuracoes
    colRename('configuracoes','agency_name','nome_orgao'),
    colRename('configuracoes','agency_address','endereco_orgao'),
    colRename('configuracoes','logo_url','url_logo'),
    colRename('configuracoes','maintenance_mode','modo_manutencao'),
    colRename('configuracoes','min_days_scheduling','min_dias_agendamento'),
    colRename('configuracoes','max_daily_slots','max_vagas_diarias'),
    colRename('configuracoes','default_max_slots_a','max_vagas_a_padrao'),
    colRename('configuracoes','default_max_slots_b','max_vagas_b_padrao'),
    colRename('configuracoes','default_max_slots_mudanca','max_vagas_mudanca_padrao'),
    colRename('configuracoes','whatsapp_message_template','template_whatsapp'),
    colRename('configuracoes','cfc_whatsapp_template','template_whatsapp_cfc'),
    colRename('configuracoes','default_exam_address','endereco_exame_padrao'),
    colRename('configuracoes','default_exam_address_link','link_exame_padrao'),
    colRename('configuracoes','restrictions','restricoes'),
    colRename('configuracoes','pcd_exam_name','nome_exame_pcd'),
    colRename('configuracoes','pcd_default_exam_address','endereco_exame_pcd_padrao'),
    colRename('configuracoes','pcd_default_exam_address_link','link_exame_pcd_padrao'),
    colRename('configuracoes','pcd_main_schedule','banca_principal_pcd'),
    colRename('configuracoes','cnh_brasil_main_schedule','banca_principal_cnh_brasil'),
    colRename('configuracoes','block_weekends','bloquear_fins_semana'),
    colRename('configuracoes','risk_area_key','chave_area_risco'),
    // logs_auditoria
    colRename('logs_auditoria','user_id','usuario_id'),
    colRename('logs_auditoria','user_name','nome_usuario'),
    colRename('logs_auditoria','user_role','perfil_usuario'),
    colRename('logs_auditoria','action','acao'),
    colRename('logs_auditoria','entity','entidade'),
    colRename('logs_auditoria','entity_id','entidade_id'),
    colRename('logs_auditoria','details','detalhes'),
    colRename('logs_auditoria','created_at','criado_em'),
    // datas_bloqueadas
    colRename('datas_bloqueadas','date','data'),
    colRename('datas_bloqueadas','description','descricao'),
    colRename('datas_bloqueadas','is_holiday','feriado'),
    colRename('datas_bloqueadas','created_at','criado_em'),
    // cidades
    colRename('cidades','name','nome'),
    colRename('cidades','created_at','criado_em'),
    // vagas (3 tabelas)
    ...vagasTables.flatMap(t => [
      colRename(t,'school_id','autoescola_id'),
      colRename(t,'exam_type','tipo_exame'),
      colRename(t,'request_type','tipo_solicitacao'),
      colRename(t,'intended_category','categoria_pretendida'),
      colRename(t,'scheduled_date','data_agendada'),
      colRename(t,'scheduled_time','hora_agendada'),
      colRename(t,'examiner_id','examinador_id'),
      colRename(t,'schedule_id','banca_id'),
      colRename(t,'scheduled_category','categoria_agendada'),
      colRename(t,'attendance_confirmed','presenca_confirmada'),
      colRename(t,'cancellation_reason','motivo_cancelamento'),
      colRename(t,'observation','observacao'),
      colRename(t,'created_at','criado_em'),
      colRename(t,'updated_at','atualizado_em'),
    ]),
    // resultados_banca
    colRename('resultados_banca','schedule_id','banca_id'),
    colRename('resultados_banca','school_id','autoescola_id'),
    colRename('resultados_banca','category','categoria'),
    colRename('resultados_banca','total_slots','total_vagas'),
    colRename('resultados_banca','used_slots','vagas_usadas'),
    colRename('resultados_banca','approved','aprovados'),
    colRename('resultados_banca','failed','reprovados'),
    colRename('resultados_banca','absent','ausentes'),
    colRename('resultados_banca','cancelled','cancelados'),
    colRename('resultados_banca','created_at','criado_em'),
    colRename('resultados_banca','updated_at','atualizado_em'),
    // migracoes_schema
    colRename('migracoes_schema','version','versao'),
    colRename('migracoes_schema','applied_at','aplicado_em'),
  ].join('\n  ');

  const doBlock = `
DO $$
BEGIN
  -- Renomear tabelas (idempotente via IF EXISTS)
  ALTER TABLE IF EXISTS users              RENAME TO usuarios;
  ALTER TABLE IF EXISTS otp_codes          RENAME TO codigos_otp;
  ALTER TABLE IF EXISTS driving_schools    RENAME TO autoescolas;
  ALTER TABLE IF EXISTS examiners          RENAME TO examinadores;
  ALTER TABLE IF EXISTS instructors        RENAME TO instrutores;
  ALTER TABLE IF EXISTS vehicles           RENAME TO veiculos;
  ALTER TABLE IF EXISTS exam_locations     RENAME TO locais_exame;
  ALTER TABLE IF EXISTS exam_schedules     RENAME TO bancas;
  ALTER TABLE IF EXISTS exam_requests      RENAME TO solicitacoes;
  ALTER TABLE IF EXISTS system_settings    RENAME TO configuracoes;
  ALTER TABLE IF EXISTS audit_logs         RENAME TO logs_auditoria;
  ALTER TABLE IF EXISTS blocked_dates      RENAME TO datas_bloqueadas;
  ALTER TABLE IF EXISTS cities             RENAME TO cidades;
  ALTER TABLE IF EXISTS exam_schedule_slots RENAME TO vagas_banca;
  ALTER TABLE IF EXISTS banca_results      RENAME TO resultados_banca;
  ALTER TABLE IF EXISTS cnhbrasil_requests RENAME TO solicitacoes_cnhbrasil;
  ALTER TABLE IF EXISTS cfc_requests       RENAME TO solicitacoes_cfc;
  ALTER TABLE IF EXISTS pcd_requests       RENAME TO solicitacoes_pcd;
  ALTER TABLE IF EXISTS cfc_schedule_slots RENAME TO vagas_cfc;
  ALTER TABLE IF EXISTS pcd_schedule_slots RENAME TO vagas_pcd;
  ALTER TABLE IF EXISTS schema_migrations  RENAME TO migracoes_schema;
  ALTER TABLE IF EXISTS sessions           RENAME TO sessoes;
  -- Recriar índice único de backups com coluna renomeada
  DROP INDEX IF EXISTS backups_auto_daily;

  -- Renomear colunas (idempotente via EXCEPTION WHEN OTHERS)
  ${colRenames}

  -- Recriar índice com novo nome de coluna
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Gravar marcador de conclusão
  CREATE TABLE IF NOT EXISTS migracoes_schema (versao text PRIMARY KEY, aplicado_em timestamp DEFAULT now());
  INSERT INTO migracoes_schema (versao) VALUES ('pt_schema_v1') ON CONFLICT DO NOTHING;
END $$
`;

  try {
    await db.execute(sql.raw(doBlock));
    _schemaMigrated = true;
  } catch (e) {
    console.error('[schema-migrate] DO block failed:', e);
    // Não seta _schemaMigrated → próxima inicialização tentará novamente
  }
}

export function getDb(env: Record<string, string>) {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set in environment');
  const sqlClient = neon(url);
  return drizzle(sqlClient, { schema });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(message: string, status = 500): Response {
  return json({ error: message }, status);
}

export async function parseBody<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function getQuery(url: string): Record<string, string> {
  const { searchParams } = new URL(url);
  const result: Record<string, string> = {};
  searchParams.forEach((v, k) => { result[k] = v; });
  return result;
}

// ─── Audit helpers ───────────────────────────────────────────────────────────

export function extractActor(req: Request) {
  return {
    userId:   req.headers.get('X-User-Id')   ?? null,
    userName: req.headers.get('X-User-Name') ?? null,
    userRole: req.headers.get('X-User-Role') ?? null,
  };
}

let _auditTableReady = false;

export async function writeAuditLog(
  db: any,
  actor: { userId: string | null; userName: string | null; userRole: string | null },
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, any>
) {
  try {
    if (!_auditTableReady) {
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
      _auditTableReady = true;
    }
    const id = crypto.randomUUID();
    const det = details ? JSON.stringify(details) : null;
    await db.execute(sql`
      INSERT INTO logs_auditoria (id, usuario_id, nome_usuario, perfil_usuario, acao, entidade, entidade_id, detalhes, criado_em)
      VALUES (
        ${id},
        ${actor.userId},
        ${actor.userName},
        ${actor.userRole},
        ${action},
        ${entity},
        ${entityId},
        ${det}::jsonb,
        now()
      )
    `);
  } catch (e) {
    console.error('[audit] write failed:', e);
  }
}
