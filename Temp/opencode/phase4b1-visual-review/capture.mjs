import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/DELL/AppData/Local/Temp/opencode/webgl-verify/node_modules/playwright-core/index.mjs";

const BASE = process.argv[2] ?? "http://localhost:3011";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "phase4b1-review";
const ROOT = "C:\\Users\\DELL\\Desktop\\Rai\\pixel-office-monitor";
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const tokenMatch = env.match(/^(?:MONITOR_TOKEN|PIXEL_MONITOR_TOKEN)=(.+)$/m);
if (!tokenMatch) throw new Error("no monitor token in .env.local");
const token = tokenMatch[1].trim().replace(/^"|"$/g, "");

const representativeRoles = ["architect", "devops", "researcher", "security-reviewer", "explore", "senior-engineer"];
const crowdedRoles = [...representativeRoles, "ai-systems", "automation-engineer", "project-manager", "qa-engineer"];
let sequence = 0;

function floorId(sessionId) {
  return `${PROJECT}:${sessionId}`;
}

function actorId(sessionId, agentKey) {
  return `${PROJECT}:${sessionId}:${agentKey}`;
}

async function ingest(sessionId, kind, detail) {
  const occurredAt = Date.now();
  const response = await fetch(`${BASE}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-monitor-token": token },
    body: JSON.stringify({
      v: 2,
      eventId: `phase4b1-${++sequence}-${occurredAt}`,
      projectId: PROJECT,
      sessionId,
      rootSessionId: sessionId,
      occurredAt,
      kind,
      detail,
    }),
  });
  if (!response.ok) throw new Error(`${kind} failed: ${response.status} ${await response.text()}`);
}

async function activity(sessionId, agentKey, state) {
  await ingest(sessionId, "actor.activity", { agentKey, activity: state });
}

async function activities(sessionId, roles, state) {
  for (const role of roles) await activity(sessionId, role, state);
}

async function seedFloor(sessionId, title, roles) {
  await ingest(sessionId, "session.upsert", { title });
  await activity(sessionId, "orchestrator", "working");
  await activities(sessionId, roles, "working");
}

async function invocation(sessionId, callId, agentKey, status, outcome) {
  await ingest(sessionId, `invocation.${status}`, {
    callId,
    agentKey,
    senderActorId: actorId(sessionId, "orchestrator"),
    recipientActorId: actorId(sessionId, agentKey),
    taskCategory: agentKey === "architect" ? "design" : "operations",
    ...(outcome ? { outcome } : {}),
  });
}

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"],
});

const screenshots = [];
const browserErrors = [];

async function openPage(sessionId, viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 240)}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 240)}`); });
  await page.addInitScript(({ activeFloor }) => {
    localStorage.setItem("pixel:activeFloor", activeFloor);
    localStorage.setItem("pixel:followActivity", "false");
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: 12, liveMode: false }));
  }, { activeFloor: floorId(sessionId) });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction((activeFloor) => localStorage.getItem("pixel:activeFloor") === activeFloor, floorId(sessionId));
  browserErrors.push(errors);
  return { context, page };
}

async function show3D(page, timeOfDay, reducedMotion = false) {
  const to2D = page.getByRole("button", { name: "Switch to 2D view" });
  if (await to2D.count()) await to2D.click();
  await page.evaluate((time) => {
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: time, liveMode: false }));
  }, timeOfDay);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to 3D view" }).click();
  await page.waitForSelector('[aria-label^="3D office agents"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(650);
  if (!reducedMotion) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(400);
  }
  const hideNavigator = page.getByRole("button", { name: "Hide session navigator" });
  if (await hideNavigator.count()) {
    await hideNavigator.click();
    await page.waitForTimeout(250);
  }
}

async function shot(page, filename, state) {
  await page.screenshot({ path: path.join(HERE, filename), fullPage: true });
  screenshots.push({ filename, ...state });
}

try {
  await seedFloor("crowd", "Crowded Worksite", representativeRoles);
  await seedFloor("pair", "Architect vs Researcher", ["architect", "researcher"]);
  await seedFloor("ops", "Operations Specialists", ["devops", "security-reviewer", "senior-engineer"]);

  const desktop = await openPage("crowd", { width: 1280, height: 800 });
  await show3D(desktop.page, 12);
  await shot(desktop.page, "01-3d-day-roles.png", {
    viewport: "1280x800", time: "manual 12:00", state: "orchestrator and six representative roles working",
  });

  await show3D(desktop.page, 1);
  await shot(desktop.page, "02-3d-night-roles.png", {
    viewport: "1280x800", time: "manual 01:00", state: "same representative roles working",
  });

  await activities("crowd", crowdedRoles, "working");
  await show3D(desktop.page, 12);
  await shot(desktop.page, "03-busy-worksite.png", {
    viewport: "1280x800", time: "manual 12:00", state: "orchestrator and ten distinct specialists working",
  });

  await activities("crowd", crowdedRoles.filter((role) => role !== "researcher"), "idle");
  await activity("crowd", "orchestrator", "idle");
  await activity("crowd", "researcher", "working");
  await desktop.page.waitForTimeout(500);
  await shot(desktop.page, "04-working-state.png", {
    viewport: "1280x800", time: "manual 12:00", state: "researcher working among idle standby specialists",
  });

  const errorCall = `error-${Date.now()}`;
  await activity("crowd", "orchestrator", "working");
  await activity("crowd", "security-reviewer", "working");
  await invocation("crowd", errorCall, "security-reviewer", "requested");
  await invocation("crowd", errorCall, "security-reviewer", "started");
  await invocation("crowd", errorCall, "security-reviewer", "finished", "failed");
  await activity("crowd", "orchestrator", "idle");
  await activity("crowd", "security-reviewer", "idle");
  await desktop.page.waitForTimeout(300);
  await shot(desktop.page, "05-error-state.png", {
    viewport: "1280x800", time: "manual 12:00", state: "failed security-reviewer invocation outcome beat",
  });

  await activities("crowd", crowdedRoles, "working");
  await activity("crowd", "orchestrator", "working");
  await desktop.page.waitForTimeout(400);
  const stage = desktop.page.getByLabel("3D office agents. Use arrow keys to inspect agents and Enter to select.");
  await stage.focus();
  await desktop.page.waitForSelector('[aria-live="polite"]', { timeout: 10_000 });
  await stage.press("ArrowRight");
  await desktop.page.waitForTimeout(250);
  await desktop.page.keyboard.press("Enter");
  await desktop.page.waitForSelector('[role="dialog"][aria-labelledby="inspector-title"]');
  await shot(desktop.page, "06-selected-agent.png", {
    viewport: "1280x800", time: "manual 12:00", state: "keyboard-selected specialist with persistent foot marker and inspector",
  });
  await desktop.page.getByRole("button", { name: "Close inspector" }).click();

  const delegationCall = `delegation-${Date.now()}`;
  await invocation("crowd", delegationCall, "architect", "requested");
  await invocation("crowd", delegationCall, "architect", "started");
  await desktop.page.waitForTimeout(700);
  await shot(desktop.page, "07-delegation-crowded.png", {
    viewport: "1280x800", time: "manual 12:00", state: "started orchestrator-to-architect delegation in crowded worksite",
  });
  await desktop.context.close();

  const pair = await openPage("pair", { width: 1280, height: 800 });
  await show3D(pair.page, 12);
  await shot(pair.page, "08-architect-vs-researcher.png", {
    viewport: "1280x800", time: "manual 12:00", state: "architect document silhouette beside researcher sensor silhouette",
  });
  await pair.context.close();

  const ops = await openPage("ops", { width: 1280, height: 800 });
  await show3D(ops.page, 12);
  await shot(ops.page, "09-devops-security-senior.png", {
    viewport: "1280x800", time: "manual 12:00", state: "devops comms, security shield, and senior device silhouettes",
  });
  await ops.context.close();

  const mobile = await openPage("crowd", { width: 390, height: 844 });
  await show3D(mobile.page, 12);
  await shot(mobile.page, "10-mobile-3d.png", {
    viewport: "390x844", time: "manual 12:00", state: "crowded working worksite",
    horizontalOverflow: await mobile.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  });
  await mobile.context.close();

  const reduced = await openPage("crowd", { width: 1280, height: 800 }, "reduce");
  await show3D(reduced.page, 12, true);
  await shot(reduced.page, "11-reduced-motion.png", {
    viewport: "1280x800", time: "manual 12:00", state: "crowded worksite with prefers-reduced-motion: reduce",
  });
  await reduced.context.close();

  const result = { screenshots, browserErrors: browserErrors.flat() };
  fs.writeFileSync(path.join(HERE, "capture-results.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ screenshots: screenshots.length, errors: result.browserErrors }));
} finally {
  void browser.close();
  setTimeout(() => process.exit(0), 2_000);
}
