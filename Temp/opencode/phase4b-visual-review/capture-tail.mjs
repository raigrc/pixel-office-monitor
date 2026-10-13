import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/DELL/AppData/Local/Temp/opencode/webgl-verify/node_modules/playwright-core/index.mjs";

const BASE = process.argv[2] ?? "http://localhost:3011";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "phase4b-review";
const SESSION = "root";
const FLOOR = `${PROJECT}:${SESSION}`;
const env = fs.readFileSync("C:\\Users\\DELL\\Desktop\\Rai\\pixel-office-monitor\\.env.local", "utf8");
const tokenMatch = env.match(/^(?:MONITOR_TOKEN|PIXEL_MONITOR_TOKEN)=(.+)$/m);
if (!tokenMatch) throw new Error("no monitor token in .env.local");
const token = tokenMatch[1].trim().replace(/^"|"$/g, "");
let sequence = 0;

async function ingest(kind, detail) {
  const occurredAt = Date.now();
  const response = await fetch(`${BASE}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-monitor-token": token },
    body: JSON.stringify({
      v: 2,
      eventId: `phase4b-tail-${++sequence}-${occurredAt}`,
      projectId: PROJECT,
      sessionId: SESSION,
      rootSessionId: SESSION,
      occurredAt,
      kind,
      detail,
    }),
  });
  if (!response.ok) throw new Error(`${kind} failed: ${response.status}`);
}

async function activity(agentKey, state) {
  await ingest("actor.activity", { agentKey, activity: state });
}

async function openPage(browser, viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 240)}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 240)}`); });
  await page.addInitScript(({ floor }) => {
    localStorage.setItem("pixel:activeFloor", floor);
    localStorage.setItem("pixel:followActivity", "false");
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: 12, liveMode: false }));
  }, { floor: FLOOR });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-office-desk]").length >= 11, null, { timeout: 60_000 });
  return { context, page, errors };
}

async function show3D(page, reduced = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to 3D view" }).click();
  await page.waitForSelector('[aria-label^="3D office agents"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(500);
  if (!reduced) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(350);
  }
}

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"],
});
const errors = [];

try {
  const success = await openPage(browser, { width: 1280, height: 800 });
  errors.push(success.errors);
  const hideNavigator = success.page.getByRole("button", { name: "Hide session navigator" });
  if (await hideNavigator.count()) await hideNavigator.click();
  await show3D(success.page);
  const callId = `success-review-${Date.now()}`;
  const detail = {
    callId,
    agentKey: "researcher",
    senderActorId: `${FLOOR}:orchestrator`,
    recipientActorId: `${FLOOR}:researcher`,
    taskCategory: "research",
  };
  await activity("orchestrator", "working");
  await activity("researcher", "working");
  await ingest("invocation.requested", detail);
  await ingest("invocation.started", detail);
  await ingest("invocation.finished", { ...detail, outcome: "succeeded" });
  await activity("orchestrator", "idle");
  await activity("researcher", "idle");
  await success.page.waitForTimeout(250);
  await success.page.screenshot({ path: path.join(HERE, "15-success-state.png"), fullPage: true });
  await success.context.close();

  await activity("build", "working");
  const optional = await openPage(browser, { width: 1280, height: 800 });
  errors.push(optional.errors);
  await optional.page.waitForFunction(() => document.querySelectorAll("[data-office-desk]").length === 12, null, { timeout: 30_000 });
  await optional.page.screenshot({ path: path.join(HERE, "10-optional-role.png"), fullPage: true });
  await optional.context.close();

  const roles = ["orchestrator", "architect", "devops", "researcher", "security-reviewer", "explore", "senior-engineer", "ai-systems", "automation-engineer", "project-manager", "qa-engineer", "build"];
  for (const role of roles) await activity(role, "working");

  const mobile2D = await openPage(browser, { width: 390, height: 844 });
  errors.push(mobile2D.errors);
  await mobile2D.page.screenshot({ path: path.join(HERE, "11-mobile-2d.png"), fullPage: true });
  const mobile2DOverflow = await mobile2D.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await mobile2D.context.close();

  const mobile3D = await openPage(browser, { width: 390, height: 844 });
  errors.push(mobile3D.errors);
  await show3D(mobile3D.page);
  await mobile3D.page.screenshot({ path: path.join(HERE, "12-mobile-3d.png"), fullPage: true });
  const mobile3DOverflow = await mobile3D.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await mobile3D.context.close();

  const reduced = await openPage(browser, { width: 1280, height: 800 }, "reduce");
  errors.push(reduced.errors);
  const hideReducedNavigator = reduced.page.getByRole("button", { name: "Hide session navigator" });
  if (await hideReducedNavigator.count()) await hideReducedNavigator.click();
  await show3D(reduced.page, true);
  await reduced.page.screenshot({ path: path.join(HERE, "13-reduced-motion.png"), fullPage: true });
  await reduced.context.close();

  console.log(JSON.stringify({ mobile2DOverflow, mobile3DOverflow, errors: errors.flat() }));
} finally {
  await browser.close();
}
