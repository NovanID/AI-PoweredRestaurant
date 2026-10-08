import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('PostgreSQL Docker Compose service is configured for local Prisma database', async () => {
  const compose = await readFile('docker-compose.yml', 'utf8');

  assert.match(compose, /postgres:/);
  assert.match(compose, /POSTGRES_DB:\s*raso_minang/);
  assert.match(compose, /POSTGRES_USER:\s*raso_minang/);
  assert.match(compose, /55432:5432/);
  assert.match(compose, /pg_isready/);
});

test('package scripts expose Docker and Prisma workflow commands', async () => {
  const pkg = await readJson('package.json');

  assert.equal(pkg.dependencies['@prisma/client'], '6.19.3');
  assert.equal(pkg.devDependencies.prisma, '6.19.3');
  assert.equal(pkg.scripts['db:up'], 'docker compose up -d postgres');
  assert.equal(pkg.scripts['db:down'], 'docker compose down');
  assert.equal(pkg.scripts['db:push'], 'prisma db push');
  assert.equal(pkg.scripts['prisma:generate'], 'prisma generate');
  assert.equal(pkg.scripts['db:health'], 'node scripts/check-db-health.mjs');
});

test('environment example documents PostgreSQL connection URL', async () => {
  const envExample = await readFile('.env.example', 'utf8');

  assert.match(envExample, /DATABASE_URL="postgresql:\/\/raso_minang:raso_minang_password@127\.0\.0\.1:55432\/raso_minang\?schema=public"/);
});

test('Prisma singleton and DB health route are present', async () => {
  const prismaClient = await readFile('lib/prisma.ts', 'utf8');
  const healthRoute = await readFile('app/api/db/health/route.ts', 'utf8');

  assert.match(prismaClient, /new PrismaClient/);
  assert.match(healthRoute, /SELECT 1/);
  assert.match(healthRoute, /database/);
});
