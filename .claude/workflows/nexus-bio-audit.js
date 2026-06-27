
export const meta = {
  name: 'nexus-bio-audit',
  description: 'Enterprise-grade 12-role biotech audit of Nexus-Bio 1.0 — architecture, security, scientific domain, data integrity, API, 3D performance, accessibility, QA, DevOps, documentation, regulatory compliance, synthesis',
  phases: [
    { title: 'Foundation', detail: '4 parallel agents: Architect, CISO, Domain Expert, Data Architect' },
    { title: 'Specialized', detail: '4 parallel agents: API Architect, WebGL Specialist, A11y Lead, QA Director' },
    { title: 'Operations', detail: '3 parallel agents: DevOps Engineer, Docs Manager, Compliance Officer' },
    { title: 'Synthesis', detail: 'Chief Audit Officer consolidates all 11 findings into executive report' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// PHASE 1: FOUNDATION AUDIT — 4 parallel agents
// ═══════════════════════════════════════════════════════════════

phase('Foundation');

const [archFindings, securityFindings, scienceFindings, dataFindings] = await parallel([

  // ──── Agent 1: Principal Software Architect ────
  () => agent(
    "You are a Principal Software Architect with 15 years of experience in large-scale React/Next.js monorepos. " +
    "You are reviewing Nexus-Bio 1.0, a synthetic biology AI platform with 14 tool pages, 300k+ lines of TypeScript/React code.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) PROJECT STRUCTURE — Analyze the app/ and src/ directory trees. Identify circular dependencies, misplaced modules, inconsistent naming conventions. " +
    "Check if the separation between app/ (Next.js routes) and src/ (shared logic) is clean.\n" +
    "2) CODE DUPLICATION — Compare all 14 tool pages in src/components/tools/ for duplicated patterns: " +
    "shared state initialization, chart configs, data fetching, layout wrappers. Quantify duplication percentage.\n" +
    "3) TYPESCRIPT TYPE SAFETY — Scan for 'any' types, missing return types, loose interfaces in src/types.ts and across tool pages. " +
    "Check if discriminated unions are used where appropriate.\n" +
    "4) STATE MANAGEMENT — Audit src/store/uiStore.ts, src/store/workbenchStore.ts (Zustand) and src/machines/metabolicMachine.ts, src/machines/analysisMachine.ts (XState). " +
    "Check for state leakage between tools, missing reset logic, unnecessary global state.\n" +
    "5) COMPONENT ARCHITECTURE — Check component sizes (files >500 lines are red flags). " +
    "Verify separation of concerns: presentation vs. logic vs. data fetching.\n" +
    "6) API ROUTES — Audit all routes in app/api/ for consistent error handling, proper HTTP status codes, request validation.\n" +
    "7) DEPENDENCY HYGIENE — Check package.json for unused deps, version conflicts, security-sensitive packages.\n\n" +
    "FILES TO READ: package.json, tsconfig.json, src/types.ts, src/store/uiStore.ts, src/store/workbenchStore.ts, " +
    "src/machines/metabolicMachine.ts, app/layout.tsx, src/App.tsx, src/components/tools/FBASimPage.tsx, " +
    "src/components/tools/CATDESPage.tsx, src/components/tools/MetabolicEngPage.tsx.\n\n" +
    "OUTPUT FORMAT: For each issue — severity (Critical/High/Medium/Low), file path, line number, description, concrete fix with code snippet. " +
    "End with a summary table of all findings sorted by severity.",
    { label: 'principal-architect', phase: 'Foundation' }
  ),

  // ──── Agent 2: CISO / Security Architect ────
  () => agent(
    "You are a CISO and Security Architect specializing in web application security, API security, and biotech data protection. " +
    "You are reviewing Nexus-Bio 1.0, a synthetic biology AI platform deployed on Vercel with Edge Runtime APIs.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) SECRETS MANAGEMENT — Verify GROQ_API_KEY and GEMINI_API_KEY are never exposed client-side. " +
    "Check for hardcoded secrets, .env files in git, API key leakage in error messages or logs.\n" +
    "2) INPUT VALIDATION — Audit every API route in app/api/ for: missing input sanitization, unbounded request bodies, " +
    "path traversal via user-supplied filenames, injection via query parameters.\n" +
    "3) XSS VECTORS — Search for dangerouslySetInnerHTML, innerHTML, unsanitized user content rendered in JSX. " +
    "Check if AI-generated content (from Groq/Gemini) is sanitized before rendering.\n" +
    "4) CORS & PROXY SECURITY — Audit /api/alphafold and /api/pubchem proxy routes: " +
    "are they open proxies? Can an attacker use them to reach arbitrary URLs? Check Access-Control-Allow-Origin headers.\n" +
    "5) RATE LIMITING — Check if API endpoints have rate limiting. The AI endpoint (app/api/analyze/route.ts) is the most critical. " +
    "Without rate limiting, a single user can exhaust the Groq/Gemini quota.\n" +
    "6) SQL INJECTION — Audit src/server/workbenchDb.ts for parameterized queries. Check if user input reaches SQL strings.\n" +
    "7) AUTHENTICATION & AUTHORIZATION — Check app/api/workbench/route.ts for auth. Can anyone read/write any project? " +
    "Check if admin routes, GDPR routes, billing routes are protected.\n" +
    "8) DEPENDENCY VULNERABILITIES — Run npm audit mentally: check for known CVEs in dependencies. " +
    "Flag any packages with known critical vulnerabilities.\n" +
    "9) ERROR INFORMATION LEAKAGE — Check if error responses expose stack traces, internal paths, or API keys.\n\n" +
    "FILES TO READ: app/api/analyze/route.ts, app/api/alphafold/route.ts, app/api/pubchem/route.ts, " +
    "app/api/workbench/route.ts, app/api/fba/route.ts, app/api/kegg/route.ts, " +
    "src/server/workbenchDb.ts, next.config.mjs, package.json.\n\n" +
    "OUTPUT FORMAT: For each vulnerability — severity (Critical/High/Medium/Low), attack vector, impact, " +
    "file path, line number, concrete fix with code snippet. End with a risk matrix table.",
    { label: 'ciso-security', phase: 'Foundation' }
  ),

  // ──── Agent 3: Scientific Domain Expert (Computational Biologist) ────
  () => agent(
    "You are a Computational Biologist and Scientific Software Auditor with a PhD in Systems Biology. " +
    "You review scientific software for algorithmic correctness, numerical stability, and domain accuracy. " +
    "You are reviewing Nexus-Bio 1.0, a synthetic biology platform implementing real biophysics and metabolic algorithms.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) FLUX BALANCE ANALYSIS (FBA) — Audit src/server/fbaEngine.ts: Is the LP simplex solver correct? " +
    "Does it handle degenerate cases? Are stoichiometric matrices validated? Check mass balance constraints.\n" +
    "2) MICHAELIS-MENTEN KINETICS — Audit src/utils/kinetics.ts: Is the RK4 ODE integrator correct? " +
    "Are rate equations dimensionally consistent? Is timestep selection appropriate for stiff systems?\n" +
    "3) THERMODYNAMICS — Audit src/utils/thermodynamics.ts: Is ΔG group contribution method implemented correctly? " +
    "Are standard state conditions handled? Is temperature correction (van't Hoff) correct?\n" +
    "4) PROTEIN EVOLUTION — Audit src/services/proevolAnalysis.ts: Is the fitness landscape calculation correct? " +
    "Are mutation scoring matrices used properly? Is the basin-climbing algorithm valid?\n" +
    "5) CATALYST DESIGN — Audit src/components/tools/CATDESPage.tsx: Is binding affinity calculation correct? " +
    "Are Pareto front computations valid? Is mutagenesis targeting scientifically sound?\n" +
    "6) GENE CIRCUIT MODELING — Audit src/components/tools/GECAIRPage.tsx: Are Hill functions correct? " +
    "Is logic gate simulation accurate? Are circuit dynamics physically plausible?\n" +
    "7) DYNAMIC CONTROL — Audit src/components/tools/DynConPage.tsx: Is the bioreactor model correct? " +
    "Is Hill function feedback implemented properly? Does RK4 converge correctly?\n" +
    "8) CELL-FREE SYSTEMS — Audit src/components/tools/CellFreePage.tsx: Are expression yield predictions based on real models?\n" +
    "9) HARDCODED vs COMPUTED — Flag any scientific values that are hardcoded rather than computed from input. " +
    "This is a CRITICAL violation — the CLAUDE.md explicitly forbids hardcoded mock responses.\n\n" +
    "FILES TO READ: src/server/fbaEngine.ts, src/utils/kinetics.ts, src/utils/thermodynamics.ts, " +
    "src/services/proevolAnalysis.ts, src/components/tools/CATDESPage.tsx, src/components/tools/GECAIRPage.tsx, " +
    "src/components/tools/DynConPage.tsx, src/components/tools/CellFreePage.tsx, " +
    "src/components/KineticPanel.tsx, src/components/ThermodynamicsPanel.tsx.\n\n" +
    "OUTPUT FORMAT: For each issue — severity (Critical/High/Medium/Low), file path, line number, " +
    "scientific explanation of the error, mathematical proof of the correct formula, concrete fix. " +
    "Separate findings into: Algorithmic Errors, Dimensional Inconsistencies, Hardcoded Values, Numerical Stability Issues.",
    { label: 'domain-expert', phase: 'Foundation' }
  ),

  // ──── Agent 4: Data Architect ────
  () => agent(
    "You are a Data Architect specializing in application state management, database design, and data integrity. " +
    "You are reviewing Nexus-Bio 1.0's data layer: Zustand stores, XState machines, better-sqlite3 database, and JSON data files.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) DATABASE SCHEMA — Audit src/server/workbenchDb.ts: Is the schema normalized? Are there missing indexes? " +
    "Are foreign keys enforced? Is the revision conflict detection (optimistic concurrency) correct?\n" +
    "2) DATA INTEGRACY — Check if workbench data can become inconsistent: " +
    "Can experiments reference deleted projects? Can actors be orphaned? Are audit trail entries immutable?\n" +
    "3) STATE MANAGEMENT PATTERNS — Audit src/store/uiStore.ts and src/store/workbenchStore.ts: " +
    "Are stores properly scoped? Is there state leakage between tools? Are selectors optimized to prevent unnecessary re-renders?\n" +
    "4) XSTATE MACHINES — Audit src/machines/metabolicMachine.ts and src/machines/analysisMachine.ts: " +
    "Are all states reachable? Are there dead states? Is the FSM complete (no missing transitions)?\n" +
    "5) DATA MIGRATION — Is there a migration strategy for schema changes? " +
    "What happens when the workbench DB schema evolves?\n" +
    "6) CONCURRENT ACCESS — Can multiple tabs/users corrupt the workbench DB? " +
    "Is better-sqlite3 used safely in a Next.js server context?\n" +
    "7) MOCK DATA INTEGRITY — Audit src/data/pathwayData.json and src/data/mock*.ts: " +
    "Are mock datasets scientifically valid? Do they match the interfaces in src/types.ts?\n" +
    "8) DATA PERSISTENCE — Is workbench state persisted correctly? " +
    "What happens on browser refresh? On server restart? Is there data loss risk?\n\n" +
    "FILES TO READ: src/server/workbenchDb.ts, src/store/uiStore.ts, src/store/workbenchStore.ts, " +
    "src/machines/metabolicMachine.ts, src/machines/analysisMachine.ts, src/types.ts, " +
    "src/data/pathwayData.json, app/api/workbench/route.ts.\n\n" +
    "OUTPUT FORMAT: For each issue — severity (Critical/High/Medium/Low), file path, line number, " +
    "description of data impact, concrete fix with code snippet. " +
    "Include a data flow diagram (ASCII) showing current vs. recommended architecture.",
    { label: 'data-architect', phase: 'Foundation' }
  ),
]);

// ═══════════════════════════════════════════════════════════════
// PHASE 2: SPECIALIZED AUDIT — 4 parallel agents
// ═══════════════════════════════════════════════════════════════

phase('Specialized');

const [apiFindings, webglFindings, a11yFindings, qaFindings] = await parallel([

  // ──── Agent 5: API & Integration Architect ────
  () => agent(
    "You are an API Architect specializing in REST API design, third-party integration patterns, and Edge Runtime constraints. " +
    "You are reviewing Nexus-Bio 1.0's API layer: 7 API routes, AI provider fallback chain, and external service proxies.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) API CONTRACT CONSISTENCY — Audit all routes in app/api/ for consistent request/response shapes. " +
    "Are error responses standardized? Is there a shared error handler?\n" +
    "2) AI PROVIDER FALLBACK — Audit app/api/analyze/route.ts: Is the Groq→Gemini fallback chain robust? " +
    "Does it handle rate limits (429), timeouts, malformed responses? Is the order correct (Groq primary, Gemini fallback)?\n" +
    "3) THIRD-PARTY INTEGRATIONS — Audit AlphaFold proxy (/api/alphafold), PubChem proxy (/api/pubchem), " +
    "KEGG proxy (/api/kegg): Are timeouts set? Is retry logic present? Are error responses sanitized?\n" +
    "4) EDGE RUNTIME CONSTRAINTS — Check which routes use Edge Runtime vs Node.js Runtime. " +
    "Edge routes cannot use Node.js APIs (fs, crypto, etc.). Verify no Edge route imports Node-only modules.\n" +
    "5) REQUEST VALIDATION — Are request bodies validated before processing? " +
    "Is there schema validation (zod, joi) or manual checks?\n" +
    "6) RESPONSE CACHING — Are GET endpoints cached appropriately? " +
    "Are AI responses cached to avoid redundant API calls?\n" +
    "7) ERROR PROPAGATION — Do API routes properly catch and transform errors? " +
    "Are internal errors (500s) sanitized before sending to client?\n" +
    "8) FBA API — Audit app/api/fba/route.ts: Is the LP solver invoked correctly? " +
    "Are large matrices handled without OOM? Is there a computation timeout?\n\n" +
    "FILES TO READ: app/api/analyze/route.ts, app/api/alphafold/route.ts, app/api/pubchem/route.ts, " +
    "app/api/kegg/route.ts, app/api/fba/route.ts, app/api/workbench/route.ts, " +
    "app/api/scspatial/ingest/route.ts, app/api/scspatial/query/route.ts.\n\n" +
    "OUTPUT FORMAT: For each issue — severity, file path, line number, API contract impact, " +
    "concrete fix. Include an API health matrix table (route × status: auth, validation, caching, error handling).",
    { label: 'api-architect', phase: 'Specialized' }
  ),

  // ──── Agent 6: 3D / WebGL Performance Specialist ────
  () => agent(
    "You are a WebGL Performance Engineer specializing in Three.js optimization, GPU memory management, " +
    "and real-time 3D rendering in React applications. You are reviewing Nexus-Bio 1.0's 3D visualization layer.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) THREE.JS MEMORY MANAGEMENT — Audit src/components/ThreeScene.tsx: Are geometries, materials, and textures " +
    "disposed properly on unmount? Is there GPU memory leakage on page navigation?\n" +
    "2) RENDER LOOP OPTIMIZATION — Is requestAnimationFrame used correctly? " +
    "Are unnecessary re-renders triggered by React state changes? Is the render loop paused when the tab is inactive?\n" +
    "3) GEOMETRY COMPLEXITY — Are 3D models using appropriate polygon counts? " +
    "Are LOD (Level of Detail) techniques used for complex scenes?\n" +
    "4) MATERIAL COMPLIANCE — Verify ALL Three.js meshes use meshLambertMaterial (NOT meshStandardMaterial). " +
    "meshStandardMaterial causes white bloom under LinearToneMapping — this is a CRITICAL violation per CLAUDE.md.\n" +
    "5) SHADER PERFORMANCE — Audit any custom GLSL shaders for: unnecessary uniforms, " +
    "fragment shader complexity, texture sampling overhead.\n" +
    "6) 3DMOL.JS INTEGRATION — Audit src/components/ProteinViewer.tsx: Is 3Dmol.js loaded correctly from CDN? " +
    "Are PDB structures cleaned up when viewer unmounts? Is the CDN fallback handled?\n" +
    "7) CODE SPLITTING — Are Three.js and 3Dmol.js lazy-loaded? " +
    "Check if tool pages use Next.js dynamic() imports to avoid loading 3D libraries on pages that don't need them.\n" +
    "8) BUNDLE SIZE — Estimate the Three.js bundle impact. Check if tree-shaking is effective. " +
    "Are unused Three.js modules imported?\n" +
    "9) RESPONSIVE 3D — Do 3D canvases resize correctly on viewport changes? " +
    "Is the pixel ratio capped to prevent excessive GPU usage on high-DPI screens?\n\n" +
    "FILES TO READ: src/components/ThreeScene.tsx, src/components/ProteinViewer.tsx, " +
    "src/components/tools/MetabolicEngPage.tsx, src/components/tools/ProEvolPage.tsx, " +
    "src/components/tools/ScSpatialPage.tsx, next.config.mjs, package.json.\n\n" +
    "OUTPUT FORMAT: For each issue — severity, file path, line number, GPU/memory impact estimate, " +
    "concrete optimization code. Include a 3D resource lifecycle table (resource × create/dispose/cleanup status).",
    { label: 'webgl-specialist', phase: 'Specialized' }
  ),

  // ──── Agent 7: Accessibility & Inclusive Design Lead ────
  () => agent(
    "You are an Accessibility Lead and Inclusive Design Expert with WCAG 2.1 AA certification expertise. " +
    "You are reviewing Nexus-Bio 1.0, a scientific platform used by researchers worldwide.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) WCAG 2.1 AA COMPLIANCE — Check all pages for: proper heading hierarchy (h1→h2→h3), " +
    "alt text on images, ARIA labels on interactive elements, focus management.\n" +
    "2) KEYBOARD NAVIGATION — Can all interactive elements be reached via Tab? " +
    "Are focus indicators visible? Is there a skip-to-content link? Can tool pages be operated entirely by keyboard?\n" +
    "3) SCREEN READER SUPPORT — Are dynamic content changes announced via aria-live regions? " +
    "Are complex widgets (tabs, modals, dropdowns) properly labeled?\n" +
    "4) COLOR CONTRAST — Check text/background contrast ratios against WCAG AA (4.5:1 normal text, 3:1 large text). " +
    "The dark theme (#0d0f14, #10131a) must have sufficient contrast with all text colors.\n" +
    "5) DARK THEME COMPLIANCE — CRITICAL: Search for ANY light backgrounds (#FFFFFF, #F5F7FA, #F2F5F8, or any light color). " +
    "This is explicitly forbidden in CLAUDE.md. Flag every violation.\n" +
    "6) RESPONSIVE DESIGN — Test layout at mobile (375px), tablet (768px), desktop (1280px). " +
    "Are 3D visualizations usable on mobile? Are tables horizontally scrollable?\n" +
    "7) LOADING & ERROR STATES — Do all async operations show loading indicators? " +
    "Are error messages descriptive and actionable? Are there error boundaries?\n" +
    "8) EMPTY STATES — When tools have no data, do they show helpful empty states with guidance?\n" +
    "9) TYPOGRAPHY — Verify all font references use THEME.SANS, THEME.MONO, THEME.BRAND from src/theme/index.ts. " +
    "No hardcoded font-family strings.\n\n" +
    "FILES TO READ: src/components/ide/IDEShell.tsx, src/components/ide/IDETopBar.tsx, " +
    "src/components/ide/IDESidebar.tsx, src/components/ide/tokens.ts, src/theme/index.ts, " +
    "tailwind.config.js, src/components/Hero.tsx, src/components/NodePanel.tsx, " +
    "src/components/tools/FBASimPage.tsx, src/components/tools/ScSpatialPage.tsx.\n\n" +
    "OUTPUT FORMAT: For each issue — severity, file path, line number, WCAG criterion violated, " +
    "who it affects (screen reader users, keyboard users, mobile users, low vision users), concrete fix. " +
    "Include a WCAG compliance scorecard by page.",
    { label: 'a11y-lead', phase: 'Specialized' }
  ),

  // ──── Agent 8: QA Director ────
  () => agent(
    "You are a QA Director with expertise in test strategy, test coverage analysis, and CI/CD pipeline quality. " +
    "You are reviewing Nexus-Bio 1.0's testing infrastructure: 76 Jest test files, CI pipeline on GitHub Actions.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) TEST COVERAGE — Estimate line coverage across the codebase. Which modules have NO tests? " +
    "Which critical paths (API routes, FBA engine, kinetics) have inadequate coverage?\n" +
    "2) TEST QUALITY — Are tests actually asserting behavior, or just checking no-crash? " +
    "Are there tests that pass even when the code is broken? Are mocks used appropriately?\n" +
    "3) HONESTY CHECKS — The codebase has 'honesty' tests (cellfreeHonesty, cethxHonesty, multioHonesty, communityFbaHonesty). " +
    "Are these sufficient? Do they actually verify no hardcoded mock responses?\n" +
    "4) SCIENTIFIC ALGORITHM TESTS — Are the core algorithms (FBA, kinetics, thermodynamics, ΔG) tested with known-good values? " +
    "Are there regression tests for numerical accuracy?\n" +
    "5) API ROUTE TESTS — Are all 7 API routes tested? Are error paths tested? " +
    "Is the AI fallback chain tested with mocked provider failures?\n" +
    "6) COMPONENT TESTS — Are React components tested with @testing-library/react? " +
    "Are user interactions tested (clicks, form submissions)?\n" +
    "7) CI PIPELINE — Audit .github/workflows/ci.yml: Are all quality gates present? " +
    "Is type checking (tsc --noEmit) enforced? Are tests run on every PR? Is there a build step?\n" +
    "8) E2E TESTING — Is there E2E test infrastructure? The CLAUDE.md mentions a Playwright placeholder. " +
    "Is it activated? What critical user flows need E2E coverage?\n" +
    "9) TEST DATA MANAGEMENT — Are test fixtures shared? Is there test data duplication? " +
    "Are mock datasets scientifically valid?\n\n" +
    "FILES TO READ: jest.config.cjs, .github/workflows/ci.yml, package.json, " +
    "__tests__/workflow/ (list files), __tests__/kinetics.test.ts, __tests__/thermodynamics.test.ts, " +
    "__tests__/fbaEngine.test.ts, __tests__/analyze-route.test.ts, " +
    "__tests__/cellfreeHonesty.test.ts, __tests__/cethxHonesty.test.ts.\n\n" +
    "OUTPUT FORMAT: For each gap — severity, affected module, current coverage estimate, " +
    "recommended test cases, effort estimate (S/M/L). Include a coverage heat map table (module × coverage level).",
    { label: 'qa-director', phase: 'Specialized' }
  ),
]);

// ═══════════════════════════════════════════════════════════════
// PHASE 3: OPERATIONS & COMPLIANCE — 3 parallel agents
// ═══════════════════════════════════════════════════════════════

phase('Operations');

const [devopsFindings, docsFindings, complianceFindings] = await parallel([

  // ──── Agent 9: DevOps & Infrastructure Engineer ────
  () => agent(
    "You are a DevOps Engineer specializing in Vercel deployment, Next.js infrastructure, and production reliability. " +
    "You are reviewing Nexus-Bio 1.0's deployment and operational readiness.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) DEPLOYMENT CONFIGURATION — Audit vercel.json and next.config.mjs: " +
    "Are build settings optimized? Are serverless function timeouts configured for compute-heavy routes (FBA)?\n" +
    "2) ENVIRONMENT MANAGEMENT — Audit .env.example: Are all required variables documented? " +
    "Are there missing variables? Are defaults safe?\n" +
    "3) MONITORING & OBSERVABILITY — Is there error tracking (Sentry, etc.)? " +
    "Are API routes instrumented with logging? Is there a health check endpoint?\n" +
    "4) PERFORMANCE BUDGETS — Are there bundle size budgets? " +
    "Are Core Web Vitals (LCP, FID, CLS) tracked?\n" +
    "5) EDGE VS NODE.JS ROUTING — Verify each API route uses the correct runtime. " +
    "Compute-heavy routes (FBA, ScSpatial) must use Node.js Runtime, not Edge.\n" +
    "6) BUILD PIPELINE — Is the build reproducible? Are there lockfile integrity checks? " +
    "Is npm ci used (not npm install) in CI?\n" +
    "7) STATIC ASSET OPTIMIZATION — Are images optimized (next/image)? " +
    "Are fonts loaded efficiently? Is there a CDN strategy for static assets?\n" +
    "8) SCALING CONSTRAINTS — Vercel Hobby plan has limits (100GB bandwidth, 1000 serverless invocations/day). " +
    "Are these sufficient for the platform's expected load?\n\n" +
    "FILES TO READ: vercel.json, next.config.mjs, .github/workflows/ci.yml, " +
    ".env.example, package.json, app/layout.tsx.\n\n" +
    "OUTPUT FORMAT: For each issue — severity, operational impact, file path, " +
    "concrete configuration fix. Include a deployment readiness checklist table.",
    { label: 'devops-engineer', phase: 'Operations' }
  ),

  // ──── Agent 10: Documentation & Knowledge Manager ────
  () => agent(
    "You are a Technical Writer and Knowledge Manager specializing in developer documentation for scientific software. " +
    "You are reviewing Nexus-Bio 1.0's documentation ecosystem.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) ARCHITECTURE DOCUMENTATION — Is CLAUDE.md comprehensive? Are there architecture diagrams? " +
    "Is the 4-stage research cycle documented clearly?\n" +
    "2) API DOCUMENTATION — Are all API routes documented with request/response schemas? " +
    "Is there a Postman collection or OpenAPI spec?\n" +
    "3) COMPONENT DOCUMENTATION — Are complex components (ThreeScene, NodePanel, KineticPanel) documented? " +
    "Are props interfaces documented with JSDoc?\n" +
    "4) ONBOARDING — Can a new developer set up the project from README/CLAUDE.md alone? " +
    "Are environment variable requirements clear?\n" +
    "5) SCIENTIFIC REFERENCES — Are algorithms cited with paper references? " +
    "Is the Artemisinin pathway data sourced (Ro et al., Nature 2006)?\n" +
    "6) CHANGELOG & VERSIONING — Is there a CHANGELOG.md? Are breaking changes documented?\n" +
    "7) SKILL/WORKFLOW DOCUMENTATION — Are the .claude/commands/ and .claude/workflows/ documented? " +
    "Can a contributor understand the audit workflow?\n" +
    "8) DEPLOYMENT DOCUMENTATION — Is the Vercel deployment process documented? " +
    "Are environment variables explained?\n\n" +
    "FILES TO READ: CLAUDE.md, README.md (if exists), docs/ (list directory), " +
    ".claude/commands/ (list files), .claude/workflows/ (list files), " +
    "src/types.ts, app/api/analyze/route.ts.\n\n" +
    "OUTPUT FORMAT: For each gap — severity, documentation area, what's missing, " +
    "recommended content structure. Include a documentation coverage matrix (area × status).",
    { label: 'docs-manager', phase: 'Operations' }
  ),

  // ──── Agent 11: Regulatory & Compliance Officer ────
  () => agent(
    "You are a Regulatory Compliance Officer specializing in biotech software, data privacy (GDPR, CCPA), " +
    "and scientific software audit trails. You are reviewing Nexus-Bio 1.0's compliance posture.\n\n" +
    "AUDIT DIMENSIONS:\n" +
    "1) AUDIT TRAIL INTEGRITY — Audit src/server/workbenchDb.ts: Is the audit trail truly immutable? " +
    "Can entries be deleted or modified? Are all state changes logged with actor, timestamp, and reason?\n" +
    "2) DATA PRIVACY — Is user data (projects, experiments) properly isolated between users? " +
    "Is there a data export mechanism (GDPR right to portability)? Is there a data deletion mechanism?\n" +
    "3) SCIENTIFIC DATA PROVENANCE — Are AI-generated results tagged as such? " +
    "Can a user distinguish between computed results and AI suggestions? Is there provenance tracking?\n" +
    "4) REPRODUCIBILITY — Can experiments be reproduced from the workbench ledger? " +
    "Are all inputs, parameters, and versions recorded?\n" +
    "5) TERMS & PRIVACY — Audit app/terms/page.tsx and app/privacy/page.tsx: " +
    "Are they legally adequate for a biotech platform handling research data?\n" +
    "6) ACCESS CONTROL — Is there role-based access control (RBAC)? " +
    "Can unauthorized users access others' research data via the workbench API?\n" +
    "7) DATA RETENTION — Is there a data retention policy? Are old projects archived? " +
    "Is there a mechanism to comply with data deletion requests?\n" +
    "8) EXPORT CONTROL — Does the platform handle any controlled biological data? " +
    "Are there restrictions on certain synthetic biology computations?\n\n" +
    "FILES TO READ: src/server/workbenchDb.ts, src/store/workbenchStore.ts, " +
    "app/api/workbench/route.ts, app/privacy/page.tsx, app/terms/page.tsx, " +
    "src/components/workbench/WorkbenchSyncProvider.tsx, " +
    "src/components/workbench/WorkbenchAuditTimeline.tsx.\n\n" +
    "OUTPUT FORMAT: For each gap — severity (Critical/High/Medium/Low), compliance framework (GDPR, CCPA, etc.), " +
    "risk description, recommended control, implementation guidance. Include a compliance scorecard table.",
    { label: 'compliance-officer', phase: 'Operations' }
  ),
]);

// ═══════════════════════════════════════════════════════════════
// PHASE 4: SYNTHESIS — Chief Audit Officer
// ═══════════════════════════════════════════════════════════════

phase('Synthesis');

const synthesis = await agent(
  "You are the Chief Audit Officer consolidating findings from an enterprise-grade 12-role audit of Nexus-Bio 1.0, " +
  "a 300k-line synthetic biology AI platform. You report directly to the CTO and Board.\n\n" +
  "SPECIALIST FINDINGS:\n\n" +
  "=== 1. PRINCIPAL SOFTWARE ARCHITECT ===\n" + archFindings + "\n\n" +
  "=== 2. CISO / SECURITY ARCHITECT ===\n" + securityFindings + "\n\n" +
  "=== 3. SCIENTIFIC DOMAIN EXPERT ===\n" + scienceFindings + "\n\n" +
  "=== 4. DATA ARCHITECT ===\n" + dataFindings + "\n\n" +
  "=== 5. API & INTEGRATION ARCHITECT ===\n" + apiFindings + "\n\n" +
  "=== 6. 3D / WEBGL PERFORMANCE SPECIALIST ===\n" + webglFindings + "\n\n" +
  "=== 7. ACCESSIBILITY & INCLUSIVE DESIGN LEAD ===\n" + a11yFindings + "\n\n" +
  "=== 8. QA DIRECTOR ===\n" + qaFindings + "\n\n" +
  "=== 9. DEVOPS & INFRASTRUCTURE ENGINEER ===\n" + devopsFindings + "\n\n" +
  "=== 10. DOCUMENTATION & KNOWLEDGE MANAGER ===\n" + docsFindings + "\n\n" +
  "=== 11. REGULATORY & COMPLIANCE OFFICER ===\n" + complianceFindings + "\n\n" +
  "PRODUCE THE FOLLOWING:\n\n" +
  "1) EXECUTIVE SUMMARY — Top 10 most critical issues across all 11 auditors, ranked by business impact.\n\n" +
  "2) RISK MATRIX — Table with columns: Issue ID, Category, Severity, Business Impact, Effort, Priority. " +
    "Sort by Risk Score (Severity × Impact).\n\n" +
  "3) PRIORITIZED ROADMAP:\n" +
    "   Phase 1 (This Week): Critical security vulnerabilities + scientific algorithm errors + data integrity issues\n" +
    "   Phase 2 (Next 2 Weeks): High-priority architecture + API + accessibility fixes\n" +
    "   Phase 3 (Month 1): Performance optimization + test coverage + documentation\n" +
    "   Phase 4 (Month 2-3): Compliance + nice-to-haves + tech debt\n\n" +
  "4) EFFORT ESTIMATES — For each fix: S (< 2 hours), M (2-8 hours), L (1-3 days), XL (1-2 weeks).\n\n" +
  "5) DEPENDENCY GRAPH — Which fixes block other fixes? Show as ASCII dependency tree.\n\n" +
  "6) QUICK WINS — List all issues fixable in under 30 minutes, grouped by category.\n\n" +
  "7) COMPLIANCE SCORECARD — Overall compliance posture: Security, Data Privacy, Scientific Integrity, Accessibility, Documentation. " +
    "Each rated: Green (compliant), Yellow (gaps), Red (critical gaps).\n\n" +
  "8) AUDITOR PERFORMANCE — Rate each auditor's findings: completeness, actionability, evidence quality. " +
    "Identify gaps that no auditor covered.\n\n" +
  "Output in clean markdown with tables, checkboxes, and clear section headers. " +
  "This report will be presented to the CTO and used as the project's quality improvement roadmap.",
  { label: 'chief-audit-officer', phase: 'Synthesis' }
);

return synthesis;
