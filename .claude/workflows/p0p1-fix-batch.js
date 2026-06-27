
export const meta = {
  name: 'p0p1-fix-batch',
  description: 'Parallel execution of 7 remaining P0/P1 audit fixes — security, science, GDPR, data, infra, a11y, QA',
  phases: [
    { title: 'Parallel Fixes', detail: '7 agents fixing independent issues simultaneously' },
  ],
};

phase('Parallel Fixes');

const results = await parallel([

  // ──── Task 2: Security — Error Sanitization & Rate Limiter ────
  () => agent(
    "You are fixing security issues in Nexus-Bio 1.0. Make these specific changes:\n\n" +
    "1. In `app/api/analyze/route.ts`: Remove the inline Map rate limiter (lines 52-64). Instead import and use `checkRateLimit` from `../../../src/utils/rateLimit.ts`. The function signature is `checkRateLimit(ip: string, max?: number): boolean`.\n\n" +
    "2. In `app/api/copilot/route.ts`: Remove the inline Map rate limiter (lines 28-40). Same — use the shared `checkRateLimit`.\n\n" +
    "3. In `app/api/admin/health/route.ts`: Replace `detail: \"GROQ_API_KEY not configured\"` with `detail: \"AI provider not configured\"` and `detail: \"GEMINI_API_KEY not configured\"` with `detail: \"Fallback AI provider not configured\"`.\n\n" +
    "4. In `src/utils/cors.ts` line 6: Wrap localhost entries in a NODE_ENV check:\n" +
    "```typescript\n" +
    "const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'\n" +
    "  ? [\"https://nexus-bio-1-0.vercel.app\"]\n" +
    "  : [\"https://nexus-bio-1-0.vercel.app\", \"http://localhost:3000\", \"http://localhost:3001\"];\n" +
    "```\n\n" +
    "5. For API routes that return `err.message` directly: In `app/api/esmfold/route.ts`, `app/api/blast/offtarget/route.ts`, `app/api/admin/retention/route.ts`, `app/api/admin/prompts/route.ts`, `app/api/admin/deploy/route.ts`, `app/api/admin/ml/train/route.ts`: replace `err instanceof Error ? err.message : \"Internal server error\"` with a generic message. Log the full error server-side with `console.error`. Return only `\"An internal error occurred\"` to the client.\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: sanitize error messages, fix rate limiter, gate CORS localhost'",
    { label: 'task2-security', phase: 'Parallel Fixes' }
  ),

  // ──── Task 3: Science — FBA ATP Yield & Cell-free Km ────
  () => agent(
    "You are fixing two critical scientific algorithm errors in Nexus-Bio 1.0.\n\n" +
    "1. In `src/server/fbaEngine.ts` around line 156-157, the ATP yield formula is WRONG. It currently includes `(vars.PDH ?? 0) * 0.5` which mixes NADH energy currency with ATP. PDH (pyruvate dehydrogenase) produces NADH, not ATP.\n\n" +
    "FIX: Change the formula to only count glycolysis ATP reactions:\n" +
    "```typescript\n" +
    "const atpYield =\n" +
    "  glc > 1e-9 ? ((vars.GAPD ?? 0) + (vars.PYK ?? 0) - (vars.PFK ?? 0)) / glc : 0;\n" +
    "```\n" +
    "Add a JSDoc comment explaining: 'ATP yield from glycolysis per glucose: GAPD produces 1 ATP, PYK produces 1 ATP, PFK consumes 1 ATP. PDH is excluded as it produces NADH, not ATP.'\n\n" +
    "2. In `src/services/CellFreeEngine.ts` around line 401, the Km unit conversion is WRONG. It uses `* 1000` but should be `* 1e6`. BRENDA Km is in mM (millimolar), internal unit is nM (nanomolar). 1 mM = 1,000,000 nM.\n\n" +
    "FIX: Change `params.brendaKm! * 1000` to `params.brendaKm! * 1e6` and update the comment to `// mM → nM (1 mM = 1e6 nM)`\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: correct FBA ATP yield formula and cell-free Km unit conversion'",
    { label: 'task3-science', phase: 'Parallel Fixes' }
  ),

  // ──── Task 4: GDPR — Table Names & Privacy Policy ────
  () => agent(
    "You are fixing GDPR compliance issues in Nexus-Bio 1.0.\n\n" +
    "1. In `src/services/governance/gdprService.ts` around lines 124-131, the TABLE_USER_COLUMNS mapping references WRONG table names. The actual tables in the database (defined in `src/server/workbenchDb.ts`) are different.\n\n" +
    "FIX: Change the mapping to:\n" +
    "```typescript\n" +
    "const TABLE_USER_COLUMNS: Record<string, string> = {\n" +
    "  projects: 'actor_id',\n" +
    "  experiment_records: 'actor_id',\n" +
    "  project_history: 'actor_id',\n" +
    "  project_run_artifact_index: 'actor_id',\n" +
    "  sync_audit: 'actor_id',\n" +
    "  gdpr_requests: 'user_id',\n" +
    "};\n" +
    "```\n\n" +
    "2. In `app/privacy/page.tsx`, the privacy policy is inaccurate. Rewrite the content section (NOT the styling/layout) to accurately describe:\n" +
    "- We store project data, experiment records, and audit logs in a SQLite database\n" +
    "- We use Groq and Google Gemini AI APIs to process research queries\n" +
    "- We use PostHog for anonymous analytics\n" +
    "- We store UI preferences in browser localStorage\n" +
    "- We use cookies for session management\n" +
    "- Users can request data deletion or export via GDPR endpoints\n" +
    "Keep the existing dark theme styling (#0a0a0a background, #a3a3a3 text, etc). Only change the TEXT CONTENT of the privacy policy paragraphs.\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: correct GDPR table names and update privacy policy'",
    { label: 'task4-gdpr', phase: 'Parallel Fixes' }
  ),

  // ──── Task 5: Data Integrity — DELETE-then-INSERT & fluidPointer ────
  () => agent(
    "You are fixing data integrity issues in Nexus-Bio 1.0.\n\n" +
    "1. In `src/server/workbenchDb.ts` around lines 687-691, there is a DELETE-then-INSERT pattern that causes a data loss window. If the server crashes between DELETE and INSERT, data is permanently lost.\n\n" +
    "FIX: Wrap the DELETE+INSERT operations in a SQLite transaction. Find the function that contains these lines (likely `writeProjectState` or similar) and ensure the operations are wrapped in BEGIN/COMMIT. The codebase uses `better-sqlite3` which supports synchronous transactions via `db.transaction()`. If the operations are already in a batch/array, ensure they execute atomically.\n\n" +
    "2. In `src/store/uiStore.ts`, the `fluidPointer` state (line 43) updates at 60Hz from mouse movements, causing ALL subscribers to re-render. This is a performance issue.\n\n" +
    "FIX: Create a new file `src/hooks/useFluidPointer.ts` with a hook that uses `useRef` instead of Zustand store:\n" +
    "```typescript\n" +
    "import { useRef, useEffect, useCallback } from 'react';\n" +
    "import type { FluidPointer } from '../store/uiStore';\n\n" +
    "export function useFluidPointer() {\n" +
    "  const pointerRef = useRef<FluidPointer>({ x: 0, y: 0, dx: 0, dy: 0, active: false });\n\n" +
    "  const updatePointer = useCallback((p: FluidPointer) => {\n" +
    "    pointerRef.current = p;\n" +
    "  }, []);\n\n" +
    "  return { pointerRef, updatePointer };\n" +
    "}\n" +
    "```\n" +
    "Keep the existing `setFluidPointer` in uiStore but add a deprecation comment. Components that only READ fluidPointer should use the ref-based hook instead.\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: atomic workbench writes and ref-based fluidPointer'",
    { label: 'task5-data', phase: 'Parallel Fixes' }
  ),

  // ──── Task 6: Infrastructure — Vercel Config & Lint ────
  () => agent(
    "You are fixing infrastructure configuration issues in Nexus-Bio 1.0.\n\n" +
    "1. In `vercel.json`: Change `installCommand` from `\"npm install\"` to `\"npm ci\"` (reproducible builds).\n\n" +
    "2. In `app/api/fba/route.ts`: Add `export const maxDuration = 60;` near the top of the file (after the runtime export). This gives FBA computations 60 seconds before Vercel times out.\n\n" +
    "3. In `app/api/analyze/route.ts`: Add `export const maxDuration = 30;` near the top of the file. This gives AI calls 30 seconds.\n\n" +
    "4. In `package.json` line 8: Change `\"lint\": \"biome check src/ || true\"` to `\"lint\": \"biome check src/\"`. The `|| true` silently swallows lint failures in CI.\n\n" +
    "5. In `server.ts`: Add a comment at the top explaining:\n" +
    "```typescript\n" +
    "// NOTE: This custom server with Socket.IO only works on self-hosted Node.js.\n" +
    "// On Vercel, the serverless deployment ignores this file.\n" +
    "// Real-time features (WebSocket) are non-functional on Vercel.\n" +
    "```\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: vercel config, maxDuration, remove lint bypass'",
    { label: 'task6-infra', phase: 'Parallel Fixes' }
  ),

  // ──── Task 7: Accessibility — Light Background Fixes ────
  () => agent(
    "You are fixing ALL light background violations in Nexus-Bio 1.0. The project requires DARK THEME ONLY.\n\n" +
    "Replace every light background with a dark equivalent:\n\n" +
    "1. `src/design-system.css` lines 42-58: DELETE the entire `@media (prefers-color-scheme: light) { ... }` block\n\n" +
    "2. `src/components/tools/ScSpatialPage.tsx`: Replace ALL `#fff`, `#ffffff`, `#f3f6f8`, `#f6f7f9`, `#e5e7eb` backgrounds with `#0d0f14` or `#10131a` (dark backgrounds)\n\n" +
    "3. `src/components/tools/scspatial/ScSpatialWorkbench.module.css`: Replace ALL `#f3f4f6`, `#fef3c7`, `#fef2f2`, `#dcfce7`, `#dbeafe`, `rgba(255,255,255,0.96)` with dark equivalents like `#1a1d24`, `#2a2418`, `#2a1818`, `#182a1e`, `#181e2a`, `rgba(255,255,255,0.06)`\n\n" +
    "4. `src/index.css`: Replace `#e2e8f0` slider thumbs with `#3a3f4b`\n\n" +
    "5. `app/privacy/page.tsx` and `app/terms/page.tsx`: Replace `background: '#fff'` with `background: '#0a0a0a'` (keeping the rest of the styling)\n\n" +
    "6. `src/components/ProteinViewer.tsx`, `src/components/PDBExplorer.tsx`, `src/components/molecular/CatalystViewer3D.tsx`, `src/components/tools/multio/MultiOEmbeddingTab.tsx`: Replace `background: '#fff'` toggle knobs with `background: '#a3a3a3'`\n\n" +
    "7. `src/components/tools/ToolOverlay.tsx` and `src/components/tools/metabolic-eng/IdleStartButton.tsx`: Replace `rgba(255,255,255,0.88)` with `rgba(255,255,255,0.08)`\n\n" +
    "8. `app/globals.css`: Replace `#e5d0aa` with `#2a2418` and `#d1e7e1` with `#1a2a24`\n\n" +
    "IMPORTANT: Search for ALL occurrences in each file. Use replace_all where possible. Do NOT miss any.\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: replace all light backgrounds with dark theme equivalents'",
    { label: 'task7-a11y', phase: 'Parallel Fixes' }
  ),

  // ──── Task 8: QA — Test Infrastructure ────
  () => agent(
    "You are fixing test infrastructure issues in Nexus-Bio 1.0.\n\n" +
    "1. In `.github/workflows/ci.yml`: Find the duplicate jest runs. There are likely two separate jest commands:\n" +
    "   - `npx jest --verbose`\n" +
    "   - `npx jest --coverage`\n" +
    "Merge them into a single run: `npx jest --verbose --coverage`\n\n" +
    "2. In `jest.config.cjs`: Add coverage thresholds. Find the `module.exports` object and add:\n" +
    "```javascript\n" +
    "coverageThreshold: {\n" +
    "  global: {\n" +
    "    branches: 50,\n" +
    "    functions: 50,\n" +
    "    lines: 50,\n" +
    "    statements: 50,\n" +
    "  },\n" +
    "},\n" +
    "```\n\n" +
    "Run `npx tsc --noEmit` after changes. Commit with message: 'fix: merge CI jest runs and add coverage thresholds'",
    { label: 'task8-qa', phase: 'Parallel Fixes' }
  ),
]);

return results;
