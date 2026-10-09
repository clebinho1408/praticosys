import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const isolatedD1 = existsSync(fileURLToPath(new URL('../../.local/d1-preview-enabled', import.meta.url)));
const command = isolatedD1
  ? 'pnpm --filter @workspace/scripts run d1:dev'
  : 'pnpm run build && pnpm run start';
const child = spawn('sh', ['-c', command], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
