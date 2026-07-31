// Diagnostic: locate the F2 dimming overlay and the F6 height-lock ancestor on a tool page
// via real DOM + computed style. Read-only. Usage: node scripts/ui-audit-inspect.mjs [path]
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PATH = process.argv[2] || "/tools/cethx";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("nexus-bio-onboarding-done", "true");
    localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, timestamp: Date.now() }));
  } catch {}
});
const p = await ctx.newPage();
await p.goto(BASE + PATH, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4500);

const report = await p.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const desc = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 90);
  };

  // ---- F2: overlay / scrim / dimmed-content candidates ----
  const overlays = [];
  const dimmed = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const coversVp = r.width >= vw * 0.85 && r.height >= vh * 0.85;
    const bg = cs.backgroundColor;
    const alphaBg = /rgba?\([^)]*?,\s*(0?\.\d+|1)\)/.test(bg) && bg !== "rgba(0, 0, 0, 0)" && !bg.endsWith(", 0)");
    // A fixed/absolute element covering the viewport with a translucent/dark bg or a backdrop-filter
    if ((cs.position === "fixed" || cs.position === "absolute") && coversVp) {
      const hasBackdrop = cs.backdropFilter !== "none" && cs.backdropFilter !== "";
      if (alphaBg || hasBackdrop || Number(cs.opacity) < 1) {
        overlays.push({
          node: desc(el),
          position: cs.position,
          zIndex: cs.zIndex,
          bg,
          opacity: cs.opacity,
          backdropFilter: cs.backdropFilter,
          pointerEvents: cs.pointerEvents,
          rect: `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`,
        });
      }
    }
    // Content wrappers rendered at reduced opacity (stuck entrance animation)
    if (Number(cs.opacity) < 0.98 && r.width > vw * 0.4 && r.height > vh * 0.4 && el.children.length > 0) {
      dimmed.push({
        node: desc(el),
        opacity: cs.opacity,
        transform: cs.transform.slice(0, 40),
        rect: `${Math.round(r.width)}x${Math.round(r.height)}`,
      });
    }
  }

  // ---- F6: height-lock chain ----
  const chain = [];
  const main = document.querySelector("main") || document.body;
  let el = main;
  let hops = 0;
  while (el && hops < 14) {
    const cs = getComputedStyle(el);
    chain.push({
      node: desc(el),
      overflowY: cs.overflowY,
      overflow: cs.overflow,
      height: cs.height,
      maxHeight: cs.maxHeight,
      minHeight: cs.minHeight,
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      capsAtVh: Math.abs(el.clientHeight - vh) <= 2,
      clips: (cs.overflowY === "hidden" || cs.overflow === "hidden") && el.scrollHeight - el.clientHeight > 20,
    });
    el = el.parentElement;
    hops++;
  }

  return {
    vw,
    vh,
    docScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    overlays: overlays.slice(0, 8),
    dimmed: dimmed.slice(0, 6),
    heightChain: chain,
  };
});

console.log(JSON.stringify(report, null, 2));
await b.close();
