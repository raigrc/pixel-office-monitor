import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** @typedef {{source: string, token: string}} CredentialCandidate */
/** @typedef {{sequence: number, floorCount: number, actorCount: number}} StateCounts */
/** @typedef {{sources: object[], equality: object[], plugin: object, probes: object[], counts: object}} TokenAudit */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'Temp', 'opencode', 'ingest-auth', 'results.json');
const PLUGIN = 'C:\\Users\\DELL\\.config\\opencode\\plugins\\pixel-monitor.js';
const KEYS = ['MONITOR_TOKEN', 'PIXEL_MONITOR_TOKEN', 'NEXT_PUBLIC_PIXEL_MONITOR_TOKEN'];
const TARGET = new URL('http://127.0.0.1:3001');
const require = createRequire(import.meta.url);

function privateText(file) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > 512 * 1024) throw new Error('private-input-rejected');
  return readFileSync(file, 'utf8');
}

function collectScope(scope, values, candidates, sources) {
  for (const key of KEYS) {
    const source = `${scope}:${key}`;
    const token = values[key];
    const present = typeof token === 'string';
    sources.push({ source, present, nonEmpty: present && token.length > 0 });
    if (present && token.length > 0) candidates.push({ source, token });
  }
}

function windowsEnvironment() {
  if (process.platform !== 'win32') return { status: 'not-windows', values: {} };
  const command = `$r=@{}; foreach($s in @('User','Machine')) { $v=@{}; foreach($k in @('${KEYS.join("','")}')) { $v[$k]=[Environment]::GetEnvironmentVariable($k,$s) }; $r[$s]=$v }; $r | ConvertTo-Json -Depth 4 -Compress`;
  try {
    const child = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (child.error || child.status !== 0) return { status: 'unavailable', values: {} };
    const values = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
    if (!values || typeof values !== 'object') return { status: 'unavailable', values: {} };
    return { status: 'read', values };
  } catch {
    return { status: 'unavailable', values: {} };
  }
}

function inspectPlugin(text, candidates) {
  const ts = require('typescript');
  const tree = ts.createSourceFile('private-plugin.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (tree.parseDiagnostics.length) return { status: 'parse-failed', envKeys: [], resolutions: [] };
  const envKeys = new Set();
  const resolutions = [];
  function envKey(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(tree) === 'process' && node.expression.name.text === 'env') {
      return node.name.text;
    }
    if (ts.isElementAccessExpression(node) && node.expression.getText(tree) === 'process.env'
      && node.argumentExpression && ts.isStringLiteral(node.argumentExpression)) return node.argumentExpression.text;
    return null;
  }
  function walk(node, visit) {
    visit(node);
    ts.forEachChild(node, child => walk(child, visit));
  }
  walk(tree, node => {
    const key = envKey(node);
    if (key && /^[A-Z][A-Z0-9_]{0,80}$/.test(key)) envKeys.add(key);
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)
      || !/token/i.test(node.name.text) || !node.initializer) return;
    const keys = new Set();
    const fallbacks = [];
    walk(node.initializer, part => {
      const referenced = envKey(part);
      if (referenced && /^[A-Z][A-Z0-9_]{0,80}$/.test(referenced)) keys.add(referenced);
      if (ts.isBinaryExpression(part) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(part.operatorToken.kind)
        && ts.isStringLiteral(part.right)) fallbacks.push(part.right);
    });
    if (keys.size === 0 && !ts.isStringLiteral(node.initializer)) return;
    let inFunction = false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionLike(parent)) inFunction = true;
    }
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    resolutions.push({ line, envKeys: [...keys].sort(), resolution: inFunction ? 'function-scope-unconfirmed-handler' : 'module-load',
      fallbackPresent: fallbacks.length > 0, literalPresent: ts.isStringLiteral(node.initializer) });
    const literals = ts.isStringLiteral(node.initializer) ? [node.initializer] : fallbacks;
    for (const literal of literals) {
      if (!literal.text) continue;
      const literalLine = tree.getLineAndCharacterOfPosition(literal.getStart(tree)).line + 1;
      candidates.push({ source: `plugin:literal-line-${literalLine}`, token: literal.text });
    }
  });
  return { status: 'parsed', envKeys: [...envKeys].sort(), resolutions };
}

function dedupe(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const group = groups.get(candidate.token);
    if (group) group.sources.push(candidate.source);
    else groups.set(candidate.token, { token: candidate.token, sources: [candidate.source] });
  }
  return [...groups.values()];
}

function equality(candidates) {
  const result = [];
  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      result.push({ left: candidates[left].source, right: candidates[right].source,
        equal: candidates[left].token === candidates[right].token });
    }
  }
  return result;
}

function stateCounts(value) {
  if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.sequence) || value.sequence < 0
    || !Array.isArray(value.floors) || !Array.isArray(value.actors)) return null;
  return { sequence: value.sequence, floorCount: value.floors.length, actorCount: value.actors.length };
}

function probe({ token, ingest, deadline }) {
  if (TARGET.protocol !== 'http:' || TARGET.hostname !== '127.0.0.1' || TARGET.port !== '3001') {
    throw new Error('target-rejected');
  }
  const timeout = Math.min(3500, deadline - Date.now());
  if (timeout <= 0) return Promise.resolve({ status: null, result: 'deadline', counts: null });
  return new Promise(resolve => {
    let settled = false;
    let timer;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const failed = result => finish({ status: null, result, counts: null });
    try {
      const headers = { accept: 'application/vnd.pixel-monitor.v2+json', 'cache-control': 'no-cache' };
      if (token !== null) headers['x-monitor-token'] = token;
      if (ingest) headers['content-type'] = 'application/json';
      const req = http.request({ hostname: '127.0.0.1', port: 3001, method: ingest ? 'POST' : 'GET',
        path: ingest ? '/api/ingest' : '/api/state', headers, agent: false }, res => {
        const status = res.statusCode ?? null;
        if (status !== null && status >= 300 && status < 400) {
          finish({ status, result: 'redirect-rejected', counts: null });
          res.destroy();
          return;
        }
        let length = 0;
        const chunks = [];
        const limit = ingest ? 8192 : 1024 * 1024;
        res.on('data', chunk => {
          length += chunk.length;
          if (length > limit) {
            finish({ status, result: 'body-limit', counts: null });
            res.destroy();
          } else if (!ingest && status === 200) chunks.push(chunk);
        });
        res.on('error', () => failed('response-error'));
        res.on('end', () => {
          let counts = null;
          if (!ingest && status === 200) {
            try { counts = stateCounts(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch {}
          }
          const result = ingest && status === 400 ? 'authenticated-invalid-json'
            : !ingest && status === 200 ? 'authenticated'
              : status === 401 ? 'unauthorized' : 'unexpected-status';
          finish({ status, result, counts });
        });
      });
      req.on('error', () => failed('request-error'));
      timer = setTimeout(() => {
        failed('timeout');
        req.destroy();
      }, timeout);
      req.end(ingest ? '{"' : undefined);
    } catch {
      failed('request-rejected');
    }
  });
}

function publicProbe(sources, state, ingest) {
  return { sources: [...sources], state: { status: state.status, result: state.result },
    ingest: { status: ingest.status, result: ingest.result } };
}

function compareCounts(before, after) {
  return { before, after, comparable: before !== null && after !== null,
    unchanged: before !== null && after !== null && before.sequence === after.sequence
      && before.floorCount === after.floorCount && before.actorCount === after.actorCount };
}

async function audit() {
  const deadline = Date.now() + 60000;
  /** @type {CredentialCandidate[]} */
  const candidates = [];
  const sources = [];
  let localStatus = 'read';
  let local = {};
  try { local = parseEnv(privateText(path.join(ROOT, '.env.local'))); } catch { localStatus = 'unavailable'; }
  collectScope('env-local', local, candidates, sources);
  collectScope('process', process.env, candidates, sources);
  const windows = windowsEnvironment();
  collectScope('windows-user', windows.values.User ?? {}, candidates, sources);
  collectScope('windows-machine', windows.values.Machine ?? {}, candidates, sources);
  let plugin;
  try { plugin = inspectPlugin(privateText(PLUGIN), candidates); }
  catch { plugin = { status: 'unavailable', envKeys: [], resolutions: [] }; }
  const groups = dedupe(candidates);
  if (groups.length > 16) throw new Error('candidate-limit');
  const states = [];
  let accepted = -1;
  for (let i = 0; i < groups.length; i++) {
    const state = await probe({ token: groups[i].token, ingest: false, deadline });
    states.push(state);
    if (accepted === -1 && state.status === 200 && state.counts) accepted = i;
  }
  const probes = [];
  for (let i = 0; i < groups.length; i++) {
    const ingest = await probe({ token: groups[i].token, ingest: true, deadline });
    probes.push(publicProbe(groups[i].sources, states[i], ingest));
  }
  let invalid = randomBytes(32).toString('hex');
  while (groups.some(group => group.token === invalid)) invalid = randomBytes(32).toString('hex');
  for (const [source, token] of [['control:no-token', null], ['control:invalid-token', invalid]]) {
    const state = await probe({ token, ingest: false, deadline });
    const ingest = await probe({ token, ingest: true, deadline });
    probes.push(publicProbe([source], state, ingest));
  }
  const after = accepted === -1 ? null : await probe({ token: groups[accepted].token, ingest: false, deadline });
  const before = accepted === -1 ? null : states[accepted].counts;
  /** @type {TokenAudit} */
  const report = { sources, equality: equality(candidates), plugin, probes,
    counts: compareCounts(before, after?.counts ?? null) };
  return { ...report, inputs: { envLocal: localStatus, windowsEnvironment: windows.status },
    candidateCount: candidates.length, distinctCandidateCount: groups.length,
    authenticatedIngestCount: probes.filter(item => item.ingest.result === 'authenticated-invalid-json').length,
    unauthorizedIngestCount: probes.filter(item => item.ingest.result === 'unauthorized').length };
}

async function selfTest() {
  const candidates = [];
  const sources = [];
  const parsed = parseEnv('MONITOR_TOKEN="private-canary-one"\nPIXEL_MONITOR_TOKEN="private-canary-one"\nNEXT_PUBLIC_PIXEL_MONITOR_TOKEN="private-canary-two"');
  collectScope('env-local', parsed, candidates, sources);
  assert.deepEqual(dedupe(candidates).map(group => group.sources), [
    ['env-local:MONITOR_TOKEN', 'env-local:PIXEL_MONITOR_TOKEN'], ['env-local:NEXT_PUBLIC_PIXEL_MONITOR_TOKEN'],
  ]);
  assert.deepEqual(equality(candidates).map(item => item.equal), [true, false, false]);
  const pluginCandidates = [];
  const plugin = inspectPlugin('const TOKEN = process.env.PIXEL_MONITOR_TOKEN || "private-canary-three";\nfunction handler() { const token = process.env.MONITOR_TOKEN || "private-canary-four"; }', pluginCandidates);
  assert.deepEqual(plugin, { status: 'parsed', envKeys: ['MONITOR_TOKEN', 'PIXEL_MONITOR_TOKEN'], resolutions: [
    { line: 1, envKeys: ['PIXEL_MONITOR_TOKEN'], resolution: 'module-load', fallbackPresent: true, literalPresent: false },
    { line: 2, envKeys: ['MONITOR_TOKEN'], resolution: 'function-scope-unconfirmed-handler', fallbackPresent: true, literalPresent: false },
  ] });
  assert.deepEqual(pluginCandidates.map(item => item.source), ['plugin:literal-line-1', 'plugin:literal-line-2']);
  const counts = stateCounts({ sequence: 7, floors: [{ secret: 'private-canary-five' }], actors: [1, 2] });
  assert.deepEqual(counts, { sequence: 7, floorCount: 1, actorCount: 2 });
  assert.equal(stateCounts({ sequence: '7', floors: [], actors: [] }), null);
  assert.deepEqual(compareCounts(counts, { sequence: 7, floorCount: 1, actorCount: 2 }), {
    before: { sequence: 7, floorCount: 1, actorCount: 2 }, after: { sequence: 7, floorCount: 1, actorCount: 2 }, comparable: true, unchanged: true,
  });
  const projected = JSON.stringify({ sources, equality: equality(candidates), plugin, counts,
    probe: publicProbe(['env-local:MONITOR_TOKEN'], { status: 200, result: 'authenticated', token: 'private-canary-six' },
      { status: 400, result: 'authenticated-invalid-json', body: 'private-canary-seven' }) });
  assert.equal(projected.includes('private-canary'), false);
  assert.deepEqual(await probe({ token: null, ingest: false, deadline: 0 }), { status: null, result: 'deadline', counts: null });
  process.stdout.write('self-test passed; dedupe, safe projection, private plugin parsing, counts, deadline verified\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  if (args.length) throw new Error('arguments-rejected');
  const report = await audit();
  mkdirSync(path.dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`audit saved Temp/opencode/ingest-auth/results.json; candidates=${report.distinctCandidateCount}; authenticated-ingest=${report.authenticatedIngestCount}; unauthorized-ingest=${report.unauthorizedIngestCount}; counts-unchanged=${report.counts.unchanged}\n`);
}

main().catch(() => {
  process.stderr.write('audit failed; details suppressed to protect private input\n');
  process.exitCode = 1;
});
