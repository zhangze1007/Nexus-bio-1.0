---
name: nexus-bio-deploy
description: Pre-deploy checklist and deployment verification for Nexus-Bio
---

# /nexus-bio-deploy

Run all pre-deploy checks and verify the deployment is safe.

## Pre-Deploy Checklist

1. **Type check**: Run `npx tsc --noEmit` — must pass with zero errors
2. **Unit tests**: Run `npm test` — no new failures beyond known baselines
3. **Build**: Run `npm run build` — must succeed
4. **Bundle size**: Run `npm run analyze` — check for unexpected growth
5. **Environment variables**: Verify all required env vars are set in Vercel:
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `SENTRY_DSN` (optional but recommended)
6. **Health check**: After deploy, verify `https://nexus-bio-1-0.vercel.app/api/health` returns `{"status":"ok"}`
7. **Smoke test**: Visit the deployed URL and verify:
   - Homepage loads
   - Tool pages render
   - AI analyze endpoint responds
   - 3D viewer loads (ProteinViewer, MoleculeViewer)

## Output
A deploy readiness report with pass/fail for each check.
