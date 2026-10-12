import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const label = process.argv[2] ?? 'final';
if (!['baseline', 'final', 'discovery', 'history', 'delivery'].includes(label)) throw new Error('Use baseline, final, discovery, history or delivery');
const output = label === 'delivery' ? path.resolve('Temp/opencode/github-delivery/gates') : ['discovery', 'history'].includes(label) ? path.resolve(`Temp/opencode/${label}/gates`) : path.resolve('Temp/opencode/phase0', label);
const localEnv = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
mkdirSync(output, { recursive: true });
const isolatedConfig = path.resolve('Temp/opencode/verification.tsconfig.json');
if (!existsSync(isolatedConfig)) writeFileSync(isolatedConfig, JSON.stringify({ extends: '../../tsconfig.json', include: ['../../next-env.d.ts', '../../src/**/*.ts', '../../src/**/*.tsx', 'next-verification/types/**/*.ts'], exclude: ['../../node_modules', '../../src/**/__tests__/**', '../../tests/**', '../../vitest.config.*'] }, null, 2));
function productionBuildFingerprint() {
  const hash = createHash('sha256');
  for (const file of ['.next/BUILD_ID', '.next/build-manifest.json', '.next/app-build-manifest.json']) if (existsSync(file)) hash.update(file).update(readFileSync(file));
  return hash.digest('hex');
}
const checks = [
  ['status', 'git status --short'],
  ['branch', 'git branch --show-current'],
  ['commit', 'git log -1 --format=%H'],
  ['test', 'npm test'],
  ['bounded-test', 'npm test -- --maxWorkers=2'],
  ['lint', 'npm run lint'],
  ['build', 'npm run build'],
  ['typescript', 'npx tsc --noEmit'],
  ['log-self-test', 'node scripts/audit-logs.mjs --self-test'],
  ['rotation-self-test', 'node scripts/rotate-monitor-token.mjs --self-test'],
  ['auth-audit-self-test', 'node scripts/audit-monitor-connection.mjs --self-test'],
  ['auth-alignment-self-test', 'node scripts/align-monitor-producer.mjs --self-test'],
];
const selected = process.argv.slice(3);
assertCheckNames(selected);
const resultsPath = path.join(output, 'results.json');
const results = selected.length && existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')).results : [];
for (const [name, command] of checks.filter(([name]) => selected.length === 0 || selected.includes(name))) {
  const start = Date.now();
  const originalBuild = productionBuildFingerprint();
  const result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
    encoding: 'utf8', timeout: 600_000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...localEnv, FORCE_COLOR: '0', PIXEL_VERIFY_ISOLATED: '1' },
  });
  writeFileSync(path.join(output, `${name}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}\n` : ''}`);
  const record = { name, command, exitCode: result.status, signal: result.signal, elapsedMs: Date.now() - start, capturedAt: new Date().toISOString(), productionBuildPreserved: originalBuild === productionBuildFingerprint() };
  const previousIndex = results.findIndex(item => item.name === name);
  if (previousIndex >= 0) results[previousIndex] = record;
  else results.push(record);
  console.log(`${name}: exit ${result.status}, ${record.elapsedMs}ms`);
}
const complete = checks.every(([name]) => results.some(result => result.name === name && result.exitCode === 0 && result.productionBuildPreserved !== false));
writeFileSync(resultsPath, JSON.stringify({ capturedAt: new Date().toISOString(), complete, results }, null, 2));
if (!complete) process.exitCode = 1;

function assertCheckNames(names) {
  if (names.some(name => !checks.some(([known]) => known === name))) throw new Error('Unknown verification check');
}
