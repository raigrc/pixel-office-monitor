import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const output = path.join(root, 'Temp/opencode/phase0/browser');
const port = 3011;
const base = `http://127.0.0.1:${port}`;
const pluginPath = path.join(process.env.USERPROFILE, '.config/opencode/plugins/pixel-monitor.js');
const playwrightPath = process.env.PHASE0_PLAYWRIGHT ?? path.join(process.env.LOCALAPPDATA, 'Temp/opencode/node_modules/playwright-core/index.mjs');
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
assert(existsSync(pluginPath), 'Installed OpenCode plugin required');
assert(existsSync(playwrightPath), 'Set PHASE0_PLAYWRIGHT to installed playwright-core/index.mjs');
process.loadEnvFile(path.join(root, '.env.local'));
const token = process.env.MONITOR_TOKEN ?? process.env.PIXEL_MONITOR_TOKEN;
assert(token, 'Configured monitor token required');
assert.equal(token, process.env.NEXT_PUBLIC_PIXEL_MONITOR_TOKEN, 'Browser and server tokens must match');
process.env.PIXEL_MONITOR_URL = `${base}/api/ingest`;
process.env.PIXEL_MONITOR_TOKEN = token;
mkdirSync(output, { recursive: true });

const checks = [];
let server;
let browser;
const browserErrors = [];
const streams = [];
const report = { checks, browserErrors, liveCli: null, limitations: ['Fixture task hooks are replayed through the installed plugin; they are not a real delegated model run.', 'Canvas visibility does not prove individual close-zoom actors are free of occlusion.'] };
report.startedAt = new Date().toISOString();
report.completed = false;
writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
function check(name, value) {
  checks.push({ name, passed: Boolean(value) });
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`${name}: ${value ? 'pass' : 'fail'}`);
  assert(value, name);
}
async function poll(predicate, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(label);
}
async function snapshot() {
  const response = await fetch(`${base}/api/state`, { headers: { 'x-monitor-token': token, accept: 'application/vnd.pixel-monitor.v2+json' } });
  assert.equal(response.status, 200);
  return response.json();
}
async function runCli() {
  const executable = process.env.PHASE0_OPENCODE ?? path.join(path.dirname(process.execPath), 'node_modules/opencode-ai/bin/opencode.exe');
  const child = spawn(executable, ['run', '--format', 'json', '--title', 'Phase 0 monitor smoke', 'Reply exactly PHASE0_MONITOR_OK. Do not use tools or modify files.'], {
    cwd: root, env: { ...process.env, OPENCODE_PERMISSION: '{"*":"deny"}' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let responseSeen = false;
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stdoutBuffer = '';
  const eventTypes = new Set();
  const errorNames = new Set();
  const diagnostics = new Set();
  const classify = chunk => {
    const text = chunk.toString();
    for (const label of ['not recognized', 'syntax', 'ModelNotFound', 'ProviderModelNotFound', 'Unauthorized', 'Authentication', 'permission', 'No configuration', 'ENOENT', 'not found', 'Error']) {
      if (text.toLowerCase().includes(label.toLowerCase())) diagnostics.add(label);
    }
  };
  child.stdout.on('data', chunk => {
    stdoutBytes += chunk.length;
    classify(chunk);
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (['text', 'error', 'step_start', 'step_finish', 'tool_use'].includes(event.type)) eventTypes.add(event.type);
        if (event.type === 'text' && event.part?.text?.trim() === 'PHASE0_MONITOR_OK') responseSeen = true;
        if (event.type === 'error' && /^[A-Za-z]+Error$/.test(event.error?.name ?? '')) errorNames.add(event.error.name);
      } catch {}
    }
  });
  child.stderr.on('data', chunk => { stderrBytes += chunk.length; classify(chunk); });
  const timer = setTimeout(() => {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  }, 150_000);
  return new Promise(resolve => {
    child.once('error', () => { clearTimeout(timer); resolve({ exitCode: null, responseSeen, launchFailed: true }); });
    child.once('close', code => { clearTimeout(timer); resolve({ exitCode: code, responseSeen, stdoutBytes, stderrBytes, diagnostics: [...diagnostics], eventTypes: [...eventTypes], errorNames: [...errorNames] }); });
  });
}

try {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Verification port 3011 occupied; existing process preserved')));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: root, env: { ...process.env, PIXEL_VERIFY_ISOLATED: '1' }, stdio: 'ignore' });
  report.serverPid = server.pid;
  await poll(async () => {
    if (server.exitCode !== null) throw new Error('Isolated server exited');
    try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; }
  }, 'Isolated server startup timed out');
  check('Isolated loopback production server healthy', true);
  check('Unauthenticated SSE rejected', (await fetch(`${base}/api/events`)).status === 401);
  check('Unauthenticated ingest rejected', (await fetch(`${base}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status === 401);

  const before = await snapshot();
  report.liveCli = await runCli();
  const after = await snapshot();
  const liveFloors = after.floors.filter(floor => !before.floors.some(previous => previous.floorId === floor.floorId));
  report.liveCli.observedFloors = liveFloors.length;
  report.liveCli.observedActors = after.actors.filter(actor => liveFloors.some(floor => actor.floorId === floor.floorId)).length;
  checks.push({ name: 'Real OpenCode CLI completed minimal no-tool prompt', passed: report.liveCli.exitCode === 0 && report.liveCli.responseSeen });
  checks.push({ name: 'Real OpenCode plugin delivered session and actors', passed: liveFloors.length > 0 && report.liveCli.observedActors > 0 });

  const originalLog = console.log;
  let hooks;
  try {
    console.log = () => {};
    const { PixelMonitor } = await import(pathToFileURL(pluginPath).href);
    hooks = await PixelMonitor({ client: { app: { log: async () => {} } }, directory: 'phase0-fixture' });
  } finally { console.log = originalLog; }
  const sessionID = `phase0-${process.pid}`;
  const childSessionID = `${sessionID}-child`;
  const floorId = `phase0-fixture:${sessionID}`;
  const callID = `phase0-call-${process.pid}`;
  await hooks.event({ event: { type: 'session.created', properties: { info: { id: sessionID, title: 'Phase 0 delegation smoke' } } } });
  await new Promise(resolve => setTimeout(resolve, 350));
  await hooks.event({ event: { type: 'session.status', properties: { sessionID, status: { type: 'busy' } } } });
  await poll(async () => (await snapshot()).floors.some(floor => floor.floorId === floorId), 'Installed plugin fixture session not ingested');

  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  browser = await chromium.launch({ executablePath: chromePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', () => browserErrors.push(`${name}: pageerror`));
    page.on('console', message => { if (message.type() === 'error') browserErrors.push(`${name}: console error`); });
    page.on('response', response => { if (new URL(response.url()).pathname === '/api/events') streams.push({ viewport: name, status: response.status() }); });
    await page.addInitScript(id => { localStorage.setItem('pixel:activeFloor', id); localStorage.setItem('pixel:followActivity', 'false'); }, floorId);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator(`[data-office-actor="${floorId}:orchestrator"]`).waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-time-stage] img')].every(image => image.complete && image.naturalWidth > 0));
    check(`${name} session and actors render from authenticated SSE`, await page.locator('[data-office-actor]').count() >= 12);
    const geometry = await page.locator('[data-time-stage]').boundingBox();
    check(`${name} 2D room contained`, geometry.x >= -1 && geometry.y >= -1 && geometry.x + geometry.width <= viewport.width + 1 && geometry.y + geometry.height <= viewport.height + 1);
    check(`${name} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    if (name === 'desktop') {
      const input = { tool: 'task', sessionID, callID };
      const args = { subagent_type: 'senior-engineer', description: 'Phase 0 harmless delegation fixture' };
      await hooks['tool.execute.before'](input, { args });
      await hooks.event({ event: { type: 'session.created', properties: { info: { id: childSessionID, parentID: sessionID, title: args.description } } } });
      await poll(async () => (await snapshot()).invocations.some(invocation => invocation.callId === callID && invocation.executionStatus === 'started'), 'Installed task hook invocation not ingested');
      const state = await snapshot();
      check('Child session shares root floor', state.sessions.some(session => session.sessionId === childSessionID && session.rootSessionId === sessionID));
      const actor = state.actors.find(candidate => candidate.floorId === floorId && candidate.agentKey === 'senior-engineer');
      await page.locator(`[data-office-actor="${actor.actorId}"]`).click({ force: true });
      await page.getByRole('dialog').waitFor();
      check('Live delegation updates inspector', await page.getByRole('dialog').getByText('WORKING', { exact: true }).count() > 0);
      await page.getByRole('button', { name: 'Close inspector' }).click();
      await page.screenshot({ path: path.join(output, 'desktop-delegation.png'), animations: 'disabled' });
      await hooks['tool.execute.after']({ ...input, args }, { success: true, output: 'Fixture completed' });
      await poll(async () => (await snapshot()).invocations.some(invocation => invocation.callId === callID && invocation.executionStatus === 'finished' && invocation.outcome === 'succeeded'), 'Task completion not ingested');
      check('Installed task hook completes same invocation', true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator(`[data-office-actor="${actor.actorId}"]`).waitFor();
      check('Refresh retains session selection and actors', true);
      await page.getByRole('button', { name: 'Switch to 3D view' }).click();
      await page.locator('[aria-label^="3D office agents"] canvas').waitFor({ timeout: 60_000 });
      await page.waitForTimeout(2_000);
      check('Retained 3D opens with single canvas', await page.locator('canvas').count() === 1);
      await page.screenshot({ path: path.join(output, 'desktop-3d.png'), timeout: 60_000 });
      await page.getByRole('button', { name: 'Switch to 2D view' }).click();
      await page.getByRole('button', { name: 'Switch to 3D view' }).click();
      check('View toggle keeps one 3D canvas', await page.locator('canvas').count() === 1);
    } else {
      await page.screenshot({ path: path.join(output, 'mobile.png'), animations: 'disabled' });
    }
    await context.close();
  }
  check('Desktop and mobile SSE authenticated', ['desktop', 'mobile'].every(name => streams.some(stream => stream.viewport === name && stream.status === 200)));
  check('No browser console errors', browserErrors.length === 0);
  if (checks.some(item => !item.passed)) process.exitCode = 1;
} catch (error) {
  report.failure = String(error.message).split('\n')[0].replaceAll(token, '[REDACTED]').replace(/token=[^\s&]+/g, 'token=[REDACTED]');
  process.exitCode = 1;
} finally {
  const browserClosed = browser ? await Promise.race([browser.close().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5_000))]) : true;
  let serverExited = !server || server.exitCode !== null;
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', () => resolve(true)));
    server.kill();
    serverExited = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(false), 5_000))]);
    if (!serverExited) {
      server.kill('SIGKILL');
      serverExited = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(false), 3_000))]);
    }
  }
  report.cleanup = { browserClosed, serverExited };
  if (!browserClosed || !serverExited) process.exitCode = 1;
  report.completed = !report.failure && checks.every(item => item.passed) && browserClosed && serverExited;
  report.recordedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: checks.length, passed: checks.filter(item => item.passed).length, liveCli: report.liveCli, failure: report.failure ?? null }));
}
process.exit(process.exitCode ?? 0);
