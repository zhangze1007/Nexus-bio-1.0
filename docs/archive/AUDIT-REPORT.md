# Nexus-Bio 1.0 — Comprehensive Audit Report

**Date:** 2026-06-05
**Auditors:** Code Quality Engineer · UX/UI Design Specialist · Software Architect · Performance & Security Engineer
**Total Findings:** 50 (6 Critical · 14 High · 21 Medium · 20 Low)

---

## Table of Contents

- [Phase 1: Critical Issues (Immediate)](#phase-1-critical-issues-immediate)
- [Phase 2: High Priority (Week 1)](#phase-2-high-priority-week-1)
- [Phase 3: Medium Priority (Week 2)](#phase-3-medium-priority-week-2)
- [Phase 4: Low Priority (Backlog)](#phase-4-low-priority-backlog)
- [Implementation Roadmap](#implementation-roadmap)

---

## Phase 1: Critical Issues (Immediate)

> **Definition:** Must be fixed before any other work. These cause incorrect scientific results, security breaches, or broken user experience.

---

### C1. RK4 Product ODE Uses Stale Substrate Value

- **Severity:** 🔴 Critical
- **Category:** Scientific Correctness
- **File:** `src/utils/kinetics.ts`, lines 48–52
- **Impact:** The 4th-order Runge-Kutta integration for product concentration is fundamentally broken. All four intermediate evaluations (`k1p` through `k4p`) read `v(substrate[i])` — the substrate value saved at the start of the iteration — instead of the RK4-interpolated substrate values. This means product dynamics are completely decoupled from substrate consumption, producing scientifically incorrect ODE trajectories. Every tool that uses `simulateKinetics` (KineticPanel in NodePanel, DynConPage bioreactor) returns wrong results.

**Current Code (BROKEN):**
```typescript
// src/utils/kinetics.ts:48-52
const k1p = v(substrate[i]) - degradationRate * P;
const k2p = v(substrate[i]) - degradationRate * (P + dt * k1p / 2);
const k3p = v(substrate[i]) - degradationRate * (P + dt * k2p / 2);
const k4p = v(substrate[i]) - degradationRate * (P + dt * k3p);
```

**Fixed Code:**
```typescript
// src/utils/kinetics.ts:48-52
const k1p = v(S) - degradationRate * P;
const k2p = v(S + dt * k1s / 2) - degradationRate * (P + dt * k1p / 2);
const k3p = v(S + dt * k2s / 2) - degradationRate * (P + dt * k2p / 2);
const k4p = v(S + dt * k3s) - degradationRate * (P + dt * k3p);
```

**Why this is correct:** The RK4 method requires evaluating the derivative at four intermediate points. For the product equation `dP/dt = v(S) - degradationRate * P`, the substrate `S` at each intermediate point must be interpolated using the substrate's own RK4 increments (`k1s`, `k2s`, `k3s`), not frozen at `substrate[i]`.

**Verification:** After fixing, run the KineticPanel with a high `k_cat` value and verify that product concentration shows the expected sigmoidal rise with substrate depletion, not an artificial plateau.

---

### C2. PDBExplorer White Background Violates Dark Theme

- **Severity:** 🔴 Critical
- **Category:** UX / Dark Theme Compliance
- **File:** `src/components/PDBExplorer.tsx`, line 157
- **Impact:** The 3Dmol.js protein viewer renders with a white background, creating a jarring white flash in the otherwise dark UI. This directly violates the project's #1 non-negotiable rule: "No light backgrounds."

**Current Code:**
```typescript
// src/components/PDBExplorer.tsx:157
backgroundColor: 'white',
```

**Fixed Code:**
```typescript
// src/components/PDBExplorer.tsx:157
backgroundColor: '#050505',
```

**Additional:** Also update the 3Dmol viewer's background in `ProteinViewer.tsx` if it has the same issue (see H7).

---

### C3. Wildcard CORS on All API Routes

- **Severity:** 🔴 Critical
- **Category:** Security
- **Files:** All routes in `app/api/`:
  - `app/api/analyze/route.ts`
  - `app/api/workbench/route.ts`
  - `app/api/alphafold/route.ts`
  - `app/api/pubchem/route.ts`
  - `app/api/fba/route.ts`
  - `app/api/kegg/route.ts`
- **Impact:** `Access-Control-Allow-Origin: '*'` permits any website to call all API endpoints. This enables:
  1. **CSRF attacks** on `/api/workbench` — a malicious site can read/write project state
  2. **API quota abuse** — any site can exhaust Groq/Gemini daily limits via `/api/analyze`
  3. **Data exfiltration** — AlphaFold/PubChem proxy responses can be harvested

**Fix — Create shared CORS utility:**
```typescript
// src/utils/cors.ts (NEW FILE)
const ALLOWED_ORIGINS = [
  'https://nexus-bio-1-0.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-workbench-actor-id, x-workbench-project-id',
  };
}

export function handleOptions(req: Request): Response {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}
```

**Apply to every route handler:**
```typescript
// In each route.ts:
import { getCorsHeaders, handleOptions } from '@/utils/cors';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(req: Request) {
  // ... logic ...
  return new Response(JSON.stringify(data), {
    headers: getCorsHeaders(req),
  });
}
```

**Files to modify:**
1. `app/api/analyze/route.ts` — update all `Response` constructors
2. `app/api/workbench/route.ts` — update all `NextResponse.json` calls to use restricted CORS
3. `app/api/alphafold/route.ts` — update `Response` constructor
4. `app/api/pubchem/route.ts` — update `Response` constructor
5. `app/api/fba/route.ts` — update `Response` constructor
6. `app/api/kegg/route.ts` — update `Response` constructor + add OPTIONS handler

---

### C4. No Rate Limiting on /api/analyze

- **Severity:** 🔴 Critical
- **Category:** Security / Availability
- **File:** `app/api/analyze/route.ts`
- **Impact:** A single client can exhaust Groq (1000 req/day) and Gemini (250 req/day) quotas in minutes, making the AI features unavailable for all other users for the rest of the day.

**Fix — Add in-memory token bucket:**
```typescript
// Add at top of app/api/analyze/route.ts
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// In POST handler, before calling AI:
const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
if (!checkRateLimit(ip)) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
  );
}
```

**Note:** This is an in-memory solution that resets on cold start. For production, consider Vercel Edge Config or Upstash Redis for persistent rate limiting.

---

### C5. No Authentication on /api/workbench

- **Severity:** 🔴 Critical
- **Category:** Security
- **File:** `app/api/workbench/route.ts`
- **Impact:** Any HTTP client can read (`GET`) and write (`PUT`) any project's state. The `x-workbench-actor-id` and `x-workbench-project-id` headers are trusted without verification. A malicious actor can:
  1. Read all project data
  2. Overwrite project state with arbitrary data
  3. Inject false audit trail entries

**Fix — Add origin checking for PUT requests:**
```typescript
// app/api/workbench/route.ts
export async function PUT(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const ALLOWED_ORIGINS = [
    'https://nexus-bio-1-0.vercel.app',
    'http://localhost:3000',
  ];
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: invalid origin' },
      { status: 403, headers: getCorsHeaders(request) }
    );
  }
  // ... rest of handler
}
```

**Additional hardening (future):** Implement session-based authentication with signed tokens for actor ID verification.

---

### C6. No Error Boundary Pages in Next.js App Router

- **Severity:** 🔴 Critical
- **Category:** UX / Reliability
- **Files:** Missing:
  - `app/error.tsx`
  - `app/not-found.tsx`
  - `app/loading.tsx`
  - `app/tools/error.tsx`
  - `app/tools/loading.tsx`
- **Impact:** Any unhandled runtime error produces a raw white error page in production, violating dark theme and providing no recovery option.

**Fix — Create error boundary files:**

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      background: '#050505',
      color: 'rgba(250,246,240,0.96)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Public Sans, sans-serif',
    }}>
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Something went wrong</h2>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          border: '1px solid rgba(250,246,240,0.2)',
          background: 'transparent',
          color: 'rgba(250,246,240,0.96)',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Try again
      </button>
    </div>
  );
}
```

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div style={{
      background: '#050505',
      color: 'rgba(250,246,240,0.96)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Public Sans, sans-serif',
    }}>
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>404 — Page Not Found</h2>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
        The page you are looking for does not exist.
      </p>
      <a
        href="/"
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          border: '1px solid rgba(250,246,240,0.2)',
          color: 'rgba(250,246,240,0.96)',
          textDecoration: 'none',
          fontSize: '13px',
        }}
      >
        Go home
      </a>
    </div>
  );
}
```

```typescript
// app/loading.tsx
export default function Loading() {
  return (
    <div style={{
      background: '#050505',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '2px solid rgba(250,246,240,0.1)',
        borderTopColor: 'rgba(147,203,82,0.8)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
```

```typescript
// app/tools/error.tsx
'use client';

export default function ToolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      background: '#050505',
      color: 'rgba(250,246,240,0.96)',
      padding: '40px',
      fontFamily: 'Public Sans, sans-serif',
      borderRadius: '12px',
      border: '1px solid rgba(250,246,240,0.08)',
      margin: '20px',
    }}>
      <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Tool Error</h3>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '16px' }}>
        {error.message || 'This tool encountered an error.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '6px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(147,203,82,0.4)',
          background: 'rgba(147,203,82,0.1)',
          color: 'rgba(147,203,82,0.9)',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Retry
      </button>
    </div>
  );
}
```

---

## Phase 2: High Priority (Week 1)

> **Definition:** Security vulnerabilities, dark theme violations, accessibility gaps, and API correctness issues. Must be addressed in the first development sprint.

---

### Work Stream: Security Hardening

#### H1. Gemini API Key Exposed in URL Query Parameter

- **Severity:** 🟠 High
- **Category:** Security
- **File:** `app/api/analyze/route.ts`, line 428
- **Impact:** API keys in URLs are logged by proxies, CDNs, and browser history. The Gemini API key should be sent via header.

**Current Code:**
```typescript
// app/api/analyze/route.ts:428
fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

**Fixed Code:**
```typescript
// app/api/analyze/route.ts:428
fetch(`${GEMINI_BASE}/${model}:generateContent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify(body),
});
```

---

#### H2. Missing Security Response Headers

- **Severity:** 🟠 High
- **Category:** Security
- **File:** `next.config.js`
- **Impact:** No protection against clickjacking, MIME sniffing, or protocol downgrade attacks.

**Fix — Add to `next.config.js`:**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config ...
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};
```

---

#### H3. No CSRF Protection on Mutating Routes

- **Severity:** 🟠 High
- **Category:** Security
- **Files:** `app/api/analyze/route.ts` (POST), `app/api/workbench/route.ts` (PUT)
- **Impact:** Cross-site request forgery possible on all mutating endpoints.

**Fix:** The CORS origin restriction in C3 provides baseline CSRF protection. For additional defense, add a custom header check:

```typescript
// In POST/PUT handlers:
const contentType = req.headers.get('content-type') ?? '';
if (!contentType.includes('application/json')) {
  return new Response(JSON.stringify({ error: 'Invalid content type' }), { status: 415 });
}
```

---

#### H4. No Request Body Size Limit on /api/workbench PUT

- **Severity:** 🟠 High
- **Category:** Security / DoS
- **File:** `app/api/workbench/route.ts`, line 72
- **Impact:** An attacker can send arbitrarily large JSON payloads to exhaust server memory.

**Fix:**
```typescript
// app/api/workbench/route.ts, in PUT handler:
const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
if (contentLength > 1_000_000) { // 1MB limit
  return NextResponse.json(
    { ok: false, error: 'Request body too large' },
    { status: 413 }
  );
}
const body = await request.json();
const stateJson = JSON.stringify(body.state ?? {});
if (stateJson.length > 500_000) { // 500KB state limit
  return NextResponse.json(
    { ok: false, error: 'State payload too large' },
    { status: 413 }
  );
}
```

---

### Work Stream: Dark Theme Compliance

#### H5. ToolShell Back Button White Hover Flash

- **Severity:** 🟠 High
- **Category:** UX / Dark Theme
- **File:** `src/components/tools/shared/ToolShell.tsx`, lines 129–134
- **Impact:** Hovering over the back button produces a white flash, violating dark theme.

**Current Code:**
```typescript
// src/components/tools/shared/ToolShell.tsx:129-134
['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.94)',
['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.94)',
['--nb-control-active-bg' as const]: '#ffffff',
['--nb-control-active-border' as const]: '#ffffff',
```

**Fixed Code:**
```typescript
// src/components/tools/shared/ToolShell.tsx:129-134
['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.08)',
['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.12)',
['--nb-control-active-bg' as const]: 'rgba(255,255,255,0.12)',
['--nb-control-active-border' as const]: 'rgba(255,255,255,0.16)',
```

---

#### H6. MultiOPage "Run Sensitivity" White Button

- **Severity:** 🟠 High
- **Category:** UX / Dark Theme
- **File:** `src/components/tools/MultiOPage.tsx`, line 925
- **Impact:** White button in otherwise dark UI.

**Current Code:**
```typescript
// src/components/tools/MultiOPage.tsx:925
border: 'none', background: 'rgba(255,255,255,0.88)', color: '#111318',
```

**Fixed Code:**
```typescript
// src/components/tools/MultiOPage.tsx:925
border: '1px solid rgba(191,220,205,0.45)', background: 'rgba(191,220,205,0.15)', color: 'rgba(250,246,240,0.96)',
```

---

#### H7. ProteinViewer White Surface Color

- **Severity:** 🟠 High
- **Category:** UX / Dark Theme
- **File:** `src/components/ProteinViewer.tsx`, line 56
- **Impact:** Protein surface renders as white, creating visual clash.

**Current Code:**
```typescript
// src/components/ProteinViewer.tsx:56
color: '#FFFFFF',
```

**Fixed Code:**
```typescript
// src/components/ProteinViewer.tsx:56
color: '#D4DCE8',
```

---

#### H8. workbenchTheme `paperElevated` Uses Pure White

- **Severity:** 🟠 High
- **Category:** UX / Dark Theme
- **File:** `src/components/workbench/workbenchTheme.ts`, line 25
- **Impact:** `paperElevated: '#FFFFFF'` is used for slider thumbs and other interactive elements, producing white flashes.

**Current Code:**
```typescript
// src/components/workbench/workbenchTheme.ts:25
paperElevated: '#FFFFFF',
```

**Fixed Code:**
```typescript
// src/components/workbench/workbenchTheme.ts:25
// Rename to sliderThumb for semantic clarity
sliderThumb: 'rgba(250,246,240,0.96)',
```

**Note:** Search for all usages of `paperElevated` and update them to `sliderThumb` or the appropriate semantic name.

---

### Work Stream: Accessibility

#### H9. 15 Buttons with Generic `aria-label="Action"`

- **Severity:** 🟠 High
- **Category:** Accessibility
- **Files:**
  - `src/components/tools/FBASimPage.tsx`
  - `src/components/tools/MultiOPage.tsx`
  - `src/components/tools/DBTLflowPage.tsx`
  - `src/components/tools/GECAIRPage.tsx`
- **Impact:** Screen readers announce "Action" for 15 different buttons, making the UI unusable for visually impaired users.

**Fix:** Replace each `aria-label="Action"` with a descriptive label based on the button's function:

```typescript
// Examples:
// FBASimPage — Run FBA button:
aria-label="Run Flux Balance Analysis"

// MultiOPage — Run sensitivity analysis:
aria-label="Run Sensitivity Analysis"

// DBTLflowPage — Add iteration:
aria-label="Add DBTL Iteration"

// GECAIRPage — Simulate circuit:
aria-label="Simulate Gene Circuit"
```

**Full list to audit:** Search for `aria-label="Action"` across the entire codebase and replace each instance.

---

#### H10. 18+ Interactive Elements with `outline: 'none'`

- **Severity:** 🟠 High
- **Category:** Accessibility
- **Files:** Multiple tool page components
- **Impact:** Keyboard users cannot see which element is focused, making keyboard navigation impossible.

**Fix:** Replace `outline: 'none'` with a visible focus indicator:

```typescript
// Replace:
outline: 'none',

// With:
outline: '2px solid rgba(175,195,214,0.5)',
outlineOffset: '2px',
```

**Scope:** Search for `outline: 'none'` and `'outline': 'none'` across all `.tsx` files. Each instance needs to be evaluated — some may be on non-interactive decorative elements (those are fine to keep), but all interactive elements (buttons, inputs, selects) must have visible focus indicators.

---

### Work Stream: API Route Fixes

#### H11. AlphaFold Route Missing OPTIONS Handler

- **Severity:** 🟠 High
- **Category:** API Correctness
- **File:** `app/api/alphafold/route.ts`
- **Impact:** CORS preflight requests fail, causing the AlphaFold proxy to be unreachable from browsers that enforce preflight.

**Fix:**
```typescript
// app/api/alphafold/route.ts — add this export:
export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}
```

---

#### H12. KEGG Route Missing OPTIONS Handler

- **Severity:** 🟠 High
- **Category:** API Correctness
- **File:** `app/api/kegg/route.ts`
- **Impact:** Same as H11 — CORS preflight failures.

**Fix:** Same pattern as H11.

---

#### H13. `escapeHtml` Corrupts LLM-Bound Input

- **Severity:** 🟠 High
- **Category:** API Correctness
- **File:** `app/api/analyze/route.ts`, line ~650
- **Impact:** `escapeHtml` is applied to user input *before* sending to the LLM, converting `<` to `&lt;`, `>` to `&gt;`, etc. This corrupts scientific queries containing mathematical notation (e.g., "ΔG < 0") and reduces LLM response quality.

**Current Code:**
```typescript
// app/api/analyze/route.ts:~650
const sanitized = escapeHtml(sanitizePromptInput(rawSearchQuery, 2000, true));
```

**Fixed Code:**
```typescript
// app/api/analyze/route.ts:~650
const sanitized = sanitizePromptInput(rawSearchQuery, 2000, true);
// Apply escapeHtml only when rendering responses in the frontend, not before sending to LLM
```

---

### Work Stream: TypeScript Strictness

#### H14. `strict: false` in tsconfig.json

- **Severity:** 🟠 High
- **Category:** Type Safety
- **File:** `tsconfig.json`, line 11
- **Impact:** Without strict mode, TypeScript allows implicit `any`, unchecked `null`/`undefined`, and other unsafe patterns. This has led to the `any` types found in L1–L3.

**Fix — Enable incrementally:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

**Strategy:** Start with `strictNullChecks` and `noImplicitAny`. Fix resulting errors file by file. Once stable, enable full `strict: true`.

---

## Phase 3: Medium Priority (Week 2)

> **Definition:** Performance optimizations, architecture improvements, and scientific accuracy enhancements. Plan for the second development sprint.

---

### Work Stream: Performance

#### M1. ThreeScene Uses meshPhysicalMaterial (Violates Project Rules)

- **Severity:** 🟡 Medium
- **Category:** Performance / Rules Compliance
- **File:** `src/components/ThreeScene.tsx`, lines 417–552
- **Impact:** `meshPhysicalMaterial` causes white bloom under `THREE.LinearToneMapping`. The project rules explicitly require `meshLambertMaterial`.

**Fix:** Search and replace all instances:
```typescript
// Replace all:
meshPhysicalMaterial
// With:
meshLambertMaterial
```

**Scope:** Audit every material in ThreeScene.tsx and ensure all use `meshLambertMaterial`.

---

#### M2. 160 Ambient Particles Updated Every Frame

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `src/components/ThreeScene.tsx`, lines 391–409
- **Impact:** 160 particle positions updated in `useFrame` at 60fps creates unnecessary CPU load.

**Fix options:**
1. **Reduce count:** Change from 160 to 80 particles
2. **GPU-side:** Move particle animation to a vertex shader with a `u_time` uniform

**Quick fix:**
```typescript
// ThreeScene.tsx:391 — change count
const PARTICLE_COUNT = 80; // was 160
```

---

#### M3. 360 Flux Particles Updated Per Frame

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `src/components/ThreeScene.tsx`, lines 740–756
- **Impact:** Same as M2 — 360 particles updated on CPU every frame.

**Fix:** Move to vertex shader animation or reduce count to 120.

---

#### M4. O(n×m) Edge Rendering with `nodes.find()`

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `src/components/ThreeScene.tsx`, lines 841–848
- **Impact:** For each edge, `nodes.find()` scans the entire node array. With N nodes and M edges, this is O(N×M).

**Fix — Build lookup Map in useMemo:**
```typescript
// Add before edge rendering:
const nodeMap = useMemo(() => {
  const map = new Map<string, PathwayNode>();
  nodes.forEach(n => map.set(n.id, n));
  return map;
}, [nodes]);

// Then in edge rendering, replace:
// const source = nodes.find(n => n.id === edge.source);
// With:
// const source = nodeMap.get(edge.source);
```

---

#### M5. Workbench Store Persists Full State to localStorage on Every Mutation

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `src/store/workbenchStore.ts`, lines 1893–1914
- **Impact:** Every state change triggers a full `JSON.stringify` of the entire workbench state and writes to localStorage. With large projects, this causes visible UI stutter.

**Fix — Debounce persistence:**
```typescript
// src/store/workbenchStore.ts
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedPersist(state: WorkbenchState) {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    const { transientField1, transientField2, ...persistable } = state;
    localStorage.setItem('workbench', JSON.stringify(persistable));
  }, 500); // 500ms debounce
}
```

**Additional:** Use Zustand's `partialize` option to exclude large transient fields from persistence.

---

#### M6. Framer Motion in 27+ Components

- **Severity:** 🟡 Medium
- **Category:** Performance / Bundle Size
- **Files:** Multiple tool page components
- **Impact:** Framer Motion adds ~30KB gzipped to the bundle. Many usages are simple fade-in animations that could be CSS.

**Fix:** Audit each usage. Replace simple animations with CSS:
```typescript
// Replace:
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

// With:
<div className="animate-fade-in">
// And in globals.css:
// .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

Keep Framer Motion only for complex orchestrated animations (stagger, layout, gesture).

---

#### M7. Google Fonts Loaded via `<link>` Instead of `next/font`

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `app/layout.tsx`, lines 38–40
- **Impact:** External font requests block rendering and cause layout shift. Next.js 15's `next/font` inlines fonts and eliminates CLS.

**Fix:**
```typescript
// app/layout.tsx
import { Public_Sans, JetBrains_Mono } from 'next/font/google';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// In layout JSX:
<html className={`${publicSans.variable} ${jetbrainsMono.variable}`}>
```

---

#### M8. No Dynamic Imports for Three.js in Tool Pages

- **Severity:** 🟡 Medium
- **Category:** Performance / Bundle Size
- **Files:** `MetabolicEngPage.tsx`, `ProEvolPage.tsx`, and other pages using Three.js
- **Impact:** Three.js (~600KB) is included in the initial bundle even on pages that don't use 3D.

**Fix:**
```typescript
// Replace static import:
import ThreeScene from '@/components/ThreeScene';

// With dynamic import:
import dynamic from 'next/dynamic';
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
  loading: () => <div style={{ background: '#050505', height: '400px' }} />,
});
```

---

### Work Stream: Architecture

#### M9. workbenchStore Is a 1915-Line God Object

- **Severity:** 🟡 Medium
- **Category:** Architecture
- **File:** `src/store/workbenchStore.ts`
- **Impact:** Single file handles project state, experiment ledger, actor management, audit trail, and persistence. Violates single responsibility principle and makes testing/maintenance difficult.

**Fix — Split into domain slices:**
```
src/store/
├── workbenchStore.ts          # Root store, composes slices
├── slices/
│   ├── projectSlice.ts        # Project metadata, versioning
│   ├── experimentSlice.ts     # Experiment ledger entries
│   ├── actorSlice.ts          # Actor/member management
│   ├── auditSlice.ts          # Audit trail
│   └── syncSlice.ts           # Server sync, conflict resolution
```

Use Zustand's slice pattern: each slice is a function that returns a partial state + actions, composed into the root store.

---

#### M10. Module-Level Singleton XState Actor with Test Helper in Production

- **Severity:** 🟡 Medium
- **Category:** Architecture / Testing
- **File:** `src/store/workbenchStore.ts`, lines 587–634
- **Impact:** `__resetWorkflowActorForTests` is exported in production code. The XState actor is created at module scope, making it impossible to reset between tests.

**Fix:**
1. Move actor lifecycle into a Zustand middleware or React context
2. Remove `__resetWorkflowActorForTests` from production path (gate behind `process.env.NODE_ENV === 'test'`)

---

#### M11. SQLite on Ephemeral Vercel Filesystem

- **Severity:** 🟡 Medium
- **Category:** Architecture / Deployment
- **File:** `src/server/workbenchDb.ts`
- **Impact:** Vercel's serverless filesystem is ephemeral — the SQLite database is lost on every cold start. All workbench data is effectively in-memory.

**Fix options (choose one):**
1. **Vercel Postgres:** Drop-in replacement, good for Vercel deployment
2. **Turso (libSQL):** SQLite-compatible, edge-friendly, supports replication
3. **Upstash Redis:** Simple key-value, good for session-like data

**Recommended:** Turso — maintains SQLite compatibility while being persistent and edge-friendly.

---

#### M12. `stableSerialize` Uses `JSON.stringify` for Equality

- **Severity:** 🟡 Medium
- **Category:** Performance
- **File:** `src/store/workbenchStore.ts`, lines 185–191
- **Impact:** `JSON.stringify` is slow for large objects and doesn't handle circular references.

**Fix:**
```typescript
// Replace custom stableSerialize with:
import { isEqual } from 'fast-deep-equal';

// Or for Zustand's subscribeWithSelector:
import shallow from 'zustand/shallow';
```

---

#### M13. WorkbenchSyncProvider Conflict Retry Has No Backoff

- **Severity:** 🟡 Medium
- **Category:** Reliability
- **File:** `src/components/workbench/WorkbenchSyncProvider.tsx`, lines 41–45
- **Impact:** On revision conflict, the sync retries immediately, potentially causing a retry storm.

**Fix:**
```typescript
// src/components/workbench/WorkbenchSyncProvider.tsx
async function syncWithRetry(state: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await syncToServer(state);
      if (result.ok) return result;
      if (result.conflict) {
        // Exponential backoff: 100ms, 400ms, 1600ms
        await new Promise(r => setTimeout(r, 100 * Math.pow(4, attempt)));
        continue;
      }
      return result;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * Math.pow(4, attempt)));
    }
  }
}
```

---

#### M14. Duplicate `SeededRNG` Class

- **Severity:** 🟡 Medium
- **Category:** Code Duplication
- **Files:**
  - `src/services/CellFreeEngine.ts`, line 163
  - `src/services/CatalystDesignerEngine.ts`, line 218
- **Impact:** Identical class duplicated in two files. Changes to one don't propagate to the other.

**Fix — Extract to shared utility:**
```typescript
// src/utils/seededRng.ts (NEW FILE)
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
}
```

Then import from both engine files.

---

#### M15. Console Logging in Production Store

- **Severity:** 🟡 Medium
- **Category:** Code Quality
- **File:** `src/store/workbenchStore.ts`, lines 956, 973, 1332, 1367, 1406, 1428
- **Impact:** Console logs in production pollute browser console and may leak sensitive state.

**Fix:**
```typescript
// Replace:
console.log('workbench: ...', data);

// With:
if (process.env.NODE_ENV !== 'production') {
  console.log('workbench: ...', data);
}
```

Or create a utility:
```typescript
// src/utils/logger.ts
export const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') console.log(...args);
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') console.warn(...args);
  },
  error: (...args: any[]) => console.error(...args), // Always log errors
};
```

---

#### M16. Console Logging in Production Workbench Route

- **Severity:** 🟡 Medium
- **Category:** Code Quality
- **File:** `app/api/workbench/route.ts`, lines 100–109, 179–189
- **Impact:** Same as M15 — production console pollution.

**Fix:** Same pattern as M15.

---

#### M17. `globals.css` Duplicate `.serif` Rule

- **Severity:** 🟡 Medium
- **Category:** CSS Correctness
- **File:** `app/globals.css`, lines 51–53
- **Impact:** Two `.serif` rules — the second silently overwrites the first.

**Fix:** Rename the second rule to `.serif-heading` or `.sans-bold` based on its actual usage.

---

### Work Stream: Scientific Correctness

#### M18. CETHX `correctedDeltaG` Ignores Temperature/pH Parameters

- **Severity:** 🟡 Medium
- **Category:** Scientific Correctness
- **File:** `src/data/mockCETHX.ts`, line 92
- **Impact:** Function signature accepts `temperature` and `pH` parameters but ignores them, returning a constant correction. Misleading API.

**Fix:** Either:
1. **Rename** to `referenceDeltaG(deltaG: number)` and remove unused parameters
2. **Implement** actual temperature/pH correction using the van't Hoff equation: `ΔG(T) = ΔH - TΔS` and pH-dependent terms

**Recommended:** Option 1 (rename) until proper thermodynamic equations are implemented.

---

#### M19. FBA Shadow Prices Are Finite-Difference, Not Dual Variables

- **Severity:** 🟡 Medium
- **Category:** Scientific Correctness
- **File:** `src/server/fbaEngine.ts`, lines 250–265
- **Impact:** The "shadow prices" are computed via finite-difference perturbation, not extracted from the LP dual solution. This is a sensitivity coefficient, not a true shadow price.

**Fix:**
1. Rename output field from `shadowPrices` to `sensitivityCoefficients`
2. Add provenance note in the UI: "Computed via finite-difference perturbation (±1% flux change)"

---

#### M20. Community FBA Is a Heuristic, Not Joint LP

- **Severity:** 🟡 Medium
- **Category:** Scientific Correctness
- **File:** `src/server/fbaEngine.ts`, lines 287–361
- **Impact:** The community FBA implementation uses a sequential single-species optimization with shared resource constraints, not a true joint LP formulation. Users may misinterpret results.

**Fix:** Add a banner in FBASimPage community mode:
```typescript
<div style={{ padding: '8px 12px', background: 'rgba(232,220,200,0.1)', borderRadius: '6px', fontSize: '12px', opacity: 0.8 }}>
  ℹ️ Community FBA uses sequential single-species optimization with shared resource constraints.
  This is an approximation — for true joint optimization, consider SteCom or BioME frameworks.
</div>
```

---

#### M21. `calcMassBalance` Uses Ad-Hoc Rate Constants

- **Severity:** 🟡 Medium
- **Category:** Scientific Correctness
- **File:** `src/utils/thermodynamics.ts`, lines 20–41
- **Impact:** Mass balance calculation uses hardcoded rate constants that don't correspond to any published kinetic model.

**Fix:** Either:
1. **Document** as "qualitative illustration only — not calibrated to experimental data"
2. **Replace** with Eyring equation: `k = (k_B * T / h) * exp(-ΔG‡ / RT)` where ΔG‡ is the activation energy

---

## Phase 4: Low Priority (Backlog)

> **Definition:** Code quality improvements, minor UX polish, and technical debt. Address as time permits.

---

### TypeScript & Type Safety

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L1 | `any` types in core type guards | `src/types.ts:133,138` | Change to `unknown` with type narrowing |
| L2 | `any` types in SemanticSearch, CellImageViewer, PDBExplorer | Multiple | Define interfaces for API responses; create `src/types/3dmol.d.ts` |
| L3 | `err: any` in catch clauses | `alphafold/route.ts:61`, `pubchem/route.ts:94` | Use `catch (err: unknown)` with type guard |

### Code Quality

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L4 | Magic numbers in bioreactor simulation | `src/data/mockDynCon.ts:109-120` | Extract to named constants |
| L5 | `calcDeltaG` can produce `log(0)` | `src/utils/thermodynamics.ts:11` | Clamp Q to `[1e-15, 1e15]` |
| L6 | `clamp` utility duplicated | `CellFreeEngine.ts:199`, `fbaEngine.ts:54` | Extract to `src/utils/math.ts` |
| L7 | `$3Dmol` Window declaration duplicated | `PDBExplorer.tsx:72`, `use3Dmol.ts:5` | Create shared `src/types/3dmol.d.ts` |

### API & Solver Robustness

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L8 | FBA simplex solver silent iteration limit | `src/server/simplexLP.ts:42` | Add `maxIterationsReached` flag to `LPSolution` |
| L9 | CellFreeEngine ribosome solver fixed 15-iteration limit | `CellFreeEngine.ts:244` | Add convergence check with tolerance |

### Build & Deployment

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L10 | `next.config.js` uses CommonJS | `next.config.js` | Rename to `next.config.mjs` |
| L11 | No sitemap.xml or robots.txt | Missing | Add `app/sitemap.ts` and `app/robots.ts` |

### Testing

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L12 | No test coverage for simplexLP, CellFreeEngine, CatalystDesignerEngine | `__tests__/` | Add unit tests |

### UX Polish

| ID | Issue | File | Fix |
|----|-------|------|-----|
| L13 | NEXAIPage `extractYear` regex is naive | `NEXAIPage.tsx:50` | Parse from structured Semantic Scholar `year` field first |
| L14 | MoleculeViewer has inline `load3Dmol` | `MoleculeViewer.tsx:19-28` | Import from `hooks/use3Dmol` |
| L15 | DynConPage phase portrait labels at `fontSize="5"` | `DynConPage.tsx:194-201` | Increase to `fontSize="7"` |
| L16 | SVG canvas background inconsistency | Multiple | Standardize to `#050505` |
| L17 | MetricCard overflow on long values | MetricCard component | Add `overflow: hidden; text-overflow: ellipsis` |
| L18 | FBASimPage knockout buttons lack hover states | `FBASimPage.tsx:449-471` | Add hover style transitions |
| L19 | CETHXPage legend overlap at narrow viewports | `CETHXPage.tsx:252-263` | Use two-row layout below 640px |
| L20 | GenMIMPage warning banner illegible contrast | `GenMIMPage.tsx:303-311` | Use `rgba(232,220,200,0.12)` background with light text |

---

## Implementation Roadmap

### Week 1 — Critical Security + Scientific Correctness

| Day | Tasks | Est. Hours | Files Modified |
|-----|-------|------------|----------------|
| **Day 1** | C1: Fix RK4 product ODE | 1h | `src/utils/kinetics.ts` |
| | C2: Fix PDBExplorer white background | 0.25h | `src/components/PDBExplorer.tsx` |
| | H5: Fix ToolShell white hover flash | 0.5h | `src/components/tools/shared/ToolShell.tsx` |
| | H6: Fix MultiOPage white button | 0.25h | `src/components/tools/MultiOPage.tsx` |
| | H7: Fix ProteinViewer white surface | 0.25h | `src/components/ProteinViewer.tsx` |
| | H8: Fix workbenchTheme paperElevated | 0.5h | `src/components/workbench/workbenchTheme.ts` |
| **Day 2** | C3: Restrict CORS to allowlist | 2h | Create `src/utils/cors.ts`, update 6 API routes |
| | C4: Add rate limiting to /api/analyze | 1h | `app/api/analyze/route.ts` |
| | H11: Add alphafold OPTIONS handler | 0.25h | `app/api/alphafold/route.ts` |
| | H12: Add kegg OPTIONS handler | 0.25h | `app/api/kegg/route.ts` |
| **Day 3** | C5: Add workbench origin checking | 1h | `app/api/workbench/route.ts` |
| | H1: Move Gemini API key to header | 0.5h | `app/api/analyze/route.ts` |
| | H2: Add security headers | 0.5h | `next.config.js` |
| | H3: Add CSRF content-type check | 0.5h | `app/api/analyze/route.ts`, `workbench/route.ts` |
| | H4: Add request body size limit | 0.5h | `app/api/workbench/route.ts` |
| **Day 4** | C6: Create error/not-found/loading pages | 2h | `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`, `app/tools/error.tsx` |
| | H13: Fix escapeHtml corrupting LLM input | 0.5h | `app/api/analyze/route.ts` |
| **Day 5** | H9: Fix 15 aria-label="Action" buttons | 1.5h | FBASimPage, MultiOPage, DBTLflowPage, GECAIRPage |
| | H10: Fix 18+ outline:none elements | 1.5h | Multiple files |

**Week 1 Total: ~14.5 hours**

---

### Week 2 — Performance + Architecture Quick Wins

| Day | Tasks | Est. Hours | Files Modified |
|-----|-------|------------|----------------|
| **Day 6** | M1: Replace meshPhysicalMaterial | 1h | `src/components/ThreeScene.tsx` |
| | M4: Build node Map for O(1) lookups | 0.5h | `src/components/ThreeScene.tsx` |
| | M2: Reduce ambient particles to 80 | 0.25h | `src/components/ThreeScene.tsx` |
| | M3: Reduce flux particles or move to GPU | 1h | `src/components/ThreeScene.tsx` |
| **Day 7** | M7: Migrate Google Fonts to next/font | 1h | `app/layout.tsx` |
| | M8: Add dynamic imports for Three.js | 1.5h | Tool page files |
| **Day 8** | M5: Debounce localStorage persistence | 1h | `src/store/workbenchStore.ts` |
| | M14: Extract SeededRNG | 0.5h | New `src/utils/seededRng.ts` |
| | L6: Extract clamp utility | 0.25h | New `src/utils/math.ts` |
| **Day 9** | M15: Gate store console.log | 0.5h | `src/store/workbenchStore.ts` |
| | M16: Gate route console.log | 0.25h | `app/api/workbench/route.ts` |
| | M17: Fix globals.css duplicate rule | 0.25h | `app/globals.css` |
| **Day 10** | M18: Rename correctedDeltaG | 0.5h | `src/data/mockCETHX.ts`, `CETHXPage.tsx` |
| | M19: Rename shadow prices | 0.5h | `src/server/fbaEngine.ts`, `FBASimPage.tsx` |
| | M20: Add community FBA disclaimer | 0.25h | `src/components/tools/FBASimPage.tsx` |
| | M12: Replace stableSerialize | 0.5h | `src/store/workbenchStore.ts` |

**Week 2 Total: ~9.75 hours**

---

### Week 3+ — Ongoing Improvements

| Sprint | Tasks | Est. Hours |
|--------|-------|------------|
| **Sprint 3** | H14: Enable `strictNullChecks` + `noImplicitAny`, fix errors incrementally | 8–16h |
| | M9: Split workbenchStore into domain slices | 4–6h |
| | M10: Move XState actor out of module scope | 2–3h |
| | M13: Add exponential backoff to sync retry | 1h |
| **Sprint 4** | M11: Migrate SQLite to Turso/Vercel Postgres | 4–8h |
| | M6: Audit Framer Motion usage, replace with CSS | 4–6h |
| | L12: Add unit tests for solvers | 4–6h |
| | L1–L3: Fix remaining `any` types | 2–4h |
| **Backlog** | L4–L20: Remaining low-priority items | 6–10h |

---

## Appendix: Deduplication Notes

The four auditors surfaced overlapping findings that were consolidated:

1. **CORS wildcard** — appeared in Code Quality, Architecture, and Security audits → consolidated into C3
2. **Rate limiting** — appeared in Architecture and Security → consolidated into C4
3. **`any` types** — appeared in Code Quality and Architecture → consolidated into L1–L3 and H14
4. **White background violations** — appeared in Code Quality and UX → consolidated into C2, H5–H8
5. **Console logging** — appeared in Code Quality and Architecture → consolidated into M15, M16
6. **Gemini API key in URL** — appeared in Code Quality and Security → consolidated into H1
7. **Workbench store issues** — appeared in Architecture and Security → consolidated into M9, M10, M12
8. **Missing OPTIONS handlers** — appeared in Code Quality → consolidated into H11, H12
9. **SQLite on ephemeral filesystem** — standalone architecture concern → M11
10. **3Dmol type declarations** — appeared in Code Quality and UX → consolidated into L7

**Total unique findings after deduplication: 50**
