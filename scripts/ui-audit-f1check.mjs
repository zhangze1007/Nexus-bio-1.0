// F1 machine-check + screenshots for the CETHX waterfall chart, 3 viewports.
// Metrics: text-bbox overlap count, truncation ("…"/slice) presence, container overflow.
// Read-only diagnostic. Usage: node scripts/ui-audit-f1check.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "tools-cethx";
const PATH = process.env.PATHURL || "/tools/cethx";
const TAG = process.env.TAG || "f1";
const VPS = [
  { w: 1920, h: 1080, t: "1920" },
  { w: 1440, h: 900, t: "1440" },
  { w: 1280, h: 800, t: "1280" },
];
const b = await chromium.launch({ headless: true });
for (const vp of VPS) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: "dark" });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("nexus-bio-onboarding-done", "true");
      localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, ts: Date.now() }));
    } catch {}
  });
  const p = await ctx.newPage();
  await p.goto(BASE + PATH, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT_MS || 10000)); // dev render latency
  await p.screenshot({ path: `reports/ui-audit/${SLUG}__${TAG}_${vp.t}.png`, fullPage: false });
  const m = await p.evaluate(() => {
    // Find the target chart svg (aria-label), fall back to the largest svg with many <text>.
    let svg = document.querySelector('svg[aria-label="Thermodynamic waterfall"]');
    if (!svg) {
      const svgs = [...document.querySelectorAll("svg")].filter((s) => s.querySelectorAll("text").length >= 5);
      svg = svgs.sort((a, b2) => b2.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    }
    if (!svg) return { found: false };
    const texts = [...svg.querySelectorAll("text")];
    const rects = texts.map((t) => ({ t: (t.textContent || "").trim(), r: t.getBoundingClientRect() }));
    // pairwise overlap (ignore empty)
    let overlaps = 0;
    const pairs = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r;
        const c = rects[j].r;
        if (!rects[i].t || !rects[j].t) continue;
        const ix = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
        const iy = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
        if (ix > 1 && iy > 1) {
          overlaps++;
          if (pairs.length < 5) pairs.push(`"${rects[i].t}"×"${rects[j].t}"`);
        }
      }
    }
    const truncated = rects.filter((x) => /…|\.\.\.$/.test(x.t)).map((x) => x.t);
    const sr = svg.getBoundingClientRect();
    const host = svg.closest("div");
    const overflow = svg.scrollWidth > svg.clientWidth + 1;
    return {
      found: true,
      textCount: texts.length,
      overlapCount: overlaps,
      overlapExamples: pairs,
      truncatedLabels: truncated,
      svgW: Math.round(sr.width),
      svgH: Math.round(sr.height),
      hostW: host ? Math.round(host.getBoundingClientRect().width) : null,
      svgScrollVsClient: `${svg.scrollWidth}/${svg.clientWidth}`,
      overflowX: overflow,
    };
  });
  console.log(`[${vp.t}]`, JSON.stringify(m));
  await ctx.close();
}
await b.close();
