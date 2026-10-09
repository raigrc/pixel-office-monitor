import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const label = process.argv[2] ?? 'final';
if (!['baseline', 'final'].includes(label)) throw new Error('Use baseline or final');
const output = path.resolve('Temp/opencode/phase0', label);
mkdirSync(output, { recursive: true });
const checks = [
  ['status', 'git status --short'],
  ['branch', 'git branch --show-current'],
  ['commit', 'git log -1 --format=%H'],
  ['test', 'npm test'],
  ['bounded-test', 'npm test -- --maxWorkers=2'],
  ['lint', 'npm run lint'],
  ['build', 'npm run build'],
  ['typescript', 'npx tsc --noEmit'],
];
const selected = process.argv.slice(3);
assertCheckNames(selected);
const resultsPath = path.join(output, 'results.json');
const results = selected.length && existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')).results : [];
for (const [name, command] of checks.filter(([name]) => selected.length === 0 || selected.includes(name))) {
  const start = Date.now();
  const result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
    encoding: 'utf8', timeout: 600_000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  writeFileSync(path.join(output, `${name}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}\n` : ''}`);
  const record = { name, command, exitCode: result.status, signal: result.signal, elapsedMs: Date.now() - start, capturedAt: new Date().toISOString() };
  const previousIndex = results.findIndex(item => item.name === name);
  if (previousIndex >= 0) results[previousIndex] = record;
  else results.push(record);
  console.log(`${name}: exit ${result.status}, ${record.elapsedMs}ms`);
}
const complete = checks.every(([name]) => results.some(result => result.name === name && result.exitCode === 0));
writeFileSync(resultsPath, JSON.stringify({ capturedAt: new Date().toISOString(), complete, results }, null, 2));
if (!complete) process.exitCode = 1;

function assertCheckNames(names) {
  if (names.some(name => !checks.some(([known]) => known === name))) throw new Error('Unknown verification check');
}
