# Nexus-Bio UI Visual & UX Audit — 2026-07

**Scope:** diagnosis only (no fixes this round). Systematically surface every issue affecting professional appearance and usability, beyond the known-issue list.

## Method & honesty notes

- Tool: Playwright + Chromium, scripted (`scripts/ui-audit-shots.mjs`, `scripts/ui-audit-repro.mjs`). Screenshots in `reports/ui-audit/` (gitignored).
- **Server:** the Next **dev** server OOM-crashed (V8 heap) under concurrent headless-browser load + on-demand route compilation, so the audit was re-run against the **production** server (`npm run build` + `npm start`) — stable, and representative of what real users see (dev-only widgets like `DevModePanel` are correctly excluded).
- **Onboarding suppressed:** every page first-loads a `WELCOME` modal (`OnboardingOverlay`, `localStorage["nexus-bio-onboarding-done"]`) + a cookie-consent banner; both were pre-set so shots show real content. (These are intended UX, not defects.)
- `AUTH_SECRET` was set for the production run to avoid a dev-only `/api/auth/session` 500 storm and see the real underlying state.
- **WebGL caveat:** headless Chromium renders the WebGL hero pages (home, metabolic-eng) unreliably (blank canvas). Blank shots on those pages are a **tooling limitation, not asserted as site bugs**.
- Every issue below is something **actually observed** in a screenshot or reproduced via console/network/DOM. Items that could not be confirmed are marked as such. No generic best-practice filler.

## Coverage

- **Pages (26):** `/`, `/tools` index, all 14 core tools (`pathd, metabolic-eng, catdes, cellfree, cethx, dbtlflow, dyncon, fbasim, gecair, genmim, multio, nexai, proevol, scspatial`) + `sequence`, `/analyze`, `/start`, `/benchmarks`, `/docs/api`, `/login`, `/profile`, `/research`, `/trust-showcase`, 404.
- **Viewports:** 1920×1080, 1440×900, 1280×800 (fold) + full-page at 1440.
- **Screenshot total:** 106 (26 pages × 3 viewports = 78, + 26 full-page at 1440, + 2 repro captures), production server. Plus `_console-network.json` (per-page console/network log) and `_repro.json` (FBA/ProEvol measurements).

## Severity legend

- **P0 — Blocks use:** feature unusable / broken / content unreachable.
- **P1 — Serious appearance harm:** looks unprofessional/broken but usable.
- **P2 — Minor:** polish.

---

## Findings

### F1 — [P1, systemic] Chart component: title/legend overlap, duplicated title, rotated+truncated axis labels
- **Evidence:** `tools-cethx__full.png`; code `src/components/tools/cethx/WaterfallCascade.tsx`.
- **Component:** `WaterfallCascade` (CETHX), rendered by `CETHXPage.tsx:720` inside a card that ALREADY supplies eyebrow "Thermodynamic waterfall" + caption.
- **Root causes (code-confirmed):**
  - **Duplicate title:** card header says "Thermodynamic waterfall"; the SVG *also* draws `THERMODYNAMIC WATERFALL` (line 73) + a long subtitle (line 82). → inner/outer duplicate.
  - **Title↔legend overlap:** long subtitle at `y=30, x=58` (lines 75–83) collides with the legend row at `y≈26, x=58,158,258,358` (lines 281–298) and the "CURRENT LIMITING STEP" box at `x=346` (lines 239–274) — all crammed into the top ~30px of a fixed 520×356 viewBox.
  - **Axis labels rotated + truncated:** x labels rotated `−38°`, hard-truncated `step.step.slice(0,12)`, at `y=338` near the bottom edge (lines 190–192) → collision + clipping.
  - **Whitespace:** fixed 520×356 SVG scaled into a much larger card ⇒ large empty margins ("大片留白").
- **Systemic?** Yes — the hand-positioned-`<text>` pattern is shared by the **custom-SVG charts** (`WaterfallCascade` + `MutagenesisChart`) via `charts/primitives/SVGChartContainer` + `charts/chartTheme`. (Recharts-based charts — Pareto/FluxCost/BindingRadar/Balancer — use auto-layout and don't share this class of bug.)
- **Affected pages:** CETHX (waterfall); CATDES/ProEvol mutagenesis (MutagenesisChart) — to confirm visually.

### F2 — [P1, systemic] Tool pages render behind a dark dimming overlay
- **Evidence:** `tools-cethx__full.png`, `tools-fbasim__1920.png` — page content (header, chart) is dimmed as if a dark backdrop/scrim sits over it.
- **Observed on:** CETHX, FBASIM (at minimum). **Root cause not yet isolated** — candidate is a modal/backdrop or a stuck entrance-animation opacity state; NOT the onboarding overlay (that was suppressed). Flagged for a focused follow-up; not asserting a specific cause I haven't confirmed.

### F3 — [P1, systemic] Large empty content band at top of tool pages + very low-contrast sub-nav
- **Evidence:** `tools-cethx__1920.png`, `tools-multio__1920.png` — below the topbar there's a faint, hard-to-read horizontal sub-nav strip, then a large empty dark band before content.
- **Systemic?** Yes — same shell across all tool pages. Wastes above-the-fold space and the sub-nav text contrast is too low to read.

### F4 — [P2, systemic] Console error noise on nearly every page
- **Evidence:** `reports/ui-audit/_console-network.json`.
- `/api/workbench → 401` on all tool pages (unauthenticated) — fired + logged on every page.
- `/api/auth/session → 500` + authjs `ClientFetchError` was seen on the **dev** run (missing local `AUTH_SECRET`); **likely a local-env artifact**, needs production/authed verification before treating as a live bug.
- **Note:** honest caveat — these are partly environment/auth-state driven, not necessarily production defects.

### F5 — [P0] FBA "simulation error" = `/api/fba` returns 401 (auth required) for anonymous sessions
- **Evidence:** `_repro.json` (production run, not logged in). FBA auto-fires `/api/fba` on load; response:
  `401 {"ok":false,"error":"Authentication required","message":"Provide a valid API key via X-API-Key header or Authorization: Bearer token."}` (fired 4×).
- **Also:** `/api/workbench → 401` (same auth gate) and `/api/bigg?type=models → 502 {"error":"BiGG unreachable: fetch failed"}` (model list fails to load; possibly env network).
- **Root cause:** the compute APIs (`/api/fba`, `/api/workbench`) require an API key / authenticated session, but the tool page is served to **anonymous visitors** and calls them without credentials → 401 → surfaced as a simulation error. **Systemic:** affects every tool whose API is auth-gated, for any logged-out user.
- **Honesty caveat:** the audit session was unauthenticated (no login, no `X-API-Key`). This definitively breaks FBA for anonymous users; whether a **logged-in** user is also affected needs a re-test with a real session/key. The `/api/bigg` 502 may be local-network.
- **Component:** `SimErrorBanner` (shared across FBA/CatalystDesigner/CellFree/DBTLflow/DynCon…) renders the failure; the FBA run logic lives in `useFBASimState` (`FBASimPage.tsx` → `singleError`/`communityError`).

### F6 — [P1, systemic] ProEvol cannot scroll to bottom — page locked to viewport height
- **Evidence:** `_repro.json` DOM measurement: `document.scrollHeight = 900 === window.innerHeight = 900`; `body overflow-y:auto`, `html overflow-y:visible`.
- **Root cause:** the whole page height is **capped at the viewport** (doc is not taller than the window), so the browser has nothing to scroll and any content below the fold is clipped/unreachable — matching "can't scroll to bottom." This is a **fixed-viewport-height shell** (`h-screen`/`100vh` + `overflow:hidden` on a shared tool-shell wrapper) capping the page. The automated `div/section overflow-y:hidden` probe did **not** isolate the exact ancestor (likely `overflow:hidden` on both axes or a flex cap), so the precise element needs a targeted look at the tool shell — flagged honestly rather than guessed.
- **Systemic?** Yes — shell-level; any tool page whose content exceeds the viewport is affected. ProEvol is just the clearest case.

---

## Issue counts

- **P0 (blocks use): 1** — F5 (FBA/compute APIs 401 for anonymous sessions).
- **P1 (serious appearance harm): 4** — F1 (chart component), F2 (dimming overlay), F3 (empty band + low-contrast sub-nav), F6 (ProEvol/shell scroll clip).
- **P2 (minor): 1** — F4 (console noise).
- **Total: 6** distinct findings; most are **systemic** (shell- or shared-component-level), so each fix lands across many pages.

## Recommended fix order (by ROI)

1. **F2 dimming overlay (P1, systemic)** — one shared scrim/backdrop dims EVERY tool page; isolating and removing it restores legibility site-wide in one change. Highest ROI. (First step: identify the fixed full-screen overlay element on a tool page in devtools.)
2. **F5 FBA/compute 401 (P0)** — a core tool fails on load. Decide the intended model (public tools vs login-gated): either allow anonymous compute or gate the tool behind a clear login prompt instead of a silent 401→"simulation error". Fixes FBA + every auth-gated tool for logged-out users.
3. **F6 ProEvol / shell scroll clip (P1, systemic)** — one tool-shell height/overflow fix (`h-screen`+`overflow:hidden` → allow inner scroll) unlocks the bottom of every long tool page.
4. **F1 custom-SVG chart pattern (P1, systemic)** — dedupe the title (drop the in-SVG title since the card supplies one), lift the legend/subtitle out of the plot header, auto-size the viewBox to the card, and stop hard-truncating/`−38°`-rotating x labels. Fixes CETHX waterfall + the `MutagenesisChart` family.
5. **F3 empty band + low-contrast sub-nav (P1, systemic)** — shell layout: reduce the dead band above content and raise sub-nav contrast; broad visual lift across all tools.
6. **F4 console noise (P2)** — guard `/api/workbench` (and auth-session) calls when unauthenticated so pages don't log errors.

## Not reproduced / needs a second pass (honesty)

- **Home + metabolic-eng (WebGL hero):** blank in headless Chromium — a tooling limit, not asserted as bugs. Re-shoot with GPU or check manually.
- **F5 for logged-in users:** the audit was unauthenticated; confirm whether a real signed-in session also gets 401.
- **F2 dimming root cause** and **F6 exact clipping element:** observed/measured but the precise DOM node was not isolated — a 10-min devtools pass will pin both.
- Per-tool deep chart review (MutagenesisChart, recharts charts, scspatial/multio plots) was constrained by the F2 dimming and the round budget; the full-page shots are in `reports/ui-audit/` for follow-up.

---

## Round-3 full-pass re-check (2026-07-31, production server, AUTH_SECRET set)

Full 26-page × 3-viewport pass after rounds 1–2. **Result: fixes hold, no regressions.**

- **Console cleanliness:** 22/26 pages have **0 console errors**; `/api/workbench 401` is **0 on every page** (F4 workbench-auth gate works site-wide). The 4 non-clean pages are all external/artifact, not new bugs:
  - `tools-cethx` — `/api/equilibrator 503` (external; see EXTERNAL_SERVICE_STATUS.md).
  - `tools-fbasim` — `/api/bigg 502` (external; registered).
  - `tools-metabolic-eng` — `/api/auth/session` **ERR_ABORTED** (request aborted as the shot navigated away — timing artifact, not a real failure).
  - `notfound` — one 404 resource on the 404 page (minor).
- **Visual (F2/F1/F3):** reviewed cethx, fbasim, multio, catdes, scspatial, proevol — all show no dimming (F2), the readable status chip (F3), and populated content; the CETHX waterfall renders responsively (F1). No new visual problems.
- **Shared primitives untouched:** `SVGChartContainer` / `chartTheme` were **not** modified in any round, so other charts are unaffected by construction — confirmed visually.
- **New problems found:** none of substance. Only the two artifacts above (metabolic-eng auth abort, notfound 404), left as-is (not code defects).

### P4 — empty band
The round-1 "large empty band at top of tool pages" was an artifact of the **F2 dimming** (content was there but dimmed/blurred). With F2 fixed (round 1) + F1 filling the CETHX chart (round 2), tool pages now carry real content above the fold. Remaining empty areas (e.g. SCSPATIAL/ProEvol) are **legitimate empty-states** ("No spatial artifact loaded", "requires upstream data from CatDes") awaiting user data — filling them would require placeholder/fake content, so **no change made** (honest: resolved indirectly + remainder is intentional empty-state).

### P1 — MutagenesisChart
`src/components/charts/MutagenesisChart.tsx` is **orphaned (0 imports)** — not rendered by any page. CATDES's live mutagenesis viz is a **table + a "MUTATION PREDICTOR" form** (`CatDesViewComponents.tsx`), which has no axis-label rotation/truncation, no duplicate title, no in-plot legend. The orphan component itself is **recharts-based** (auto-responsive). So no fix was warranted; the 3-viewport chart metric is N/A (nothing rendered to measure).
