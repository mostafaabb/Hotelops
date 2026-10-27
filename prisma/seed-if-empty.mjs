/**
 * Seeds the database only when it is empty.
 *
 * Used by the Render build command so a fresh environment gets demo data
 * without wiping existing data on every subsequent deploy.
 */
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log(`[seed] Database already has ${userCount} user(s) - skipping seed.`);
    process.exit(0);
  }

  console.log('[seed] Database is empty - running seed...');
  const result = spawnSync(process.execPath, ['prisma/seed.mjs'], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`[seed] Seed script failed with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status ?? 1);
  }

  console.log('[seed] Seed completed.');
} catch (error) {
  console.error('[seed] Seed check failed:', error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
