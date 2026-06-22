# UI/UX Deepening Plan — Controlled Refactoring

## Constraints (Hard)
1. No global route changes
2. No navigation skeleton changes
3. No design language overhaul
4. No core data schema / module boundary changes
5. No new pages before adapting existing code
6. No UI design based on engine name alone — read code first

## Phase 1: Audit — DONE (NEXAI + CatDes audited, shared component inventory complete)

## Phase 2: Shared Components — 7 new + 3 fixes

### New Components (src/components/tools/shared/)

1. **WorkflowStepper.tsx** — Step indicator for multi-stage pipelines
   - Props: `steps: StepDef[]`, `activeIndex`, `onStepClick?`
   - Each step: `{ id, label, status: 'pending'|'active'|'done'|'error', detail? }`
   - Horizontal bar with numbered circles, connecting lines, status colors

2. **ParameterPanel.tsx** — Collapsible parameter input drawer
   - Props: `title`, `children`, `defaultCollapsed?`, `onReset?`
   - Glass-panel with collapse toggle, reset button, consistent spacing

3. **ResultSummaryPanel.tsx** — Compact 3-5 metric summary
   - Props: `metrics: SummaryMetric[]`, `actions?`
   - Each metric: `{ label, value, unit?, trend?: 'up'|'down'|'flat', accent? }`
   - Row of MetricCards with optional trend indicators

4. **DetailDrawer.tsx** — Slide-out detail view
   - Props: `open`, `title`, `onClose`, `children`
   - Right-side drawer with backdrop, close button, scroll content

5. **HandoffCard.tsx** — "Send to downstream tool" card
   - Props: `fromTool`, `toTool`, `payload`, `onSend`
   - Shows context summary + "Send to {toTool}" button
   - Uses workbench store for payload transfer (not localStorage)

6. **ConfidenceBadge.tsx** — Confidence/risk indicator pill
   - Props: `value: number` (0-1), `label?`, `thresholds?`
   - Color-coded: green (>0.7), yellow (0.4-0.7), red (<0.4)

7. **ProvenanceLog.tsx** — Audit trail display
   - Props: `entries: ProvenanceEntry[]`, `compact?`
   - Timeline of data sources, timestamps, validity tiers

### Fixes to Existing Components

8. **EmptyState.tsx** — Add `action?: { label, onClick }` slot for CTA buttons
9. **MetricCard.tsx** — Add `trend?: 'up'|'down'|'flat'` indicator
10. **DataTable.tsx** — Add `expandable?: boolean` + `renderExpand(row)` for row expansion

## Phase 3: NEXAI AXON Redesign (Engine #1)

### Keep
- Three-column grid layout
- Cognitive Router tier system
- ContextChips, PromptInput, AbortController pattern
- Citation verification flow
- Component decomposition (ResultPanel, EvidencePanel, etc.)

### Refactor
- Extract 1202-line monolith into focused sub-components
- Replace hardcoded "Groq API unavailable" with dynamic provider name
- Cap messages array at 50
- Extract inline styles to CSS modules / style objects
- Fix duplicated pathwayToResult call
- Remove "Axon posture" filler panel
- Add empty state for conversation thread
- Extract magic numbers to named constants

### Add
- WorkflowStepper showing Cognitive Router tier progression
- ConfidenceBadge on citations
- ResultSummaryPanel above detail views
- Error state for Semantic Scholar failures

## Phase 4: Per-Engine Execution (remaining 9)
CatDes → DynCon → Biosensor → MultiO → Consortium → MFA → GenMIM → RNA → GEM

## Phase 5: Tests & Verification
Per engine: write tests, run tests, visual self-check, change summary, rollback points.
