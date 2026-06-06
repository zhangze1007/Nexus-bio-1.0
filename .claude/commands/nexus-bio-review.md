---
name: nexus-bio-review
description: Structured code review checklist for Nexus-Bio pull requests
---

# /nexus-bio-review

Perform a structured code review of the current changes (git diff).

## Review Checklist

### 1. Safety
- [ ] No light backgrounds introduced (`#FFFFFF`, `#F5F7FA`, `#F2F5F8`)
- [ ] No hardcoded mock responses
- [ ] No `as any` casts without documented justification
- [ ] FORBIDDEN files not modified (IDEShell, IDETopBar, IDESidebar, DBTLflowPage, GECAIRPage, ProEvolPage)
- [ ] `meshLambertMaterial` used for all Three.js geometry (not `meshStandardMaterial`)
- [ ] 3Dmol.js loaded from CDN only (not npm)

### 2. Correctness
- [ ] Real scientific algorithms used (no placeholder math)
- [ ] API error responses use `{ ok: false, error: string }` format
- [ ] Input validation on all API routes
- [ ] CORS headers on all API responses

### 3. Type Safety
- [ ] `npx tsc --noEmit` passes (zero errors)
- [ ] No `any` types without documented reason
- [ ] All function parameters typed

### 4. Performance
- [ ] No synchronous heavy computation on main thread (use Web Workers)
- [ ] `useMemo` for expensive computations
- [ ] Dynamic imports for large components
- [ ] No unnecessary re-renders

### 5. Testing
- [ ] `npm test` passes (no new failures)
- [ ] New code has test coverage
- [ ] E2E tests for critical paths

## Output
A structured review report with findings categorized by severity.
