---
name: nexus-bio-test
description: Run tests, check coverage, and generate new test stubs for Nexus-Bio tool pages
---

# /nexus-bio-test

Run the test suite and report results. If a tool page name is provided, generate a test stub for that tool.

## Parameters
- `ToolName` (optional): One of `ScSpatial`, `MultiO`, `FBASim`, `ProEvol`, `GECAIR`, `GenMIM`, `NEXAI`, `DBTLflow`, `DynCon`, `CETHX`, `CellFree`, `CATDES`, `CellFree`, `PathD`

## Steps

1. Run `npm test` and report the results (pass/fail counts, any failures)
2. Run `npx tsc --noEmit` and report type errors
3. If `ToolName` is provided:
   a. Read `src/components/tools/${ToolName}Page.tsx`
   b. Identify the main exported component
   c. Generate a test stub in `__tests__/${ToolName}Page.test.tsx` with:
      - Smoke test (renders without crashing)
      - Key interaction tests (button clicks, tab switches)
      - Snapshot test for the main SVG/visualization
   d. Run the new test to verify it passes

## Output
A summary of test results + any newly generated test files.
