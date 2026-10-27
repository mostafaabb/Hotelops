/**
 * Generates the Prisma client when the Prisma CLI is available.
 *
 * Some hosts (Vercel) install production dependencies only, so the Prisma CLI
 * is absent there. The web app does not need Prisma, so skip quietly instead of
 * failing the whole install with "prisma: command not found".
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let prismaCli;
try {
  prismaCli = require.resolve('prisma/build/index.js');
} catch {
  console.log('[postinstall] Prisma CLI not installed - skipping prisma generate.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [prismaCli, 'generate'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
