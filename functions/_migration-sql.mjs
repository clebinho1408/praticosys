// SQL da migração de renomeação EN → PT.
// Fonte única de verdade: usada pelo backend Cloudflare (functions/_db.ts)
// e por scripts de migração manual (psql).
// Tudo protegido por BEGIN...EXCEPTION para idempotência total —
// inclusive renomeações de tabela (ex.: "sessions" e "sessoes" podem coexistir).

function tbl(oldName, newName) {
  return `BEGIN ALTER TABLE IF EXISTS ${oldName} RENAME TO ${newName}; EXCEPTION WHEN OTHERS THEN NULL; END;`;
}
function col(table, oldCol, newCol) {
  return `BEGIN ALTER TABLE IF EXISTS ${table} RENAME COLUMN ${oldCol} TO ${newCol}; EXCEPTION WHEN OTHERS THEN NULL; END;`;
}

const solicitacoesTables = ['solicitacoes', 'solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd'];
const vagasTables = ['vagas_banca', 'vagas_cfc', 'vagas_pcd'];

const tableRenames = [
  tbl('users', 'usuarios'),
  tbl('otp_codes', 'codigos_otp'),
  tbl('driving_schools', 'autoescolas'),
  tbl('examiners', 'examinadores'),
  tbl('instructors', 'instrutores'),
  tbl('vehicles', 'veiculos'),
  tbl('exam_locations', 'locais_exame'),
  tbl('exam_schedules', 'bancas'),
  tbl('exam_requests', 'solicitacoes'),
  tbl('system_settings', 'configuracoes'),
  tbl('audit_logs', 'logs_auditoria'),
  tbl('blocked_dates', 'datas_bloqueadas'),
  tbl('cities', 'cidades'),
  tbl('exam_schedule_slots', 'vagas_banca'),
  tbl('banca_results', 'resultados_banca'),
  tbl('cnhbrasil_requests', 'solicitacoes_cnhbrasil'),
  tbl('exam_requests_cnh_brasil', 'solicitacoes_cnhbrasil'),
  tbl('cfc_requests', 'solicitacoes_cfc'),
  tbl('exam_requests_cfc', 'solicitacoes_cfc'),
  tbl('pcd_requests', 'solicitacoes_pcd'),
  tbl('exam_requests_pcd', 'solicitacoes_pcd'),
  tbl('cfc_schedule_slots', 'vagas_cfc'),
  tbl('pcd_schedule_slots', 'vagas_pcd'),
  tbl('schema_migrations', 'migracoes_schema'),
  tbl('sessions', 'sessoes'),
];

const colRenames = [
  // backups
  col('backups', 'trigger_type', 'tipo_gatilho'),
  col('backups', 'payload', 'dados'),
  col('backups', 'size_bytes', 'tamanho_bytes'),
  col('backups', 'created_at', 'criado_em'),
  // usuarios
  col('usuarios', 'name', 'nome'),
  col('usuarios', 'password', 'senha'),
  col('usuarios', 'role', 'perfil'),
  col('usuarios', 'school_id', 'autoescola_id'),
  col('usuarios', 'examiner_id', 'examinador_id'),
  col('usuarios', 'instructor_id', 'instrutor_id'),
  col('usuarios', 'force_password_change', 'forcar_troca_senha'),
  col('usuarios', 'allowed_modules', 'modulos_permitidos'),
  col('usuarios', 'allowed_location_ids', 'locais_permitidos_ids'),
  col('usuarios', 'phone', 'telefone'),
  col('usuarios', 'two_factor_enabled', 'dois_fatores_ativo'),
  col('usuarios', 'created_at', 'criado_em'),
  // codigos_otp
  col('codigos_otp', 'user_id', 'usuario_id'),
  col('codigos_otp', 'code', 'codigo'),
  col('codigos_otp', 'expires_at', 'expira_em'),
  col('codigos_otp', 'used', 'usado'),
  col('codigos_otp', 'failed_attempts', 'tentativas_falhas'),
  col('codigos_otp', 'created_at', 'criado_em'),
  // sessoes
  col('sessoes', 'user_id', 'usuario_id'),
  col('sessoes', 'expires_at', 'expira_em'),
  col('sessoes', 'created_at', 'criado_em'),
  // autoescolas
  col('autoescolas', 'name', 'nome'),
  col('autoescolas', 'phone', 'telefone'),
  col('autoescolas', 'address', 'endereco'),
  col('autoescolas', 'city', 'cidade'),
  col('autoescolas', 'services', 'servicos'),
  col('autoescolas', 'moto_yard_address', 'endereco_patio_moto'),
  col('autoescolas', 'car_yard_address', 'endereco_patio_carro'),
  col('autoescolas', 'category_change_yard_address', 'endereco_patio_mudanca'),
  col('autoescolas', 'main_schedule', 'banca_principal'),
  col('autoescolas', 'provisional_schedule', 'banca_provisoria'),
  col('autoescolas', 'created_at', 'criado_em'),
  // examinadores
  col('examinadores', 'name', 'nome'),
  col('examinadores', 'registration_number', 'matricula'),
  col('examinadores', 'can_exam_common', 'pode_examinar_comum'),
  col('examinadores', 'can_exam_pcd', 'pode_examinar_pcd'),
  col('examinadores', 'categories', 'categorias'),
  col('examinadores', 'default_max_slots_a', 'max_vagas_a_padrao'),
  col('examinadores', 'default_max_slots_b', 'max_vagas_b_padrao'),
  col('examinadores', 'default_max_slots_mudanca', 'max_vagas_mudanca_padrao'),
  col('examinadores', 'created_at', 'criado_em'),
  // instrutores
  col('instrutores', 'name', 'nome'),
  col('instrutores', 'phone', 'telefone'),
  col('instrutores', 'category', 'categoria'),
  col('instrutores', 'plate', 'placa'),
  col('instrutores', 'created_at', 'criado_em'),
  // veiculos
  col('veiculos', 'instructor_id', 'instrutor_id'),
  col('veiculos', 'type', 'tipo'),
  col('veiculos', 'brand', 'marca'),
  col('veiculos', 'model', 'modelo'),
  col('veiculos', 'plate', 'placa'),
  col('veiculos', 'active', 'ativo'),
  col('veiculos', 'transmission', 'transmissao'),
  col('veiculos', 'accessories', 'acessorios'),
  col('veiculos', 'created_at', 'criado_em'),
  // locais_exame
  col('locais_exame', 'city_id', 'cidade_id'),
  col('locais_exame', 'address', 'endereco'),
  col('locais_exame', 'maps_url', 'url_maps'),
  col('locais_exame', 'regions_served', 'regioes_atendidas'),
  col('locais_exame', 'created_at', 'criado_em'),
  // bancas
  col('bancas', 'code', 'codigo'),
  col('bancas', 'date', 'data'),
  col('bancas', 'time', 'hora'),
  col('bancas', 'examiner_ids', 'examinadores_ids'),
  col('bancas', 'max_slots_a', 'max_vagas_a'),
  col('bancas', 'max_slots_b', 'max_vagas_b'),
  col('bancas', 'type', 'tipo'),
  col('bancas', 'cancellation_reason', 'motivo_cancelamento'),
  col('bancas', 'location_id', 'local_id'),
  col('bancas', 'created_at', 'criado_em'),
  // solicitacoes (4 tabelas)
  ...solicitacoesTables.flatMap((t) => [
    col(t, 'student_name', 'nome_candidato'),
    col(t, 'social_name', 'nome_social'),
    col(t, 'phone', 'telefone'),
    col(t, 'address', 'endereco'),
    col(t, 'city', 'cidade'),
    col(t, 'request_type', 'tipo_solicitacao'),
    col(t, 'exam_type', 'tipo_exame'),
    col(t, 'intended_category', 'categoria_pretendida'),
    col(t, 'source', 'origem'),
    col(t, 'school_id', 'autoescola_id'),
    col(t, 'paid_fee', 'taxa_paga_bool'),
    col(t, 'completed_practical_course', 'curso_pratico_concluido'),
    col(t, 'practical_hours', 'horas_praticas'),
    col(t, 'has_vehicle', 'tem_veiculo'),
    col(t, 'cnh_restriction', 'restricao_cnh'),
    col(t, 'instructor', 'instrutor'),
    col(t, 'vehicle_plate', 'placa_veiculo'),
    col(t, 'disability_type', 'tipo_deficiencia'),
    col(t, 'special_needs', 'necessidades_especiais'),
    col(t, 'result', 'resultado'),
    col(t, 'schedule_id', 'banca_id'),
    col(t, 'scheduled_date', 'data_agendada'),
    col(t, 'scheduled_time', 'hora_agendada'),
    col(t, 'scheduled_category', 'categoria_agendada'),
    col(t, 'examiner_id', 'examinador_id'),
    col(t, 'attendance_confirmed', 'presenca_confirmada'),
    col(t, 'cancellation_reason', 'motivo_cancelamento'),
    col(t, 'observation', 'observacao'),
    col(t, 'exam_history', 'historico_exames'),
    col(t, 'category_quantities', 'quantidades_categoria'),
    col(t, 'checklist_vehicle', 'checklist_veiculo'),
    col(t, 'practical_course_inserted', 'curso_pratico_inserido'),
    col(t, 'row_color', 'cor_linha'),
    col(t, 'created_at', 'criado_em'),
    col(t, 'updated_at', 'atualizado_em'),
    col(t, 'queue_updated_at', 'fila_atualizado_em'),
    col(t, 'scheduled_by', 'agendado_por'),
  ]),
  // configuracoes
  col('configuracoes', 'agency_name', 'nome_orgao'),
  col('configuracoes', 'agency_address', 'endereco_orgao'),
  col('configuracoes', 'logo_url', 'url_logo'),
  col('configuracoes', 'maintenance_mode', 'modo_manutencao'),
  col('configuracoes', 'min_days_scheduling', 'min_dias_agendamento'),
  col('configuracoes', 'max_daily_slots', 'max_vagas_diarias'),
  col('configuracoes', 'default_max_slots_a', 'max_vagas_a_padrao'),
  col('configuracoes', 'default_max_slots_b', 'max_vagas_b_padrao'),
  col('configuracoes', 'default_max_slots_mudanca', 'max_vagas_mudanca_padrao'),
  col('configuracoes', 'whatsapp_message_template', 'template_whatsapp'),
  col('configuracoes', 'whatsapp_template', 'template_whatsapp'), // variante antiga encontrada em produção
  col('configuracoes', 'cfc_whatsapp_template', 'template_whatsapp_cfc'),
  col('configuracoes', 'default_exam_address', 'endereco_exame_padrao'),
  col('configuracoes', 'default_exam_address_link', 'link_exame_padrao'),
  col('configuracoes', 'restrictions', 'restricoes'),
  col('configuracoes', 'pcd_exam_name', 'nome_exame_pcd'),
  col('configuracoes', 'pcd_default_exam_address', 'endereco_exame_pcd_padrao'),
  col('configuracoes', 'pcd_default_exam_address_link', 'link_exame_pcd_padrao'),
  col('configuracoes', 'pcd_main_schedule', 'banca_principal_pcd'),
  col('configuracoes', 'cnh_brasil_main_schedule', 'banca_principal_cnh_brasil'),
  col('configuracoes', 'block_weekends', 'bloquear_fins_semana'),
  col('configuracoes', 'risk_area_key', 'chave_area_risco'),
  // logs_auditoria
  col('logs_auditoria', 'user_id', 'usuario_id'),
  col('logs_auditoria', 'user_name', 'nome_usuario'),
  col('logs_auditoria', 'user_role', 'perfil_usuario'),
  col('logs_auditoria', 'action', 'acao'),
  col('logs_auditoria', 'entity', 'entidade'),
  col('logs_auditoria', 'entity_id', 'entidade_id'),
  col('logs_auditoria', 'details', 'detalhes'),
  col('logs_auditoria', 'created_at', 'criado_em'),
  // datas_bloqueadas
  col('datas_bloqueadas', 'date', 'data'),
  col('datas_bloqueadas', 'description', 'descricao'),
  col('datas_bloqueadas', 'is_holiday', 'feriado'),
  col('datas_bloqueadas', 'created_at', 'criado_em'),
  // cidades
  col('cidades', 'name', 'nome'),
  col('cidades', 'created_at', 'criado_em'),
  // vagas (3 tabelas)
  ...vagasTables.flatMap((t) => [
    col(t, 'school_id', 'autoescola_id'),
    col(t, 'exam_type', 'tipo_exame'),
    col(t, 'request_type', 'tipo_solicitacao'),
    col(t, 'intended_category', 'categoria_pretendida'),
    col(t, 'scheduled_date', 'data_agendada'),
    col(t, 'scheduled_time', 'hora_agendada'),
    col(t, 'examiner_id', 'examinador_id'),
    col(t, 'schedule_id', 'banca_id'),
    col(t, 'scheduled_category', 'categoria_agendada'),
    col(t, 'attendance_confirmed', 'presenca_confirmada'),
    col(t, 'cancellation_reason', 'motivo_cancelamento'),
    col(t, 'observation', 'observacao'),
    col(t, 'created_at', 'criado_em'),
    col(t, 'updated_at', 'atualizado_em'),
  ]),
  // resultados_banca
  col('resultados_banca', 'schedule_id', 'banca_id'),
  col('resultados_banca', 'school_id', 'autoescola_id'),
  col('resultados_banca', 'category', 'categoria'),
  col('resultados_banca', 'total_slots', 'total_vagas'),
  col('resultados_banca', 'used_slots', 'vagas_usadas'),
  col('resultados_banca', 'approved', 'aprovados'),
  col('resultados_banca', 'failed', 'reprovados'),
  col('resultados_banca', 'absent', 'ausentes'),
  col('resultados_banca', 'cancelled', 'cancelados'),
  col('resultados_banca', 'created_at', 'criado_em'),
  col('resultados_banca', 'updated_at', 'atualizado_em'),
  // migracoes_schema
  col('migracoes_schema', 'version', 'versao'),
  col('migracoes_schema', 'applied_at', 'aplicado_em'),
];

export const PT_SCHEMA_DO_BLOCK = `
DO $ptmig$
BEGIN
  -- Renomear tabelas (cada uma protegida: alvo já existente não aborta o bloco)
  ${tableRenames.join('\n  ')}

  -- Recriar índice único de backups com coluna renomeada
  BEGIN
    DROP INDEX IF EXISTS backups_auto_daily;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Renomear colunas
  ${colRenames.join('\n  ')}

  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $ptmig$;
`;

// Verificação de 6 objetos-chave — retorna uma linha com c1..c6 (1 ou NULL).
// O marcador só deve ser gravado se todos forem 1.
export const PT_SCHEMA_VERIFY_SQL = `
SELECT
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios'       AND column_name='perfil')           AS c1,
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessoes'        AND column_name='usuario_id')       AS c2,
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bancas'         AND column_name='examinadores_ids') AS c3,
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='configuracoes'  AND column_name='nome_orgao')       AS c4,
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='solicitacoes'   AND column_name='nome_candidato')   AS c5,
  (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='logs_auditoria' AND column_name='acao')             AS c6
`;

// Gravação do marcador (executar SOMENTE após a verificação passar).
export const PT_SCHEMA_MARKER_SQL = `
DO $ptmarker$
BEGIN
  CREATE TABLE IF NOT EXISTS migracoes_schema (versao text PRIMARY KEY, aplicado_em timestamp DEFAULT now());
  INSERT INTO migracoes_schema (versao) VALUES ('pt_schema_v1') ON CONFLICT DO NOTHING;
END $ptmarker$;
`;
