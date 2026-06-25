# Audit Quick Wins — 2026-06-24

10 small fixes from the pre-launch audit, all under 30 minutes each.

## Tasks

### Task 1: FluxParticles geometry disposal (Performance)
**File:** `src/components/ThreeScene.tsx` lines 738-741
**Fix:** Add a `useEffect` cleanup that calls `.dispose()` on the `BufferGeometry` and `PointsMaterial` created for FluxParticles. Return cleanup function from the same effect or a dedicated one.

### Task 2: Skip-to-content link (Accessibility)
**File:** `src/components/ide/ToolsLayoutShell.tsx`
**Fix:** Add `id="main-content"` to the main content landmark element so the skip-to-content link works.

### Task 3: Sidebar aria-label (Accessibility)
**File:** `src/components/ide/IDESidebar.tsx` lines 393-396
**Fix:** Add `aria-label={collapsed ? \`\${tool.shortLabel} — ${tool.name}\` : undefined}` to the cross-stage Link elements (matching the pattern already used at lines 254-257).

### Task 4: Tool title heading (Accessibility)
**File:** `src/components/tools/shared/ToolShell.tsx` line 202-208
**Fix:** Change the `<div>` to `<h1>` for the tool title. Keep all existing styles.

### Task 5: Console entries cap (Architecture)
**File:** `src/store/uiStore.ts` lines 139-145
**Fix:** Cap `consoleEntries` at 500 entries. After appending, slice to last 500: `.slice(-500)`.

### Task 6: sanitizeHistory escapeHtml (Security)
**File:** `app/api/analyze/route.ts` lines 416-453
**Fix:** Apply `escapeHtml()` to each message content inside `sanitizeHistory` before truncation.

### Task 7: mfa13CEngine stale comment (Documentation)
**File:** `src/server/mfa13CEngine.ts` lines 21-22
**Fix:** Update "Flux estimation uses grid search, not nonlinear optimization" to "Flux estimation uses Levenberg-Marquardt nonlinear least-squares optimization."

### Task 8: iJO1366Subset header (Documentation)
**File:** `src/data/iJO1366Subset.ts` line 2
**Fix:** Change "~95 reactions" to "71 reactions" (the actual count).

### Task 9: Turso CSP connect-src (Security)
**File:** `next.config.mjs` line 53
**Fix:** Add `https://*.turso.io` to the `connect-src` directive.

### Task 10: Pin next-auth version (Security)
**File:** `package.json` line 37
**Fix:** Change `"next-auth": "^5.0.0-beta.31"` to `"next-auth": "5.0.0-beta.31"` (remove caret).

## Global Constraints
- Dark theme only: never use light backgrounds
- All font references must use `THEME.SANS`, `THEME.MONO`, or `THEME.BRAND`
- Never modify FORBIDDEN files (IDEShell, IDETopBar, IDESidebar structure, DBTLflowPage, GECAIRPage, ProEvolPage)
- Run `npx jest --no-coverage` after all changes to confirm zero regressions
