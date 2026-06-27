
export const meta = {
  name: 'p3-fix-batch',
  description: 'Parallel execution of P3 low-priority audit fixes — architecture, testing, regulatory, WebGL, documentation, security',
  phases: [
    { title: 'P3 Fixes', detail: '6 agents fixing low-priority issues simultaneously' },
  ],
};

phase('P3 Fixes');

const results = await parallel([

  // ──── P3-A: Architecture — Type Safety & Component Split ────
  () => agent(
    "You are fixing architecture issues in Nexus-Bio 1.0. Focus on type safety and component splitting.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Fix `any` types**: Search for `as any` and `: any` across `src/` directory. Replace the top 20 most egregious ones with proper types. Focus on:\n" +
    "   - API route handlers\n" +
    "   - Store actions\n" +
    "   - Component props\n" +
    "   For each, determine the correct type from context and replace.\n\n" +
    "2. **Add Zod validation to top 3 API routes**: Create a `src/schemas/` directory and add Zod schemas for:\n" +
    "   - `app/api/analyze/route.ts` request body\n" +
    "   - `app/api/fba/route.ts` request body\n" +
    "   - `app/api/workbench/route.ts` PUT body\n" +
    "   Import and validate at the top of each handler.\n\n" +
    "3. **Split types.ts**: `src/types.ts` is 658 lines. Split into:\n" +
    "   - `src/types/pathway.ts` (PathwayNode, PathwayEdge, GeneratedPathway)\n" +
    "   - `src/types/workbench.ts` (workbench-related types)\n" +
    "   - `src/types/tools.ts` (tool-specific types)\n" +
    "   - `src/types/index.ts` (re-exports all)\n" +
    "   Update imports across the codebase.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'refactor: type safety improvements, Zod schemas, split types.ts'",
    { label: 'p3-architecture', phase: 'P3 Fixes' }
  ),

  // ──── P3-B: Testing — API Route Tests ────
  () => agent(
    "You are adding tests for untested API routes in Nexus-Bio 1.0.\n\n" +
    "Create test files for the 5 most critical untested API routes:\n\n" +
    "1. `__tests__/api/analyze-route.test.ts`: Test the AI analyze endpoint:\n" +
    "   - Mock Groq/Gemini API calls\n" +
    "   - Test successful response\n" +
    "   - Test fallback chain (Groq fails → Gemini)\n" +
    "   - Test rate limiting\n" +
    "   - Test invalid input\n\n" +
    "2. `__tests__/api/fba-route.test.ts`: Test the FBA endpoint:\n" +
    "   - Test valid FBA input\n" +
    "   - Test timeout handling\n" +
    "   - Test invalid matrix\n\n" +
    "3. `__tests__/api/workbench-route.test.ts`: Test workbench CRUD:\n" +
    "   - Test GET with auth\n" +
    "   - Test GET without auth (should 401)\n" +
    "   - Test PUT with valid payload\n" +
    "   - Test PUT with revision conflict (should 409)\n\n" +
    "4. `__tests__/api/alphafold-route.test.ts`: Test AlphaFold proxy:\n" +
    "   - Test successful proxy\n" +
    "   - Test invalid ID\n\n" +
    "5. `__tests__/api/pubchem-route.test.ts`: Test PubChem proxy:\n" +
    "   - Test CID lookup\n" +
    "   - Test name lookup\n\n" +
    "Use `@testing-library/react` patterns. Mock external APIs. Each test file should have at least 3 test cases.\n\n" +
    "Run `npm test -- --testPathPattern=api` to verify. Commit with message: 'test: add API route tests for analyze, fba, workbench, alphafold, pubchem'",
    { label: 'p3-testing', phase: 'P3 Fixes' }
  ),

  // ──── P3-C: Regulatory — Consent, ToS, Export Control ────
  () => agent(
    "You are fixing regulatory compliance issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Terms of Service biotech provisions** in `app/terms/page.tsx`: Add a new section after the existing content:\n" +
    "```tsx\n" +
    "<h2>9. Synthetic Biology Research</h2>\n" +
    "<p>This platform is designed for legitimate synthetic biology research. Users agree not to use this platform for:\n" +
    "Development of biological weapons or harmful organisms\n" +
    "Research that violates local or international biosecurity regulations\n" +
    "Any activity that could cause environmental harm through engineered organisms</p>\n" +
    "<p>Users are responsible for ensuring their research complies with all applicable biosafety regulations,\n" +
    "including institutional biosafety committee (IBC) approvals where required.</p>\n" +
    "```\n" +
    "Keep the same dark theme styling as existing sections.\n\n" +
    "2. **Export control notice**: Add another section:\n" +
    "```tsx\n" +
    "<h2>10. Export Control</h2>\n" +
    "<p>Some synthetic biology tools and data may be subject to export control regulations.\n" +
    "Users are responsible for compliance with applicable export control laws.</p>\n" +
    "```\n\n" +
    "3. **Consent banner**: Create `src/components/ConsentBanner.tsx`:\n" +
    "```tsx\n" +
    "'use client';\n" +
    "import { useState, useEffect } from 'react';\n\n" +
    "export function ConsentBanner() {\n" +
    "  const [show, setShow] = useState(false);\n\n" +
    "  useEffect(() => {\n" +
    "    const consent = localStorage.getItem('nexus-bio-consent');\n" +
    "    if (!consent) setShow(true);\n" +
    "  }, []);\n\n" +
    "  const accept = () => {\n" +
    "    localStorage.setItem('nexus-bio-consent', JSON.stringify({ analytics: true, timestamp: Date.now() }));\n" +
    "    setShow(false);\n" +
    "  };\n\n" +
    "  if (!show) return null;\n\n" +
    "  return (\n" +
    "    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#10131a', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem', zIndex: 9999, display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>\n" +
    "      <span style={{ color: '#a3a3a3', fontSize: '14px' }}>We use analytics to improve your experience. By continuing, you agree to our <a href=\"/privacy\" style={{ color: '#C8D8E8' }}>Privacy Policy</a>.</span>\n" +
    "      <button onClick={accept} style={{ background: '#C8D8E8', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Accept</button>\n" +
    "    </div>\n" +
    "  );\n" +
    "}\n" +
    "```\n" +
    "Then import and render in `app/layout.tsx` inside the body.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'feat: biotech ToS provisions, export control, consent banner'",
    { label: 'p3-regulatory', phase: 'P3 Fixes' }
  ),

  // ──── P3-D: WebGL Optimization ────
  () => agent(
    "You are fixing 3D/WebGL performance issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Fix FitnessSurface geometry leak** in `src/components/tools/ProEvolPage.tsx` or its sub-components:\n" +
    "   - Find the FitnessSurface component\n" +
    "   - Add geometry disposal in useEffect cleanup:\n" +
    "   ```typescript\n" +
    "   return () => {\n" +
    "     if (geometryRef.current) {\n" +
    "       geometryRef.current.dispose();\n" +
    "       geometryRef.current = null;\n" +
    "     }\n" +
    "   };\n" +
    "   ```\n\n" +
    "2. **Fix import * as THREE** in remaining files:\n" +
    "   - Search for `import * as THREE from 'three'` across the codebase\n" +
    "   - Replace with named imports for each file\n" +
    "   - Common imports: `Scene, PerspectiveCamera, WebGLRenderer, Mesh, SphereGeometry, MeshLambertMaterial, Vector3, Color`\n\n" +
    "3. **Add LOD for large pathways**: In `src/components/ThreeScene.tsx` or the pathway renderer:\n" +
    "   - When node count > 50, reduce geometry detail\n" +
    "   - Use simpler geometries (icosahedron instead of sphere)\n" +
    "   - Reduce label rendering for distant nodes\n\n" +
    "4. **Dispose textures on unmount**: Search for `useTexture` or `TextureLoader` usage. Ensure textures are disposed in cleanup functions.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: WebGL geometry disposal, LOD, texture cleanup'",
    { label: 'p3-webgl', phase: 'P3 Fixes' }
  ),

  // ──── P3-E: Documentation ────
  () => agent(
    "You are fixing documentation issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Create deployment guide** at `docs/deployment.md`:\n" +
    "```markdown\n" +
    "# Deployment Guide\n\n" +
    "## Vercel (Recommended)\n\n" +
    "1. Fork the repository\n" +
    "2. Connect to Vercel\n" +
    "3. Set environment variables:\n" +
    "   - `GROQ_API_KEY` - Groq API key (primary AI)\n" +
    "   - `GEMINI_API_KEY` - Google Gemini API key (fallback AI)\n" +
    "4. Deploy\n\n" +
    "## Self-Hosted\n\n" +
    "```bash\n" +
    "git clone https://github.com/zhangze1007/Nexus-bio-1.0.git\n" +
    "cd Nexus-bio-1.0\n" +
    "npm ci\n" +
    "npm run build\n" +
    "npm run start\n" +
    "```\n\n" +
    "## Environment Variables\n\n" +
    "| Variable | Required | Description |\n" +
    "|----------|----------|-------------|\n" +
    "| `GROQ_API_KEY` | Yes | Groq API authorization |\n" +
    "| `GEMINI_API_KEY` | Yes | Google Gemini authorization |\n" +
    "| `SCSPATIAL_ARTIFACT_DIR` | No | ScSpatial artifact storage |\n" +
    "| `ESM2_PYTHON_BACKEND` | No | ESM-2 Python backend URL |\n" +
    "```\n\n" +
    "2. **Create contributing guide** at `CONTRIBUTING.md`:\n" +
    "```markdown\n" +
    "# Contributing to Nexus-Bio\n\n" +
    "## Development Setup\n\n" +
    "1. Clone the repository\n" +
    "2. Run `npm ci`\n" +
    "3. Copy `.env.example` to `.env.local`\n" +
    "4. Run `npm run dev`\n\n" +
    "## Code Style\n\n" +
    "- TypeScript strict mode\n" +
    "- Dark theme only (no light backgrounds)\n" +
    "- Use `THEME` constants from `src/theme/index.ts`\n" +
    "- Use `meshLambertMaterial` in Three.js\n\n" +
    "## Testing\n\n" +
    "- Run `npm test` for unit tests\n" +
    "- Run `npx tsc --noEmit` for type checking\n" +
    "- All tests must pass before PR\n\n" +
    "## Pull Requests\n\n" +
    "- Create feature branch from `main`\n" +
    "- Include tests for new features\n" +
    "- Update documentation if needed\n" +
    "```\n\n" +
    "3. **Create architecture diagram** at `docs/architecture.md`:\n" +
    "Describe the 4-stage research cycle with ASCII art (same as in CLAUDE.md but more detailed).\n\n" +
    "4. **Create OpenAPI spec** at `docs/openapi.yaml`:\n" +
    "Document the top 3 API routes (analyze, fba, workbench) with request/response schemas.\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'docs: deployment guide, contributing guide, architecture, OpenAPI spec'",
    { label: 'p3-docs', phase: 'P3 Fixes' }
  ),

  // ──── P3-F: Security — API Key & Monitoring ────
  () => agent(
    "You are fixing security and monitoring issues in Nexus-Bio 1.0.\n\n" +
    "Make these specific changes:\n\n" +
    "1. **Fix Gemini API key in URL**: Search for where the Gemini API key is passed. If it's in the URL query string, move it to the Authorization header:\n" +
    "```typescript\n" +
    "// Before (insecure):\n" +
    "const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;\n" +
    "\n" +
    "// After (secure):\n" +
    "const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';\n" +
    "const response = await fetch(url, {\n" +
    "  method: 'POST',\n" +
    "  headers: {\n" +
    "    'Content-Type': 'application/json',\n" +
    "    'x-goog-api-key': apiKey,\n" +
    "  },\n" +
    "  body: JSON.stringify(payload),\n" +
    "});\n" +
    "```\n\n" +
    "2. **Add structured logging utility**: Create `src/utils/logger.ts`:\n" +
    "```typescript\n" +
    "export function createLogger(requestId: string) {\n" +
    "  return {\n" +
    "    info: (msg: string, data?: unknown) => console.log(JSON.stringify({ level: 'info', requestId, msg, data, ts: new Date().toISOString() })),\n" +
    "    warn: (msg: string, data?: unknown) => console.warn(JSON.stringify({ level: 'warn', requestId, msg, data, ts: new Date().toISOString() })),\n" +
    "    error: (msg: string, data?: unknown) => console.error(JSON.stringify({ level: 'error', requestId, msg, data, ts: new Date().toISOString() })),\n" +
    "  };\n" +
    "}\n" +
    "```\n" +
    "Then use in `app/api/analyze/route.ts` and `app/api/fba/route.ts`.\n\n" +
    "3. **Add request ID to API responses**: In `src/utils/apiErrors.ts` (or wherever error responses are defined), add a `requestId` field to all error responses:\n" +
    "```typescript\n" +
    "const requestId = crypto.randomUUID();\n" +
    "return NextResponse.json({ ok: false, error: message, requestId }, { status });\n" +
    "```\n\n" +
    "Run `npx tsc --noEmit` after all changes. Commit with message: 'fix: Gemini API key security, structured logging, request IDs'",
    { label: 'p3-security', phase: 'P3 Fixes' }
  ),
]);

return results;
