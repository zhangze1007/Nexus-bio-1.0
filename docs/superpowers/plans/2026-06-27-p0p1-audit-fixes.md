# P0/P1 Audit Fix Plan — 2026-06-27

## Overview
Fix 36 Critical and High severity issues found by the 12-role enterprise audit.
Organized into 8 tasks, each touching a focused area of the codebase.

## Global Constraints
- Dark theme only: never use #FFFFFF, #F5F7FA, #F2F5F8 or any light background
- All algorithms must use real math — no hardcoded values
- Groq is always primary AI provider, Gemini is always fallback
- meshLambertMaterial only in Three.js (never meshStandardMaterial)
- Never reverse API provider order
- All error messages to clients must be generic — log details server-side only
- All fixes must pass `npx tsc --noEmit` type check

---

## Task 1: Security — Workbench Auth & User Isolation

**Goal:** Add authentication and user isolation to the workbench API.

**Files to modify:**
- `app/api/workbench/route.ts`

**Requirements:**
1. Add auth check to GET handler (line 142) — verify session/token before returning data
2. Add project membership verification — only members can read/write a project
3. The `x-workbench-project-id` and `x-workbench-actor-id` headers must be validated against actual session, not trusted blindly
4. Return 401 for unauthenticated requests, 403 for non-members
5. Keep existing CORS and provenance logic intact

**Acceptance criteria:**
- Unauthenticated GET returns 401
- Authenticated user cannot access another user's project
- Existing valid flows still work

---

## Task 2: Security — Error Sanitization & Rate Limiter

**Goal:** Fix error message leaking and rate limiter bypass.

**Files to modify:**
- `app/api/analyze/route.ts` (lines 52-64: remove inline rate limiter)
- `app/api/copilot/route.ts` (lines 28-40: remove inline rate limiter)
- `app/api/admin/health/route.ts` (lines 66, 108: genericize API key messages)
- `src/utils/cors.ts` (line 6: gate localhost behind NODE_ENV check)
- Multiple API routes: replace `err.message` with generic messages

**Requirements:**
1. Remove the inline `Map` rate limiters from analyze and copilot routes — use the shared `checkRateLimit` from `src/utils/rateLimit.ts`
2. In admin/health route, replace `"GROQ_API_KEY not configured"` with `"AI provider not configured"`
3. In `src/utils/cors.ts`, wrap localhost entries in `if (process.env.NODE_ENV !== 'production')`
4. For all API routes that return `err.message` directly: log the full error server-side, return generic "Internal server error" to client
5. The FBA route pattern (line 380-396) is the correct example — follow it

**Acceptance criteria:**
- analyze route uses shared rate limiter, not inline Map
- admin/health doesn't reveal env var names
- localhost not in CORS allowlist in production
- No raw error messages in HTTP responses

---

## Task 3: Science — FBA ATP Yield & Cell-free Km

**Goal:** Fix two critical scientific algorithm errors.

**Files to modify:**
- `src/server/fbaEngine.ts` (line 156-157: fix ATP yield formula)
- `src/services/CellFreeEngine.ts` (line 401: fix Km conversion)

**Requirements:**
1. **ATP yield formula** at line 156-157: remove `(vars.PDH ?? 0) * 0.5` — PDH produces NADH, not ATP. Correct formula:
   ```typescript
   const atpYield = glc > 1e-9 ? ((vars.GAPD ?? 0) + (vars.PYK ?? 0) - (vars.PFK ?? 0)) / glc : 0;
   ```
2. **Km conversion** at line 401: change `* 1000` to `* 1e6` — 1 mM = 1,000,000 nM, not 1,000
3. Add JSDoc comments explaining the scientific basis of each formula
4. Add unit tests for both fixes with known-good values

**Acceptance criteria:**
- ATP yield formula only counts glycolysis reactions (GAPD, PYK, PFK)
- Km conversion is 1e6 (mM to nM)
- Unit tests pass with scientifically correct expected values

---

## Task 4: GDPR — Table Names & Privacy Policy

**Goal:** Fix GDPR endpoints and privacy policy.

**Files to modify:**
- `src/services/governance/gdprService.ts` (lines 124-131: fix table names)
- `app/privacy/page.tsx` (rewrite to match actual data collection)

**Requirements:**
1. Fix `TABLE_USER_COLUMNS` mapping to match actual DB tables:
   ```typescript
   const TABLE_USER_COLUMNS: Record<string, string> = {
     projects: 'actor_id',                    // was: workbench_projects
     experiment_records: 'actor_id',          // was: workbench_experiments
     project_history: 'actor_id',             // was: workbench_history
     project_run_artifact_index: 'actor_id',  // was: workbench_artifacts
     sync_audit: 'actor_id',                  // was: audit_log
     gdpr_requests: 'user_id',                // correct
   };
   ```
2. Update privacy policy to accurately describe:
   - Data stored in SQLite (projects, experiments, audit logs)
   - AI provider usage (Groq/Gemini API calls)
   - PostHog analytics
   - localStorage usage
   - Cookie usage
3. Keep the dark theme styling of the privacy page

**Acceptance criteria:**
- GDPR deletion/export queries find the correct tables
- Privacy policy accurately describes all data collection

---

## Task 5: Data Integrity — DELETE-then-INSERT & fluidPointer

**Goal:** Fix data loss window and performance issue.

**Files to modify:**
- `src/server/workbenchDb.ts` (lines 687-691: replace DELETE+INSERT with atomic upsert)
- `src/store/uiStore.ts` (line 130: move fluidPointer to ref-based approach)

**Requirements:**
1. Replace DELETE-then-INSERT pattern with `INSERT OR REPLACE` or wrapped in a transaction:
   ```typescript
   // Instead of:
   { sql: "DELETE FROM project_run_artifact_index WHERE project_id = ?", ... },
   { sql: "INSERT INTO ...", ... },
   // Use:
   { sql: "INSERT OR REPLACE INTO project_run_artifact_index ...", ... },
   ```
   Or wrap in `BEGIN`/`COMMIT` transaction.
2. For fluidPointer: create a separate `useFluidPointerRef` hook that uses `useRef` instead of Zustand store, so mouse movements don't trigger re-renders across all subscribers
3. Keep the existing `setFluidPointer` in uiStore for backward compatibility but mark as deprecated

**Acceptance criteria:**
- No data loss window on concurrent syncs
- fluidPointer updates don't cause re-renders in unrelated components
- Existing fluid pointer functionality (background animation) still works

---

## Task 6: Infrastructure — Vercel Config & Socket.IO

**Goal:** Fix deployment configuration issues.

**Files to modify:**
- `vercel.json` (installCommand: npm ci)
- `app/api/fba/route.ts` (add maxDuration)
- `app/api/analyze/route.ts` (add maxDuration)
- `package.json` (line 8: remove `|| true` from lint script)

**Requirements:**
1. Change `vercel.json` installCommand from `"npm install"` to `"npm ci"`
2. Add `export const maxDuration = 60` to `app/api/fba/route.ts` (compute-heavy)
3. Add `export const maxDuration = 30` to `app/api/analyze/route.ts` (AI calls)
4. Remove `|| true` from lint script in `package.json` line 8
5. Add a comment in `server.ts` explaining Socket.IO only works on self-hosted, not Vercel

**Acceptance criteria:**
- `npm ci` used in Vercel builds
- FBA route has 60s timeout
- analyze route has 30s timeout
- Lint failures actually fail CI
- Socket.IO limitation documented

---

## Task 7: Accessibility — Light Background Fixes

**Goal:** Fix all light background violations in source code.

**Files to modify:**
- `src/design-system.css` (lines 42-58: remove prefers-color-scheme: light block)
- `src/components/tools/ScSpatialPage.tsx` (10 violations)
- `src/components/tools/scspatial/ScSpatialWorkbench.module.css` (9 violations)
- `src/index.css` (4 slider thumb violations)
- `app/privacy/page.tsx`, `app/terms/page.tsx` (white backgrounds)
- `src/components/ProteinViewer.tsx`, `src/components/PDBExplorer.tsx`, `src/components/molecular/CatalystViewer3D.tsx`, `src/components/tools/multio/MultiOEmbeddingTab.tsx` (toggle knobs)
- `src/components/tools/ToolOverlay.tsx`, `src/components/tools/metabolic-eng/IdleStartButton.tsx` (rgba white)

**Requirements:**
1. Remove the entire `@media (prefers-color-scheme: light)` block from `src/design-system.css`
2. Replace all `#fff`/`#ffffff`/`white` backgrounds with dark theme equivalents from THEME
3. Replace all light gray backgrounds (#f3f6f8, #f6f7f9, #f3f4f6, #e5e7eb) with dark equivalents
4. Replace `rgba(255,255,255,0.88)` with `rgba(255,255,255,0.08)` or similar dark-appropriate value
5. For toggle knobs, use `THEME.TEXT_PRIMARY` or similar
6. For slider thumbs in index.css, use `#3a3f4b` or similar dark gray

**Acceptance criteria:**
- No `#fff`, `#ffffff`, `white`, `#f3f6f8`, `#f6f7f9`, `#f3f4f6` in source code
- No `@media (prefers-color-scheme: light)` blocks
- All UI elements visible on dark backgrounds

---

## Task 8: QA — Test Infrastructure

**Goal:** Fix test infrastructure issues.

**Files to modify:**
- `.github/workflows/ci.yml` (merge duplicate jest runs)
- `jest.config.cjs` (add coverage thresholds)

**Requirements:**
1. Merge duplicate jest runs in CI: change `npx jest --verbose` + `npx jest --coverage` to single `npx jest --verbose --coverage`
2. Add coverage thresholds to jest.config.cjs:
   ```javascript
   coverageThreshold: {
     global: {
       branches: 50,
       functions: 50,
       lines: 50,
       statements: 50,
     },
   },
   ```
3. Verify CI passes with these changes

**Acceptance criteria:**
- Single jest run in CI with both verbose and coverage
- Coverage thresholds enforced
- CI passes
