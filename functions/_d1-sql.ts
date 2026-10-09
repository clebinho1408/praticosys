import { d1Tables, D1_NOW } from '../db/d1-schema.js';

// Deliberately a small compatibility dialect for this app, not a PostgreSQL
// emulator. Never modify literals/quoted identifiers or interpolate user input.
const tokens = /'(?:''|[^'])*'|"(?: ""|""|[^"])*"|\$\d+|[a-z_][a-z_0-9]*|\s+|./gis;
export function translateD1Sql(source: string, params: unknown[]) {
  if (/\b(DO\s+\$|information_schema|INCLUDING\s+ALL|ILIKE|JSONB_SET)\b/i.test(source)) {
    throw new Error('SQL PostgreSQL não suportado no D1; use a migração ou uma consulta D1 explícita.');
  }
  // Drizzle Pg emits DEFAULT values for omitted columns. SQLite requires an
  // expression instead; defaults come from the same table metadata.
  const insert = /^\s*insert\s+into\s+"([^"]+)"\s*\(([^)]+)\)\s*values\s*/i.exec(source);
  if (insert) {
    const columns = [...insert[2].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const defaults = d1Tables[insert[1]];
    if (!defaults) throw new Error('Tabela D1 desconhecida.');
    const suffix = source.slice(insert[0].length);
    let level = 0, col = 0;
    source = insert[0] + (suffix.match(tokens) ?? []).map(token => {
      if (token === '(') { level++; if (level === 1) col = 0; }
      if (token === ')' && level > 0) level--;
      if (token === ',' && level === 1) col++;
      if (/^default$/i.test(token) && level === 1) {
        return defaults.find(c => c.name === columns[col])?.defaultSql ?? 'NULL';
      }
      return token;
    }).join('');
  }
  const pieces = source.match(tokens) ?? [];
  const bound: unknown[] = [];
  let output = '';
  for (let i = 0; i < pieces.length; i++) {
    const token = pieces[i];
    if (/^\$\d+$/.test(token)) {
      const value = params[Number(token.slice(1)) - 1];
      bound.push(value instanceof Date ? value.toISOString() : typeof value === 'boolean' ? Number(value) : value ?? null);
      output += '?';
    } else if (/^now$/i.test(token) && pieces[i + 1] === '(' && pieces[i + 2] === ')') {
      output += D1_NOW; i += 2;
    } else if (token === ':' && pieces[i + 1] === ':' && /^jsonb$/i.test(pieces[i + 2])) {
      i += 2;
    } else if (token === ':' && pieces[i + 1] === ':' && /^date$/i.test(pieces[i + 2])) {
      const identifier = /("[^"]+"|[a-z_][a-z_0-9]*)$/i.exec(output);
      if (!identifier) throw new Error('Conversão de data D1 não suportada.');
      output = output.slice(0, -identifier[0].length) + `date(${identifier[0]})`; i += 2;
    } else if (/^public$/i.test(token) && pieces[i + 1] === '.') {
      i++;
    } else {
      output += token;
    }
  }
  if (bound.length > 100 || new TextEncoder().encode(output).length > 100_000) {
    throw new Error('Consulta excede os limites D1 (100 parâmetros / 100 KB). Use um lote atômico.');
  }
  for (const value of bound) {
    if (typeof value === 'string' && new TextEncoder().encode(value).length > 1_900_000) {
      throw new Error('Valor excede o limite de registro D1. Divida o conteúdo antes de gravar.');
    }
  }
  return { sql: output, params: bound };
}

const kinds = new Map(Object.values(d1Tables).flatMap(cols => cols.map(c => [c.name, c.kind] as const)));
const aliases: Record<string, string> = {
  name: 'nome', role: 'perfil', force_password_change: 'forcar_troca_senha',
  allowed_modules: 'modulos_permitidos', allowed_location_ids: 'locais_permitidos_ids',
  two_factor_enabled: 'dois_fatores_ativo', payload: 'dados', details: 'detalhes',
};
export function decodeD1Row(row: Record<string, unknown>, arrayMode = false) {
  const entries = Object.entries(row).map(([key, value]) => {
    const kind = kinds.get(aliases[key] ?? key);
    if (value != null && kind === 'boolean') value = value === 1 || value === true;
    if (typeof value === 'string' && kind === 'json') value = JSON.parse(value);
    // PgTimestamp's mapper appends +0000. Only array mode is ORM-mapped.
    if (typeof value === 'string' && kind === 'timestamp' && arrayMode) value = value.replace(/Z$/, '');
    return [key, value] as const;
  });
  return arrayMode ? entries.map(([, v]) => v) : Object.fromEntries(entries);
}
