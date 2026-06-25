# Task Brief: Accessibility Fixes (Tasks 2, 3, 4)

## Task 2: Skip-to-content link
**File:** `src/components/ide/ToolsLayoutShell.tsx`
Add `id="main-content"` to the main content landmark element.

## Task 3: Sidebar aria-label
**File:** `src/components/ide/IDESidebar.tsx` lines 393-396
Add `aria-label` to cross-stage Link elements. Match the pattern at lines 254-257:
```tsx
aria-label={collapsed ? `${tool.shortLabel} — ${tool.name}` : undefined}
```

## Task 4: Tool title heading
**File:** `src/components/tools/shared/ToolShell.tsx` lines 202-208
Change the `<div>` wrapping the tool title to `<h1>`. Keep all existing inline styles.

## Constraints
- Do NOT modify IDEShell.tsx, IDETopBar.tsx structure, or IDESidebar.tsx navigation structure
- Dark theme only
- Run `npx jest --no-coverage` after changes
