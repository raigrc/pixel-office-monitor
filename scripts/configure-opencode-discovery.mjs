import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants, closeSync, fstatSync, ftruncateSync, lstatSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.env.local');

function ensure(condition) {
  if (!condition) throw new Error('Configuration check failed');
}

function addMissing(text, desired) {
  const previous = parseEnv(text);
  ensure(!Object.values(previous).some(value => /[\r\n]/.test(value)));
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let updated = text.endsWith('\n') ? text : text + eol;
  const added = [];
  for (const [key, value] of Object.entries(desired)) {
    if (previous[key]) continue;
    ensure(!/[\r\n'"]/.test(value));
    const encoded = /[\s#]/.test(value) ? `'${value}'` : value;
    updated += `${key}=${encoded}${eol}`;
    added.push(key);
  }
  const parsed = parseEnv(updated);
  for (const [key, value] of Object.entries(previous)) if (value) ensure(parsed[key] === value);
  for (const [key, value] of Object.entries(desired)) ensure(parsed[key] === (previous[key] || value));
  return { updated, added };
}

try {
  ensure(process.argv.length === 3 && ['--apply', '--self-test'].includes(process.argv[2]));
  if (process.argv[2] === '--self-test') {
    const result = addMissing('MONITOR_TOKEN=synthetic-existing\r\nPIXEL_DISCOVERY_ORIGIN=http://127.0.0.1:3002\r\n', {
      PIXEL_DISCOVERY_ORIGIN: 'http://127.0.0.1:3001', PIXEL_OPENCODE_DIRECTORY: 'C:\\workspace with spaces',
    });
    ensure(parseEnv(result.updated).MONITOR_TOKEN === 'synthetic-existing');
    ensure(parseEnv(result.updated).PIXEL_DISCOVERY_ORIGIN === 'http://127.0.0.1:3002');
    ensure(parseEnv(result.updated).PIXEL_OPENCODE_DIRECTORY === 'C:\\workspace with spaces');
    ensure(addMissing(result.updated, { PIXEL_OPENCODE_DIRECTORY: 'different' }).added.length === 0);
    let multilineRejected = false;
    try { addMissing('OTHER_PASSWORD="first\nsecond"', {}); } catch { multilineRejected = true; }
    ensure(multilineRejected);
    console.log('Discovery configuration self-test passed');
  } else {
    execFileSync('git', ['check-ignore', '--quiet', '--', '.env.local'], { cwd: root, stdio: 'ignore' });
    ensure(execFileSync('git', ['ls-files', '--', '.env.local'], { cwd: root, encoding: 'utf8' }).trim() === '');
    const stat = lstatSync(file);
    ensure(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    const fd = openSync(file, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd);
      ensure(opened.dev === stat.dev && opened.ino === stat.ino);
      const original = readFileSync(fd, 'utf8');
      const result = addMissing(original, {
        PIXEL_DISCOVERY_ORIGIN: 'http://127.0.0.1:3001',
        PIXEL_DISCOVERY_ACCESS_SECRET: randomBytes(32).toString('base64url'),
        PIXEL_OPENCODE_URL: 'http://127.0.0.1:4097',
        PIXEL_OPENCODE_DIRECTORY: root,
        PIXEL_OPENCODE_USERNAME: 'opencode',
        PIXEL_OPENCODE_PASSWORD: randomBytes(32).toString('base64url'),
      });
      const bytes = Buffer.from(result.updated);
      let written = 0;
      while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written, written);
      ftruncateSync(fd, bytes.length);
      ensure(readFileSync(file, 'utf8') === result.updated);
      console.log(JSON.stringify({ keysAdded: result.added, credentialsPrinted: false, providerStarted: false, monitorRestarted: false, activationPending: true }));
    } finally { closeSync(fd); }
  }
} catch {
  console.error('Discovery configuration failed. No credential values printed.');
  process.exitCode = 2;
}
