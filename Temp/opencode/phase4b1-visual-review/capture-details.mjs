import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/DELL/AppData/Local/Temp/opencode/webgl-verify/node_modules/playwright-core/index.mjs";

const BASE = process.argv[2] ?? "http://localhost:3011";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "phase4b1-detail";
const env = fs.readFileSync("C:\\Users\\DELL\\Desktop\\Rai\\pixel-office-monitor\\.env.local", "utf8");
const tokenMatch = env.match(/^(?:MONITOR_TOKEN|PIXEL_MONITOR_TOKEN)=(.+)$/m);
if (!tokenMatch) throw new Error("no monitor token in .env.local");
const token = tokenMatch[1].trim().replace(/^"|"$/g, "");
let sequence = 0;

function floorId(sessionId) {
  return `${PROJECT}:${sessionId}`;
}

async function request(pathname, payload) {
  const response = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-monitor-token": token },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) throw new Error(`${pathname} failed: ${response.status}`);
}

async function ingest(sessionId, kind, detail) {
  const occurredAt = Date.now();
  await request("/api/ingest", {
    v: 2,
    eventId: `phase4b1-detail-${++sequence}-${occurredAt}`,
    projectId: PROJECT,
    sessionId,
    rootSessionId: sessionId,
    occurredAt,
    kind,
    detail,
  });
}

async function seed(sessionId, roles) {
  await ingest(sessionId, "session.upsert", { title: sessionId });
  await ingest(sessionId, "actor.activity", { agentKey: "orchestrator", activity: "working" });
  for (const agentKey of roles) {
    await ingest(sessionId, "actor.activity", { agentKey, activity: "working" });
  }
}

async function closeExistingFloors() {
  const response = await fetch(`${BASE}/api/state`);
  if (!response.ok) throw new Error(`/api/state failed: ${response.status}`);
  const state = await response.json();
  for (const floor of state.floors ?? []) {
    await request(`/api/floor/${encodeURIComponent(floor.sessionID)}/close`);
  }
}

async function open3D(browser, sessionId) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(({ activeFloor }) => {
    localStorage.setItem("pixel:activeFloor", activeFloor);
    localStorage.setItem("pixel:followActivity", "false");
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: 12, liveMode: false }));
  }, { activeFloor: floorId(sessionId) });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Switch to 3D view" }).click();
  await page.waitForSelector('[aria-label^="3D office agents"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(700);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const hideNavigator = page.getByRole("button", { name: "Hide session navigator" });
  if (await hideNavigator.count()) await hideNavigator.click();
  await page.waitForTimeout(350);
  return { context, page };
}

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  await closeExistingFloors();
  await seed("pair", ["architect", "researcher"]);
  await seed("ops", ["devops", "security-reviewer", "senior-engineer"]);
  const pair = await open3D(browser, "pair");
  await pair.page.screenshot({ path: path.join(HERE, "08-architect-vs-researcher.png"), fullPage: true });

  const stage = pair.page.getByLabel("3D office agents. Use arrow keys to inspect agents and Enter to select.");
  await stage.focus();
  const keyboardIdentity = stage.locator('[aria-live="polite"]');
  await keyboardIdentity.waitFor();
  const initialIdentity = await keyboardIdentity.textContent();
  await stage.press("ArrowRight");
  await pair.page.waitForFunction(
    ({ selector, initial }) => document.querySelector(selector)?.textContent !== initial,
    { selector: '[aria-label^="3D office agents"] [aria-live="polite"]', initial: initialIdentity },
  );
  await stage.press("Enter");
  await pair.page.waitForSelector('[role="dialog"][aria-labelledby="inspector-title"]');
  await pair.page.screenshot({ path: path.join(HERE, "06-selected-agent.png"), fullPage: true });
  await pair.context.close();

  const ops = await open3D(browser, "ops");
  await ops.page.screenshot({ path: path.join(HERE, "09-devops-security-senior.png"), fullPage: true });
  await ops.context.close();

  console.log(JSON.stringify({ recaptured: ["06-selected-agent.png", "08-architect-vs-researcher.png", "09-devops-security-senior.png"] }));
} finally {
  void browser.close();
  setTimeout(() => process.exit(0), 2_000);
}
