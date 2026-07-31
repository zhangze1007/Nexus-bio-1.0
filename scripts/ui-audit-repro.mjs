// Reproduce the two known functional bugs with REAL evidence:
//  (a) FBA simulation error — click Run, capture the /api/fba response + on-screen error text
//  (b) ProEvol can't scroll to bottom — measure which container clips content (overflow/height)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const out = {};
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("nexus-bio-onboarding-done", "true");
    localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, timestamp: Date.now() }));
  } catch {}
});

// ---------- (a) FBA ----------
{
  const page = await ctx.newPage();
  const net = [];
  const cons = [];
  page.on("response", async (r) => {
    if (r.url().includes("/api/")) {
      let body = "";
      try {
        body = (await r.text()).slice(0, 600);
      } catch {}
      net.push({ url: r.url().replace(BASE, ""), status: r.status(), body });
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error") cons.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => cons.push("PAGEERROR: " + String(e.message).slice(0, 300)));

  await page.goto(BASE + "/tools/fbasim", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4500);

  const tried = [];
  const labels = [
    "Run Simulation",
    "Run FBA",
    "Run",
    "Solve",
    "Optimize",
    "Simulate",
    "Analyze",
    "Compute",
    "Community",
  ];
  for (const lb of labels) {
    const b = page.getByRole("button", { name: new RegExp(lb, "i") });
    const n = await b.count();
    if (n > 0) {
      tried.push(`${lb}(x${n})`);
      try {
        await b.first().click({ timeout: 3000 });
      } catch {}
      await page.waitForTimeout(3500);
    }
  }
  const errText = await page.evaluate(() => {
    const hits = [];
    for (const e of document.querySelectorAll("*")) {
      if (e.children.length === 0) {
        const t = (e.textContent || "").trim();
        if (t && /error|failed|unable|invalid|cannot|infeasible|no solution/i.test(t)) hits.push(t.slice(0, 200));
      }
    }
    return [...new Set(hits)].slice(0, 12);
  });
  await page.screenshot({ path: "reports/ui-audit/_repro_fba.png", fullPage: true });
  out.fba = { buttonsTried: tried, apiCalls: net, consoleErrors: cons, visibleErrorTexts: errText };
  await page.close();
}

// ---------- (b) ProEvol scroll ----------
{
  const page = await ctx.newPage();
  await page.goto(BASE + "/tools/proevol", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4500);
  const geom = await page.evaluate(() => {
    const clippers = [];
    for (const e of document.querySelectorAll("div,main,section,article")) {
      const cs = getComputedStyle(e);
      const clips = cs.overflowY === "hidden" || cs.overflow === "hidden";
      if (clips && e.scrollHeight - e.clientHeight > 40) {
        clippers.push({
          tag: e.tagName,
          cls: String(e.className || "").slice(0, 90),
          scrollH: e.scrollHeight,
          clientH: e.clientHeight,
          hiddenPx: e.scrollHeight - e.clientHeight,
          overflowY: cs.overflowY,
          height: cs.height,
          maxHeight: cs.maxHeight,
          position: cs.position,
        });
      }
    }
    return {
      docScrollHeight: document.documentElement.scrollHeight,
      winInner: window.innerHeight,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      clippers: clippers.sort((a, b) => b.hiddenPx - a.hiddenPx).slice(0, 12),
    };
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "reports/ui-audit/_repro_proevol_scrolled.png", fullPage: false });
  out.proevol = geom;
  await page.close();
}

await browser.close();
writeFileSync("reports/ui-audit/_repro.json", JSON.stringify(out, null, 2));
console.log("REPRO DONE");
