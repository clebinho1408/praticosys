/** Edição de pedidos pendentes: não pode agendar, confirmar ou mover de módulo. */
export function canEditExtra(role: string | undefined): boolean {
  return ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role ?? '');
}

const editable = ['requestType', 'intendedCategory', 'categoryQuantities', 'observation'] as const;

export function extraEditError(current: any, module: string, role: string | undefined, body: any):
  { status: number; error: string } | null {
  if (!canEditExtra(role)) return { status: 403, error: 'Acesso negado.' };
  if (!current || module !== 'CFC' || current.examType === 'PCD' ||
      ['PCD', 'CNH_BRASIL'].includes(current.schoolId) ||
      current.status !== 'WAITING_SCHEDULING' || current.attendanceConfirmed) {
    return { status: 409, error: 'Este pedido não está mais na fila de provas extras. Atualize a lista.' };
  }
  const fail = (error: string) => ({ status: 400, error });
  if (Object.keys(body).some(key => !['id', 'extraEdit', 'examGroup', ...editable].includes(key))) {
    return fail('Esta edição permite somente Tipo, Exame, Qtd. por Cat. e Observações.');
  }
  if (!['FIXA', 'EXTRA', 'REPOSICAO'].includes(body.requestType)) return fail('Selecione um tipo válido.');
  if (typeof body.intendedCategory !== 'string') return fail('Selecione ao menos uma categoria.');
  const cats: string[] = body.intendedCategory.split(',');
  if (!cats.length || new Set(cats).size !== cats.length || cats.some(c => !['A', 'B', 'C', 'D', 'E'].includes(c))) {
    return fail('Selecione categorias válidas para o exame.');
  }
  const hab = cats.some(c => ['A', 'B'].includes(c));
  const mud = cats.some(c => ['C', 'D', 'E'].includes(c));
  const group = hab && mud ? 'MISTO' : mud ? 'MUD_CAT' : '1HAB';
  if (body.examGroup !== group) return fail('As categorias não correspondem ao exame selecionado.');
  const quantities = body.categoryQuantities;
  if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities) ||
      Object.keys(quantities).length !== cats.length ||
      cats.some(cat => !Object.hasOwn(quantities, cat) || !Number.isSafeInteger(quantities[cat]) || quantities[cat] < 1)) {
    return fail('Informe uma quantidade inteira maior que zero para cada categoria selecionada.');
  }
  if (typeof body.observation !== 'string') return fail('Observações inválidas.');
  return null;
}

export function extraPatch(body: any): any {
  return Object.fromEntries(editable.map(key => [key, body[key]]));
}
