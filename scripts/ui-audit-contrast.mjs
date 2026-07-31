// F3 contrast check: measure WCAG contrast of the top tool-page sub-nav text.
// Reports the lowest-contrast text items in the top strip + their selectors.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PATH = process.env.PATHURL || "/tools/cethx";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("nexus-bio-onboarding-done", "true");
    localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, ts: Date.now() }));
  } catch {}
});
const p = await ctx.newPage();
await p.goto(BASE + PATH, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);

const results = await p.evaluate(() => {
  const parseRGB = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  });
  const effBg = (el) => {
    let cur = el;
    let acc = { r: 5, g: 7, b: 11 }; // page base ~#05070b
    const stack = [];
    while (cur) {
      const bg = parseRGB(getComputedStyle(cur).backgroundColor);
      if (bg && bg.a > 0) stack.unshift(bg);
      cur = cur.parentElement;
    }
    for (const bg of stack) acc = over(bg, acc);
    return acc;
  };
  const ratio = (a, b) => {
    const L1 = lum(a);
    const L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.top > 100 || r.height === 0 || r.width === 0) continue; // top strip only
    const txt =
      el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        ? el.textContent.trim().slice(0, 30)
        : "";
    if (!txt) continue;
    const cs = getComputedStyle(el);
    const fg = parseRGB(cs.color);
    if (!fg) continue;
    const bg = effBg(el);
    const cr = ratio(over(fg, bg), bg);
    out.push({
      txt,
      color: cs.color,
      contrast: Math.round(cr * 100) / 100,
      fontSize: cs.fontSize,
      cls: String(el.className || "").slice(0, 40),
      y: Math.round(r.top),
    });
  }
  return out.sort((a, b2) => a.contrast - b2.contrast).slice(0, 14);
});
for (const r of results) console.log(`${r.contrast}:1  y=${r.y}  "${r.txt}"  ${r.color}  ${r.fontSize}  .${r.cls}`);
await b.close();
