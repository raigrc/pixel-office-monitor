import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync, constants, existsSync, fstatSync, ftruncateSync, lstatSync,
  mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** @typedef {{file:string,line:number,kind:string,fingerprint:string,exposure:'full'|'truncated',configuredCredentialMatch:boolean}} Finding */
/** @typedef {{start:number,end:number,kind:string,value:string,exposure:'full'|'truncated',configuredCredentialMatch:boolean}} Span */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIRECTORY = 'Temp/opencode/log-security';
const EXCLUDED = new Set([
  '.git', 'node_modules', '.next', '.cache', '.turbo', '.vercel', '.yarn',
  '.opencode', '.claude', '.codex', '.gemini', 'graphify-out', '__pycache__',
  'plugins', 'externalplugins', 'external-plugins', 'provider-history',
  'history', 'sessions', 'transcripts', 'asset-backups',
]);
const MARKER = '[REDACTED]';
const PREFIX_RULES = [
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{12,}/g],
  ['openai-key', /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})/g],
  ['google-api-key', /\bAIza[A-Za-z0-9_-]{20,}/g],
  ['google-oauth-token', /\b(?:ya29\.[A-Za-z0-9_-]{16,}|GOCSPX-[A-Za-z0-9_-]{16,})/g],
  ['slack-token', /\b(?:xox[baprs]|xapp)-[A-Za-z0-9-]{12,}/g],
  ['aws-access-key-id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
];

function credentialName(name) {
  const normalized = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  return /(?:^|[_.-])(?:key|api[_-]?key|apikey|token|password|passwd|secret|credential|authorization|signature)(?:$|[_.-])/.test(normalized)
    && !/(?:count|usage|length|limit|expires|expiry|enabled|hash|path|file|type|name|version|index|tokens_per)/.test(normalized);
}

function category(name) {
  if (/monitor/i.test(name)) return 'monitor-token';
  if (/anthropic/i.test(name)) return 'anthropic-key';
  if (/openai/i.test(name)) return 'openai-key';
  if (/github|\bgh_/i.test(name)) return 'github-token';
  if (/google|gemini/i.test(name)) return 'google-api-key';
  if (/slack/i.test(name)) return 'slack-token';
  if (/aws/i.test(name)) return 'aws-credential';
  if (/password|passwd/i.test(name)) return 'password';
  return 'configured-credential';
}

function decoded(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function placeholder(value, allowNumeric = false) {
  const plain = decoded(value).replace(/(?:\.{3}|…).*$/, '');
  return !plain || (!allowNumeric && /^\d+$/.test(plain))
    || /^(?:\[REDACTED|<[^>]*>|\$\{|%[A-Z_]+%)/i.test(plain)
    || /^(?:null|undefined|none|true|false|redacted|masked|not[-_ ]?set|n\/a)$/i.test(plain)
    || /^(?:dev[-_]token|test[-_]token|changeme|change[-_]me|replace[-_]me)$/i.test(plain)
    || /^(?:(?:sk-(?:proj-|svcacct-|ant-(?:api03-)?)?|gh[pousr]_|github_pat_|AIza|xox[baprs]-))?(?:your[-_]|example|dummy|placeholder|replace[-_]me)/i.test(plain)
    || /^(?:sk-(?:proj-|ant-)?|gh[pousr]_|AIza|xox[baprs]-)?[xX*?._-]+$/.test(plain)
    || /^(?:[A-Z]:[\\/]|\.{1,2}[\\/]|\/(?:[^/\s]+\/)+)/i.test(plain)
    || /^(?:sha(?:1|256|512):)[a-f0-9]+$/i.test(plain);
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

function configuredCredentials(text) {
  return Object.entries(parseEnv(text))
    .filter(([name, value]) => credentialName(name) && value.length >= 4 && !placeholder(value, true))
    .map(([name, value]) => ({ value, kind: category(name) }));
}

function scan(text, file, credentials = []) {
  /** @type {Span[]} */
  const candidates = [];
  function add(start, value, kind, forceExposure) {
    const exposure = forceExposure ?? (/(?:\.{3}|…|%E2%80%A6)$/i.test(value) || /^(?:\.{3}|…)/.test(text.slice(start + value.length)) ? 'truncated' : 'full');
    const comparable = decoded(value).replace(/(?:\.{3}|…)$/, '');
    const configured = credentials.find(item => exposure === 'full'
      ? comparable === item.value
      : comparable.length >= 6 && comparable.length < item.value.length && item.value.startsWith(comparable));
    if (!configured && placeholder(value, kind === 'plugin-token' && exposure === 'truncated')) return;
    candidates.push({ start, end: start + value.length, value, exposure,
      kind: configured ? `configured-${configured.kind}` : kind,
      configuredCredentialMatch: Boolean(configured) });
  }
  for (const credential of credentials) {
    for (const value of new Set([credential.value, encodeURIComponent(credential.value)])) {
      let start = text.indexOf(value);
      while (start !== -1) {
        add(start, value, `configured-${credential.kind}`, 'full');
        start = text.indexOf(value, start + value.length);
      }
    }
  }
  for (const [kind, regex] of PREFIX_RULES) {
    for (const match of text.matchAll(regex)) add(match.index, match[0], kind);
  }
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const [header, payload] = match[0].split('.').slice(0, 2).map(value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
      if (header && typeof header.alg === 'string' && payload && typeof payload === 'object') add(match.index, match[0], 'jwt');
    } catch {}
  }
  for (const match of text.matchAll(/-----BEGIN ((?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g)) {
    const body = match[0].split('\n').slice(1, -1).join('').trim();
    if (/[A-Za-z0-9+/=]{12,}/.test(body) && !placeholder(body)) add(match.index, match[0], 'private-key', 'full');
  }
  for (const match of text.matchAll(/-----BEGIN (?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]{12,}\r?\n?)+/g)) {
    add(match.index, match[0], 'private-key-partial', 'truncated');
  }
  for (const match of text.matchAll(/\b(?:Authorization|Proxy-Authorization)["']?\s*[:=]\s*["']?(?:Bearer|Basic|Token)\s+([^\s"',;}\]\r\n]+)/gi)) {
    add(match.index + match[0].lastIndexOf(match[1]), match[1], 'authorization');
  }
  for (const match of text.matchAll(/\bBearer\s+([A-Za-z0-9._~+/%=-]{4,})/gi)) {
    add(match.index + match[0].lastIndexOf(match[1]), match[1], 'bearer-token');
  }
  for (const match of text.matchAll(/[?&]([A-Za-z0-9_.%+-]+)=([^&#\s"'<>]+)/g)) {
    if (credentialName(decoded(match[1]))) add(match.index + match[0].lastIndexOf(match[2]), match[2], 'credential-url-query');
  }
  for (const match of text.matchAll(/\b([A-Za-z][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s,&;}\]\r\n]+))/gd)) {
    if (!credentialName(match[1])) continue;
    const value = match[2] ?? match[3] ?? match[4];
    if (value.length < 4 || /^[{[]/.test(value) || /^(?:Bearer|Basic|Token)(?:\s|$)/i.test(value)) continue;
    const group = match[2] !== undefined ? 2 : match[3] !== undefined ? 3 : 4;
    add(match.indices[group][0], value, 'credential-assignment');
  }
  for (const match of text.matchAll(/\bUsing token:\s*["']?([^\s"',;}\]\r\n]+)/gi)) {
    if (match[1].length >= 4) add(match.index + match[0].lastIndexOf(match[1]), match[1], 'plugin-token');
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end || Number(b.configuredCredentialMatch) - Number(a.configuredCredentialMatch));
  /** @type {Span[]} */
  const spans = [];
  for (const candidate of candidates) {
    const previous = spans.at(-1);
    if (!previous || candidate.start >= previous.end) spans.push({ ...candidate });
    else {
      previous.end = Math.max(previous.end, candidate.end);
      if (candidate.configuredCredentialMatch && !previous.configuredCredentialMatch) {
        previous.kind = candidate.kind;
        previous.configuredCredentialMatch = true;
        previous.exposure = candidate.exposure;
      }
      previous.value = text.slice(previous.start, previous.end);
    }
  }
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  /** @type {Finding[]} */
  const findings = spans.map(span => {
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= span.start) low = mid; else high = mid;
    }
    return { file, line: low + 1, kind: span.kind, fingerprint: fingerprint(span.value),
      exposure: span.exposure, configuredCredentialMatch: span.configuredCredentialMatch };
  });
  let sanitized = '', cursor = 0;
  for (const span of spans) {
    sanitized += text.slice(cursor, span.start) + MARKER + span.value.replace(/[^\r\n]/g, '');
    cursor = span.end;
  }
  return { findings, sanitized: sanitized + text.slice(cursor) };
}

function insideRoot(relative) {
  return relative !== '' && !path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..');
}

function guardedPath(relative, allowExcluded = false) {
  if (!insideRoot(relative)) throw new Error('unsafe-path');
  let current = ROOT;
  for (const part of relative.split(/[\\/]/)) {
    if (!allowExcluded && EXCLUDED.has(part.toLowerCase())) throw new Error('excluded-path');
    current = path.join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('symlink-refused');
  }
  const resolved = path.relative(ROOT, realpathSync(current));
  if (!insideRoot(resolved)) throw new Error('outside-root');
  return current;
}

function retainedLogs() {
  const logs = [], skipped = [];
  function visit(relative) {
    const directory = relative ? guardedPath(relative) : ROOT;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (EXCLUDED.has(entry.name.toLowerCase())) continue;
      if (entry.isSymbolicLink()) { skipped.push({ file: name, reason: 'symlink-refused' }); continue; }
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile() && /\.log$/i.test(entry.name)) logs.push(name);
    }
  }
  visit('');
  return { logs: logs.sort(), skipped };
}

function safeRead(relative) {
  const file = guardedPath(relative);
  const before = lstatSync(file);
  if (!before.isFile() || before.nlink !== 1) throw new Error('nonregular-or-hardlink-refused');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (before.dev !== opened.dev || before.ino !== opened.ino) throw new Error('file-changed');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

function rewriteLog(relative, original, replacement) {
  if (!/\.log$/i.test(relative)) throw new Error('non-log-write-refused');
  const file = guardedPath(relative);
  const before = lstatSync(file);
  if (!before.isFile() || before.nlink !== 1) throw new Error('nonregular-or-hardlink-refused');
  const fd = openSync(file, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (before.dev !== opened.dev || before.ino !== opened.ino || !descriptorBytes(fd).equals(original)) throw new Error('file-changed');
    guardedPath(relative);
    const bytes = Buffer.from(replacement, 'utf8');
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written, written);
    ftruncateSync(fd, bytes.length);
    if (!descriptorBytes(fd).equals(bytes)) throw new Error('write-verification-failed');
  } finally { closeSync(fd); }
}

function descriptorBytes(fd) {
  const bytes = Buffer.alloc(fstatSync(fd).size);
  let read = 0;
  while (read < bytes.length) {
    const count = readSync(fd, bytes, read, bytes.length - read, read);
    if (count === 0) throw new Error('file-changed');
    read += count;
  }
  return bytes;
}

function reportFile(mode, report) {
  const name = `${REPORT_DIRECTORY}/${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.json`;
  execFileSync('git', ['check-ignore', '--quiet', '--', name], { cwd: ROOT, stdio: 'ignore' });
  let relative = '';
  for (const part of REPORT_DIRECTORY.split('/')) {
    relative = path.posix.join(relative, part);
    const parent = path.dirname(relative);
    if (parent !== '.') guardedPath(parent);
    if (!existsSync(path.join(ROOT, relative))) mkdirSync(path.join(ROOT, relative));
    guardedPath(relative);
  }
  const fd = openSync(path.join(ROOT, name), 'wx', 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
  } finally { closeSync(fd); }
  return name;
}

function selfTest() {
  const credential = 'synthetic-monitor-value-47A9';
  const credentials = [{ value: credential, kind: 'monitor-token' }];
  const first = scan(`ready\r\nAuthorization: Bearer ${credential}\r\nGET /?token=${credential}&page=2\r\n`, 'synthetic.log', credentials);
  assert.equal(first.sanitized, 'ready\r\nAuthorization: Bearer [REDACTED]\r\nGET /?token=[REDACTED]&page=2\r\n');
  assert.deepEqual(first.findings.map(item => [item.line, item.kind, item.exposure, item.configuredCredentialMatch]), [
    [2, 'configured-monitor-token', 'full', true], [3, 'configured-monitor-token', 'full', true],
  ]);
  const assignment = scan('prefix {"password":"synthetic-secret-93Z", "total_tokens": 120, "token_count": 99} suffix', 'synthetic.log');
  assert.equal(assignment.sanitized, 'prefix {"password":"[REDACTED]", "total_tokens": 120, "token_count": 99} suffix');
  assert.equal(assignment.findings[0].kind, 'credential-assignment');
  assert.equal(scan("key='synthetic-key-93Z' tail=ok\npassword=synthetic-pass-93Z tail=ok", 'synthetic.log').sanitized, "key='[REDACTED]' tail=ok\npassword=[REDACTED] tail=ok");
  assert.equal(scan('Bearer synthetic-auth-93Z\nAuthorization: Basic c3ludGhldGlj\n', 'synthetic.log').sanitized, 'Bearer [REDACTED]\nAuthorization: Basic [REDACTED]\n');
  const placeholders = 'token=dev-token password=changeme token=12345 token=<TOKEN> api_key=sk-xxxx token=${TOKEN}\npassword=/cache/0123456789abcdef/value token=sha256:0123456789abcdef token=[REDACTED]\n';
  assert.equal(scan(placeholders, 'synthetic.log').sanitized, placeholders);
  assert.equal(scan(placeholders, 'synthetic.log').findings.length, 0);
  const prefix = scan('Using token: synthetic-mon...\nready\n', 'synthetic.log', credentials);
  assert.equal(prefix.sanitized, 'Using token: [REDACTED]\nready\n');
  assert.equal(prefix.findings[0].exposure, 'truncated');
  assert.equal(prefix.findings[0].configuredCredentialMatch, true);
  const unknownPrefix = scan('Using token: unknown-synthetic…\nready', 'synthetic.log');
  assert.equal(unknownPrefix.sanitized, 'Using token: [REDACTED]\nready');
  assert.equal(unknownPrefix.findings[0].configuredCredentialMatch, false);
  assert.equal(unknownPrefix.findings[0].exposure, 'truncated');
  assert.equal(scan('Using token: 12345678...\n', 'synthetic.log').sanitized, 'Using token: [REDACTED]\n');
  const fixtures = [
    'sk-proj-SyntheticOnly0123456789', 'sk-ant-api03-SyntheticOnly0123456789',
    'ghp_SyntheticOnly0123456789', 'github_pat_SyntheticOnly0123456789',
    'AIzaSyntheticOnly0123456789012345', 'xoxb-SyntheticOnly-0123456789', 'AKIASYNTHETIC0000000',
  ];
  const providers = scan(fixtures.join('\n'), 'synthetic.log');
  assert.deepEqual(providers.findings.map(item => item.kind), [
    'openai-key', 'anthropic-key', 'github-token', 'github-token', 'google-api-key', 'slack-token', 'aws-access-key-id',
  ]);
  assert.equal(providers.sanitized, Array(7).fill(MARKER).join('\n'));
  assert.equal(scan('ya29.SyntheticOnly0123456789\nxapp-SyntheticOnly-0123456789', 'synthetic.log').sanitized, '[REDACTED]\n[REDACTED]');
  const jwt = [Buffer.from('{"alg":"TEST"}').toString('base64url'), Buffer.from('{"synthetic":true}').toString('base64url'), 'syntheticSignature'].join('.');
  assert.equal(scan(`jwt ${jwt} done`, 'synthetic.log').sanitized, 'jwt [REDACTED] done');
  const privateKey = '-----BEGIN PRIVATE KEY-----\nc3ludGhldGljLW5vdC1hLXJlYWwta2V5\n-----END PRIVATE KEY-----';
  assert.equal(scan(`before\n${privateKey}\nafter`, 'synthetic.log').sanitized, 'before\n[REDACTED]\n\n\nafter');
  assert.equal(scan('-----BEGIN PRIVATE KEY-----\nc3ludGhldGljLW5vdC1hLXJlYWwta2V5\nready\n', 'synthetic.log').sanitized, '[REDACTED]\n\nready\n');
  assert.equal(scan('jwt eyJub3Rqd3Qi.synthetichash.hashvalue\ntoken={"type":"text"}', 'synthetic.log').sanitized, 'jwt eyJub3Rqd3Qi.synthetichash.hashvalue\ntoken={"type":"text"}');
  const encodedCredential = 'synthetic-value/47A9+piece';
  assert.equal(scan(`/?api_key=${encodeURIComponent(encodedCredential)}&q=ok`, 'synthetic.log', [{ value: encodedCredential, kind: 'configured-credential' }]).sanitized, '/?api_key=[REDACTED]&q=ok');
  const combined = [first, assignment, prefix, providers, unknownPrefix];
  for (const result of combined) {
    assert.equal(scan(result.sanitized, 'synthetic.log', credentials).findings.length, 0);
    for (const secret of [credential, 'synthetic-secret-93Z', 'synthetic-mon...', ...fixtures]) {
      assert(!result.sanitized.includes(secret));
      assert(!JSON.stringify(result.findings).includes(secret));
    }
  }
  assert.deepEqual(configuredCredentials('MONITOR_TOKEN=synthetic-monitor-value-47A9\nPORT=3001\nOPENAI_API_KEY=sk-xxxx\n'), credentials);
  assert.equal(scan('password=12345678', 'synthetic.log', [{ value: '12345678', kind: 'password' }]).findings[0].configuredCredentialMatch, true);
  assert.equal(insideRoot('../outside.log'), false);
  assert.equal(insideRoot(path.resolve(ROOT, '..', 'outside.log')), false);
  assert.throws(() => guardedPath('node_modules/anything.log'), /excluded-path/);
  assert.throws(() => rewriteLog('scripts/audit-logs.mjs', Buffer.alloc(0), ''), /non-log-write-refused/);
  console.log(JSON.stringify({ mode: 'self-test', passed: true, syntheticOnly: true }));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--redact', '--self-test', '--help'].includes(args[0]))) throw new Error('invalid-arguments');
  if (args[0] === '--help') {
    console.log('Usage: node scripts/audit-logs.mjs [--redact | --self-test | --help]\nDefault audit scans retained workspace .log files, including ignored logs. Reports contain no credential values. --redact rewrites matching logs in place without backups. No credentials are validated over a network or rotated.');
    return;
  }
  if (args[0] === '--self-test') { selfTest(); return; }
  if (realpathSync(ROOT).toLowerCase() !== ROOT.toLowerCase()) throw new Error('symlink-root-refused');
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (path.resolve(gitRoot).toLowerCase() !== ROOT.toLowerCase()) throw new Error('git-root-mismatch');
  const credentials = existsSync(path.join(ROOT, '.env.local')) ? configuredCredentials(safeRead('.env.local').toString('utf8')) : [];
  const safeName = name => scan(name, '<path>', credentials).sanitized;
  const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.log'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  const { logs, skipped } = retainedLogs();
  const mode = args[0] === '--redact' ? 'redact' : 'audit';
  const findings = [], files = [], issues = skipped.map(item => ({ file: safeName(item.file), reason: item.reason }));
  for (const file of logs) {
    try {
      const original = safeRead(file);
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(original);
      const result = scan(text, safeName(file), credentials);
      let redacted = false;
      if (mode === 'redact' && result.findings.length) {
        if (scan(result.sanitized, '<verification>', credentials).findings.length) throw new Error('residual-pattern-write-refused');
        rewriteLog(file, original, result.sanitized);
        redacted = true;
      }
      findings.push(...result.findings);
      files.push({ file: safeName(file), tracked: tracked.includes(file), bytes: original.length,
        beforeSha256: fingerprint(original), afterSha256: fingerprint(redacted ? Buffer.from(result.sanitized) : original),
        findings: result.findings.length, redacted });
    } catch (error) {
      const reason = /^(?:unsafe-path|excluded-path|symlink-refused|outside-root|nonregular-or-hardlink-refused|file-changed|non-log-write-refused|write-verification-failed|residual-pattern-write-refused)$/.test(error.message) ? error.message : error.code ?? 'scan-or-write-failed';
      issues.push({ file: safeName(file), reason });
    }
  }
  for (const file of tracked) if (!logs.includes(file)) issues.push({ file: safeName(file), reason: 'tracked-log-not-scanned' });
  const confirmedFull = findings.filter(item => item.configuredCredentialMatch && item.exposure === 'full');
  const potentialFull = findings.filter(item => !item.configuredCredentialMatch && item.exposure === 'full');
  const truncated = findings.filter(item => item.exposure === 'truncated');
  const counts = {};
  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  const summary = { mode, scannedFiles: files.length, trackedLogFiles: tracked.length, findingCount: findings.length,
    confirmedConfiguredFull: confirmedFull.length, potentialFull: potentialFull.length, truncated: truncated.length,
    configuredPrefixMatches: truncated.filter(item => item.configuredCredentialMatch).length,
    redactedFiles: files.filter(item => item.redacted).length, issueCount: issues.length, byKind: counts,
    rotationRequiredCategories: [...new Set(confirmedFull.map(item => item.kind.replace(/^configured-/, '')))].sort(),
    rotationReviewCategories: [...new Set(potentialFull.map(item => item.kind))].sort() };
  const report = { capturedAt: new Date().toISOString(), ...summary,
    assessment: 'Configured full matches require owner rotation. Other full patterns are potential credentials requiring owner review, not validated credentials. AWS access-key IDs alone do not prove secret-key exposure. Truncated prefixes alone do not prove full credential exposure. Redaction does not remove historical git copies or prevent future logging. No credentials were revoked, rotated, or tested against providers.',
    excludedDirectoryNames: [...EXCLUDED].sort(), files, findings, issues };
  const output = reportFile(mode, report);
  console.log(JSON.stringify({ ...summary, report: output }));
  if (issues.length) process.exitCode = 2;
}

try { main(); } catch (error) {
  if (process.argv[2] === '--self-test') {
    const site = error.stack?.split('\n').find(line => /^\s+at selfTest \(/.test(line));
    if (site) console.error(site.trim());
  }
  console.error('Log audit failed. No credential values printed. Check arguments, workspace guards, file access, and ignored report directory.');
  process.exitCode = 2;
}
