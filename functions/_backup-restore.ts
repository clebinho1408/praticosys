import { getTableColumns, sql } from 'drizzle-orm';

type BackupRow = Record<string, unknown>;
export type BackupPayload = Record<string, unknown>;

export const RESTORE_TABLES = [
  'autoescolas',
  'examinadores',
  'instrutores',
  'veiculos',
  'cidades',
  'bancas',
  'solicitacoes',
  'solicitacoes_cnhbrasil',
  'solicitacoes_cfc',
  'solicitacoes_pcd',
  'vagas_banca',
  'vagas_cfc',
  'vagas_pcd',
  'resultados_banca',
  'locais_exame',
  'datas_bloqueadas',
  'configuracoes',
  'usuarios',
] as const;

type RestoreTable = (typeof RESTORE_TABLES)[number];

const TABLE_ALIASES: Record<string, RestoreTable> = {
  autoescolas: 'autoescolas',
  driving_schools: 'autoescolas',
  examinadores: 'examinadores',
  examiners: 'examinadores',
  instrutores: 'instrutores',
  instructors: 'instrutores',
  veiculos: 'veiculos',
  vehicles: 'veiculos',
  cidades: 'cidades',
  cities: 'cidades',
  bancas: 'bancas',
  exam_schedules: 'bancas',
  solicitacoes: 'solicitacoes',
  exam_requests: 'solicitacoes',
  solicitacoes_cnhbrasil: 'solicitacoes_cnhbrasil',
  cnhbrasil_requests: 'solicitacoes_cnhbrasil',
  exam_requests_cnh_brasil: 'solicitacoes_cnhbrasil',
  solicitacoes_cfc: 'solicitacoes_cfc',
  cfc_requests: 'solicitacoes_cfc',
  exam_requests_cfc: 'solicitacoes_cfc',
  solicitacoes_pcd: 'solicitacoes_pcd',
  pcd_requests: 'solicitacoes_pcd',
  exam_requests_pcd: 'solicitacoes_pcd',
  vagas_banca: 'vagas_banca',
  exam_schedule_slots: 'vagas_banca',
  vagas_cfc: 'vagas_cfc',
  cfc_schedule_slots: 'vagas_cfc',
  vagas_pcd: 'vagas_pcd',
  pcd_schedule_slots: 'vagas_pcd',
  resultados_banca: 'resultados_banca',
  banca_results: 'resultados_banca',
  locais_exame: 'locais_exame',
  exam_locations: 'locais_exame',
  datas_bloqueadas: 'datas_bloqueadas',
  blocked_dates: 'datas_bloqueadas',
  configuracoes: 'configuracoes',
  system_settings: 'configuracoes',
  usuarios: 'usuarios',
  users: 'usuarios',
};

const COMMON_REQUEST_COLUMNS = [
  'id', 'nome_candidato', 'nome_social', 'cpf', 'telefone', 'email', 'endereco',
  'cidade', 'tipo_solicitacao', 'tipo_exame', 'categoria_pretendida', 'origem',
  'autoescola_id', 'taxa_paga_bool', 'curso_pratico_concluido', 'horas_praticas',
  'tem_veiculo', 'restricao_cnh', 'instrutor', 'placa_veiculo', 'sem_duplo_comando',
  'checklist_veiculo', 'curso_pratico_inserido', 'taxa_paga', 'tipo_deficiencia',
  'necessidades_especiais', 'status', 'resultado', 'banca_id', 'data_agendada',
  'hora_agendada', 'categoria_agendada', 'examinador_id', 'presenca_confirmada',
  'motivo_cancelamento', 'observacao', 'quantidades_categoria', 'historico_exames',
  'modulo', 'cor_linha', 'criado_em', 'atualizado_em', 'fila_atualizado_em',
  'agendado_por',
];

const COMMON_SLOT_COLUMNS = [
  'id', 'autoescola_id', 'tipo_exame', 'tipo_solicitacao', 'categoria_pretendida',
  'data_agendada', 'hora_agendada', 'examinador_id', 'banca_id', 'categoria_agendada',
  'status', 'presenca_confirmada', 'motivo_cancelamento', 'observacao',
  'criado_em', 'atualizado_em',
];

const TABLE_COLUMNS: Record<RestoreTable, string[]> = {
  autoescolas: [
    'id', 'nome', 'telefone', 'email', 'endereco', 'cidade', 'servicos',
    'endereco_patio_moto', 'endereco_patio_carro', 'endereco_patio_mudanca',
    'banca_principal', 'banca_provisoria', 'criado_em',
  ],
  examinadores: [
    'id', 'nome', 'matricula', 'pode_examinar_comum', 'pode_examinar_pcd',
    'categorias', 'max_vagas_a_padrao', 'max_vagas_b_padrao',
    'max_vagas_mudanca_padrao', 'criado_em',
  ],
  instrutores: ['id', 'nome', 'cpf', 'telefone', 'categoria', 'placa', 'criado_em'],
  veiculos: [
    'id', 'instrutor_id', 'tipo', 'marca', 'modelo', 'placa', 'ativo', 'transmissao',
    'acessorios', 'duplo_comando', 'procuracao', 'criado_em',
  ],
  cidades: ['id', 'nome', 'criado_em'],
  bancas: [
    'id', 'codigo', 'data', 'hora', 'examinadores_ids', 'max_vagas_a', 'max_vagas_b',
    'tipo', 'status', 'motivo_cancelamento', 'local_id', 'criado_em',
  ],
  solicitacoes: COMMON_REQUEST_COLUMNS,
  solicitacoes_cnhbrasil: COMMON_REQUEST_COLUMNS.filter(
    (column) => !['tipo_deficiencia', 'necessidades_especiais', 'quantidades_categoria'].includes(column),
  ),
  solicitacoes_cfc: COMMON_REQUEST_COLUMNS.filter(
    (column) => !['tipo_deficiencia', 'necessidades_especiais'].includes(column),
  ),
  solicitacoes_pcd: COMMON_REQUEST_COLUMNS.filter(
    (column) => !['sem_duplo_comando', 'quantidades_categoria'].includes(column),
  ),
  vagas_banca: COMMON_SLOT_COLUMNS,
  vagas_cfc: COMMON_SLOT_COLUMNS,
  vagas_pcd: COMMON_SLOT_COLUMNS,
  resultados_banca: [
    'id', 'banca_id', 'autoescola_id', 'categoria', 'total_vagas', 'vagas_usadas',
    'aprovados', 'reprovados', 'ausentes', 'cancelados', 'modulo', 'criado_em',
    'atualizado_em',
  ],
  locais_exame: ['id', 'cidade_id', 'endereco', 'url_maps', 'regioes_atendidas', 'criado_em'],
  datas_bloqueadas: ['id', 'data', 'descricao', 'feriado', 'criado_em'],
  configuracoes: [
    'id', 'nome_orgao', 'endereco_orgao', 'url_logo', 'modo_manutencao',
    'min_dias_agendamento', 'max_vagas_diarias', 'max_vagas_a_padrao',
    'max_vagas_b_padrao', 'max_vagas_mudanca_padrao', 'template_whatsapp',
    'template_whatsapp_cfc', 'endereco_exame_padrao', 'link_exame_padrao',
    'restricoes', 'nome_exame_pcd', 'endereco_exame_pcd_padrao',
    'link_exame_pcd_padrao', 'banca_principal_pcd', 'banca_principal_cnh_brasil',
    'bloquear_fins_semana', 'chave_area_risco',
  ],
  usuarios: [
    'id', 'nome', 'login', 'senha', 'perfil', 'autoescola_id', 'examinador_id',
    'instrutor_id', 'email', 'telefone', 'dois_fatores_ativo', 'forcar_troca_senha',
    'modulos_permitidos', 'locais_permitidos_ids', 'criado_em',
  ],
};

const COLUMN_ALIASES: Record<RestoreTable, Record<string, string>> = {
  autoescolas: {
    name: 'nome', phone: 'telefone', address: 'endereco', city: 'cidade',
    services: 'servicos', moto_yard_address: 'endereco_patio_moto',
    car_yard_address: 'endereco_patio_carro',
    category_change_yard_address: 'endereco_patio_mudanca',
    main_schedule: 'banca_principal', provisional_schedule: 'banca_provisoria',
    created_at: 'criado_em',
  },
  examinadores: {
    name: 'nome', registration_number: 'matricula', can_exam_common: 'pode_examinar_comum',
    can_exam_pcd: 'pode_examinar_pcd', categories: 'categorias',
    default_max_slots_a: 'max_vagas_a_padrao', default_max_slots_b: 'max_vagas_b_padrao',
    default_max_slots_mudanca: 'max_vagas_mudanca_padrao', created_at: 'criado_em',
  },
  instrutores: {
    name: 'nome', phone: 'telefone', category: 'categoria', plate: 'placa',
    created_at: 'criado_em',
  },
  veiculos: {
    instructor_id: 'instrutor_id', type: 'tipo', brand: 'marca', model: 'modelo',
    plate: 'placa', active: 'ativo', transmission: 'transmissao',
    accessories: 'acessorios', created_at: 'criado_em',
  },
  cidades: { name: 'nome', created_at: 'criado_em' },
  bancas: {
    code: 'codigo', date: 'data', time: 'hora', examiner_ids: 'examinadores_ids',
    max_slots_a: 'max_vagas_a', max_slots_b: 'max_vagas_b',
    cancellation_reason: 'motivo_cancelamento', location_id: 'local_id',
    created_at: 'criado_em',
  },
  solicitacoes: {},
  solicitacoes_cnhbrasil: {},
  solicitacoes_cfc: {},
  solicitacoes_pcd: {},
  vagas_banca: {},
  vagas_cfc: {},
  vagas_pcd: {},
  resultados_banca: {
    schedule_id: 'banca_id', school_id: 'autoescola_id', category: 'categoria',
    total_slots: 'total_vagas', used_slots: 'vagas_usadas', approved: 'aprovados',
    failed: 'reprovados', absent: 'ausentes', cancelled: 'cancelados',
    created_at: 'criado_em', updated_at: 'atualizado_em',
  },
  locais_exame: {
    city_id: 'cidade_id', address: 'endereco', maps_url: 'url_maps',
    regions_served: 'regioes_atendidas', created_at: 'criado_em',
  },
  datas_bloqueadas: {
    date: 'data', description: 'descricao', is_holiday: 'feriado',
    created_at: 'criado_em',
  },
  configuracoes: {
    agency_name: 'nome_orgao', agency_address: 'endereco_orgao', logo_url: 'url_logo',
    maintenance_mode: 'modo_manutencao', min_days_scheduling: 'min_dias_agendamento',
    max_daily_slots: 'max_vagas_diarias', default_max_slots_a: 'max_vagas_a_padrao',
    default_max_slots_b: 'max_vagas_b_padrao',
    default_max_slots_mudanca: 'max_vagas_mudanca_padrao',
    whatsapp_message_template: 'template_whatsapp', whatsapp_template: 'template_whatsapp',
    cfc_whatsapp_template: 'template_whatsapp_cfc',
    default_exam_address: 'endereco_exame_padrao',
    default_exam_address_link: 'link_exame_padrao', restrictions: 'restricoes',
    pcd_exam_name: 'nome_exame_pcd', pcd_default_exam_address: 'endereco_exame_pcd_padrao',
    pcd_default_exam_address_link: 'link_exame_pcd_padrao',
    pcd_main_schedule: 'banca_principal_pcd',
    cnh_brasil_main_schedule: 'banca_principal_cnh_brasil',
    block_weekends: 'bloquear_fins_semana', risk_area_key: 'chave_area_risco',
  },
  usuarios: {
    name: 'nome', password: 'senha', role: 'perfil', school_id: 'autoescola_id',
    examiner_id: 'examinador_id', instructor_id: 'instrutor_id',
    force_password_change: 'forcar_troca_senha', allowed_modules: 'modulos_permitidos',
    allowed_location_ids: 'locais_permitidos_ids', phone: 'telefone',
    two_factor_enabled: 'dois_fatores_ativo', created_at: 'criado_em',
  },
};

for (const table of ['solicitacoes', 'solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd'] as RestoreTable[]) {
  COLUMN_ALIASES[table] = {
    student_name: 'nome_candidato', social_name: 'nome_social', phone: 'telefone',
    address: 'endereco', city: 'cidade', request_type: 'tipo_solicitacao',
    exam_type: 'tipo_exame', intended_category: 'categoria_pretendida', source: 'origem',
    school_id: 'autoescola_id', paid_fee: 'taxa_paga_bool',
    completed_practical_course: 'curso_pratico_concluido', practical_hours: 'horas_praticas',
    has_vehicle: 'tem_veiculo', cnh_restriction: 'restricao_cnh', vehicle_plate: 'placa_veiculo',
    sem_duplo_comando: 'sem_duplo_comando', checklist_vehicle: 'checklist_veiculo',
    practical_course_inserted: 'curso_pratico_inserido', disability_type: 'tipo_deficiencia',
    special_needs: 'necessidades_especiais', schedule_id: 'banca_id',
    scheduled_date: 'data_agendada', scheduled_time: 'hora_agendada',
    scheduled_category: 'categoria_agendada', examiner_id: 'examinador_id',
    attendance_confirmed: 'presenca_confirmada', cancellation_reason: 'motivo_cancelamento',
    observation: 'observacao', exam_history: 'historico_exames',
    category_quantities: 'quantidades_categoria', row_color: 'cor_linha',
    created_at: 'criado_em', updated_at: 'atualizado_em',
    queue_updated_at: 'fila_atualizado_em', scheduled_by: 'agendado_por',
  };
}

for (const table of ['vagas_banca', 'vagas_cfc', 'vagas_pcd'] as RestoreTable[]) {
  COLUMN_ALIASES[table] = {
    school_id: 'autoescola_id', exam_type: 'tipo_exame', request_type: 'tipo_solicitacao',
    intended_category: 'categoria_pretendida', scheduled_date: 'data_agendada',
    scheduled_time: 'hora_agendada', examiner_id: 'examinador_id', schedule_id: 'banca_id',
    scheduled_category: 'categoria_agendada', attendance_confirmed: 'presenca_confirmada',
    cancellation_reason: 'motivo_cancelamento', created_at: 'criado_em',
    updated_at: 'atualizado_em',
  };
}

const JSON_COLUMNS = new Set([
  'servicos', 'banca_principal', 'banca_provisoria', 'categorias', 'acessorios',
  'examinadores_ids', 'quantidades_categoria', 'historico_exames', 'restricoes',
  'banca_principal_pcd', 'banca_principal_cnh_brasil', 'modulos_permitidos',
  'locais_permitidos_ids', 'regioes_atendidas',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRow(table: RestoreTable, value: unknown): BackupRow | null {
  if (!isObject(value)) return null;
  const allowed = new Set(TABLE_COLUMNS[table]);
  const row: BackupRow = {};
  for (const [sourceColumn, sourceValue] of Object.entries(value)) {
    const targetColumn = COLUMN_ALIASES[table][sourceColumn] ?? sourceColumn;
    if (allowed.has(targetColumn) && (row[targetColumn] === undefined || sourceColumn === targetColumn)) {
      row[targetColumn] = sourceValue;
    }
  }
  return row.id === undefined || row.id === null ? null : row;
}

/**
 * Accepts both snapshots made with English table/column names and current
 * snapshots made with Portuguese names. When both aliases exist, the current
 * Portuguese key wins because it is the most recent representation.
 */
export function normalizeBackupPayload(input: unknown): Record<RestoreTable, BackupRow[]> {
  const normalized = {} as Record<RestoreTable, BackupRow[]>;
  if (!isObject(input)) throw new Error('Arquivo de backup inválido: objeto esperado.');

  for (const [sourceTable, sourceRows] of Object.entries(input)) {
    const table = TABLE_ALIASES[sourceTable];
    if (!table || !Array.isArray(sourceRows)) continue;
    const rows = sourceRows
      .map((value) => normalizeRow(table, value))
      .filter((row): row is BackupRow => row !== null);
    normalized[table] = [...(normalized[table] ?? []), ...rows];
  }

  return normalized;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function valueSql(column: string, value: unknown) {
  if (value === undefined) return sql`NULL`;
  if (value === null) return sql`NULL`;
  if (JSON_COLUMNS.has(column) && typeof value === 'object') {
    return sql`${JSON.stringify(value)}::jsonb`;
  }
  return sql`${value}`;
}

async function restoreRows(db: any, normalized: Record<RestoreTable, BackupRow[]>) {
  const restored: Record<string, number> = {};
  for (const table of RESTORE_TABLES) {
    const rows = normalized[table] ?? [];
    if (rows.length === 0) continue;

    for (const row of rows) {
      const columns = TABLE_COLUMNS[table].filter((column) => row[column] !== undefined);
      if (!columns.includes('id')) continue;
      const quotedColumns = columns.map(quoteIdentifier).join(', ');
      const values = sql.join(columns.map((column) => valueSql(column, row[column])), sql`, `);
      const updates = columns
        .filter((column) => column !== 'id')
        .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
        .join(', ');
      const conflict = updates
        ? sql`ON CONFLICT ("id") DO UPDATE SET ${sql.raw(updates)}`
        : sql`ON CONFLICT ("id") DO NOTHING`;

      await db.execute(sql`
        INSERT INTO ${sql.raw(quoteIdentifier(table))} (${sql.raw(quotedColumns)})
        VALUES (${values})
        ${conflict}
      `);
      restored[table] = (restored[table] ?? 0) + 1;
    }
  }
  return restored;
}

function prepareRestore(input: unknown) {
  const normalized = normalizeBackupPayload(input);
  const source = isObject(input) ? Object.keys(input) : [];
  const hasEnglish = source.some((key) => !!TABLE_ALIASES[key] && key !== TABLE_ALIASES[key]);
  const hasPortuguese = source.some((key) => !!TABLE_ALIASES[key] && key === TABLE_ALIASES[key]);
  const format = hasEnglish && hasPortuguese ? 'mixed' : hasEnglish ? 'english' : hasPortuguese ? 'portuguese' : 'unknown';
  return { normalized, format } as const;
}

function restoreCounts(normalized: Record<RestoreTable, BackupRow[]>) {
  return Object.fromEntries(
    RESTORE_TABLES
      .map((table) => [table, normalized[table]?.length ?? 0] as const)
      .filter(([, count]) => count > 0),
  );
}

function toDrizzleValue(columnName: string, value: unknown) {
  if (
    value !== null
    && typeof value === 'string'
    && ['criado_em', 'atualizado_em', 'fila_atualizado_em'].includes(columnName)
  ) {
    return new Date(value);
  }
  return value;
}

async function restoreWithBatch(
  db: any,
  normalized: Record<RestoreTable, BackupRow[]>,
  schemaTables: Partial<Record<RestoreTable, any>>,
) {
  const queries: any[] = [];
  for (const tableName of RESTORE_TABLES) {
    const table = schemaTables[tableName];
    if (!table) continue;
    const columns = getTableColumns(table) as Record<string, any>;
    const propertyBySqlName = new Map(
      Object.entries(columns).map(([property, column]) => [column.name, property]),
    );
    const idProperty = propertyBySqlName.get('id');
    if (!idProperty) continue;

    for (const row of normalized[tableName] ?? []) {
      const values: Record<string, unknown> = {};
      for (const [sqlName, value] of Object.entries(row)) {
        const property = propertyBySqlName.get(sqlName);
        if (property) values[property] = toDrizzleValue(sqlName, value);
      }
      if (values[idProperty] === undefined || values[idProperty] === null) continue;
      const updates = { ...values };
      delete updates[idProperty];
      const insert = db.insert(table).values(values);
      queries.push(
        Object.keys(updates).length > 0
          ? insert.onConflictDoUpdate({ target: columns[idProperty], set: updates })
          : insert.onConflictDoNothing({ target: columns[idProperty] }),
      );
    }
  }
  if (queries.length > 0) await db.batch(queries as [any, ...any[]]);
}

export async function restoreBackup(
  db: any,
  input: unknown,
  options?: { batchTables?: Partial<Record<RestoreTable, any>> },
): Promise<{
  restored: Record<string, number>;
  format: 'english' | 'portuguese' | 'mixed' | 'unknown';
}> {
  const { normalized, format } = prepareRestore(input);
  if (options?.batchTables) {
    await restoreWithBatch(db, normalized, options.batchTables);
    return { restored: restoreCounts(normalized), format };
  }
  if (typeof db.transaction !== 'function') {
    throw new Error('O banco atual não oferece restauração transacional.');
  }
  const restored = await db.transaction(async (transaction: any) => restoreRows(transaction, normalized));

  return { restored, format };
}