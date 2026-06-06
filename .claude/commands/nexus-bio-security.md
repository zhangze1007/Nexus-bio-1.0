---
name: nexus-bio-security
description: Quick security scan for Nexus-Bio API routes and dependencies
---

# /nexus-bio-security

Perform a quick security audit of the codebase.

## Checks

1. **Dependency audit**: Run `npm audit` and report vulnerabilities
2. **API route security**:
   - Check all `app/api/*/route.ts` files for:
     - Input validation (sanitize all user input)
     - Rate limiting (at least on `/api/analyze`)
     - CORS headers (should use `getCorsHeaders()`)
     - Error format (`{ ok: false, error: string }`)
     - No secrets in response bodies
3. **CSP header**: Verify `next.config.mjs` has a Content-Security-Policy header
4. **Secrets scan**: Search for hardcoded API keys or tokens in source
   ```bash
   grep -rn "sk-\|AIza\|ghp_\|GROQ_API_KEY=\|GEMINI_API_KEY=" src/ app/ --include="*.ts" --include="*.tsx"
   ```
5. **SSRF check**: Verify AlphaFold and PubChem proxy routes validate input before fetching

## Output
A security report with findings categorized by severity (critical/high/medium/low).
