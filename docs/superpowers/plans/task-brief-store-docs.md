# Task Brief: Store + Documentation Fixes (Tasks 5, 7, 8)

## Task 5: Console entries cap
**File:** `src/store/uiStore.ts` lines 139-145
Cap `consoleEntries` at 500. After appending, slice to last 500:
```ts
consoleEntries: [...s.consoleEntries, { ... }].slice(-500),
```

## Task 7: mfa13CEngine stale comment
**File:** `src/server/mfa13CEngine.ts` lines 21-22
Change:
```
- Flux estimation uses grid search, not nonlinear optimization
```
To:
```
- Flux estimation uses Levenberg-Marquardt nonlinear least-squares optimization
```

## Task 8: iJO1366Subset header
**File:** `src/data/iJO1366Subset.ts` line 2
Change "~95 reactions" to "71 reactions" (the actual count in the file).

## Constraints
- Run `npx jest --no-coverage` after changes
