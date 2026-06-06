---
name: nexus-bio-tool
description: Scaffold a new Nexus-Bio tool page with correct layout, store wiring, and workbench config
---

# /nexus-bio-tool

Generate a new tool page following the established patterns.

## Parameters
- `ToolName` (required): Name of the new tool (e.g., `BioReact`, `GeneFlow`)
- `ToolRoute` (required): URL route (e.g., `bioreact`, `geneflow`)

## Steps

1. Read `src/components/tools/shared/toolRegistry.ts` to understand the tool registration pattern
2. Read `src/components/tools/shared/workbenchConfig.ts` to understand the stage/tool mapping
3. Create the tool page file at `src/components/tools/${ToolName}Page.tsx` with:
   - Correct imports (ToolShell, PATHD_THEME, toolTokens, etc.)
   - Design tokens from `useToolTheme()`
   - Tab structure (ToolTabPanel)
   - Workbench payload sync (useEffect + setToolPayload)
   - MetricCard and FloatingControlRail layout
4. Add tool definition to `toolRegistry.ts`
5. Add tool route to `app/tools/${ToolRoute}/page.tsx`
6. Run `npx tsc --noEmit` to verify
7. Run `npm test` to verify no regressions

## Output
The new tool page files + registration changes.
