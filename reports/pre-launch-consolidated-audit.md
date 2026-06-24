# Nexus-Bio 1.0 — Consolidated Pre-Launch Audit

**Date:** 2026-06-24
**Auditors:** Scientific integrity audit + Architecture/Security/UX/Performance audit
**Scope:** Full platform audit across 1,320 commits, 31 branches, 14 tool pages, 6+ simulation engines
**Reports merged:** Scientific audit (Phases 0-6) + Multi-role workflow audit (5 agents)

---

## EXECUTIVE SUMMARY — Top 10 Blocking Issues

| # | Severity | Category | Issue | Impact |
|---|----------|----------|-------|--------|
| 1 | **CRITICAL** | Security | No security headers in vercel.json (CSP, HSTS, X-Frame-Options) | XSS, clickjacking, MIME sniffing |
| 2 | **CRITICAL** | Science | Python sidecars not running on Vercel — eQuilibrator + BRENDA unavailable | All ΔG values use reference tables; all kinetics use assumed defaults |
| 3 | **CRITICAL** | Science | MultiO labeled "partial" in toolValidity.ts but engine declares "demo" | Users trust "partial" label on deterministic demo math |
| 4 | **CRITICAL** | Security | In-memory rate limiter on /api/analyze doesn't work across Vercel instances | Attacker can drain Groq/Gemini quotas in minutes |
| 5 | **HIGH** | Security | No rate limiting on proxy routes (AlphaFold, PubChem, KEGG, FBA, ScSpatial) | Upstream API IP bans, resource exhaustion |
| 6 | **HIGH** | Security | ScSpatial ingest has no file size limit | OOM crash via arbitrarily large .h5ad upload |
| 7 | **HIGH** | Science | OptKnock not bilevel MILP — sequential LP enumeration | Gene deletion targets may be suboptimal |
| 8 | **HIGH** | UX | ScSpatial communication tab renders with light background (#f3f6f8) | Violates non-negotiable dark-theme rule |
| 9 | **HIGH** | Security | Wildcard CORS on /api/bigg route | Any website can make credentialed requests |
| 10 | **HIGH** | Science | Silent default kinetics (kcat=10, Km=1) when BRENDA absent | Users see "kinetics" that are assumed, not measured |

---

## COMBINED ACTION PLAN

### PHASE 1 — Immediate (This Week) — ~14 hours

| # | Category | Issue | Effort | File(s) |
|---|----------|-------|--------|---------|
| 1.1 | Security | Add security headers to vercel.json or middleware.ts | S (30m) | `vercel.json` or `middleware.ts` |
| 1.2 | Security | Replace in-memory rate limiter with Upstash Redis | M (4h) | `app/api/analyze/route.ts:69-81` |
| 1.3 | Security | Add rate limiting to all 5 proxy routes | M (4h) | `app/api/alphafold/`, `pubchem/`, `kegg/`, `fba/`, `scspatial/` |
| 1.4 | Security | Add file size limit to ScSpatial ingest | S (15m) | `app/api/scspatial/ingest/route.ts:58-76` |
| 1.5 | Security | Sanitize FBA error messages before client send | S (15m) | `app/api/fba/route.ts:323-345` |
| 1.6 | Science | Update MultiO in toolValidity.ts from "partial" to "demo" | S (5m) | `src/config/toolValidity.ts:48` |
| 1.7 | UX | Fix ScSpatial light theme — convert to dark palette | S (30m) | `ScSpatialWorkbench.module.css:7-30` |
| 1.8 | UX | Fix skip-to-content link — add id="main-content" | S (15m) | `ToolsLayoutShell.tsx:130` |
| 1.9 | Perf | Fix FluxParticles geometry disposal leak | S (30m) | `ThreeScene.tsx:726-742` |
| 1.10 | Security | Pin next-auth to exact version | S (5m) | `package.json:37` |

### PHASE 2 — Short-Term (Next 2 Weeks) — ~15 hours

| # | Category | Issue | Effort | File(s) |
|---|----------|-------|--------|---------|
| 2.1 | UX | Add ARIA attributes to progress bars and interactive elements | S (1h) | `NodePanel.tsx:109-134, 849-854` |
| 2.2 | UX | Add aria-label to collapsed sidebar links | S (15m) | `IDESidebar.tsx:393-396` |
| 2.3 | UX | Convert tool page titles to `<h1>` in ToolShell | S (30m) | `ToolShell.tsx:203` |
| 2.4 | UX | Add ARIA labels to SVG network visualization | S (30m) | `ScSpatialPage.tsx:478-555` |
| 2.5 | UX | Fix search dropdown ID mismatch for aria-activedescendant | M (2h) | `Hero.tsx:324-474` |
| 2.6 | UX | Add error boundary to home page | S (15m) | `app/page.tsx` |
| 2.7 | UX | Add responsive breakpoints to FBASim and ScSpatial | M (3h) | `FBASimPage.tsx`, `ScSpatialPage.tsx` |
| 2.8 | Arch | Standardize API error responses with errorResponse() | M (2h) | `fba/route.ts`, `workbench/route.ts` |
| 2.9 | Perf | Fix `import * as THREE` in ScSpatialViewport | S (30m) | `ScSpatialViewport.tsx:7` |
| 2.10 | Arch | Export pre-destructured design tokens from useToolTheme | S (30m) | `useToolTheme.ts` |
| 2.11 | Arch | Cap consoleEntries array at 500 entries | S (15m) | `uiStore.ts:139-145` |
| 2.12 | Security | Add escapeHtml to sanitizeHistory | S (15m) | `analyze/route.ts:416-453` |
| 2.13 | Security | Add CORS headers to ScSpatial ingest responses | S (15m) | `scspatial/ingest/route.ts:15-16` |
| 2.14 | Security | Add CSP connect-src entry for Turso | S (5m) | `next.config.mjs:53` |
| 2.15 | Security | Replace wildcard CORS in /api/bigg with getCorsHeaders() | S (15m) | `app/api/bigg/route.ts:42` |

### PHASE 3 — Medium-Term (Next Month) — ~60 hours

| # | Category | Issue | Effort |
|---|----------|-------|--------|
| 3.1 | Science | Implement proper bilevel MILP for OptKnock using HiGHS binaries | L (8h) |
| 3.2 | Science | Deploy eQuilibrator/BRENDA sidecars as cloud functions OR bundle pre-computed ΔG tables | L (8h) |
| 3.3 | Science | Add "estimated" flag to default kcat/Km in eyringKinetics.ts | S (30m) |
| 3.4 | Science | Upgrade cellFreeMetabolicEngine from Euler to RK4/adaptive | M (4h) |
| 3.5 | Science | Consolidate dual group contribution implementations | M (3h) |
| 3.6 | Science | Fix stale "grid search" comment in mfa13CEngine.ts | S (5m) |
| 3.7 | Science | Fix iJO1366Subset header (claims ~95, only 71 reactions) | S (15m) |
| 3.8 | Arch | Extract sub-components from MultiOPage (2595 lines) | XL (12h) |
| 3.9 | Arch | Extract sub-components from CatalystDesignerPage (2508 lines) | XL (10h) |
| 3.10 | Perf | Replace trivial framer-motion animations with CSS transitions | L (8h) |
| 3.11 | Perf | Reduce FluidSimCanvas per-frame updates | S (30m) |
| 3.12 | Arch | Extract analyze/route.ts (907 lines) into service modules | L (6h) |

### PHASE 4 — Long-Term (Backlog) — ~52 hours

| # | Category | Issue | Effort |
|---|----------|-------|--------|
| 4.1 | Security | Add API key auth to workbench PUT endpoint | L (6h) |
| 4.2 | Perf | Add client-side data caching (React Query/SWR) | L (8h) |
| 4.3 | Perf | Server-render static homepage sections | M (4h) |
| 4.4 | Perf | Replace drei `<Html>` labels with CSS overlay | M (4h) |
| 4.5 | Science | Implement true QP solver for MOMA (or document L1 limitation in UI) | M (4h) |
| 4.6 | Science | Add community FBA joint LP (SteadyCom or cFBA) | L (8h) |
| 4.7 | Science | Add missing ion exchange reactions to iJO1366Subset | S (2h) |
| 4.8 | Arch | Extract sub-components from remaining 8 large pages | XL (24h) |

---

## SCIENTIFIC AUDIT — DETAILED FINDINGS

### Phase 0: Triage

#### Python Sidecar Status
```
equilibrator_sidecar.py:  NOT RUNNING (cannot run on Vercel serverless)
brenda_sidecar.py:        NOT RUNNING (cannot run on Vercel serverless)
```
Impact: CETHX falls back to Alberty-transformed Lehninger values. CatDes/CellFree lose live BRENDA kinetics.

#### LP Solver
- **Primary:** HiGHS WASM (`highs ^1.14.2`) — all FBA paths in fbaEngine.ts
- **Fallback:** Pure TS simplexLP.ts (Bland's rule, EPS=1e-9) — only gemReconstructionEngine.ts
- **MILP support:** HiGHS supports binary/integer variables but FBA variants don't use them (except OptKnock could)

#### VAE/ONNX Status
- ONNX infrastructure fully scaffolded but non-functional (no .onnx model files exist)
- MultiO uses pure-math deterministic VAE via Web Worker (not a real VAE)
- `onnxruntime-web` installed but unused in production

#### toolValidity.ts Baseline
- 2 real (nexai, digitaltwin), 16 partial, 3 demo
- **Discrepancy:** MultiO should be "demo" not "partial"

### Phase 1: Thermodynamics — VERIFIED WORKING

| Component | Status | Evidence |
|-----------|--------|----------|
| ΔG = ΔG° + RT·ln(Q) | ✅ Correct | 3 independent implementations, R=8.314e-3 kJ/(mol·K) |
| Alberty transform | ✅ Correct | Debye-Hückel coefficients from Goldberg & Tewari 1991 |
| Mavrovouniotis group contribution | ✅ Correct | 1991 J Biol Chem, constants match Table I |
| eQuilibrator integration | ✅ Real | Proxy chain: CETHXPage → /api/equilibrator → Python sidecar |
| Boundary conditions | ✅ Realistic | pH 7.4, T 37°C, I 0.25M |

### Phase 2: FBA Engine — VERIFIED WITH FLAGS

| Component | Status | Evidence |
|-----------|--------|----------|
| HiGHS WASM solver | ✅ Correct | CPLEX .lp format, status mapping |
| FVA | ✅ Correct | Mahadevan & Schilling (2003), parallel LP solves |
| pFBA | ✅ Correct | Lewis et al. (2010), absolute-value linearization |
| Biomass objective | ✅ Correct | 10 central precursors, ATPM=8.39 |
| OptKnock | ⚠️ Approximation | Sequential LP, not bilevel MILP |
| MOMA | ⚠️ Approximation | L1 norm, not L2 (QP) |
| Community FBA | ⚠️ Heuristic | Two independent LPs, not joint community |

### Phase 3: Kinetics Engine — VERIFIED WITH FLAGS

| Component | Status | Evidence |
|-----------|--------|----------|
| Michaelis-Menten | ✅ Correct | v = Vmax·[S]/(Km+[S]) in 3 implementations |
| Substrate inhibition | ✅ Correct | v = Vmax·[S]/(Km+[S]+[S]²/Kis) |
| RK4 ODE | ✅ Correct | 4 evaluations, textbook formula |
| Dormand-Prince RK4(5) | ✅ Correct | 7-stage embedded pair, standard Butcher tableau |
| Eyring equation | ✅ Correct | k = (kB·T/h)·exp(-ΔG‡/RT) |
| Default kinetics | ⚠️ Silent | kcat=10, Km=1 used when BRENDA absent, not flagged |
| CellFree solver | ⚠️ Euler | Forward Euler instead of RK4/adaptive |

### Phase 4: Complex Engines — VERIFIED WORKING

| Engine | Status | Evidence |
|--------|--------|----------|
| 13C MFA | ✅ Real | EMU + Levenberg-Marquardt (stale "grid search" comment) |
| Gillespie SSA | ✅ Real | Exact Direct Method, τ = -ln(r1)/Σaμ |
| ML Models | ✅ Real | 5 models, all textbook algorithms |
| scVAE | ✅ Real (constrained) | Correct architecture, sigmoid decoder simplification |
| GEM Reconstruction | ✅ Real | Textbook FBA via simplexLP |

### Phase 5: Security

| Check | Status |
|-------|--------|
| API keys in client bundle | ✅ Clean |
| Prompt injection defenses | ⚠️ Present but inherent LLM risk |
| Auth configuration | ✅ Proper (NextAuth v5, JWT) |
| Hardcoded secrets | ✅ None found |
| API input validation | ✅ Strong on all routes |
| CORS | ⚠️ Wildcard on /api/bigg |
| Security headers | ❌ MISSING — no CSP, HSTS, X-Frame-Options |
| eval/Function injection | ✅ None found |

### Phase 6: Validity Cross-Reference

| Tool | toolValidity.ts | Actual | Match? |
|------|----------------|--------|--------|
| NEXAI | real | real | ✅ |
| DigitalTwin | real | real | ✅ |
| FBAsim | partial | partial | ✅ |
| CETHX | partial | partial | ✅ |
| CatDes | partial | partial | ✅ |
| CellFree | demo | demo | ✅ |
| **MultiO** | **partial** | **demo** | **❌ MISMATCH** |

---

## MULTI-ROLE AUDIT — ADDITIONAL FINDINGS

### Architecture Issues (from workflow audit)

| # | Issue | File | Impact |
|---|-------|------|--------|
| A1 | MultiOPage is 2,595 lines — needs extraction | `MultiOPage.tsx` | Maintainability, testability |
| A2 | CatalystDesignerPage is 2,508 lines | `CatalystDesignerPage.tsx` | Same |
| A3 | `any` types in streaming module | `streaming/types.ts` | Type safety |
| A4 | `sharedHelpers.ts` is 781 lines | `sharedHelpers.ts` | Maintainability |
| A5 | `analyze/route.ts` is 907 lines | `analyze/route.ts` | Maintainability |
| A6 | Inconsistent API error responses | Multiple routes | DX |
| A7 | No component tests for tool pages | `__tests__/` | Quality |

### Performance Issues (from workflow audit)

| # | Issue | File | Impact |
|---|-------|------|--------|
| P1 | FluxParticles geometry/material leak | `ThreeScene.tsx:726-742` | GPU memory leak per pathway change |
| P2 | `import * as THREE` in ScSpatialViewport | `ScSpatialViewport.tsx:7` | Bundle size |
| P3 | Trivial framer-motion animations | 41 files | Bundle size (~50KB gzipped) |
| P4 | FluidSimCanvas per-frame updates | `FluidSimCanvas.tsx:70-99` | CPU usage |
| P5 | ModuleCard `layout` prop | `ModuleCard.tsx:37` | Unnecessary layout animations |
| P6 | No client-side data caching | Multiple API consumers | Redundant fetches |
| P7 | Homepage fully client-rendered | `App.tsx` | FCP/LCP |

### UX/Accessibility Issues (from workflow audit)

| # | Issue | File | Impact |
|---|-------|------|--------|
| U1 | ScSpatial light theme (#f3f6f8) | `ScSpatialWorkbench.module.css` | Dark theme violation |
| U2 | Missing ARIA on progress bars | `NodePanel.tsx` | Screen reader inaccessible |
| U3 | Missing aria-label on collapsed sidebar | `IDESidebar.tsx` | Screen reader inaccessible |
| U4 | Tool titles are `<h2>` not `<h1>` | `ToolShell.tsx:203` | Heading hierarchy broken |
| U5 | Search dropdown ID mismatch | `Hero.tsx:324-474` | aria-activedescendant broken |
| U6 | No error boundary on home page | `app/page.tsx` | White screen on crash |
| U7 | No responsive breakpoints on FBASim/ScSpatial | Multiple | Mobile unusable |

---

## POSITIVE FINDINGS (Worth Preserving)

The audit also identified strong patterns:

- **Zustand slice pattern** with debounced localStorage and `beforeunload` flush
- **XState machines** are minimal, focused, correctly typed
- **ToolShell** shared primitive with progressive disclosure
- **`errorResponse()` helper** in `src/utils/apiErrors.ts` (needs wider adoption)
- **`next/dynamic` with `ssr: false`** on all 14 tool pages
- **Dynamic imports** for pyodide (3MB) and onnxruntime-web (2MB)
- **`Promise.allSettled`** parallel fetching across multiple components
- **Parameterized SQL queries** throughout database layer
- **560+ line `sanitizeWorkbenchState()`** validation
- **Trust gating system** (runtimeGating.ts, claimSurfacePolicy.ts) — demo→partial/real blocked
- **Validity badge system** — REAL (green), PARTIAL (beige), DEMO (salmon) visible in UI
- **All core scientific engines genuinely implement real algorithms with published references**

---

## EFFORT SUMMARY

| Phase | Focus | Issues | Hours |
|-------|-------|--------|-------|
| Phase 1 | Critical security + science + breaking bugs | 10 | ~14h |
| Phase 2 | UX + accessibility + architecture | 15 | ~15h |
| Phase 3 | Science fixes + performance + refactoring | 12 | ~60h |
| Phase 4 | Long-term improvements | 8 | ~52h |
| **Total** | | **45** | **~141h** |

### Quick Wins (Under 30 Minutes Each) — 15 fixes in ~4.5 hours

1. Add security headers to vercel.json (30m)
2. Update MultiO validity to "demo" (5m)
3. Add file size limit to ScSpatial ingest (15m)
4. Sanitize FBA error messages (15m)
5. Fix ScSpatial dark theme CSS (30m)
6. Add id="main-content" to landmarks (15m)
7. Fix FluxParticles geometry disposal (30m)
8. Pin next-auth exact version (5m)
9. Add aria-label to collapsed sidebar (15m)
10. Convert tool titles to `<h1>` (30m)
11. Cap consoleEntries at 500 (15m)
12. Add escapeHtml to sanitizeHistory (15m)
13. Add CORS headers to ScSpatial ingest (15m)
14. Add Turso to CSP connect-src (5m)
15. Replace wildcard CORS in /api/bigg (15m)

---

## DEPENDENCY MAP

```
1.1 (Upstash rate limiter)
 └──> 1.2 (proxy route rate limiting)

1.6 (MultiO validity fix)
 └──> Phase 3 science fixes (validity must be correct first)

3.1 (OptKnock MILP) -- standalone
3.2 (Sidecar deployment) -- standalone, biggest architectural decision
3.8 (MultiO extraction)
 └──> component tests (extraction makes testing feasible)
```

---

*Report generated by Claude Code ultracode audit. Scientific findings verified against source code. Multi-role findings from 5-agent workflow (Architecture, Security, UX, Performance, PM).*
