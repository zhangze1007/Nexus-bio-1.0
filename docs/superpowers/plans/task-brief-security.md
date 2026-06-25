# Task Brief: Security Fixes (Tasks 6, 9)

## Task 6: sanitizeHistory escapeHtml
**File:** `app/api/analyze/route.ts`
The `escapeHtml` function is defined at line 372. The `sanitizeHistory` function is at lines 416-453.
Apply `escapeHtml()` to each message's `content` field inside `sanitizeHistory`, after truncation.

## Task 9: Turso CSP connect-src
**File:** `next.config.mjs` line 53
Add `https://*.turso.io` to the `connect-src` CSP directive. Insert it near the other database-related origins.

## Constraints
- Do NOT change the escapeHtml function itself
- Do NOT change other CSP directives
- Run `npx jest --no-coverage` after changes
