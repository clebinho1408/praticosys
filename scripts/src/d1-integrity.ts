type Row = Record<string, unknown>;
export function integritySummary(tables: Record<string, Row[]>) {
  const references = [
    ['usuarios', 'autoescola_id', 'autoescolas'], ['usuarios', 'instrutor_id', 'instrutores'], ['usuarios', 'examinador_id', 'examinadores'],
    ['veiculos', 'instrutor_id', 'instrutores'], ['sessoes', 'usuario_id', 'usuarios'], ['sessions', 'user_id', 'usuarios'],
    ['codigos_otp', 'usuario_id', 'usuarios'], ['vagas_cfc', 'autoescola_id', 'autoescolas'], ['vagas_cfc', 'examinador_id', 'examinadores'],
    ['vagas_cfc', 'banca_id', 'bancas'], ['vagas_pcd', 'examinador_id', 'examinadores'], ['vagas_pcd', 'banca_id', 'bancas'],
    ...['solicitacoes', 'solicitacoes_cfc', 'solicitacoes_cnhbrasil', 'solicitacoes_pcd'].flatMap(t =>
      [['autoescola_id', 'autoescolas'], ['banca_id', 'bancas'], ['instrutor_id', 'instrutores'], ['veiculo_id', 'veiculos'], ['examinador_id', 'examinadores']]
        .map(([col, target]) => [t, col, target])),
  ];
  const orphans = Object.fromEntries(references.map(([table, column, target]) => {
    const ids = new Set((tables[target] ?? []).map(r => r.id));
    const linked = (tables[table] ?? []).map(r => r[column]).filter(id => id != null && id !== '' && !['PCD', 'CNH_BRASIL'].includes(String(id)));
    return [`${table}.${column}`, { linked: linked.length, orphaned: linked.filter(id => !ids.has(id)).length }];
  }));
  const distribution = Object.fromEntries(Object.entries(tables).filter(([t]) => /solicitacoes|vagas|bancas|resultados|logs/.test(t)).map(([t, rows]) =>
    [t, Object.fromEntries(['modulo', 'status', 'tipo_solicitacao'].map(column => {
      const counts: Record<string, number> = {};
      for (const row of rows) if (row[column] != null) counts[String(row[column])] = (counts[String(row[column])] ?? 0) + 1;
      return [column, counts];
    }))]));
  return { references: orphans, distribution };
}
