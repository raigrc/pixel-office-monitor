import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const root = process.cwd();
const env = parseEnv(readFileSync(path.join(root, '.env.local'), 'utf8'));
const output = path.join(root, 'Temp/opencode/production-discovery');
mkdirSync(output, { recursive: true });
const report = { completed: false, checks: [], startedAt: new Date().toISOString(), processesStarted: 0, processesStopped: 0 };
let browser;
let stage = 'configuration';
function check(name, passed) {
  stage = name;
  report.checks.push({ name, passed: Boolean(passed) });
  assert(Boolean(passed), name);
}
async function monitorSummary(base) {
  const response = await fetch(`${base}/api/state`, { headers: { accept: 'application/vnd.pixel-monitor.v2+json', 'x-monitor-token': env.MONITOR_TOKEN }, signal: AbortSignal.timeout(5_000) });
  assert(response.ok);
  const state = await response.json();
  return { sequence: state.sequence, floors: state.floors.length, actors: state.actors.length };
}

try {
  for (const key of ['PIXEL_DISCOVERY_ORIGIN', 'PIXEL_DISCOVERY_ACCESS_SECRET', 'PIXEL_OPENCODE_URL', 'PIXEL_OPENCODE_DIRECTORY']) assert(env[key]);
  const app = new URL(env.PIXEL_DISCOVERY_ORIGIN);
  const provider = new URL(env.PIXEL_OPENCODE_URL);
  assert(app.hostname === '127.0.0.1' && app.port === '3001');
  assert(provider.hostname === '127.0.0.1' && ['http:', 'https:'].includes(provider.protocol));
  const headers = { accept: 'application/json' };
  if (env.PIXEL_OPENCODE_PASSWORD) headers.authorization = `Basic ${Buffer.from(`${env.PIXEL_OPENCODE_USERNAME ?? 'opencode'}:${env.PIXEL_OPENCODE_PASSWORD}`).toString('base64')}`;
  stage = 'existing provider health';
  const healthResponse = await fetch(new URL('/global/health', provider), { headers, redirect: 'manual', signal: AbortSignal.timeout(5_000) });
  report.providerHttpStatus = healthResponse.status;
  assert(healthResponse.ok);
  const health = await healthResponse.json();
  check('Existing provider reports supported OpenCode 1.18.35', health.healthy === true && health.version === '1.18.35');
  report.providerVersion = health.version;
  const nativeURL = new URL('/api/session', provider);
  nativeURL.searchParams.set('directory', env.PIXEL_OPENCODE_DIRECTORY);
  nativeURL.searchParams.set('limit', '50'); nativeURL.searchParams.set('order', 'desc');
  const nativeResponse = await fetch(nativeURL, { headers, redirect: 'manual', signal: AbortSignal.timeout(8_000) });
  assert(nativeResponse.ok);
  const native = await nativeResponse.json();
  assert(Array.isArray(native.data));
  report.nativeReturnedCount = native.data.length;
  const before = await monitorSummary(app.origin);
  const { chromium } = await import(pathToFileURL(process.env.PHASE0_PLAYWRIGHT ?? path.join(process.env.LOCALAPPDATA, 'Temp/opencode/node_modules/playwright-core/index.mjs')).href);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let monitorWrites = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ingest') monitorWrites++; });
  stage = 'production Settings panel';
  await page.goto(new URL('/settings', app).href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'OpenCode discovery · Read-only' }).waitFor();
  await page.getByLabel('Discovery access secret', { exact: true }).fill(env.PIXEL_DISCOVERY_ACCESS_SECRET);
  stage = 'production unlock';
  const unlockResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/opencode-discovery' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Unlock discovery' }).click();
  report.unlockHttpStatus = (await unlockResponse).status();
  await page.getByRole('status').filter({ hasText: 'Discovery unlocked' }).waitFor();
  check('Production unlock succeeds and clears input', await page.getByLabel('Discovery access secret', { exact: true }).inputValue() === '');
  await page.getByRole('button', { name: 'Check OpenCode', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'persisted records returned' }).waitFor();
  const dto = await page.evaluate(async () => (await fetch('/api/opencode-discovery', { headers: { 'X-Pixel-Discovery': '1' }, cache: 'no-store' })).json());
  check('Production discovery is configured and lists metadata', dto.kind === 'snapshot' && dto.sessions.kind === 'ready');
  report.productionReturnedCount = dto.sessions.count;
  check('Production matches native session IDs and count', dto.sessions.count === native.data.length && dto.sessions.records.every(record => native.data.some(row => row.id === record.id)));
  const serialized = JSON.stringify(dto);
  check('Private credentials and directory absent from browser DTO', ![env.PIXEL_DISCOVERY_ACCESS_SECRET, env.PIXEL_OPENCODE_PASSWORD, env.PIXEL_OPENCODE_DIRECTORY].filter(Boolean).some(value => serialized.includes(value)));
   const list = page.getByRole('list', { name: 'Persisted OpenCode session metadata' });
   check('Metadata offers only read-only inspection', await list.getByRole('button').count() === dto.sessions.count && await list.getByRole('button', { name: 'Inspect recorded messages', exact: true }).count() === dto.sessions.count);
  check('Discovery sends no monitor ingest requests', monitorWrites === 0);
  const after = await monitorSummary(app.origin);
  report.monitorStateUnchangedDuringWindow = JSON.stringify(before) === JSON.stringify(after);
  report.completed = report.checks.every(item => item.passed);
} catch (error) {
  report.failureAt = stage;
  const code = error?.cause?.code;
  if (typeof code === 'string' && /^[A-Z_]+$/.test(code)) report.connectionError = code;
  process.exitCode = 1;
} finally {
  report.browserClosed = browser ? await Promise.race([browser.close().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5_000))]) : true;
  report.finishedAt = new Date().toISOString();
  if (!report.browserClosed) { report.completed = false; process.exitCode = 1; }
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completed: report.completed, checks: report.checks.length, nativeReturnedCount: report.nativeReturnedCount ?? null, productionReturnedCount: report.productionReturnedCount ?? null, failureAt: report.failureAt ?? null, providerHttpStatus: report.providerHttpStatus ?? null, unlockHttpStatus: report.unlockHttpStatus ?? null, connectionError: report.connectionError ?? null, processesStarted: 0, processesStopped: 0 }));
}
