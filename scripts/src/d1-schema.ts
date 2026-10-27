import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './d1-runtime.js';
// @ts-ignore Shared migration definitions.
import { initialD1Statements, d1Checksum, D1_VERSION } from '../../db/d1-schema.js';
// @ts-ignore Shared versioned feature migration.
import { CPF_D1_STATEMENTS, CPF_D1_VERSION, cpfD1Checksum } from '../../db/cpf-migration.js';
const dir = path.join(root, 'generated-artifacts/d1');
await mkdir(dir, { recursive: true });
const checksum = await d1Checksum();
const sql = initialD1Statements().map(s => s + ';').join('\n\n') +
  `\n\nINSERT INTO migracoes_d1 (versao, checksum, aplicado_em) VALUES ('${D1_VERSION}', '${checksum}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT (versao) DO NOTHING;\n`;
await writeFile(path.join(dir, '0001_initial.sql'), sql);
await writeFile(path.join(dir, '0002_cpf_autofill.sql'), CPF_D1_STATEMENTS.map(s => s + ';').join('\n\n')
  + `\nINSERT INTO migracoes_d1 VALUES ('${CPF_D1_VERSION}', '${await cpfD1Checksum()}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));\n`);
process.stdout.write(`D1 migration generated: ${initialD1Statements().length} statements; sha256=${checksum}; no database was changed.\n`);
