# Nexus-Bio 1.0 Consolidated Audit Report

**Audit Date:** 2026-06-28
**Audit Scope:** 12-role enterprise audit across 11 specialist domains
**Codebase:** ~300k lines, 90+ API routes, 14 tool pages, 334 test files
**Auditors:** Principal Software Architect, CISO, Scientific Domain Expert, Data Architect, API/Integration Architect, 3D/WebGL Specialist, Accessibility Lead, QA Director, DevOps Engineer, Documentation Manager, Regulatory Compliance Officer

---

## 1. Executive Summary -- Top 10 Critical Issues

| Rank | Issue | Category | Business Impact |
|------|-------|----------|-----------------|
| 1 | **In-memory rate limiting is non-functional on Vercel without Upstash Redis** -- all rate limits are bypassed by concurrent requests hitting different serverless instances. Groq/Gemini quotas can be drained in minutes. | Security / DevOps | Production outage risk; API quota exhaustion blocks all users |
| 2 | **TOCTOU race in workbench PUT endpoint** -- read-compare-write cycle is not atomic. Concurrent writes silently lose data. | Data Integrity | Silent data loss for multi-tab or concurrent users |
| 3 | **Forgeable actor identity** -- `x-workbench-actor-id` header is client-controlled; any authenticated user can impersonate another actor and overwrite their data. | Security / Compliance | Identity spoofing; audit trail pollution; unauthorized data modification |
| 4 | **Same-origin trust bypass on write routes** -- `Sec-Fetch-Site: same-origin` auto-authenticates all non-high-security routes including `/api/workbench`. Combined with any XSS, this bypasses all auth. | Security | Single XSS compromises entire workbench |
| 5 | **`project_history` uses INSERT OR REPLACE** -- overwrites destroy audit trail immutability. DELETE-then-INSERT on experiment records destroys historical data on every sync. | Compliance / Data Integrity | Violates FDA 21 CFR Part 11; prevents reproducibility |
| 6 | **No fetch timeouts on 3 of 4 proxy routes** -- AlphaFold GET, KEGG, and PubChem proxies have bare `fetch()` calls with no `AbortSignal.timeout()`. Hung backends block Edge Functions until platform kill. | API Reliability | Cascading timeouts; degraded user experience |
| 7 | **FBA ATP objective conflates NADH with ATP** -- PDH coefficient of 1.2 in the ATP objective is arbitrary and not derived from P/O ratio. Community FBA uses magic scaling factors with no biological basis. | Scientific Correctness | Misleading simulation results for researchers |
| 8 | **13 files exceed 500 lines** with NodePanel.tsx at 2,274 lines mixing presentation, data fetching, and 3 tab views. Identical 30-50 line workbench seed pattern duplicated across 12+ tool hooks. | Architecture / Maintainability | Slows development velocity; increases bug surface |
| 9 | **Coverage thresholds at 35% branches / 50% lines** -- 12 of 14 tool pages have zero component tests. CI does not enforce coverage. 8 server pipelines have no tests. | Quality / Reliability | Regressions ship undetected; scientific correctness unverified |
| 10 | **No data retention policy; no technical export controls** -- database grows unboundedly. No screening of target molecules against controlled substance lists. GDPR deletion misses workbench tables. | Compliance / Legal | Regulatory non-compliance; potential dual-use liability |

---

## 2. Risk Matrix

| ID | Issue | Category | Severity (1-5) | Business Impact (1-5) | Risk Score | Effort | Priority |
|----|-------|----------|----------------|----------------------|------------|--------|----------|
| R-01 | Rate limiting non-functional on Vercel | Security | 5 | 5 | 25 | S (config) | P0 |
| R-02 | TOCTOU race in workbench PUT | Data Integrity | 5 | 4 | 20 | M | P0 |
| R-03 | Forgeable actor identity header | Security | 5 | 4 | 20 | M | P0 |
| R-04 | Same-origin trust bypass on writes | Security | 5 | 4 | 20 | M | P0 |
| R-05 | Audit trail overwritable (INSERT OR REPLACE + DELETE-then-INSERT) | Compliance | 5 | 4 | 20 | M | P0 |
| R-06 | No fetch timeouts on proxy routes | API | 4 | 4 | 16 | S | P1 |
| R-07 | FBA ATP yield calculation incorrect | Science | 4 | 3 | 12 | S | P1 |
| R-08 | Community FBA uses arbitrary magic numbers | Science | 4 | 3 | 12 | M | P1 |
| R-09 | AlphaFold POST no body size limit | Security | 3 | 4 | 12 | S | P1 |
| R-10 | Inconsistent error response shapes across routes | API | 3 | 3 | 9 | M | P2 |
| R-11 | 13 files >500 lines; cross-tool duplication | Architecture | 3 | 3 | 9 | L | P2 |
| R-12 | uiStore selectedNode persists across routes | State | 4 | 3 | 12 | S | P1 |
| R-13 | workbenchStore localStorage silently swallows quota errors | State | 3 | 3 | 9 | S | P2 |
| R-14 | No schema migration system | Data | 4 | 3 | 12 | M | P2 |
| R-15 | KEGG regex allows parentheses | Security | 2 | 2 | 4 | S | P3 |
| R-16 | dangerouslySetInnerHTML with barcode data (XSS) | Security | 4 | 3 | 12 | S | P1 |
| R-17 | CSP allows unsafe-inline scripts | Security | 3 | 3 | 9 | L | P3 |
| R-18 | AI content rendered unsanitized | Security | 3 | 3 | 9 | M | P2 |
| R-19 | Workbench PUT missing membership check | Security | 3 | 4 | 12 | M | P1 |
| R-20 | PAPER_ELEVATED uses near-white background | Accessibility | 4 | 2 | 8 | S | P1 |
| R-21 | Focus indicators stripped via outline:none | Accessibility | 4 | 2 | 8 | S | P1 |
| R-22 | 12/14 tool pages have no component tests | QA | 4 | 3 | 12 | L | P2 |
| R-23 | Coverage thresholds too low (35% branches) | QA | 3 | 3 | 9 | S | P2 |
| R-24 | Hobby plan 1000 invocations/day limit | DevOps | 5 | 5 | 25 | S (billing) | P0 |
| R-25 | ignoreBuildErrors:true allows broken deploys | DevOps | 4 | 4 | 16 | S | P1 |
| R-26 | Client Sentry DSN not configured | DevOps | 3 | 3 | 9 | S | P1 |
| R-27 | 90+ scaffold API routes increase attack surface | Architecture | 3 | 3 | 9 | M | P2 |
| R-28 | KineticPanel uses fixed-step RK4 instead of adaptive | Science | 3 | 2 | 6 | M | P2 |
| R-29 | Eyring kinetics mixed M/mM units | Science | 3 | 2 | 6 | S | P2 |
| R-30 | Yeast FBA network incomplete (no TCA cycle) | Science | 3 | 2 | 6 | M | P3 |
| R-31 | No data retention policy | Compliance | 5 | 4 | 20 | L | P2 |
| R-32 | No export control technical controls | Compliance | 4 | 4 | 16 | XL | P3 |
| R-33 | GDPR deletion misses workbench tables | Compliance | 4 | 3 | 12 | M | P2 |
| R-34 | No legal basis stated in privacy policy | Compliance | 4 | 3 | 12 | S | P2 |
| R-35 | No CHANGELOG.md | Documentation | 2 | 2 | 4 | M | P3 |
| R-36 | 70 API routes undocumented | Documentation | 3 | 2 | 6 | L | P3 |
| R-37 | Stale types.ts reference in CLAUDE.md | Documentation | 2 | 1 | 2 | S | P4 |
| R-38 | meshPhysicalMaterial type cast violation | 3D/WebGL | 3 | 2 | 6 | S | P2 |
| R-39 | ScSpatialViewport no DPR cap | 3D/WebGL | 3 | 2 | 6 | S | P2 |
| R-40 | FluidSimCanvas no visibility pause | 3D/WebGL | 3 | 2 | 6 | M | P2 |

---

## 3. Prioritized Roadmap

### Phase 1 -- This Week (Critical Security + Data Integrity + Science)

- [ ] **R-01** [S] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel dashboard. Zero code change.
- [ ] **R-24** [S] Upgrade Vercel plan or implement aggressive client-side caching to stay under 1000 invocations/day.
- [ ] **R-04** [M] Restrict same-origin auto-trust in `middleware.ts` to GET requests only. Require explicit credentials for all state-changing requests.
- [ ] **R-03** [M] Replace `x-workbench-actor-id` with authenticated session user ID in `app/api/workbench/route.ts`.
- [ ] **R-02** [M] Move revision check into the write transaction using a conditional UPDATE in `workbenchDb.ts`.
- [ ] **R-05** [M] Change `INSERT OR REPLACE` to `INSERT` in `project_history`. Replace DELETE-then-INSERT with append-only + soft-delete for experiment records.
- [ ] **R-19** [M] Add project membership verification to the PUT handler in `app/api/workbench/route.ts`.
- [ ] **R-16** [S] Escape SVG text input in `LabelGenerator.tsx` before `dangerouslySetInnerHTML`.
- [ ] **R-06** [S] Add `signal: AbortSignal.timeout(8000)` to all fetch calls in `alphafold/route.ts`, `pubchem/route.ts`, `kegg/route.ts`.
- [ ] **R-09** [S] Add body size limit to AlphaFold POST handler.
- [ ] **R-07** [S] Set PDH coefficient to 0 in ATP objective or document P/O ratio assumption in `fbaEngine.ts`.
- [ ] **R-12** [S] Add route-change cleanup for `selectedNode` in `uiStore.ts` or scope per tool.
- [ ] **R-20** [S] Replace `PAPER_ELEVATED` with dark-surface value. Replace all `#ffffff` active-state backgrounds with `rgba(255,255,255,0.12)`.
- [ ] **R-21** [S] Restore `outline: 2px solid rgba(175,195,214,0.52)` on `:focus-visible` in Hero.module.css and ScSpatialWorkbench.module.css.
- [ ] **R-25** [S] Remove `ignoreBuildErrors: true` or add pre-build typecheck step.
- [ ] **R-26** [S] Add `NEXT_PUBLIC_SENTRY_DSN` to .env.example and Vercel dashboard.

### Phase 2 -- Next 2 Weeks (Architecture + API + Accessibility + Compliance)

- [ ] **R-08** [M] Add UI warning for community FBA heuristic estimates. Document scaling factors.
- [ ] **R-10** [M] Standardize all API routes to use shared `errorResponse` utility.
- [ ] **R-13** [S] Add size check before localStorage write. Emit console warning on quota exceeded.
- [ ] **R-14** [M] Create `schema_migrations` table and versioned migration runner.
- [ ] **R-18** [M] Ensure AI output is never rendered via `dangerouslySetInnerHTML`. Use `react-markdown` with `rehype-sanitize`.
- [ ] **R-22** [L] Add smoke tests for all 14 tool pages (render + key elements visible).
- [ ] **R-23** [S] Raise coverage thresholds to branches:60, functions:65, lines:70.
- [ ] **R-28** [M] Replace KineticPanel's local `simulateODE` with `kineticsEngine.simulateEnzymeSystem`.
- [ ] **R-29** [S] Fix Eyring kinetics unit mismatch in `eyringKinetics.ts`.
- [ ] **R-33** [M] Add `project_members`, `project_state`, `project_run_artifact_index` to GDPR deletion scope.
- [ ] **R-34** [S] Add legal basis for processing to privacy policy.
- [ ] **R-38** [S] Fix `meshPhysicalMaterial` type cast to `MeshLambertMaterial` in ThreeScene.tsx.
- [ ] **R-39** [S] Add `dpr={[1, 1.5]}` to ScSpatialViewport Canvas.
- [ ] **R-40** [M] Add visibility-based render pausing to FluidSimCanvas.
- [ ] Add `maxDuration` exports to ScSpatial and FBA stream routes.
- [ ] Add node focus trap to NodePanel dialog.
- [ ] Add `aria-label` to 3 toggle/download buttons in NodePanel.
- [ ] Increase text opacity from 0.12 to 0.40+ on low-contrast labels.

### Phase 3 -- Month 1 (Performance + Testing + Documentation)

- [ ] **R-11** [L] Extract `useToolSeed()` generic hook. Extract NodePanel tabs into separate files.
- [ ] **R-27** [M] Remove or relocate 80+ unused API scaffold routes.
- [ ] **R-31** [L] Implement configurable data retention policy with automatic archival.
- [ ] [L] Add honesty boundary tests for remaining 10 tools.
- [ ] [M] Add AI provider chain unit tests with mocked fetch.
- [ ] [M] Add numerical regression tests for CETHX Alberty transform.
- [ ] [M] Add KEGG API route test.
- [ ] [M] Create `CHANGELOG.md` following Keep a Changelog format.
- [ ] [M] Create `docs/DATA_FLOW.md` with inter-tool data flow documentation.
- [ ] [M] Expand `CONTRIBUTING.md` with branch strategy, adding tools, adding API routes.
- [ ] [S] Update CLAUDE.md stale references (types.ts path, test count).
- [ ] [M] Pin Node.js to 22 LTS in CI until 24 reaches LTS.
- [ ] [S] Add `npm audit` step to CI.
- [ ] [M] Add E2E test for primary AI analyze flow.
- [ ] [M] Add bundle size budgets to CI.

### Phase 4 -- Month 2-3 (Compliance + Nice-to-Haves + Tech Debt)

- [ ] **R-32** [XL] Implement controlled substance screening module for biosecurity.
- [ ] [L] Update Terms and Privacy pages (legal basis, retention period, DPO, CCPA, Groq disclosure, international transfers).
- [ ] [M] Implement persistent GDPR export storage.
- [ ] [M] Add AI model version tracking to analyze artifacts.
- [ ] [L] Add RBAC roles (owner/editor/viewer) to project_members.
- [ ] [M] Add hash chain to sync_audit table.
- [ ] [L] Expand OpenAPI spec to cover all 100 routes.
- [ ] [M] Add region configuration (`sin1`) for Malaysian audience.
- [ ] [M] Standardize structured logging across all API routes.
- [ ] [S] Remove redundant d3 sub-packages or full d3 bundle.
- [ ] [S] Remove `next-intl` or complete i18n implementation.
- [ ] [L] Add component tests for ThreeScene, NodePanel, SemanticSearch.
- [ ] [S] Add scientific references to CatDes, ProEvol, GECAIR, DynCon, ScSpatial engines.

---

## 4. Effort Estimates

| Size | Definition | Count | Examples |
|------|-----------|-------|---------|
| **S** (< 2 hours) | Config change, one-line fix, add a line | 24 | Set Upstash env vars, add timeout to fetch, fix type cast, raise coverage thresholds, add dpr prop |
| **M** (2-8 hours) | Moderate code change, new utility, single module | 14 | Fix TOCTOU race, extract generic hook, add migration system, standardize error responses, add focus trap |
| **L** (1-3 days) | Multi-file refactor, new test suite, documentation set | 8 | Extract NodePanel tabs, add 12 tool smoke tests, implement retention policy, remove 80+ scaffold routes |
| **XL** (1-2 weeks) | Cross-cutting concern, new subsystem | 2 | Biosecurity screening module, full OpenAPI coverage |

---

## 5. Dependency Graph

```
R-01 (Set Upstash Redis)  ─────────────────────────────────────────────┐
  No dependencies. Unblocks rate limiting for all routes.              │
                                                                       ▼
R-04 (Same-origin trust fix) ──┐                              R-02 (TOCTOU fix)
  No dependencies.              │                              Depends on: nothing
                                │                              Blocks: R-05 pattern
R-03 (Actor ID fix) ───────────┤                                       │
  No dependencies.              │                              R-05 (Audit immutability)
  Must land before R-19.        │                              Depends on: R-02
                                ▼                              Blocks: compliance work
R-19 (Membership check)                                                 │
  Depends on: R-03                                             R-14 (Migration system)
  Blocks: compliance audit                                              │
                                                                       ▼
R-16 (Barcode XSS) ─────────┐                                 R-33 (GDPR deletion)
  No dependencies.           │                                 Depends on: R-14
                             │
R-06 (Fetch timeouts) ──────┤
  No dependencies.           │
                             │
R-07 (FBA ATP fix) ─────────┤
  No dependencies.           │
                             ▼
                    Phase 1 complete ──► Phase 2 unblocked
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        R-11 (Refactor)  R-22 (Tests)  R-31 (Retention)
        Depends on:      Depends on:   Depends on: R-14
        nothing          nothing       Blocks: R-33, R-32
              │              │              │
              ▼              ▼              ▼
        R-27 (Prune      R-23 (Coverage)  R-32 (Export control)
         routes)         thresholds)      Depends on: R-31
        Depends on:      Depends on:      XL effort
        R-11             R-22
```

**Critical path:** R-01 -> R-04/R-03 (parallel) -> R-19 -> Phase 2 compliance work -> R-31 -> R-32

**Parallelizable:** R-01, R-04, R-03, R-06, R-07, R-16 can all be done simultaneously by different developers.

---

## 6. Quick Wins (Fixable in Under 30 Minutes)

### Security
- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel dashboard (config only, zero code)
- [ ] Add `signal: AbortSignal.timeout(8000)` to 3 fetch calls in `alphafold/route.ts`
- [ ] Add `signal: AbortSignal.timeout(10000)` to 4 fetch calls in `kegg/route.ts`
- [ ] Add `signal: AbortSignal.timeout(10000)` to 4 fetch calls in `pubchem/route.ts`
- [ ] Add `content-length` check to AlphaFold POST handler
- [ ] Escape SVG text in `LabelGenerator.tsx` before rendering
- [ ] Remove `path: resolveDbPath()` from `getBackendMeta()` return value
- [ ] Tighten KEGG regex from `[^a-zA-Z0-9\s\-()]` to `[^a-zA-Z0-9\s\-]`

### Science
- [ ] Set PDH coefficient to 0 in ATP objective (`fbaEngine.ts` line 171)
- [ ] Fix Eyring kinetics unit mismatch -- convert enzymeConc from M to mM (`eyringKinetics.ts` line 57)
- [ ] Add comment documenting P/O ratio assumption in FBA

### Architecture
- [ ] Remove `MeshPhysicalMaterial` import and fix type cast in `ThreeScene.tsx` lines 25, 597, 602
- [ ] Add `dpr={[1, 1.5]}` to ScSpatialViewport Canvas (`ScSpatialViewport.tsx` line 861)
- [ ] Add `aria-label` to 3 toggle buttons in NodePanel (lines 1544, 1793, 1945)
- [ ] Replace `outline: none` with `outline: 2px solid rgba(175,195,214,0.52)` in Hero.module.css and ScSpatialWorkbench.module.css

### State
- [ ] Add route-change cleanup for `selectedNode` in `uiStore.ts`
- [ ] Add size check before localStorage write in `workbenchStore.ts`

### DevOps
- [ ] Remove `ignoreBuildErrors: true` from `next.config.mjs` line 20
- [ ] Add `NEXT_PUBLIC_SENTRY_DSN` to `.env.example`
- [ ] Raise coverage thresholds in `jest.config.cjs` to `branches: 60, functions: 65, lines: 70`
- [ ] Add `npm audit --omit=dev --audit-level=high` to CI pipeline

### Accessibility
- [ ] Replace `PAPER_ELEVATED` value in `src/theme/index.ts` line 98
- [ ] Replace `"#ffffff"` active-state backgrounds with `"rgba(255,255,255,0.12)"` in ToolOverlay.tsx
- [ ] Increase text opacity from 0.12 to 0.40 in NodePanel.tsx lines 435, 1459
- [ ] Add `role="status"` and `aria-label="Loading content"` to NodePanel loading placeholders
- [ ] Update stale Terms page date from "March 2026" to "June 2026"

---

## 7. Compliance Scorecard

| Dimension | Rating | Status | Key Gaps |
|-----------|--------|--------|----------|
| **Security** | Yellow | Gaps | Rate limiting non-functional without Upstash; same-origin trust bypass; forgeable actor ID; barcode XSS; no fetch timeouts on proxies |
| **Data Privacy (GDPR/CCPA)** | Red | Critical Gaps | No legal basis stated; no data retention policy; GDPR deletion incomplete; no CCPA compliance; in-memory export store; forgeable actor identity |
| **Scientific Integrity** | Yellow | Gaps | FBA ATP calculation incorrect; community FBA uses magic numbers; mixed units in Eyring kinetics; 10/14 tools lack honesty boundary tests |
| **Accessibility (WCAG 2.1 AA)** | Yellow | Gaps | 73% overall score; 1 critical (PAPER_ELEVATED), 11 high (focus indicators, contrast, missing aria-labels, focus trap, keyboard access) |
| **Audit Trail / Reproducibility** | Red | Critical Gaps | INSERT OR REPLACE destroys immutability; DELETE-then-INSERT destroys records; no hash chain on workbench data; no AI model version pinning |
| **API Reliability** | Yellow | Gaps | No fetch timeouts on proxy routes; inconsistent error shapes; no response caching; provider chain timeout can exceed platform maxDuration |
| **Documentation** | Yellow | Gaps | 70 API routes undocumented; no CHANGELOG; no inter-tool data flow docs; stale CLAUDE.md references; skeleton CONTRIBUTING.md |
| **Testing / QA** | Red | Critical Gaps | 35% branch threshold; 12/14 tools untested; 8 pipelines untested; CI does not enforce coverage; no E2E for primary AI flow |
| **DevOps / Infrastructure** | Yellow | Gaps | Hobby plan invocation limit; ignoreBuildErrors; missing client Sentry DSN; no bundle size budgets; no region config |
| **Export Control / Biosecurity** | Red | Critical Gaps | No technical controls for dual-use data; no controlled substance screening; insufficient export control notice in Terms |

**Overall Posture: Yellow -- Significant gaps requiring immediate attention in security, data integrity, and compliance before production scale.**

---

## 8. Auditor Performance Assessment

### Rating Scale: A (Excellent) / B (Good) / C (Adequate) / D (Weak)

| Auditor | Completeness | Actionability | Evidence Quality | Overall | Notable Strength |
|---------|-------------|---------------|------------------|---------|-----------------|
| **CISO** | A | A | A | **A** | Every finding includes concrete code fix with file:line references. Risk matrix with exploitability ratings. |
| **Scientific Domain Expert** | A | A | A | **A** | Hand-calculated expected values for FBA. Correct unit analysis for Eyring equation. Balanced positive findings. |
| **Data Architect** | A | A | A | **A** | ASCII data flow diagrams. TOCTOU race correctly identified with exact code path. Migration strategy recommended. |
| **Principal Software Architect** | A | B+ | A | **A-** | Comprehensive 22-finding summary table. Excellent dependency analysis. Could improve by prioritizing findings more sharply. |
| **API/Integration Architect** | A | A | B+ | **A-** | API Health Matrix is excellent. Missing fetch timeouts correctly identified across all proxy routes. |
| **QA Director** | A | B+ | B+ | **B+** | Coverage heat map is outstanding. Honesty test gap identification is valuable. Could provide more specific test code examples. |
| **3D/WebGL Specialist** | B+ | A | A | **B+** | meshLambertMaterial compliance table is thorough. DPR and visibility pause findings are actionable. Scope limited to 3D only. |
| **Accessibility Lead** | A | B+ | B+ | **B+** | WCAG scorecard with per-page ratings. Positive findings section is valuable. Some fixes lack specific code examples. |
| **DevOps Engineer** | A | B+ | B+ | **B+** | Deployment readiness checklist is excellent. Hobby plan invocation limit is a critical finding others missed. |
| **Regulatory Compliance Officer** | A | B | B | **B+** | FDA 21 CFR Part 11 and GDPR article references are authoritative. Some findings overlap with CISO/Data Architect. |
| **Documentation Manager** | B+ | B | B | **B** | Good gap identification. Could prioritize more aggressively. OpenAPI spec duplication finding is useful. |

### Gaps No Auditor Covered

| Gap | Why It Matters | Recommended Action |
|-----|---------------|-------------------|
| **Performance/load testing** | No auditor measured actual page load times, TTFB, or LCP under load. The WebVitals component captures data but discards it in production. | Add Lighthouse CI or Vercel Analytics integration. |
| **Mobile/responsive testing** | No auditor tested the 14 tool pages on mobile viewports. The 3D visualizations, complex forms, and data tables likely degrade significantly on small screens. | Add Playwright tests with mobile viewports for key tool pages. |
| **Internationalization readiness** | `next-intl` is integrated but unused. No auditor assessed the effort to localize the platform for non-English audiences. | Either remove next-intl or add a localization audit. |
| **Error recovery/resilience** | No auditor tested what happens when upstream services (Groq, Gemini, AlphaFold, PubChem, KEGG) are partially or fully down. The AI provider chain handles this, but proxy routes may not. | Add chaos testing or manual service degradation tests. |
| **Cost modeling** | No auditor estimated the actual dollar cost of running this platform at various user scales (Vercel, Groq, Gemini, Turso, Upstash). | Create a cost model spreadsheet with per-user API call estimates. |
| **Backup/disaster recovery** | No auditor assessed what happens if the Turso database is lost, or if Vercel deployment fails. No backup strategy documented. | Document backup procedures. Test database restore from backup. |

---

**End of Consolidated Audit Report**

**Prepared by:** Chief Audit Officer
**Distribution:** CTO, Board
**Next Review:** After Phase 1 completion (target: 2026-07-05)