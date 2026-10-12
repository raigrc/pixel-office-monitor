import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, ftruncateSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** @typedef {{local: Record<string, string>, inherited: Record<string, string | undefined>, user: Record<string, string | null>}} CredentialSnapshot */
/** @typedef {{envFileSafe: boolean, storedKeysEqual: boolean, canonicalStrong: boolean, credentialsIndependent: boolean, canonicalAuthenticated: boolean, unauthenticatedRejected: boolean, invalidTokenRejected: boolean, readyToApply: boolean, applyRequested: boolean, userTokenMatchesBefore: boolean, userTokenMatchesAfter: boolean, inheritedTokenMatchesCanonical: boolean, writeAttempted: boolean, readbackVerified: boolean, aligned: boolean, keysChanged: string[], restartRequired: boolean, runningEnvironmentUnchanged: boolean, ownerReloadRequired: boolean, proofSaved: boolean}} AlignmentResult */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const REPORT = path.join(ROOT, 'Temp', 'opencode', 'ingest-auth', 'alignment.json');
const MONITOR_KEYS = ['MONITOR_TOKEN', 'PIXEL_MONITOR_TOKEN', 'NEXT_PUBLIC_PIXEL_MONITOR_TOKEN'];
const INDEPENDENT_KEYS = ['PIXEL_DISCOVERY_ACCESS_SECRET', 'PIXEL_OPENCODE_PASSWORD'];
const READ_KEYS = [...MONITOR_KEYS, ...INDEPENDENT_KEYS];
const USER_KEY = 'PIXEL_MONITOR_TOKEN';
const NOTICE = 'Current running inherited environment is unaffected. Owner must reload the producer parent environment from Windows User settings, then start a new producer. This helper never injects environment into running processes or restarts them.\n';
const CHILD_OPTIONS = { encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };

function ensure(condition) {
  if (!condition) throw new Error('alignment-check-failed');
}

function regularPrivateFile(stat) {
  return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 512 * 1024;
}

function readLocal() {
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', '.env.local'], { ...CHILD_OPTIONS, cwd: ROOT });
  const tracked = spawnSync('git', ['ls-files', '-z', '--', '.env.local'], { ...CHILD_OPTIONS, cwd: ROOT });
  ensure(!ignored.error && ignored.status === 0 && !tracked.error && tracked.status === 0 && tracked.stdout === '');
  const stat = lstatSync(ENV_FILE);
  ensure(regularPrivateFile(stat));
  const fd = openSync(ENV_FILE, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    ensure(regularPrivateFile(opened) && opened.dev === stat.dev && opened.ino === stat.ino);
    const text = readFileSync(fd, 'utf8');
    ensure(Buffer.byteLength(text) <= 512 * 1024);
    return parseLocal(text);
  } finally {
    closeSync(fd);
  }
}

function parseLocal(text) {
  for (const key of READ_KEYS) {
    const definitions = text.match(new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, 'gm')) ?? [];
    ensure(definitions.length === 1);
  }
  const parsed = parseEnv(text);
  for (const key of READ_KEYS) ensure(typeof parsed[key] === 'string' && !/[$\\\r\n\0]/.test(parsed[key]));
  return Object.fromEntries(READ_KEYS.map(key => [key, parsed[key]]));
}

function strongToken(token) {
  return typeof token === 'string' && /^[!-~]{32,256}$/.test(token) && !/[$\\]/.test(token)
    && new Set(token).size >= 12
    && !/(?:dev[-_]?token|default|change[-_]?me|replace|placeholder|example|your[-_]?token|test[-_]?token)/i.test(token);
}

function credentialChecks(snapshot) {
  const token = snapshot.local.MONITOR_TOKEN;
  return {
    storedKeysEqual: typeof token === 'string' && token.length > 0 && MONITOR_KEYS.every(key => snapshot.local[key] === token),
    canonicalStrong: strongToken(token),
    credentialsIndependent: INDEPENDENT_KEYS.every(key => typeof snapshot.local[key] === 'string' && snapshot.local[key].length > 0)
      && [snapshot.local, snapshot.inherited, snapshot.user].every(scope => INDEPENDENT_KEYS.every(key => scope[key] !== token)),
  };
}

function readUser(run = spawnSync) {
  ensure(process.platform === 'win32');
  const command = `$ErrorActionPreference='Stop'; $r=@{}; foreach($k in @('${READ_KEYS.join("','")}')) { $r[$k]=[Environment]::GetEnvironmentVariable($k,'User') }; $r | ConvertTo-Json -Compress`;
  const child = run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], CHILD_OPTIONS);
  ensure(!child.error && child.status === 0);
  const parsed = JSON.parse(child.stdout.replace(/^\uFEFF/, ''));
  ensure(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed));
  for (const key of READ_KEYS) ensure(Object.hasOwn(parsed, key) && (parsed[key] === null || typeof parsed[key] === 'string'));
  return Object.fromEntries(READ_KEYS.map(key => [key, parsed[key]]));
}

function writeUser(desired, expected, run = spawnSync) {
  ensure(process.platform === 'win32');
  const command = "$ErrorActionPreference='Stop'; $current=[Environment]::GetEnvironmentVariable('PIXEL_MONITOR_TOKEN','User'); if($env:PIXEL_ALIGNMENT_EXPECTED_MISSING -ceq '1') { if($null -ne $current) { exit 2 } } elseif($current -cne $env:PIXEL_ALIGNMENT_EXPECTED_TOKEN) { exit 2 }; [Environment]::SetEnvironmentVariable('PIXEL_MONITOR_TOKEN',$env:PIXEL_ALIGNMENT_DESIRED_TOKEN,'User'); if([Environment]::GetEnvironmentVariable('PIXEL_MONITOR_TOKEN','User') -cne $env:PIXEL_ALIGNMENT_DESIRED_TOKEN) { exit 3 }; [Console]::Out.Write('true')";
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PIXEL_ALIGNMENT_/i.test(key)));
  const child = run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    ...CHILD_OPTIONS,
    env: { ...inherited, PIXEL_ALIGNMENT_DESIRED_TOKEN: desired,
      PIXEL_ALIGNMENT_EXPECTED_TOKEN: expected ?? '', PIXEL_ALIGNMENT_EXPECTED_MISSING: expected === null ? '1' : '0' },
  });
  ensure(!child.error && child.status === 0 && child.stdout.trim() === 'true');
}

function probeStatus(token, request = http.request) {
  return new Promise(resolve => {
    let settled = false;
    let timer;
    let req;
    const finish = status => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    try {
      const headers = { 'content-type': 'application/json', 'content-length': '2', 'cache-control': 'no-cache' };
      if (token !== null) headers['x-monitor-token'] = token;
      req = request({ hostname: '127.0.0.1', port: 3001, path: '/api/ingest', method: 'POST', headers, agent: false }, res => {
        finish(res.statusCode ?? null);
        res.on('error', () => {});
        res.destroy();
      });
      req.on('error', () => finish(null));
      timer = setTimeout(() => { finish(null); req.destroy(); }, 3500);
      req.end('{"');
    } catch {
      finish(null);
      req?.destroy();
    }
  });
}

async function authenticate(token, probe = probeStatus) {
  return {
    canonicalAuthenticated: await probe(token) === 400,
    unauthenticatedRejected: await probe(null) === 401,
    invalidTokenRejected: await probe('alignment-invalid-control') === 401,
  };
}

function persistProof(result) {
  for (const directory of [path.join(ROOT, 'Temp'), path.join(ROOT, 'Temp', 'opencode'), path.dirname(REPORT)]) {
    const stat = lstatSync(directory);
    ensure(stat.isDirectory() && !stat.isSymbolicLink());
  }
  let previous = null;
  try { previous = lstatSync(REPORT); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) ensure(regularPrivateFile(previous));
  const fd = openSync(REPORT, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0)
    | (previous ? 0 : constants.O_CREAT | constants.O_EXCL), 0o600);
  try {
    const opened = fstatSync(fd);
    ensure(regularPrivateFile(opened) && (!previous || (opened.dev === previous.dev && opened.ino === previous.ino)));
    ftruncateSync(fd, 0);
    writeFileSync(fd, `${JSON.stringify({ ...result, proofSaved: true }, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(fd);
  }
}

const LIVE = {
  snapshot() {
    const local = readLocal();
    return { local, inherited: Object.fromEntries(READ_KEYS.map(key => [key, process.env[key]])), user: readUser() };
  },
  authenticate,
  readUser,
  writeUser,
  persist: persistProof,
};

async function align(mode, io) {
  /** @type {AlignmentResult} */
  const result = { envFileSafe: false, storedKeysEqual: false, canonicalStrong: false, credentialsIndependent: false,
    canonicalAuthenticated: false, unauthenticatedRejected: false, invalidTokenRejected: false, readyToApply: false,
    applyRequested: mode === '--apply', userTokenMatchesBefore: false, userTokenMatchesAfter: false,
    inheritedTokenMatchesCanonical: false, writeAttempted: false, readbackVerified: false, aligned: false,
    keysChanged: [], restartRequired: true, runningEnvironmentUnchanged: true, ownerReloadRequired: true, proofSaved: false };
  try {
    /** @type {CredentialSnapshot} */
    const snapshot = io.snapshot();
    result.envFileSafe = true;
    Object.assign(result, credentialChecks(snapshot));
    const token = snapshot.local.MONITOR_TOKEN;
    const canonicalPresent = typeof token === 'string' && token.length > 0;
    result.userTokenMatchesBefore = canonicalPresent && snapshot.user[USER_KEY] === token;
    result.userTokenMatchesAfter = result.userTokenMatchesBefore;
    result.inheritedTokenMatchesCanonical = canonicalPresent && snapshot.inherited[USER_KEY] === token;
    if (result.storedKeysEqual && result.canonicalStrong && result.credentialsIndependent) {
      Object.assign(result, await io.authenticate(token));
      result.readyToApply = result.canonicalAuthenticated && result.unauthenticatedRejected && result.invalidTokenRejected;
      if (result.readyToApply) {
        if (mode === '--apply' && !result.userTokenMatchesBefore) {
          result.writeAttempted = true;
          try { io.writeUser(token, snapshot.user[USER_KEY]); } catch {}
        }
        const readback = io.readUser();
        result.userTokenMatchesAfter = readback[USER_KEY] === token;
        result.readbackVerified = result.userTokenMatchesAfter
          && READ_KEYS.filter(key => key !== USER_KEY).every(key => readback[key] === snapshot.user[key]);
        if (result.writeAttempted && result.userTokenMatchesAfter) result.keysChanged = [USER_KEY];
        result.aligned = result.readbackVerified;
      }
    }
  } catch {}
  try { io.persist(result); result.proofSaved = true; } catch {}
  return result;
}

async function execute(args, io, output) {
  ensure(args.length === 1 && ['--self-test', '--check', '--apply'].includes(args[0]));
  if (args[0] === '--self-test') {
    await selfTest();
    output(`${JSON.stringify({ selfTestPassed: true })}\n`);
    return true;
  }
  const result = await align(args[0], io);
  output(`${JSON.stringify(result)}\n`);
  return result.readyToApply && result.aligned && result.proofSaved;
}

async function selfTest() {
  const inheritedBefore = { ...process.env };
  const desired = 'FakeOnly_A7p9Q2v4X6z8C0n3M5r1B7k9D2s4';
  const wrong = 'FakeOnly_Z9w8V7u6T5s4R3q2P1n0M9k8J7h6';
  const discovery = 'FakeDiscovery_8X7w6V5u4T3s2R1q0P9n8M7k6';
  const password = 'FakePassword_2J3k4M5n6P7q8R9s0T1u2V3w4';
  const local = { MONITOR_TOKEN: desired, PIXEL_MONITOR_TOKEN: desired, NEXT_PUBLIC_PIXEL_MONITOR_TOKEN: desired,
    PIXEL_DISCOVERY_ACCESS_SECRET: discovery, PIXEL_OPENCODE_PASSWORD: password };
  const privateValues = [desired, wrong, discovery, password];
  const fixture = (overrides = {}) => {
    const state = { local: { ...local }, inherited: { PIXEL_MONITOR_TOKEN: wrong },
      user: { MONITOR_TOKEN: null, PIXEL_MONITOR_TOKEN: wrong, NEXT_PUBLIC_PIXEL_MONITOR_TOKEN: null,
        PIXEL_DISCOVERY_ACCESS_SECRET: discovery, PIXEL_OPENCODE_PASSWORD: password, OTHER: 'keep' },
      probes: [], writes: [], reports: [], failSnapshot: false, accept: true, controlsRejected: true, failWrite: false,
      failReadback: false, failPersist: false, ...overrides };
    const io = {
      snapshot() { ensure(!state.failSnapshot); return structuredClone({ local: state.local, inherited: state.inherited, user: state.user }); },
      async authenticate(token) {
        state.probes.push(token);
        return { canonicalAuthenticated: state.accept && token === desired,
          unauthenticatedRejected: state.controlsRejected, invalidTokenRejected: state.controlsRejected };
      },
      readUser() { return { ...state.user, ...(state.failReadback ? { PIXEL_MONITOR_TOKEN: wrong } : {}) }; },
      writeUser(token, expected) {
        ensure(!state.failWrite && state.user.PIXEL_MONITOR_TOKEN === expected);
        state.writes.push(USER_KEY);
        state.user.PIXEL_MONITOR_TOKEN = token;
      },
      persist(result) { ensure(!state.failPersist); state.reports.push(JSON.stringify({ ...result, proofSaved: true })); },
    };
    return { state, io };
  };
  const assertSafe = result => {
    for (const [key, value] of Object.entries(result)) {
      if (key === 'keysChanged') assert(value.every(item => item === 'PIXEL_MONITOR_TOKEN'));
      else assert.equal(typeof value, 'boolean');
    }
    for (const value of privateValues) assert.equal(JSON.stringify(result).includes(value), false);
  };

  const check = fixture();
  const beforeCheck = structuredClone(check.state);
  const drift = await align('--check', check.io);
  assert.deepEqual([drift.readyToApply, drift.aligned, drift.writeAttempted, drift.keysChanged, drift.proofSaved], [true, false, false, [], true]);
  assert.deepEqual(check.state.user, beforeCheck.user);
  assert.deepEqual(check.state.writes, []);
  assertSafe(drift);

  const apply = fixture();
  const beforeApply = structuredClone(apply.state);
  const changed = await align('--apply', apply.io);
  assert.deepEqual([changed.readyToApply, changed.aligned, changed.readbackVerified, changed.keysChanged, changed.restartRequired], [true, true, true, ['PIXEL_MONITOR_TOKEN'], true]);
  assert.deepEqual(apply.state.user, { ...beforeApply.user, PIXEL_MONITOR_TOKEN: desired });
  assert.deepEqual(apply.state.local, beforeApply.local);
  assert.deepEqual(apply.state.inherited, { PIXEL_MONITOR_TOKEN: wrong });
  const rerun = await align('--apply', apply.io);
  assert.deepEqual([rerun.aligned, rerun.writeAttempted, rerun.keysChanged], [true, false, []]);
  assert.deepEqual(apply.state.writes, ['PIXEL_MONITOR_TOKEN']);
  assertSafe(changed);
  assertSafe(rerun);

  for (const userToken of [null, '', desired]) {
    const item = fixture();
    item.state.user.PIXEL_MONITOR_TOKEN = userToken;
    const result = await align('--apply', item.io);
    assert.deepEqual([result.aligned, result.writeAttempted, result.keysChanged],
      [true, userToken !== desired, userToken === desired ? [] : ['PIXEL_MONITOR_TOKEN']]);
    assert.equal(item.state.user.PIXEL_MONITOR_TOKEN, desired);
    assertSafe(result);
  }

  const invalidLocals = [];
  for (const key of MONITOR_KEYS) {
    const missing = { ...local }; delete missing[key]; invalidLocals.push(missing);
    invalidLocals.push({ ...local, [key]: wrong });
  }
  for (const token of ['dev-token', 'REPLACE_WITH_LOCAL_RANDOM_VALUE_123456789', 'A'.repeat(48), 'short', `${desired}\n`, `${desired}$VARIABLE`, `${desired}\\escape`]) {
    invalidLocals.push({ ...local, ...Object.fromEntries(MONITOR_KEYS.map(key => [key, token])) });
  }
  for (const key of INDEPENDENT_KEYS) {
    invalidLocals.push({ ...local, [key]: desired });
    invalidLocals.push({ ...local, [key]: '' });
    const missing = { ...local }; delete missing[key]; invalidLocals.push(missing);
  }
  for (const value of invalidLocals) {
    const item = fixture({ local: value });
    const result = await align('--apply', item.io);
    assert.deepEqual([result.readyToApply, result.aligned, result.writeAttempted, result.keysChanged], [false, false, false, []]);
    assert.deepEqual(item.state.user.PIXEL_MONITOR_TOKEN, wrong);
    assert.deepEqual(item.state.probes, []);
    assertSafe(result);
  }
  const absent = fixture({ local: {}, inherited: {} });
  const absentResult = await align('--apply', absent.io);
  assert.deepEqual([absentResult.storedKeysEqual, absentResult.inheritedTokenMatchesCanonical, absentResult.userTokenMatchesBefore], [false, false, false]);
  for (const scope of ['inherited', 'user']) {
    for (const key of INDEPENDENT_KEYS) {
      const item = fixture(); item.state[scope][key] = desired;
      const result = await align('--apply', item.io);
      assert.deepEqual([result.credentialsIndependent, result.readyToApply, result.writeAttempted], [false, false, false]);
      assert.equal(item.state.user.PIXEL_MONITOR_TOKEN, wrong);
      assertSafe(result);
    }
  }
  for (const overrides of [{ failSnapshot: true }, { accept: false }, { controlsRejected: false }, { failWrite: true }, { failReadback: true }]) {
    const item = fixture(overrides);
    const result = await align('--apply', item.io);
    assert.equal(result.aligned, false);
    assertSafe(result);
    if (!overrides.failReadback) assert.equal(item.state.user.PIXEL_MONITOR_TOKEN, wrong);
  }
  const failedProof = fixture({ failPersist: true });
  const partial = await align('--apply', failedProof.io);
  assert.deepEqual([partial.aligned, partial.proofSaved], [true, false]);
  failedProof.state.failPersist = false;
  const recovered = await align('--apply', failedProof.io);
  assert.deepEqual([recovered.aligned, recovered.proofSaved, recovered.writeAttempted], [true, true, false]);
  assert.deepEqual(failedProof.state.writes, ['PIXEL_MONITOR_TOKEN']);

  const text = Object.entries(local).map(([key, value]) => `${key}="${value}"`).join('\n');
  assert.deepEqual(parseLocal(text), local);
  assert.throws(() => parseLocal(`${text}\nMONITOR_TOKEN=${wrong}`), /alignment-check-failed/);
  assert.throws(() => parseLocal(text.replace(desired, '$OTHER')), /alignment-check-failed/);
  assert.throws(() => parseLocal(text.replace(`PIXEL_OPENCODE_PASSWORD="${password}"`, '')), /alignment-check-failed/);
  const stat = { isFile: () => true, isSymbolicLink: () => false, nlink: 1, size: 128 };
  assert.equal(regularPrivateFile(stat), true);
  for (const override of [{ isFile: () => false }, { isSymbolicLink: () => true }, { nlink: 2 }, { size: 512 * 1024 + 1 }]) {
    assert.equal(regularPrivateFile({ ...stat, ...override }), false);
  }

  for (const [token, status] of [[desired, 400], [wrong, 401], [null, 401], [desired, 302], [desired, 500]]) {
    const observed = await probeStatus(token, (options, response) => ({
      on() {}, destroy() {},
      end(body) {
        assert.deepEqual([options.hostname, options.port, options.path, options.method, options.agent, body], ['127.0.0.1', 3001, '/api/ingest', 'POST', false, '{"']);
        assert.throws(() => JSON.parse(body));
        assert.equal(options.headers['x-monitor-token'] ?? null, token);
        queueMicrotask(() => response({ statusCode: status, on() {}, destroy() {} }));
      },
    }));
    assert.equal(observed, status);
  }
  assert.equal(await probeStatus(desired, () => { throw new Error(desired); }), null);
  const authenticationInputs = [];
  const authenticated = await authenticate(desired, async token => {
    authenticationInputs.push(token);
    return token === desired ? 400 : 401;
  });
  assert.deepEqual(authenticated, { canonicalAuthenticated: true, unauthenticatedRejected: true, invalidTokenRejected: true });
  assert.deepEqual(authenticationInputs, [desired, null, 'alignment-invalid-control']);
  assert.deepEqual(await authenticate(desired, async () => 400), {
    canonicalAuthenticated: true, unauthenticatedRejected: false, invalidTokenRejected: false,
  });
  assert.deepEqual(await authenticate(desired, async () => 401), {
    canonicalAuthenticated: false, unauthenticatedRejected: true, invalidTokenRejected: true,
  });

  if (process.platform === 'win32') {
    for (const expected of [wrong, null]) {
      writeUser(desired, expected, (executable, args, options) => {
        assert.equal(executable, 'powershell.exe');
        for (const value of privateValues) assert.equal(JSON.stringify(args).includes(value), false);
        assert.equal(options.env.PIXEL_ALIGNMENT_DESIRED_TOKEN, desired);
        assert.equal(options.env.PIXEL_ALIGNMENT_EXPECTED_TOKEN, expected ?? '');
        assert.equal(options.env.PIXEL_ALIGNMENT_EXPECTED_MISSING, expected === null ? '1' : '0');
        assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
        return { status: 0, stdout: 'true', stderr: desired };
      });
    }
    assert.throws(() => writeUser(desired, wrong, () => ({ status: 1, stdout: desired, stderr: password })), /alignment-check-failed/);
    const user = Object.fromEntries(READ_KEYS.map(key => [key, key === USER_KEY ? desired : null]));
    assert.deepEqual(readUser(() => ({ status: 0, stdout: JSON.stringify(user), stderr: password })), user);
    assert.throws(() => readUser(() => ({ status: 0, stdout: desired, stderr: password })));
  }
  for (const mode of ['--check', '--apply']) {
    const item = fixture();
    const output = [];
    const ok = await execute([mode], item.io, text => output.push(text));
    assert.equal(ok, mode === '--apply');
    assertSafe(JSON.parse(output.join('')));
    for (const value of privateValues) {
      assert.equal(output.join('').includes(value), false);
      assert.equal(item.state.reports.join('').includes(value), false);
    }
  }
  for (const args of [[], ['--apply', '--check'], ['--unknown'], [desired]]) {
    await assert.rejects(execute(args, fixture().io, () => {}), /alignment-check-failed/);
  }
  assert.deepEqual({ ...process.env }, inheritedBefore);
}

try {
  const ok = await execute(process.argv.slice(2), LIVE, text => process.stdout.write(text));
  if (!ok) process.exitCode = 1;
} catch {
  process.stderr.write('Alignment failed. Details suppressed to protect credentials. Use exactly one of --self-test, --check, --apply.\n');
  process.exitCode = 1;
} finally {
  process.stdout.write(NOTICE);
}
