import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const root = process.cwd();
const appBase = 'http://127.0.0.1:3011';
const providerBase = 'http://127.0.0.1:4097';
const fixtureBase = 'http://127.0.0.1:4098';
const output = path.join(root, 'Temp/opencode/discovery/browser');
const localEnv = parseEnv(readFileSync(path.join(root, '.env.local'), 'utf8'));
const accessSecret = randomBytes(32).toString('base64url');
const providerPassword = randomBytes(32).toString('base64url');
const authorization = `Basic ${Buffer.from(`opencode:${providerPassword}`).toString('base64')}`;
const journal = [];
const report = { checks: [], errors: 0, completed: false, providerVersion: null, realMetadataCount: null, writesObserved: 0, startedAt: new Date().toISOString(), limitations: ['Metadata listing does not establish execution activity.', 'Verification does not create or prompt provider sessions.', 'Only first page, at most 50 records, is read.'] };
let app;
let provider;
let fixture;
let browser;
let fixtureMode = 'ready';
let stage = 'setup';
mkdirSync(output, { recursive: true });

function check(name, passed) {
  stage = name;
  report.checks.push({ name, passed: Boolean(passed) });
  console.log(`${name}: ${passed ? 'pass' : 'fail'}`);
  assert(Boolean(passed), name);
}
async function free(port) {
  await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', () => reject(new Error('Verification port occupied')));
    socket.listen(port, '127.0.0.1', () => socket.close(resolve));
  });
}
async function waitFor(predicate, timeout = 30_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if (await predicate()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Verification deadline exceeded');
}
async function stop(child) {
  if (!child || child.exitCode !== null) return true;
  const exited = new Promise(resolve => child.once('exit', () => resolve(true)));
  child.kill();
  let done = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(false), 5_000))]);
  if (!done) { child.kill('SIGKILL'); done = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(false), 3_000))]); }
  return done;
}
async function startApp(target) {
  check('Previous isolated app stopped', await stop(app));
  await free(3011);
  app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '3011'], {
    cwd: root, stdio: 'ignore', env: { ...process.env, ...localEnv,
      PIXEL_DISCOVERY_ORIGIN: appBase, PIXEL_DISCOVERY_ACCESS_SECRET: accessSecret,
      PIXEL_OPENCODE_URL: target, PIXEL_OPENCODE_DIRECTORY: root,
      PIXEL_OPENCODE_PASSWORD: providerPassword, PIXEL_OPENCODE_USERNAME: 'opencode',
      PIXEL_VERIFY_ISOLATED: '1',
    },
  });
  await waitFor(async () => (await fetch(`${appBase}/api/health`, { signal: AbortSignal.timeout(1_000) })).ok);
}
async function monitorState() {
  const response = await fetch(`${appBase}/api/state`, { headers: { 'x-monitor-token': localEnv.MONITOR_TOKEN, accept: 'application/vnd.pixel-monitor.v2+json' } });
  assert(response.ok);
  const state = await response.json();
  return { sequence: state.sequence, floors: state.floors.length, actors: state.actors.length, invocations: state.invocations.length };
}
async function ingest(kind, detail) {
  const response = await fetch(`${appBase}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-monitor-token': localEnv.MONITOR_TOKEN }, body: JSON.stringify({ v: 2, eventId: `discovery-proof-${kind}-${Date.now()}`, projectId: 'discovery-proof', sessionId: 'fixture-root', rootSessionId: 'fixture-root', occurredAt: Date.now(), kind, detail }) });
  assert(response.ok);
}
async function openSettings(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', () => report.errors++);
  page.on('console', message => { if (message.type() === 'error') report.errors++; });
  await page.goto(`${appBase}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'OpenCode discovery · Read-only' }).waitFor();
  return { context, page };
}
async function unlockAndRead(page) {
  await page.getByLabel('Discovery access secret', { exact: true }).fill(accessSecret);
  await page.getByLabel('Discovery access secret', { exact: true }).press('Enter');
  await page.getByRole('status').filter({ hasText: 'Discovery unlocked' }).waitFor();
  check('Unlock clears entered owner secret', await page.getByLabel('Discovery access secret', { exact: true }).inputValue() === '');
  await page.getByRole('button', { name: 'Check OpenCode', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'persisted records returned' }).waitFor();
}

try {
  await free(4097);
  await free(4098);
  provider = spawn(path.join(path.dirname(process.execPath), 'node_modules/opencode-ai/bin/opencode.exe'), ['serve', '--pure', '--hostname', '127.0.0.1', '--port', '4097', '--no-mdns'], { cwd: root, env: { ...process.env, OPENCODE_SERVER_PASSWORD: providerPassword, OPENCODE_SERVER_USERNAME: 'opencode' }, stdio: 'ignore' });
  await waitFor(async () => (await fetch(`${providerBase}/global/health`, { headers: { authorization }, signal: AbortSignal.timeout(1_000) })).ok);
  const health = await (await fetch(`${providerBase}/global/health`, { headers: { authorization } })).json();
  report.providerVersion = health.version;
  check('Installed provider health reports 1.18.35', health.healthy === true && health.version === '1.18.35');
  const nativeURL = new URL('/api/session', providerBase);
  nativeURL.searchParams.set('directory', root); nativeURL.searchParams.set('limit', '50'); nativeURL.searchParams.set('order', 'desc');
  const nativeBefore = await (await fetch(nativeURL, { headers: { authorization } })).json();
  report.realMetadataCount = nativeBefore.data.length;

  const { chromium } = await import(pathToFileURL(process.env.PHASE0_PLAYWRIGHT ?? path.join(process.env.LOCALAPPDATA, 'Temp/opencode/node_modules/playwright-core/index.mjs')).href);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  await startApp(providerBase);
  await ingest('session.upsert', { title: 'Discovery continuity fixture' });
  await ingest('actor.activity', { agentKey: 'senior-engineer', activity: 'working' });
  const stateBefore = await monitorState();
  const realView = await openSettings({ width: 1280, height: 800 });
  await unlockAndRead(realView.page);
  const realDTO = await realView.page.evaluate(async () => (await fetch('/api/opencode-discovery', { headers: { 'X-Pixel-Discovery': '1' }, cache: 'no-store' })).json());
  check('App reads real persisted native session IDs', realDTO.kind === 'snapshot' && realDTO.sessions.kind === 'ready' && realDTO.sessions.records.every(row => nativeBefore.data.some(native => native.id === row.id)) && realDTO.sessions.count === nativeBefore.data.length);
  const json = JSON.stringify(realDTO);
  check('Provider credentials and raw directory stay server-side', ![accessSecret, providerPassword, authorization, root].some(value => json.includes(value)));
  check('Discovery leaves monitor sequence and floors unchanged', JSON.stringify(await monitorState()) === JSON.stringify(stateBefore));
  const nativeAfter = await (await fetch(nativeURL, { headers: { authorization } })).json();
  check('Provider session metadata unchanged by discovery', JSON.stringify(nativeBefore) === JSON.stringify(nativeAfter));
  await realView.page.goto(appBase, { waitUntil: 'domcontentloaded' });
  await realView.page.locator('[data-office-actor]').first().waitFor();
  check('Existing monitor still renders ingested actors after discovery', await realView.page.locator('[data-office-actor]').count() >= 11);
  await realView.context.close();

  fixture = createServer((request, response) => {
    const url = new URL(request.url, fixtureBase);
    journal.push({ method: request.method, path: url.pathname });
    if (request.method !== 'GET') report.writesObserved++;
    if (request.headers.authorization !== authorization || fixtureMode === 'unauthorized') { response.writeHead(401, { 'content-type': 'application/json' }); response.end('{}'); return; }
    response.writeHead(200, { 'content-type': 'application/json' });
    if (url.pathname === '/global/health') { response.end(JSON.stringify({ healthy: true, version: '1.18.35' })); return; }
    if (url.pathname !== '/api/session' || url.searchParams.get('directory') !== root || url.searchParams.get('limit') !== '50' || url.searchParams.get('order') !== 'desc') { response.end('{}'); return; }
    if (fixtureMode === 'malformed') { response.end('{bad json'); return; }
    const row = (id, title, created, extra = {}) => ({ id, projectID: 'prj_fixture', title, location: { directory: root, workspaceID: 'wrk_fixture' }, time: { created, updated: created }, unused: 'private-sentinel', ...extra });
    const data = fixtureMode === 'empty' ? [] : [row('ses_fixture_child', 'Fixture child', 3000, { parentID: 'ses_fixture_parent' }), row('ses_fixture_parent', 'Fixture saved parent', 2000), row('ses_fixture_archive', 'Fixture archived session', 1000, { time: { created: 1000, updated: 1100, archived: 1200 } })];
    response.end(JSON.stringify({ data, cursor: { next: 'private-cursor-sentinel' } }));
  });
  await new Promise(resolve => fixture.listen(4098, '127.0.0.1', resolve));
  await startApp(fixtureBase);
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    fixtureMode = 'ready';
    const { page, context } = await openSettings(viewport);
    await unlockAndRead(page);
    const list = page.getByRole('list', { name: 'Persisted OpenCode session metadata' });
    check(`${label} renders parent, child and archived metadata`, await list.getByRole('listitem').count() === 3 && await list.getByText('Present in this page. Child record.', { exact: true }).count() === 1);
    check(`${label} shows explicit first-page limit`, await page.getByText(/First page only, limit 50/).count() === 1);
    check(`${label} contains no session actions`, await list.getByRole('button').count() === 0 && await list.getByRole('link').count() === 0);
    check(`${label} has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const cookies = await context.cookies();
    const cookie = cookies.find(value => value.name === 'pixel-discovery');
    check(`${label} access cookie HttpOnly and Strict`, cookie?.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/api/opencode-discovery');
    await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true, animations: 'disabled' });
    const requestHeaders = { host: '127.0.0.1:3011', origin: appBase, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', 'x-pixel-discovery': '1' };
    const beforeDenied = journal.length;
    const denied = await fetch(`${appBase}/api/opencode-discovery`, { headers: { ...requestHeaders, 'x-monitor-token': localEnv.MONITOR_TOKEN } });
    check(`${label} public monitor token cannot unlock discovery`, denied.status === 401);
    const foreign = await fetch(`${appBase}/api/opencode-discovery`, { headers: { ...requestHeaders, cookie: `pixel-discovery=${cookie.value}`, origin: 'http://127.0.0.1:9999' } });
    check(`${label} foreign origin denied before provider read`, foreign.status === 401 && journal.length === beforeDenied);
    if (label === 'desktop') {
      for (const [mode, expected] of [['empty', '0 persisted records returned'], ['unauthorized', 'rejected provider authentication'], ['malformed', 'returned invalid metadata']]) {
        fixtureMode = mode;
        await page.getByRole('button', { name: /Refresh metadata|Check OpenCode/ }).click();
        await page.getByRole('status').filter({ hasText: expected }).waitFor();
        check(`Fixture ${mode} state is explicit and clears stale rows`, await page.getByRole('list', { name: 'Persisted OpenCode session metadata' }).count() === 0);
      }
    }
    await context.close();
  }
  check('Provider fixture received only allowlisted GETs', journal.every(entry => entry.method === 'GET' && ['/global/health', '/api/session'].includes(entry.path)) && report.writesObserved === 0);
  check('No browser errors', report.errors === 0);
} catch {
  report.failureAt = stage;
  process.exitCode = 1;
} finally {
  const browserClosed = browser ? await Promise.race([browser.close().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5_000))]) : true;
  const appExited = await stop(app);
  const providerExited = await stop(provider);
  if (fixture) { fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)); }
  report.cleanup = { browserClosed, appExited, providerExited };
  report.completed = !report.failureAt && report.checks.every(item => item.passed) && browserClosed && appExited && providerExited;
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completed: report.completed, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, realMetadataCount: report.realMetadataCount, failureAt: report.failureAt ?? null, cleanup: report.cleanup }));
  if (!report.completed) process.exitCode = 1;
}
