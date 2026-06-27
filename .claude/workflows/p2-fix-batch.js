
export const meta = {
  name: 'p2-fix-batch',
  description: 'Parallel execution of P2 medium-priority audit fixes — science, data, API, WebGL, a11y, architecture',
  phases: [
    { title: 'P2 Fixes', detail: '6 agents fixing medium-priority issues simultaneously' },
  ],
};

phase('P2 Fixes');

const results = await parallel([

  // ──── P2-A: Scientific & Data Fixes ────
  () => agent(
    "You are fixing medium-priority scientific and data integrity issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Bioreactor kLa value** in `src/components/tools/DynConPage.tsx`: Find the kLa constant (likely 0.015). Add a JSDoc comment explaining this is a placeholder and the actual value depends on reactor geometry and agitation. Consider making it a configurable parameter.\n\n" +
    "2. **Carbon efficiency constants** in `src/server/fbaEngine.ts`: Find inline carbon efficiency coefficients (line ~158: `biomass * 4.6 + product * 6`). Extract to named constants at the top of the file:\n" +
    "```typescript\n" +
    "const BIOMASS_CARBON_CONTENT = 4.6; // mol C per g DW (Neidhardt et al.)\n" +
    "const GLUCOSE_CARBON = 6; // mol C per mol glucose\n" +
    "```\n\n" +
    "3. **metabolicMachine SET_PARAM** in `src/machines/metabolicMachine.ts`: Find the `equilibrium` state. Add a `SET_PARAM` transition that allows updating parameters while in equilibrium state.\n\n" +
    "4. **Optimistic concurrency** in `app/api/workbench/route.ts`: Find the PUT handler's revision check. Ensure it uses strict equality (`===`) not less-than (`<`) for revision matching.\n\n" +
    "5. **workbenchStore workflowControl** in `src/store/workbenchStore.ts`: Find the merge function. After merging state, recompute `workflowControl` if it exists.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: scientific constants extraction, metabolicMachine SET_PARAM, concurrency fix'",
    { label: 'p2-science-data', phase: 'P2 Fixes' }
  ),

  // ──── P2-B: API & Error Handling ────
  () => agent(
    "You are fixing medium-priority API issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Standardize error responses**: Find `src/utils/apiErrors.ts` or create it if missing. It should export an `errorResponse(message, status, details?, headers?)` function. Then update these routes to use it:\n" +
    "   - `app/api/workbench/route.ts`\n" +
    "   - `app/api/fba/route.ts`\n" +
    "   - `app/api/analyze/route.ts`\n" +
    "   Each error response should have `{ ok: false, error: string }` shape.\n\n" +
    "2. **FBA computation timeout** in `app/api/fba/route.ts`: Wrap the FBA solver call in a `Promise.race` with a 30-second timeout:\n" +
    "```typescript\n" +
    "const timeout = new Promise((_, reject) =>\n" +
    "  setTimeout(() => reject(new Error('FBA computation timeout')), 30_000)\n" +
    ");\n" +
    "const result = await Promise.race([fbaSolver(input), timeout]);\n" +
    "```\n\n" +
    "3. **CORS headers for ScSpatial** in `app/api/scspatial/ingest/route.ts` and `app/api/scspatial/query/route.ts`: Add `getCorsHeaders` import and apply to all responses.\n\n" +
    "4. **Body size limit**: In `app/api/analyze/route.ts` and `app/api/fba/route.ts`, add a check at the top of POST handlers:\n" +
    "```typescript\n" +
    "const contentLength = parseInt(request.headers.get('content-length') || '0', 10);\n" +
    "if (contentLength > 1_000_000) { // 1MB limit\n" +
    "  return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 });\n" +
    "}\n" +
    "```\n\n" +
    "5. **middleware 401/429 responses**: In `src/middleware.ts` or `middleware.ts`, ensure 401 and 429 responses include `ok: false` in the JSON body.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: standardize API errors, add FBA timeout, CORS for ScSpatial, body size limits'",
    { label: 'p2-api', phase: 'P2 Fixes' }
  ),

  // ──── P2-C: WebGL & Performance ────
  () => agent(
    "You are fixing medium-priority 3D/WebGL issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **3Dmol viewer cleanup** in `src/components/ProteinViewer.tsx`: Find the component's useEffect cleanup. Add viewer cleanup on unmount:\n" +
    "```typescript\n" +
    "return () => {\n" +
    "  if (viewerRef.current) {\n" +
    "    viewerRef.current.clear();\n" +
    "    viewerRef.current = null;\n" +
    "  }\n" +
    "};\n" +
    "```\n\n" +
    "2. **Visibility-based render pausing** in `src/components/ThreeScene.tsx`: Add a `useEffect` that listens for `document.visibilitychange` and pauses/resumes the render loop:\n" +
    "```typescript\n" +
    "useEffect(() => {\n" +
    "  const handleVisibility = () => {\n" +
    "    if (document.hidden) {\n" +
    "      cancelAnimationFrame(rafRef.current);\n" +
    "    } else {\n" +
    "      animate(); // restart loop\n" +
    "    }\n" +
    "  };\n" +
    "  document.addEventListener('visibilitychange', handleVisibility);\n" +
    "  return () => document.removeEventListener('visibilitychange', handleVisibility);\n" +
    "}, []);\n" +
    "```\n\n" +
    "3. **Reduce geometry complexity**: Search for `SphereGeometry` and `TorusGeometry` across the codebase. Reduce sphere segments from `(24, 24)` to `(12, 12)` and torus segments from `(40, ...)` to `(16, ...)`.\n\n" +
    "4. **Fix import * as THREE** in `src/components/tools/ScSpatialViewport.tsx`: Change `import * as THREE from 'three'` to named imports:\n" +
    "```typescript\n" +
    "import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, SphereGeometry, MeshLambertMaterial } from 'three';\n" +
    "```\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: WebGL cleanup, visibility pause, reduce geometry complexity'",
    { label: 'p2-webgl', phase: 'P2 Fixes' }
  ),

  // ──── P2-D: Accessibility ────
  () => agent(
    "You are fixing medium-priority accessibility issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **prefers-reduced-motion** in `app/globals.css`: Add at the end of the file:\n" +
    "```css\n" +
    "@media (prefers-reduced-motion: reduce) {\n" +
    "  *, *::before, *::after {\n" +
    "    animation-duration: 0.01ms !important;\n" +
    "    animation-iteration-count: 1 !important;\n" +
    "    transition-duration: 0.01ms !important;\n" +
    "  }\n" +
    "}\n" +
    "```\n\n" +
    "2. **IDESidebar contrast** in `src/components/ide/IDESidebar.tsx`: Find `rgba(226,232,240,0.42)` and change to `rgba(226,232,240,0.7)` for better contrast.\n\n" +
    "3. **NodePanel aria-modal** in `src/components/NodePanel.tsx`: Find the modal/dialog container and add `aria-modal=\"true\"` and `role=\"dialog\"`.\n\n" +
    "4. **SVG aria-labels**: Search for `<svg` elements in visualization components (`src/components/visualizations/`). Add `role=\"img\"` and `aria-label` attributes describing the visualization.\n\n" +
    "5. **aria-live regions**: In `src/components/tools/FBASimPage.tsx`, add `aria-live=\"polite\"` to the results container so screen readers announce new results.\n\n" +
    "6. **aria-label on spinners**: Search for loading spinner components across the codebase. Add `aria-label=\"Loading\"` to each.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: a11y improvements - reduced motion, ARIA labels, contrast fixes'",
    { label: 'p2-a11y', phase: 'P2 Fixes' }
  ),

  // ──── P2-E: Architecture & Dependencies ────
  () => agent(
    "You are fixing medium-priority architecture issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Move @types/d3** in `package.json`: Move `@types/d3` from `dependencies` to `devDependencies`.\n\n" +
    "2. **Remove monolithic d3** in `package.json`: If the `d3` meta-package is listed alongside individual `d3-*` packages, remove the meta-package (keep only the modular imports).\n\n" +
    "3. **ProteinViewer, CatalystViewer3D, PDBExplorer light backgrounds**: These files have `background: '#fff'` on toggle switch knobs. Search for ALL occurrences of `#fff` or `#ffffff` in these files and replace with `#a3a3a3`.\n\n" +
    "4. **ToolOverlay and IdleStartButton**: These have `rgba(255,255,255,0.88)`. Search and replace with `rgba(255,255,255,0.08)`.\n\n" +
    "5. **MultiOEmbeddingTab**: Has `background: '#fff'` on toggle. Replace with `#a3a3a3`.\n\n" +
    "6. **globals.css signal cards**: Find `#e5d0aa` (light amber) and `#d1e7e1` (light mint) and replace with `#2a2418` and `#1a2a24` respectively.\n\n" +
    "7. **index.css slider thumbs**: Find `#e2e8f0` and replace with `#3a3f4b`.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: architecture cleanup, remaining light background fixes'",
    { label: 'p2-arch', phase: 'P2 Fixes' }
  ),

  // ──── P2-F: Documentation & Monitoring ────
  () => agent(
    "You are fixing medium-priority documentation and monitoring issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Create CHANGELOG.md** in the project root:\n" +
    "```markdown\n" +
    "# Changelog\n\n" +
    "## [1.0.0] - 2026-06-27\n" +
    "### Added\n" +
    "- 14 synthetic biology tool pages\n" +
    "- AI-powered research assistant (NEXAI)\n" +
    "- Workbench with experiment ledger and audit trail\n" +
    "- Flux Balance Analysis engine\n" +
    "- Michaelis-Menten kinetics simulator\n" +
    "- Protein structure viewer (AlphaFold + RCSB)\n" +
    "- Single-cell spatial omics visualization\n\n" +
    "### Fixed\n" +
    "- Security: Workbench API authentication and user isolation\n" +
    "- Security: Error message sanitization across all API routes\n" +
    "- Science: FBA ATP yield formula correction\n" +
    "- Science: Cell-free Km unit conversion (mM to nM)\n" +
    "- GDPR: Table name mapping for data deletion/export\n" +
    "- GDPR: Privacy policy accuracy\n" +
    "- Data: Atomic workbench writes\n" +
    "- Performance: Ref-based fluidPointer to prevent 60Hz re-renders\n" +
    "- Infrastructure: Vercel deployment config, maxDuration, lint\n" +
    "- Accessibility: All light backgrounds replaced with dark theme\n" +
    "- QA: CI jest consolidation, coverage thresholds\n" +
    "```\n\n" +
    "2. **Add JSDoc to critical components**: Add JSDoc comments to the top of these files:\n" +
    "   - `src/components/ThreeScene.tsx`: Describe the 3D visualization system\n" +
    "   - `src/components/NodePanel.tsx`: Describe the 3-tab scientific workbench\n" +
    "   - `src/components/KineticPanel.tsx`: Describe the MM kinetics + RK4 ODE panel\n" +
    "   - `src/components/ThermodynamicsPanel.tsx`: Describe the ΔG group contribution panel\n" +
    "   Each JSDoc should be 2-3 sentences describing purpose and key features.\n\n" +
    "3. **Add algorithm citations**: In `src/utils/kinetics.ts`, `src/utils/thermodynamics.ts`, `src/server/fbaEngine.ts`, add JSDoc comments citing the scientific papers:\n" +
    "   - kinetics.ts: 'Michaelis-Menten kinetics (Michaelis & Menten, 1913) with Dormand-Prince RK4 integration'\n" +
    "   - thermodynamics.ts: 'ΔG group contribution method (Mavrovouniotis, 1990; Alberty, 2003)'\n" +
    "   - fbaEngine.ts: 'Flux Balance Analysis (Orth et al., 2010) with simplex LP solver'\n\n" +
    "4. **Create sentry.client.config.ts** in the project root (if not exists):\n" +
    "```typescript\n" +
    "import * as Sentry from '@sentry/nextjs';\n\n" +
    "Sentry.init({\n" +
    "  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,\n" +
    "  tracesSampleRate: 0.1,\n" +
    "  environment: process.env.NODE_ENV,\n" +
    "});\n" +
    "```\n" +
    "Only create this file if @sentry/nextjs is in package.json dependencies.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'docs: CHANGELOG, JSDoc, algorithm citations, Sentry config'",
    { label: 'p2-docs', phase: 'P2 Fixes' }
  ),
]);

return results;
