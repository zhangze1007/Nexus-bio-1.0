// UI audit: screenshot every major page at 3 viewports (+ full-page at 1440),
// capturing console errors/warnings and failed network requests per page.
// Diagnostic only. Output -> reports/ui-audit/ (gitignored).
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "reports/ui-audit";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { w: 1920, h: 1080, tag: "1920" },
  { w: 1440, h: 900, tag: "1440" },
  { w: 1280, h: 800, tag: "1280" },
];

const PAGES = [
  { slug: "home", path: "/" },
  { slug: "tools-index", path: "/tools" },
  { slug: "tools-pathd", path: "/tools/pathd" },
  { slug: "tools-metabolic-eng", path: "/tools/metabolic-eng" },
  { slug: "tools-catdes", path: "/tools/catdes" },
  { slug: "tools-cellfree", path: "/tools/cellfree" },
  { slug: "tools-cethx", path: "/tools/cethx" },
  { slug: "tools-dbtlflow", path: "/tools/dbtlflow" },
  { slug: "tools-dyncon", path: "/tools/dyncon" },
  { slug: "tools-fbasim", path: "/tools/fbasim" },
  { slug: "tools-gecair", path: "/tools/gecair" },
  { slug: "tools-genmim", path: "/tools/genmim" },
  { slug: "tools-multio", path: "/tools/multio" },
  { slug: "tools-nexai", path: "/tools/nexai" },
  { slug: "tools-proevol", path: "/tools/proevol" },
  { slug: "tools-scspatial", path: "/tools/scspatial" },
  { slug: "tools-sequence", path: "/tools/sequence" },
  { slug: "analyze", path: "/analyze" },
  { slug: "start", path: "/start" },
  { slug: "benchmarks", path: "/benchmarks" },
  { slug: "docs-api", path: "/docs/api" },
  { slug: "login", path: "/login" },
  { slug: "profile", path: "/profile" },
  { slug: "research", path: "/research" },
  { slug: "trust-showcase", path: "/trust-showcase" },
  { slug: "notfound", path: "/this-route-does-not-exist-404" },
];

// Optional filters for the fix-loop: ONLY_SLUGS=tools-cethx,tools-fbasim  ONLY_VIEWPORT=1440
const onlySlugs = process.env.ONLY_SLUGS ? new Set(process.env.ONLY_SLUGS.split(",")) : null;
const pagesToShoot = onlySlugs ? PAGES.filter((p) => onlySlugs.has(p.slug)) : PAGES;
const viewportsToShoot = process.env.ONLY_VIEWPORT
  ? VIEWPORTS.filter((v) => v.tag === process.env.ONLY_VIEWPORT)
  : VIEWPORTS;

const logs = [];
const browser = await chromium.launch({ headless: true });

for (const vp of viewportsToShoot) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });
  // Suppress the first-run onboarding modal + cookie-consent banner so shots show real page content.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("nexus-bio-onboarding-done", "true");
      localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, timestamp: Date.now() }));
    } catch {}
  });
  const page = await context.newPage();

  for (const P of pagesToShoot) {
    const log = {
      path: P.path,
      slug: P.slug,
      viewport: vp.tag,
      consoleErrors: [],
      consoleWarnings: [],
      pageErrors: [],
      failedRequests: [],
    };
    const onConsole = (m) => {
      const t = m.type();
      if (t === "error") log.consoleErrors.push(m.text().slice(0, 300));
      else if (t === "warning") log.consoleWarnings.push(m.text().slice(0, 200));
    };
    const onPageErr = (e) => log.pageErrors.push(String(e.message || e).slice(0, 300));
    const onReqFail = (r) => log.failedRequests.push({ url: r.url().slice(0, 160), failure: r.failure()?.errorText });
    const onResp = (r) => {
      if (r.status() >= 400) log.failedRequests.push({ url: r.url().slice(0, 160), status: r.status() });
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageErr);
    page.on("requestfailed", onReqFail);
    page.on("response", onResp);

    try {
      await page.goto(BASE + P.path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4500); // let charts/animations settle
      await page.screenshot({ path: `${OUT}/${P.slug}__${vp.tag}.png`, fullPage: false });
      if (vp.tag === "1440") {
        await page.screenshot({ path: `${OUT}/${P.slug}__full.png`, fullPage: true });
        // record scroll geometry (for the "can't scroll to bottom" class of bug)
        log.geom = await page.evaluate(() => ({
          docScroll: document.documentElement.scrollHeight,
          winInner: window.innerHeight,
          bodyOverflowY: getComputedStyle(document.body).overflowY,
          htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
        }));
      }
    } catch (e) {
      log.gotoError = String(e.message || e).slice(0, 200);
    }
    page.off("console", onConsole);
    page.off("pageerror", onPageErr);
    page.off("requestfailed", onReqFail);
    page.off("response", onResp);
    logs.push(log);
    process.stdout.write(`shot ${P.slug} @${vp.tag}${log.gotoError ? " ERR" : ""}\n`);
  }
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/_console-network.json`, JSON.stringify(logs, null, 2));
console.log(`\nDONE. ${PAGES.length} pages x ${VIEWPORTS.length} viewports. Log -> ${OUT}/_console-network.json`);
