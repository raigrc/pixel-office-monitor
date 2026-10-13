import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keys = ['MONITOR_TOKEN', 'PIXEL_MONITOR_TOKEN', 'NEXT_PUBLIC_PIXEL_MONITOR_TOKEN'];
const file = path.join(root, '.env.local');
const args = process.argv.slice(2);

function replaceMonitorValues(text, token) {
  if (Object.values(parseEnv(text)).some(value => /[\r\n]/.test(value))) throw new Error('Multiline environment values are unsupported');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const found = new Set();
  const updated = lines.map(line => {
    const match = line.match(/^(\s*(?:export\s+)?)([A-Z_]+)\s*=/);
    if (!match || !keys.includes(match[2])) return line;
    found.add(match[2]);
    return `${match[1]}${match[2]}=${token}`;
  });
  for (const key of keys) if (!found.has(key)) updated.push(`${key}=${token}`);
  return updated.join(eol);
}

try {
assert(args.length === 1 && ['--apply', '--self-test', '--self-test-rejection'].includes(args[0]), 'Use --apply or --self-test');
if (args[0] === '--self-test-rejection') {
  replaceMonitorValues('OTHER_PASSWORD="synthetic-private-value\nMONITOR_TOKEN=interior\nend"\n', 'synthetic-new');
  throw new Error('Expected multiline rejection');
} else if (args[0] === '--self-test') {
  const result = replaceMonitorValues('# keep\r\nMONITOR_TOKEN=old\r\nOTHER_VALUE=keep\r\nMONITOR_TOKEN=duplicate\r\n', 'synthetic-new');
  const parsed = parseEnv(result);
  assert.equal(parsed.OTHER_VALUE, 'keep');
  assert(result.startsWith('# keep\r\n'));
  assert(!result.includes('old') && !result.includes('duplicate'));
  for (const key of keys) assert.equal(parsed[key], 'synthetic-new');
  const rejected = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--self-test-rejection'], { encoding: 'utf8' });
  assert.equal(rejected.status, 2);
  assert.equal(rejected.stderr.trim(), 'Monitor rotation failed. No credential values printed.');
  assert(!`${rejected.stdout}${rejected.stderr}`.includes('synthetic-private-value'));
  assert(!`${rejected.stdout}${rejected.stderr}`.includes('synthetic-new'));
  console.log('Monitor rotation self-test passed');
} else {
  assert(existsSync(file), 'Local environment file required');
  const stat = lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Regular unlinked local environment file required');
  execFileSync('git', ['check-ignore', '--quiet', '--', '.env.local'], { cwd: root, stdio: 'ignore' });
  assert.equal(execFileSync('git', ['ls-files', '--', '.env.local'], { cwd: root, encoding: 'utf8' }).trim(), '', 'Environment file must remain untracked');
  const original = readFileSync(file, 'utf8');
  const previous = parseEnv(original);
  const token = randomBytes(32).toString('base64url');
  const updated = replaceMonitorValues(original, token);
  const next = parseEnv(updated);
  for (const [key, value] of Object.entries(previous)) if (!keys.includes(key)) assert(next[key] === value, 'Other configuration must be preserved');
  for (const key of keys) assert(next[key] === token, 'Monitor configuration mismatch');
  assert(readFileSync(file, 'utf8') === original, 'Environment changed during rotation');
  writeFileSync(file, updated, { mode: 0o600 });
  for (const key of keys) assert(parseEnv(readFileSync(file, 'utf8'))[key] === token, 'Monitor configuration mismatch');
  const output = path.join(root, 'Temp/opencode/log-security');
  mkdirSync(output, { recursive: true });
  const report = { rotatedAt: new Date().toISOString(), keys, previousFingerprints: [...new Set(keys.map(key => previous[key]).filter(Boolean))].map(value => createHash('sha256').update(value).digest('hex')), configRotated: true, runningProcessesRestarted: false, activationRequiresOwnerRestart: true };
  writeFileSync(path.join(output, 'monitor-rotation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ configRotated: true, keysUpdated: keys.length, activationRequiresOwnerRestart: true }));
}
} catch {
  console.error('Monitor rotation failed. No credential values printed.');
  process.exitCode = 2;
}
