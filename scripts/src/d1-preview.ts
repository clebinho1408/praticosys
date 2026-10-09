import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { root } from './d1-runtime.js';
const marker = path.join(root, '.local/d1-preview-enabled');
if (process.argv.includes('--disable')) {
  await rm(marker, { force: true });
  process.stdout.write('D1 preview disabled. Restart the managed API workflow; its original Neon startup may run existing migrations.\n');
} else {
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, 'local-only synthetic D1\n');
  process.stdout.write('D1 preview selected. Restart the managed API workflow. Production remains unchanged.\n');
}
