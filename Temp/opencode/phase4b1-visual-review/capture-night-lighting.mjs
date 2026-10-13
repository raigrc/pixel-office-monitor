import { chromium } from "file:///C:/Users/DELL/AppData/Local/Temp/opencode/webgl-verify/node_modules/playwright-core/index.mjs";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const switchTo3D = page.getByRole("button", { name: "Switch to 3D view" });
  if (await switchTo3D.count()) await switchTo3D.click();
  await page.waitForSelector('[aria-label^="3D office agents"] canvas', { timeout: 60_000 });
  await page.waitForTimeout(1_500);
  await page.screenshot({
    path: "Temp/opencode/phase4b1-visual-review/12-brighter-live-night.png",
    fullPage: true,
  });
  if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(" | ")}`);
} finally {
  await browser.close();
}
