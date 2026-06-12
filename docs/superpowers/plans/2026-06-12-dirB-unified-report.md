# Direction B: Unified Report System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a complete scientific report from all tool outputs — methods, results, figures, provenance — in one click.

**Architecture:** Report generator service collects all tool payloads from workbench store, formats them into structured sections, renders as Markdown (exportable to PDF/HTML). Each tool contributes a section template.

**Tech Stack:** TypeScript, React, Zustand workbench store, existing SVG chart components

---

## Phase B1: Report Data Layer

### Task B1.1: Create report data collector

**Files:**
- Create: `src/services/report/reportCollector.ts`
- Test: `__tests__/report/reportCollector.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { collectReportData } from '../../src/services/report/reportCollector';

describe('reportCollector', () => {
  it('returns empty report when no payloads exist', () => {
    const store = { toolPayloads: {} };
    const report = collectReportData(store as any);
    expect(report.sections).toEqual([]);
    expect(report.metadata.generatedAt).toBeDefined();
  });

  it('collects FBA section when payload exists', () => {
    const store = {
      toolPayloads: {
        fbasim: { fluxes: { R1: 1.0 }, objectiveValue: 0.5 },
      },
    };
    const report = collectReportData(store as any);
    const fbaSection = report.sections.find(s => s.toolId === 'fbasim');
    expect(fbaSection).toBeDefined();
    expect(fbaSection?.title).toContain('Flux Balance');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/report/reportCollector.test.ts --verbose`
Expected: FAIL

- [ ] **Step 3: Implement reportCollector**

```typescript
// src/services/report/reportCollector.ts
export interface ReportSection {
  toolId: string;
  title: string;
  content: string;
  tables: ReportTable[];
  figures: ReportFigure[];
  provenance: { source: string; validityTier: string; assumptions: string[] };
}

export interface ReportTable {
  headers: string[];
  rows: string[][];
  caption: string;
}

export interface ReportFigure {
  title: string;
  svgContent: string;
  caption: string;
}

export interface ReportData {
  metadata: {
    generatedAt: string;
    projectTitle: string;
    targetProduct: string;
  };
  sections: ReportSection[];
  summary: string;
}

const SECTION_TEMPLATES: Record<string, (payload: any) => ReportSection> = {
  fbasim: (p) => ({
    toolId: 'fbasim',
    title: 'Flux Balance Analysis',
    content: `FBA was performed using a ${p.modelType ?? 'single-species'} LP model.`,
    tables: [{
      headers: ['Reaction', 'Flux (mmol/gDW/h)'],
      rows: Object.entries(p.fluxes ?? {}).map(([r, f]) => [r, String(f)]),
      caption: 'Table 1: Predicted flux distribution',
    }],
    figures: [],
    provenance: p.provenance ?? { source: 'demo', validityTier: 'demo', assumptions: [] },
  }),
  cethx: (p) => ({
    toolId: 'cethx',
    title: 'Thermodynamic Feasibility',
    content: `ΔG analysis was performed on ${p.reactionCount ?? 0} reactions.`,
    tables: [{
      headers: ['Reaction', 'ΔG (kJ/mol)', 'Feasible'],
      rows: (p.reactions ?? []).map((r: any) => [r.id, r.deltaG?.toFixed(1) ?? 'N/A', r.feasible ? 'Yes' : 'No']),
      caption: 'Table 2: Gibbs free energy changes',
    }],
    figures: [],
    provenance: p.provenance ?? { source: 'demo', validityTier: 'demo', assumptions: [] },
  }),
  catdes: (p) => ({
    toolId: 'catdes',
    title: 'Enzyme Design',
    content: `Enzyme design was performed with ${p.designCount ?? 0} variant sequences.`,
    tables: [{
      headers: ['Design', 'ΔΔG (kcal/mol)', 'CAI', 'Stability'],
      rows: (p.designs ?? []).map((d: any) => [d.id, d.stabilityDelta?.toFixed(2) ?? 'N/A', d.cai?.toFixed(3) ?? 'N/A', d.stable ? 'Stable' : 'Unstable']),
      caption: 'Table 3: Enzyme design variants',
    }],
    figures: [],
    provenance: p.provenance ?? { source: 'demo', validityTier: 'demo', assumptions: [] },
  }),
};

export function collectReportData(store: { toolPayloads: Record<string, any> }): ReportData {
  const sections: ReportSection[] = [];

  for (const [toolId, payload] of Object.entries(store.toolPayloads)) {
    if (!payload) continue;
    const template = SECTION_TEMPLATES[toolId];
    if (template) {
      sections.push(template(payload));
    }
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      projectTitle: 'Nexus-Bio Research Report',
      targetProduct: 'Synthetic Biology Pathway',
    },
    sections,
    summary: `Report generated with ${sections.length} tool sections.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/report/reportCollector.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/report/reportCollector.ts __tests__/report/reportCollector.test.ts
git commit -m "feat(report): create report data collector with section templates"
```

---

### Task B1.2: Add section templates for remaining tools

**Files:**
- Modify: `src/services/report/reportCollector.ts`

- [ ] **Step 1: Add templates for CellFree, DynCon, MultiO, ScSpatial, GenMIM, ProEvol, GECAIR**

Each tool gets a template that extracts key results into tables.

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests -- report`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/services/report/reportCollector.ts
git commit -m "feat(report): add section templates for all 14 tools"
```

---

## Phase B2: Report Renderer

### Task B2.1: Create Markdown report renderer

**Files:**
- Create: `src/services/report/markdownRenderer.ts`
- Test: `__tests__/report/markdownRenderer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { renderMarkdown } from '../../src/services/report/markdownRenderer';

describe('markdownRenderer', () => {
  it('renders metadata header', () => {
    const report = {
      metadata: { generatedAt: '2026-06-12', projectTitle: 'Test', targetProduct: 'X' },
      sections: [],
      summary: 'No sections.',
    };
    const md = renderMarkdown(report);
    expect(md).toContain('# Nexus-Bio Research Report');
    expect(md).toContain('Test');
  });

  it('renders section with table', () => {
    const report = {
      metadata: { generatedAt: '2026-06-12', projectTitle: 'Test', targetProduct: 'X' },
      sections: [{
        toolId: 'test', title: 'Test Section', content: 'Description.',
        tables: [{ headers: ['A', 'B'], rows: [['1', '2']], caption: 'Table 1' }],
        figures: [],
        provenance: { source: 'demo', validityTier: 'demo', assumptions: [] },
      }],
      summary: '1 section.',
    };
    const md = renderMarkdown(report);
    expect(md).toContain('## Test Section');
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/report/markdownRenderer.test.ts --verbose`
Expected: FAIL

- [ ] **Step 3: Implement markdownRenderer**

```typescript
// src/services/report/markdownRenderer.ts
import type { ReportData } from './reportCollector';

export function renderMarkdown(report: ReportData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${report.metadata.projectTitle}`);
  lines.push('');
  lines.push(`**Generated:** ${report.metadata.generatedAt}`);
  lines.push(`**Target:** ${report.metadata.targetProduct}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  // Sections
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(section.content);
    lines.push('');

    // Tables
    for (const table of section.tables) {
      lines.push(`**${table.caption}**`);
      lines.push('');
      lines.push(`| ${table.headers.join(' | ')} |`);
      lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }

    // Provenance
    lines.push('> **Data source:** ' + section.provenance.source);
    lines.push('> **Validity tier:** ' + section.provenance.validityTier);
    if (section.provenance.assumptions.length > 0) {
      lines.push('> **Assumptions:** ' + section.provenance.assumptions.join('; '));
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/report/markdownRenderer.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/report/markdownRenderer.ts __tests__/report/markdownRenderer.test.ts
git commit -m "feat(report): create Markdown report renderer"
```

---

### Task B2.2: Create report export button component

**Files:**
- Create: `src/components/tools/shared/ReportExportButton.tsx`

- [ ] **Step 1: Create ReportExportButton**

```typescript
// src/components/tools/shared/ReportExportButton.tsx
import React, { useCallback } from 'react';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { collectReportData } from '../../../services/report/reportCollector';
import { renderMarkdown } from '../../../services/report/markdownRenderer';

interface ReportExportButtonProps {
  style?: React.CSSProperties;
}

export default function ReportExportButton({ style }: ReportExportButtonProps) {
  const toolPayloads = useWorkbenchStore(s => s.toolPayloads);
  const project = useWorkbenchStore(s => s.project);

  const handleExport = useCallback(() => {
    const report = collectReportData({ toolPayloads });
    report.metadata.projectTitle = project?.title ?? 'Nexus-Bio Report';
    report.metadata.targetProduct = project?.targetProduct ?? 'Unknown';

    const markdown = renderMarkdown(report);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-bio-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [toolPayloads, project]);

  return (
    <button
      onClick={handleExport}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--nb-radius-sm)',
        border: '1px solid rgba(200, 216, 232, 0.2)',
        background: 'rgba(200, 216, 232, 0.08)',
        color: '#C8D8E8',
        fontFamily: 'var(--nb-sans)',
        fontSize: 'var(--nb-fs-sm)',
        cursor: 'pointer',
        ...style,
      }}
    >
      📄 Export Report
    </button>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/ReportExportButton.tsx
git commit -m "feat(report): create ReportExportButton component"
```

---

### Task B2.3: Wire ReportExportButton into workbench status bar

**Files:**
- Modify: `src/components/workbench/WorkbenchStatusBar.tsx`

- [ ] **Step 1: Add ReportExportButton to status bar**

Import and render `ReportExportButton` in the workbench status bar, next to existing export buttons.

- [ ] **Step 2: Commit**

```bash
git add src/components/workbench/WorkbenchStatusBar.tsx
git commit -m "feat(report): add report export button to workbench status bar"
```

---

## Phase B3: Report Testing & Polish

### Task B3.1: Add report generation tests

**Files:**
- Create: `__tests__/report/reportIntegration.test.ts`

- [ ] **Step 1: Write integration test**

Test full pipeline: collect data from mock payloads → render Markdown → verify all sections present.

- [ ] **Step 2: Commit**

```bash
git add __tests__/report/reportIntegration.test.ts
git commit -m "test(report): add report generation integration tests"
```

---

### Task B3.2: Add report documentation

**Files:**
- Modify: `README.md` (add Report System section)

- [ ] **Step 1: Add report section to README**

Add a section explaining the one-click report export feature, what it includes, and how to use it.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add report system documentation to README"
```
