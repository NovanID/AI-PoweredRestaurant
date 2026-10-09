import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectTestFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...collectTestFiles(fullPath));
    else if (entry.endsWith('.test.mts')) files.push(fullPath);
  }
  return files;
}

const args = process.argv.slice(2);
const explicitFiles = args
  .filter((arg) => arg.endsWith('.test.mts'))
  .map((arg) => resolve(arg));

const testFiles = explicitFiles.length > 0 ? explicitFiles : collectTestFiles(resolve('tests/ai'));
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
