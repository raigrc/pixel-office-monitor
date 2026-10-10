import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const root = process.cwd();
const local = parseEnv(readFileSync(path.join(root, '.env.local'), 'utf8'));
const production = process.argv.includes('--production');
assert(process.argv.slice(2).every(arg => arg === '--production'));
const base = production ? local.PIXEL_DISCOVERY_ORIGIN : 'http://127.0.0.1:3011';
const fixtureBase = 'http://127.0.0.1:4198';
const secret = production ? local.PIXEL_DISCOVERY_ACCESS_SECRET : randomBytes(32).toString('base64url');
const output = path.join(root, `Temp/opencode/${production ? 'production-history' : 'history/browser'}`);
const report = { checks: [], completed: false, browserErrors: 0, providerWrites: 0, monitorWrites: 0, startedAt: new Date().toISOString(), limitations: ['Read-only APIs can initialize provider-managed location metadata.', 'Profile enrollment detects config drift, not same-endpoint non-pure process replacement.', 'Only first 50 native sessions are eligible. No raw history or real screenshots retained.'] };
report.measurements = { monitorState: 'V2 sequence and floor/actor/invocation counts, not full state equality', providerWrites: production ? 'Provider internals not instrumented; application source sends fixed GETs only' : 'Non-GET requests to fixture provider only', providerIdentity: 'Native ID/project/parent/workspace/creation tuples, not atomic metadata equality', browserErrors: 'Page errors, not every console message', restoration: 'Synthetic lifecycle handlers plus real navigation/back; BFCache use not guaranteed' };
let app; let fixture; let browser; let browserServer; let stage = 'setup';
let held; let fixtureMode = 'ready';
const heldHealth = [];
const journal = [];
mkdirSync(output, { recursive: true });
function check(name, passed) { stage = name; report.checks.push({ name, passed: Boolean(passed) }); console.log(`${name}: ${passed ? 'pass' : 'fail'}`); assert(Boolean(passed), name); }
async function waitFor(predicate) { const end = Date.now() + 30000; while (Date.now() < end) { try { if (await predicate()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Verification deadline'); }
async function free(port) { await new Promise((resolve, reject) => { const socket = net.createServer(); socket.once('error', () => reject(new Error('Verification port occupied'))); socket.listen(port, '127.0.0.1', () => socket.close(resolve)); }); }
async function stop(child) { if (!child || child.exitCode !== null) return true; const exited = new Promise(resolve => child.once('exit', () => resolve(true))); child.kill(); return Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(false), 5000))]); }
function profile(env) { const directory = path.win32.normalize(env.PIXEL_OPENCODE_DIRECTORY).replace(/[\\/]+$/, '').toLowerCase(); return createHash('sha256').update(JSON.stringify(['pixel-opencode-history-v1', env.PIXEL_OPENCODE_URL, directory, env.PIXEL_OPENCODE_USERNAME ?? 'opencode', env.PIXEL_OPENCODE_PASSWORD || null, '1.18.35'])).digest('hex'); }
async function startApp(env) {
  check('Previous isolated app stopped', await stop(app)); await free(3011);
  stage = 'isolated app start';
  app = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '3011'], { cwd: root, stdio: 'ignore', env: { ...process.env, ...local, ...env, PIXEL_DISCOVERY_ORIGIN: base, PIXEL_DISCOVERY_ACCESS_SECRET: secret, PIXEL_VERIFY_ISOLATED: '1' } });
  await waitFor(async () => (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).ok);
}
async function summary() { const response = await fetch(`${base}/api/state`, { headers: { accept: 'application/vnd.pixel-monitor.v2+json', 'x-monitor-token': local.MONITOR_TOKEN }, signal: AbortSignal.timeout(5000) }); assert(response.ok); const state = await response.json(); return { sequence: state.sequence, floors: state.floors.length, actors: state.actors.length, invocations: state.invocations.length }; }
async function settings(viewport = { width: 1280, height: 800 }) {
  stage = 'Settings unlock and metadata';
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' }); const page = await context.newPage();
  page.on('pageerror', () => report.browserErrors++);
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ingest') report.monitorWrites++; });
  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Discovery access secret', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Unlock discovery', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Discovery unlocked' }).waitFor();
  await page.getByRole('button', { name: 'Check OpenCode', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'persisted records returned' }).waitFor();
  return { context, page };
}
async function read(page, id, cursor) { return page.evaluate(async ({ id, cursor }) => { const response = await fetch('/api/opencode-discovery/history', { headers: { 'X-Pixel-Discovery': '1', 'X-Pixel-History-Session': id, ...(cursor ? { 'X-Pixel-History-Cursor': cursor } : {}) }, cache: 'no-store' }); return { status: response.status, cache: response.headers.get('cache-control'), dto: await response.json() }; }, { id, cursor }); }
function identities(data) { return data.map(row => [row.id, row.projectID, row.parentID ?? null, row.location.workspaceID ?? null, row.time.created]).sort((a, b) => a[0].localeCompare(b[0])); }
const inspector = page => page.getByRole('region', { name: 'Session Inspector · Read-only' });
async function inspect(page, index = 0) { await page.getByRole('button', { name: 'Inspect recorded messages', exact: true }).nth(index).click(); await inspector(page).waitFor(); }

try {
  const { chromium } = await import(pathToFileURL(process.env.PHASE0_PLAYWRIGHT ?? path.join(process.env.LOCALAPPDATA, 'Temp/opencode/node_modules/playwright-core/index.mjs')).href);
  browserServer = await chromium.launchServer({ host: '127.0.0.1', executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const providerHeaders = { accept: 'application/json' };
  if (local.PIXEL_OPENCODE_PASSWORD) providerHeaders.authorization = `Basic ${Buffer.from(`${local.PIXEL_OPENCODE_USERNAME ?? 'opencode'}:${local.PIXEL_OPENCODE_PASSWORD}`).toString('base64')}`;
  const health = await (await fetch(`${local.PIXEL_OPENCODE_URL}/global/health`, { headers: providerHeaders, redirect: 'manual', signal: AbortSignal.timeout(5000) })).json();
  check('Owner provider remains supported OpenCode 1.18.35', health.healthy === true && health.version === '1.18.35');
  stage = 'native first-page listing';
  const nativeURL = new URL('/api/session', local.PIXEL_OPENCODE_URL); nativeURL.searchParams.set('directory', local.PIXEL_OPENCODE_DIRECTORY); nativeURL.searchParams.set('limit', '50'); nativeURL.searchParams.set('order', 'desc');
  const nativeBefore = await (await fetch(nativeURL, { headers: providerHeaders, signal: AbortSignal.timeout(8000) })).json();
  if (!production) await startApp({});
  const real = await settings(); const before = await summary();
  const metadata = await real.page.evaluate(async () => (await fetch('/api/opencode-discovery', { headers: { 'X-Pixel-Discovery': '1' } })).json());
  check('Discovery and native first-page IDs agree', metadata.kind === 'snapshot' && metadata.sessions.kind === 'ready' && metadata.sessions.count === nativeBefore.data.length && metadata.sessions.records.every(row => nativeBefore.data.some(native => native.id === row.id)));
  let chosen; let index = -1; let attempted = 0; const rejected = {};
  for (const [i, row] of metadata.sessions.records.entries()) {
    attempted++; const result = await read(real.page, row.id);
    if (result.dto.kind === 'history-page' && result.dto.messages.length > 0 && result.dto.olderCursor) { chosen = result; index = i; break; }
    const kind = result.dto.kind === 'failure' ? result.dto.problem.code : result.dto.kind; rejected[kind] = (rejected[kind] ?? 0) + 1;
  }
  report.realCandidateReads = attempted; report.realCandidateResults = rejected;
  check('Real bounded legacy history provides older continuation', chosen?.dto.kind === 'history-page');
  const latest = chosen.dto; const older = await read(real.page, latest.session.id, latest.olderCursor);
  check('Real older page replaces latest without overlapping messages', older.dto.kind === 'history-page' && older.dto.messages.length > 0 && older.dto.messages.every(message => !latest.messages.some(last => last.id === message.id)) && older.dto.messages.at(-1).time.created <= latest.messages[0].time.created);
  const privateValues = [secret, local.PIXEL_OPENCODE_PASSWORD, providerHeaders.authorization].filter(Boolean);
  check('Real DTO is private no-store, redacted and below 64 KiB', chosen.cache === 'private, no-store' && [latest, older.dto].every(dto => Buffer.byteLength(JSON.stringify(dto)) <= 65536 && !privateValues.some(value => JSON.stringify(dto).includes(value))));
  report.realLatestMessages = latest.messages.length; report.realOlderMessages = older.dto.messages.length;
  report.realRecordedToolParts = [...latest.messages, ...older.dto.messages].flatMap(message => message.parts).filter(part => part.kind === 'recorded-tool').length;
  await inspect(real.page, index);
  check('Real Inspector renders and receives keyboard focus', await inspector(real.page).getByRole('listitem').count() > 0 && await real.page.getByRole('heading', { name: 'Session Inspector · Read-only' }).evaluate(element => element === document.activeElement));
  await inspector(real.page).getByRole('button', { name: 'Older messages', exact: true }).click(); await inspector(real.page).waitFor();
  await inspector(real.page).getByRole('button', { name: 'Clear inspection', exact: true }).click();
  check('Real Clear removes message DOM', await inspector(real.page).count() === 0);
  const nativeAfter = await (await fetch(nativeURL, { headers: providerHeaders, signal: AbortSignal.timeout(8000) })).json();
  check('Real reads preserve provider session identities', JSON.stringify(identities(nativeBefore.data)) === JSON.stringify(identities(nativeAfter.data)));
  report.monitorStateUnchangedDuringWindow = JSON.stringify(before) === JSON.stringify(await summary());
  if (!production) check('Isolated monitor state unchanged by real inspection', report.monitorStateUnchangedDuringWindow);
  await real.context.close();

  if (!production) {
    await free(4198);
    const fixtureEnv = { PIXEL_OPENCODE_URL: fixtureBase, PIXEL_OPENCODE_DIRECTORY: root, PIXEL_OPENCODE_USERNAME: 'opencode', PIXEL_OPENCODE_PASSWORD: randomBytes(32).toString('base64url') };
    fixtureEnv.PIXEL_OPENCODE_HISTORY_PROFILE = profile(fixtureEnv);
    const fixtureAuthorization = `Basic ${Buffer.from(`opencode:${fixtureEnv.PIXEL_OPENCODE_PASSWORD}`).toString('base64')}`;
    const rows = [
      { id: 'ses_fixture_a', projectID: 'prj_fixture', title: 'History fixture A', location: { directory: root }, time: { created: 2, updated: 2 } },
      { id: 'ses_fixture_b', projectID: 'prj_fixture', parentID: 'ses_fixture_a', title: 'History fixture B', location: { directory: root }, time: { created: 1, updated: 1 } },
    ];
    fixture = createServer((request, response) => {
      const url = new URL(request.url, fixtureBase); journal.push({ method: request.method, path: url.pathname });
      if (request.method !== 'GET') report.providerWrites++;
      if (request.headers.authorization !== fixtureAuthorization) { response.writeHead(401); response.end(); return; }
      response.setHeader('content-type', 'application/json');
      const send = value => response.end(JSON.stringify(value));
      if (url.pathname === '/global/health') { const health = () => send({ healthy: true, version: '1.18.35' }); if (fixtureMode === 'held-health') heldHealth.push(health); else health(); return; }
      if (url.pathname === '/api/session') { send({ data: rows, cursor: {} }); return; }
      const row = rows.find(row => url.pathname === `/session/${row.id}` || url.pathname === `/session/${row.id}/message`);
      if (!row || url.searchParams.get('directory') !== root) { response.statusCode = 404; send({}); return; }
      if (!url.pathname.endsWith('/message')) { send({ ...row, directory: root }); return; }
      if (fixtureMode === 'error') { response.statusCode = 503; send({}); return; }
      const older = url.searchParams.has('before'); const id = older ? 'msg_1' : 'msg_2';
      const binding = { sessionID: row.id, messageID: id };
      if (!older) response.setHeader('x-next-cursor', Buffer.from(JSON.stringify({ id, time: 20 })).toString('base64url'));
      const body = [{ info: { id, sessionID: row.id, role: older ? 'user' : 'assistant', agent: 'build', time: { created: older ? 10 : 20 } }, parts: [
        { ...binding, id: 'prt_text', type: 'text', text: older ? 'Older fixture message' : `Saved ${row.id} <img src="https://example.invalid/trap" onerror="window.__historyTrap=1"> ${secret} ${'界'.repeat(1500)}` },
        { ...binding, id: 'prt_tool', type: 'tool', tool: 'read', state: { status: 'completed', input: { password: 'private-fixture-password', query: 'saved query' }, output: `Bearer ${fixtureEnv.PIXEL_OPENCODE_PASSWORD}`, time: { start: 21, end: 22 } } },
        { ...binding, id: 'prt_running', type: 'tool', tool: 'task', state: { status: 'running', input: {}, time: { start: 22 } } },
        { ...binding, id: 'prt_reason', type: 'reasoning', text: 'PRIVATE REASONING FIXTURE' },
        { ...binding, id: 'prt_file', type: 'file', url: 'https://example.invalid/private' },
      ] }];
      if (fixtureMode === 'held' && row.id === 'ses_fixture_a') { held = () => send(body); return; }
      send(body);
    });
    await new Promise(resolve => fixture.listen(4198, '127.0.0.1', resolve));
    await startApp(fixtureEnv);
    for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
      fixtureMode = 'ready'; const { page, context } = await settings(viewport); const initial = await summary();
      let external = 0; page.on('request', request => { if (new URL(request.url()).hostname === 'example.invalid') external++; });
      await inspect(page);
      await inspector(page).getByText('Recorded tool read. Recorded status completed.', { exact: true }).click();
      check(`${label} text is inert and tool credentials redacted`, await inspector(page).getByText('{"password":"[REDACTED]","query":"saved query"}', { exact: true }).count() === 1 && await inspector(page).getByText('Bearer [REDACTED]', { exact: true }).count() === 1 && await inspector(page).locator('img, iframe, a').count() === 0 && external === 0 && !(await page.evaluate(() => window.__historyTrap)));
      check(`${label} recorded running status and omitted content are explicit`, await inspector(page).getByText('Recorded tool task. Recorded status running.', { exact: true }).count() === 1 && !(await inspector(page).textContent()).includes('PRIVATE REASONING FIXTURE'));
      await inspector(page).getByRole('button', { name: 'Older messages', exact: true }).click(); await inspector(page).getByText('Older fixture message', { exact: true }).waitFor();
      check(`${label} older page replaces text and preserves usable paging focus`, await inspector(page).getByText(/Saved ses_fixture_a/).count() === 0 && await page.getByRole('button', { name: 'Latest messages', exact: true }).evaluate(element => element === document.activeElement));
      await inspector(page).getByRole('button', { name: 'Latest messages', exact: true }).click(); await inspector(page).waitFor();
      await inspector(page).getByRole('button', { name: 'Inspect loaded child ses_fixture_b', exact: true }).click(); await inspector(page).getByText(/Native session ses_fixture_b/).waitFor();
      check(`${label} relationships select loaded native child`, await inspector(page).getByRole('button', { name: 'Inspect loaded parent', exact: true }).count() === 1);
      check(`${label} page fits viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true, animations: 'disabled' });
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
      check(`${label} pagehide disposes history`, await inspector(page).count() === 0);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      check(`${label} restored page requires deliberate read`, await inspector(page).count() === 0);
      if (label === 'desktop') {
        fixtureMode = 'held-health';
        const pendingMetadata = page.evaluate(async () => (await (await fetch('/api/opencode-discovery', { headers: { 'X-Pixel-Discovery': '1' } })).json()).kind);
        const pendingHistory = read(page, 'ses_fixture_a');
        await waitFor(() => heldHealth.length === 2);
        const busy = await read(page, 'ses_fixture_b');
        check('Production route bundles share two-read admission', busy.status === 429 && busy.dto.kind === 'failure' && busy.dto.problem.code === 'busy');
        fixtureMode = 'ready'; for (const release of heldHealth.splice(0)) release();
        check('Cross-route admission recovers after both reads finish', await pendingMetadata === 'snapshot' && (await pendingHistory).dto.kind === 'history-page');
        const bounded = (await read(page, 'ses_fixture_a')).dto;
        await context.route('**/api/opencode-discovery/history', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...bounded, expires: Date.now() - 1000 }) }));
        await page.getByRole('button', { name: 'Inspect recorded messages', exact: true }).first().click();
        await page.getByRole('status').filter({ hasText: 'inspection expired' }).waitFor();
        check('Expired response never displays message DOM', await inspector(page).count() === 0);
        await context.unroute('**/api/opencode-discovery/history');
        await context.route('**/api/opencode-discovery/history', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...bounded, expires: Date.now() + 1500 }) }));
        await inspect(page); await inspector(page).waitFor({ state: 'hidden' });
        check('Client inspection expiry disposes message DOM', await inspector(page).count() === 0);
        await context.unroute('**/api/opencode-discovery/history');
        fixtureMode = 'held'; held = undefined;
        await page.getByRole('button', { name: 'Inspect recorded messages', exact: true }).first().click(); await waitFor(() => Boolean(held));
        await inspect(page, 1); held(); held = undefined; await new Promise(resolve => setTimeout(resolve, 150));
        check('Late selection A cannot overwrite B', await inspector(page).getByText(/Native session ses_fixture_b/).count() === 1 && await inspector(page).getByText(/Saved ses_fixture_a/).count() === 0);
        held = undefined; await page.getByRole('button', { name: 'Inspect recorded messages', exact: true }).first().click(); await waitFor(() => Boolean(held));
        await page.getByRole('button', { name: 'Clear inspection', exact: true }).click(); held(); held = undefined; await new Promise(resolve => setTimeout(resolve, 150));
        check('Clear during pending read rejects late response', await inspector(page).count() === 0);
        fixtureMode = 'ready'; await inspect(page);
        fixtureMode = 'error'; await inspector(page).getByRole('button', { name: 'Latest messages', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'could not complete this read' }).waitFor();
        check('Provider failure clears old recorded message DOM', await inspector(page).count() === 0);
        fixtureMode = 'ready'; await inspect(page);
        await page.getByRole('button', { name: 'Refresh metadata', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'persisted records returned' }).waitFor();
        check('Metadata refresh clears Inspector', await inspector(page).count() === 0);
        await inspect(page);
        const historyReads = journal.filter(entry => entry.path.endsWith('/message')).length;
        await page.goto(`${base}/demo`, { waitUntil: 'domcontentloaded' });
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'OpenCode discovery · Read-only' }).waitFor();
        await inspector(page).waitFor({ state: 'hidden' });
        check('Real navigation/back discards Inspector without automatic history read', await inspector(page).count() === 0 && journal.filter(entry => entry.path.endsWith('/message')).length === historyReads);
      }
      check(`${label} no private history or cursor in browser storage or URL`, await page.evaluate(({ secret, password }) => { const stored = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }); return ![secret, password, 'Older fixture message', 'Saved ses_fixture', 'olderCursor'].some(value => stored.includes(value)) && !location.search && !location.hash; }, { secret, password: fixtureEnv.PIXEL_OPENCODE_PASSWORD }));
      check(`${label} no monitor state changes from fixture history`, JSON.stringify(await summary()) === JSON.stringify(initial));
      await context.close();
    }
    check('Fixture provider received only fixed allowlisted GETs', report.providerWrites === 0 && journal.every(entry => entry.method === 'GET' && ['/global/health', '/api/session', '/session/ses_fixture_a', '/session/ses_fixture_a/message', '/session/ses_fixture_b', '/session/ses_fixture_b/message'].includes(entry.path)));
  }
  check('Inspector sends no monitor ingestion', report.monitorWrites === 0);
  check('No browser page errors', report.browserErrors === 0);
} catch (error) {
  report.failureAt = stage;
  if (['AbortError', 'TimeoutError', 'AssertionError'].includes(error?.name)) report.failureType = error.name;
  process.exitCode = 1;
}
finally {
  let browserClosed = browserServer ? await Promise.race([browserServer.close().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]) : true;
  if (!browserClosed) {
    report.ownedBrowserForcedStop = true;
    browserClosed = await Promise.race([browserServer.kill().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]);
  }
  const appStopped = await stop(app);
  if (fixture) { fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)); }
  report.cleanup = { browserClosed, isolatedAppStopped: appStopped, userProcessesChanged: false };
  report.completed = !report.failureAt && report.checks.every(check => check.passed) && browserClosed && appStopped;
  report.finishedAt = new Date().toISOString(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completed: report.completed, checks: report.checks.length, failureAt: report.failureAt ?? null, realCandidateReads: report.realCandidateReads ?? 0, realLatestMessages: report.realLatestMessages ?? 0, realOlderMessages: report.realOlderMessages ?? 0, cleanup: report.cleanup }));
  if (!report.completed) process.exitCode = 1;
}
