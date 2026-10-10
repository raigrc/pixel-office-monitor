import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.env.local');
const key = 'PIXEL_OPENCODE_HISTORY_PROFILE';
function ensure(value) { if (!value) throw new Error('History enrollment check failed'); }
function fingerprint(env) {
  const directory = env.PIXEL_OPENCODE_DIRECTORY;
  ensure(typeof directory === 'string' && directory.length > 0);
  const normalized = /^[A-Za-z]:[\\/]/.test(directory) ? path.win32.normalize(directory).replace(/[\\/]+$/, '').toLowerCase() : path.posix.normalize(directory).replace(/\/+$/, '') || '/';
  return createHash('sha256').update(JSON.stringify(['pixel-opencode-history-v1', new URL(env.PIXEL_OPENCODE_URL).origin, normalized, env.PIXEL_OPENCODE_USERNAME ?? 'opencode', env.PIXEL_OPENCODE_PASSWORD || null, '1.18.35'])).digest('hex');
}
try {
  ensure(process.argv.length === 3 && ['--approve-plugin-free', '--self-test'].includes(process.argv[2]));
  if (process.argv[2] === '--self-test') {
    const env = { PIXEL_OPENCODE_URL: 'http://127.0.0.1:4097', PIXEL_OPENCODE_DIRECTORY: 'C:\\approved\\workspace', PIXEL_OPENCODE_PASSWORD: 'synthetic-password' };
    ensure(fingerprint(env) === fingerprint({ ...env, PIXEL_OPENCODE_DIRECTORY: 'c:\\APPROVED\\workspace\\' }));
    ensure(fingerprint(env) !== fingerprint({ ...env, PIXEL_OPENCODE_PASSWORD: 'another-synthetic' }));
    console.log('History enrollment self-test passed');
  } else {
    execFileSync('git', ['check-ignore', '--quiet', '--', '.env.local'], { cwd: root, stdio: 'ignore' });
    ensure(execFileSync('git', ['ls-files', '--', '.env.local'], { cwd: root, encoding: 'utf8' }).trim() === '');
    const stat = lstatSync(file); ensure(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    const original = readFileSync(file, 'utf8'); const env = parseEnv(original);
    ensure(!Object.values(env).some(value => /[\r\n]/.test(value)));
    const url = new URL(env.PIXEL_OPENCODE_URL);
    ensure(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '4097' && !url.username && !url.password && !url.search && !url.hash);
    const headers = { accept: 'application/json', authorization: `Basic ${Buffer.from(`${env.PIXEL_OPENCODE_USERNAME ?? 'opencode'}:${env.PIXEL_OPENCODE_PASSWORD ?? ''}`).toString('base64')}` };
    const response = await fetch(new URL('/global/health', url), { headers, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    ensure(response.ok); const health = await response.json(); ensure(health.healthy === true && health.version === '1.18.35');
    const profile = fingerprint(env); const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const exists = new RegExp(`^\\s*${key}\\s*=`, 'm').test(original);
    const updated = exists ? original.replace(new RegExp(`^\\s*${key}\\s*=.*$`, 'gm'), `${key}=${profile}`) : original + (original.endsWith('\n') ? '' : eol) + `${key}=${profile}${eol}`;
    ensure(readFileSync(file, 'utf8') === original); writeFileSync(file, updated);
    const parsed = parseEnv(readFileSync(file, 'utf8'));
    for (const [name, value] of Object.entries(env)) if (name !== key) ensure(parsed[name] === value);
    ensure(parsed[key] === profile);
    console.log(JSON.stringify({ historyConnectionEnrolled: true, keysChanged: [key], credentialsPrinted: false, pureAttestation: 'Explicit operator approval; health alone does not attest pure mode', processesChanged: false }));
  }
} catch { console.error('History enrollment failed. No credential values printed.'); process.exitCode = 2; }
