// This launcher never imports the application/database or forwards workspace secrets.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = await mkdtemp(path.join(tmpdir(), 'cpf-pg-'));
const data = path.join(directory, 'data');
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: directory,
  TMPDIR: directory,
  LANG: 'C',
  NODE_ENV: 'production',
  LOG_LEVEL: 'silent',
};
function command(binary: string, args: string[]) {
  const result = spawnSync(binary, args, { env, encoding: 'utf8', timeout: 30_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
}
let started = false;
try {
  command('initdb', ['-D', data, '-U', 'postgres', '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
  // Unix socket only: no TCP listener, no shared server, no inherited PG* settings.
  command('pg_ctl', ['-D', data, '-l', path.join(directory, 'postgres.log'),
    '-o', `-F -k ${directory} -c listen_addresses='' -c max_connections=40`, '-w', 'start']);
  started = true;
  command('createdb', ['-h', directory, '-U', 'postgres', 'cpf_test']);
  const databaseUrl = `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(directory)}`;
  const worker = fileURLToPath(new URL('./cpf-postgres.integration.ts', import.meta.url));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), worker], {
      env: { ...env, DATABASE_URL: databaseUrl, CPF_TEST_SOCKET: directory },
      stdio: 'inherit',
    });
    const timeout = setTimeout(() => { child.kill('SIGKILL'); }, 90_000);
    child.once('error', reject);
    child.once('exit', code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`CPF PostgreSQL integration failed (exit ${code}).`));
    });
  });
} finally {
  try {
    if (started) command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
