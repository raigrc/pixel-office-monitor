import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/DELL/AppData/Local/Temp/opencode/webgl-verify/node_modules/playwright-core/index.mjs";

const BASE = process.argv[2] ?? "http://localhost:3011";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "phase4b-review";
const SESSION = "root";
const FLOOR = `${PROJECT}:${SESSION}`;
const ROOT = "C:\\Users\\DELL\\Desktop\\Rai\\pixel-office-monitor";
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const tokenMatch = env.match(/^(?:MONITOR_TOKEN|PIXEL_MONITOR_TOKEN)=(.+)$/m);
if (!tokenMatch) throw new Error("no monitor token in .env.local");
const token = tokenMatch[1].trim().replace(/^"|"$/g, "");

const representativeRoles = [
  "architect",
  "devops",
  "researcher",
  "security-reviewer",
  "explore",
  "senior-engineer",
];
const crowdedRoles = [
  ...representativeRoles,
  "ai-systems",
  "automation-engineer",
  "project-manager",
  "qa-engineer",
];

let eventSequence = 0;
async function ingest(kind, detail) {
  const occurredAt = Date.now();
  const response = await fetch(`${BASE}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-monitor-token": token },
    body: JSON.stringify({
      v: 2,
      eventId: `phase4b-review-${++eventSequence}-${occurredAt}`,
      projectId: PROJECT,
      sessionId: SESSION,
      rootSessionId: SESSION,
      occurredAt,
      kind,
      detail,
    }),
  });
  if (!response.ok) throw new Error(`${kind} failed: ${response.status} ${await response.text()}`);
}

async function setActivity(agentKey, activity) {
  await ingest("actor.activity", { agentKey, activity });
}

async function setActivities(roles, activity) {
  for (const role of roles) await setActivity(role, activity);
}

async function invocation(callId, agentKey, status, outcome) {
  const detail = {
    callId,
    agentKey,
    senderActorId: `${FLOOR}:orchestrator`,
    recipientActorId: `${FLOOR}:${agentKey}`,
    taskCategory: agentKey === "architect" ? "design" : "research",
    ...(outcome ? { outcome } : {}),
  };
  await ingest(`invocation.${status}`, detail);
}

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"],
});

const evidence = [];
const allErrors = [];

async function openPage(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 240)}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 240)}`);
  });
  await page.addInitScript(({ floor }) => {
    localStorage.setItem("pixel:activeFloor", floor);
    localStorage.setItem("pixel:followActivity", "false");
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: 12, liveMode: false }));
  }, { floor: FLOOR });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-office-desk]").length >= 11, null, { timeout: 60_000 });
  allErrors.push(errors);
  return { context, page, errors };
}

async function shot(page, filename, metadata) {
  await page.screenshot({ path: path.join(HERE, filename), fullPage: true });
  evidence.push({ filename, ...metadata });
}

async function show2D(page) {
  const button = page.getByRole("button", { name: "Switch to 2D view" });
  if (await button.count()) {
    await button.click();
    await page.waitForSelector('[data-office-frame="2d"]');
  }
}

async function show3D(page, timeOfDay, reducedMotion = false) {
  await show2D(page);
  await page.evaluate((time) => {
    localStorage.setItem("pixel-monitor-3d-settings", JSON.stringify({ timeOfDay: time, liveMode: false }));
  }, timeOfDay);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to 3D view" }).click();
  await page.waitForSelector('[aria-label^="3D office agents"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(700);
  if (!reducedMotion) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(500);
  }
}

try {
  await ingest("session.upsert", { title: "Phase 4B Visual Review" });
  await setActivity("orchestrator", "working");

  const desktop = await openPage({ width: 1280, height: 800 });
  const page = desktop.page;
  await shot(page, "01-2d-default.png", {
    viewport: "1280x800",
    renderer: "2D",
    state: "default 11-role 4-4-3 roster; orchestrator working; optional roles absent",
  });

  await setActivity("architect", "working");
  await setActivity("devops", "idle");
  await setActivity("researcher", "working");
  await setActivity("security-reviewer", "idle");
  await setActivity("explore", "working");
  await setActivity("senior-engineer", "idle");
  await page.waitForSelector('[aria-label="researcher (work)"]', { timeout: 30_000 });
  await page.waitForTimeout(400);
  await shot(page, "02-2d-busy-roles.png", {
    viewport: "1280x800",
    renderer: "2D",
    state: "architect/researcher/explore working; devops/security/senior idle",
  });

  await setActivities(representativeRoles, "working");
  const hideNavigator = page.getByRole("button", { name: "Hide session navigator" });
  if (await hideNavigator.count()) await hideNavigator.click();
  await show3D(page, 12);
  await shot(page, "03-3d-day-roles.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "orchestrator plus six representative working roles",
  });

  await show3D(page, 1);
  await shot(page, "04-3d-night-roles.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 01:00",
    state: "orchestrator plus six representative working roles",
  });

  await setActivities(crowdedRoles, "working");
  await show3D(page, 12);
  await shot(page, "05-3d-busy-worksite.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "orchestrator plus ten distinct working specialists",
  });

  await setActivities(crowdedRoles.filter((role) => role !== "researcher"), "idle");
  await setActivity("orchestrator", "idle");
  await setActivity("researcher", "working");
  await page.waitForTimeout(600);
  await shot(page, "06-working-priority.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "researcher working among specialists in idle standby",
  });

  const stage = page.getByLabel("3D office agents. Use arrow keys to inspect agents and Enter to select.");
  await stage.focus();
  await stage.press("ArrowRight");
  await stage.press("ArrowRight");
  await shot(page, "16-hover-agent.png", {
    viewport: "1280x800",
    renderer: "3D",
    state: "keyboard-equivalent hover label on third selectable actor",
  });
  await stage.press("Enter");
  await page.waitForSelector('[role="dialog"][aria-labelledby="inspector-title"]');
  await shot(page, "07-selected-agent.png", {
    viewport: "1280x800",
    renderer: "3D plus inspector",
    state: "keyboard-selected third selectable actor",
  });
  await page.getByRole("button", { name: "Close inspector" }).click();

  await setActivity("orchestrator", "working");
  await page.waitForTimeout(500);
  await shot(page, "08-orchestrator-priority.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "working orchestrator with idle specialists nearby",
  });

  await setActivity("architect", "working");
  await invocation("delegation-architect", "architect", "requested");
  await invocation("delegation-architect", "architect", "started");
  await page.waitForTimeout(800);
  await shot(page, "09-delegation.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "started orchestrator-to-architect delegation",
  });

  await invocation("delegation-architect", "architect", "finished", "failed");
  await setActivity("architect", "idle");
  await setActivity("orchestrator", "idle");
  await page.waitForTimeout(350);
  await shot(page, "14-error-state.png", {
    viewport: "1280x800",
    renderer: "3D",
    state: "truthful failed architect invocation outcome beat",
  });

  await invocation("success-researcher", "researcher", "requested");
  await invocation("success-researcher", "researcher", "started");
  await invocation("success-researcher", "researcher", "finished", "succeeded");
  await setActivity("researcher", "idle");
  await page.waitForTimeout(350);
  await shot(page, "15-success-state.png", {
    viewport: "1280x800",
    renderer: "3D",
    state: "truthful succeeded researcher invocation outcome beat",
  });

  await show2D(page);
  await setActivity("build", "working");
  await page.waitForFunction(() => document.querySelectorAll("[data-office-desk]").length === 12, null, { timeout: 30_000 });
  await shot(page, "10-optional-role.png", {
    viewport: "1280x800",
    renderer: "2D",
    state: "explicitly observed build role appended as twelfth desk",
  });

  await setActivities(crowdedRoles, "working");
  await setActivity("orchestrator", "working");

  const mobile2D = await openPage({ width: 390, height: 844 });
  await shot(mobile2D.page, "11-mobile-2d.png", {
    viewport: "390x844",
    renderer: "2D",
    state: "crowded roster including optional build",
    overflow: await mobile2D.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  });
  await mobile2D.context.close();

  const mobile3D = await openPage({ width: 390, height: 844 });
  await show3D(mobile3D.page, 12);
  await shot(mobile3D.page, "12-mobile-3d.png", {
    viewport: "390x844",
    renderer: "3D",
    time: "manual 12:00",
    state: "crowded worksite including optional build",
    overflow: await mobile3D.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  });
  await mobile3D.context.close();

  const reduced = await openPage({ width: 1280, height: 800 }, "reduce");
  await show3D(reduced.page, 12, true);
  await shot(reduced.page, "13-reduced-motion.png", {
    viewport: "1280x800",
    renderer: "3D",
    time: "manual 12:00",
    state: "crowded worksite with prefers-reduced-motion: reduce",
  });
  await reduced.context.close();

  const metrics = await page.evaluate(() => ({
    desks: document.querySelectorAll("[data-office-desk]").length,
    distinctRoleAccents: new Set([...document.querySelectorAll("[data-role-accent]")].map((node) => node.getAttribute("data-role-accent"))).size,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  await desktop.context.close();

  const errors = allErrors.flat();
  fs.writeFileSync(path.join(HERE, "capture-results.json"), `${JSON.stringify({ evidence, metrics, errors }, null, 2)}\n`);
  console.log(JSON.stringify({ screenshots: evidence.length, metrics, errors }));
} finally {
  await browser.close();
}
