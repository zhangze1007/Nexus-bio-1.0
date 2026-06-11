# Research-Friendliness Architecture — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Nexus-Bio from a teaching/demo tool into a research-grade platform with real data, transparent algorithms, and standard exports.

**Architecture:** 4 phases: Data Layer → Calculation Layer → Output Layer → AI Optimization. Each phase produces independently usable improvements.

**Tech Stack:** Next.js 15 API routes, existing /api/kegg and /api/pubchem routes, better-sqlite3 (workbench), CSV parsing, SBML/SBOL libraries.

---

## Phase 1: Data Layer

### Task 1: Create CSV Upload Component

**Files:**
- Create: `src/components/shared/DataUpload.tsx`
- Create: `src/components/shared/DataPreview.tsx`
- Test: `__tests__/DataUpload.test.tsx`

- [ ] **Step 1: Create DataUpload component**

```tsx
// src/components/shared/DataUpload.tsx
'use client';
import { useState, useRef, useCallback } from 'react';
import { THEME } from '../../theme';

interface DataUploadProps {
  onUpload: (data: Record<string, string>[], headers: string[]) => void;
  onError?: (error: string) => void;
  accept?: string;
  label?: string;
}

export default function DataUpload({ onUpload, onError, accept = '.csv,.tsv', label = 'Upload Data' }: DataUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('File must have at least a header row and one data row');

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    const rows = lines.slice(1).map((line, i) => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 2}: expected ${headers.length} columns, got ${values.length}`);
      }
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j]; });
      return row;
    });

    return { headers, rows };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setIsParsing(true);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      onUpload(rows, headers);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setIsParsing(false);
    }
  }, [parseCSV, onUpload, onError]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        padding: '16px',
        borderRadius: THEME.R_MD,
        border: `2px dashed ${isDragging ? THEME.MINT : THEME.BORDER}`,
        background: isDragging ? 'rgba(191,220,205,0.08)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
      />
      <div style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.LABEL }}>
        {isParsing ? 'Parsing...' : label}
      </div>
      <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, marginTop: '4px' }}>
        Drag & drop or click to browse · CSV/TSV format
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DataPreview component**

```tsx
// src/components/shared/DataPreview.tsx
'use client';
import { THEME } from '../../theme';

interface DataPreviewProps {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
}

export default function DataPreview({ headers, rows, maxRows = 5 }: DataPreviewProps) {
  const shown = rows.slice(0, maxRows);

  return (
    <div style={{ overflow: 'auto', borderRadius: THEME.R_MD, border: `1px solid ${THEME.BORDER}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: THEME.MONO, fontSize: THEME.FS_XS }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: THEME.LABEL, background: THEME.PANEL_INSET, borderBottom: `1px solid ${THEME.BORDER}`, position: 'sticky', top: 0 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} style={{ background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              {headers.map(h => (
                <td key={h} style={{ padding: '4px 8px', color: THEME.VALUE, borderBottom: `1px solid ${THEME.BORDER}` }}>
                  {row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div style={{ padding: '6px 8px', fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, textAlign: 'center' }}>
          + {rows.length - maxRows} more rows
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write test**

```tsx
// __tests__/DataUpload.test.tsx
import { render, fireEvent } from '@testing-library/react';
import DataUpload from '../src/components/shared/DataUpload';

describe('DataUpload', () => {
  it('renders upload area', () => {
    const { getByText } = render(<DataUpload onUpload={jest.fn()} />);
    expect(getByText(/Upload Data/)).toBeTruthy();
  });

  it('shows drag and drop hint', () => {
    const { getByText } = render(<DataUpload onUpload={jest.fn()} />);
    expect(getByText(/Drag & drop/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run test**

- [ ] **Step 5: Commit**

### Task 2: Add Data Upload to FBASim

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`

- [ ] **Step 1: Add upload tab to FBASim**

Add a new tab "Upload" with DataUpload + DataPreview components. When user uploads CSV with reaction IDs and flux values, parse and use as simulation input.

- [ ] **Step 2: Commit**

### Task 3: Add Data Upload to MultiO

**Files:**
- Modify: `src/components/tools/MultiOPage.tsx`

- [ ] **Step 1: Add upload capability to MultiO**

Add DataUpload for gene expression matrix (genes × samples CSV). Parse and use as input for VAE embedding.

- [ ] **Step 2: Commit**

### Task 4: Enhance KEGG Integration

**Files:**
- Modify: `app/api/kegg/route.ts`
- Create: `src/services/keggClient.ts`

- [ ] **Step 1: Create KEGG client service**

```typescript
// src/services/keggClient.ts
export async function getKEGGPathway(pathwayId: string) {
  const res = await fetch(`/api/kegg?endpoint=pathway&id=${pathwayId}`);
  if (!res.ok) throw new Error(`KEGG error: ${res.status}`);
  return res.json();
}

export async function searchKEGGCompounds(query: string) {
  const res = await fetch(`/api/kegg?endpoint=search&query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`KEGG error: ${res.status}`);
  return res.json();
}

export async function getKEGGReaction(reactionId: string) {
  const res = await fetch(`/api/kegg?endpoint=reaction&id=${reactionId}`);
  if (!res.ok) throw new Error(`KEGG error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Integrate into PathD**

Add a "Load from KEGG" button that fetches pathway data and populates the metabolic graph.

- [ ] **Step 3: Commit**

---

## Phase 2: Calculation Layer

### Task 5: Create Algorithm Transparency Panel

**Files:**
- Create: `src/components/shared/AlgorithmPanel.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/shared/AlgorithmPanel.tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, ExternalLink } from 'lucide-react';
import { THEME } from '../../theme';

interface AlgorithmPanelProps {
  name: string;
  version?: string;
  description: string;
  assumptions: string[];
  citation?: { authors: string; title: string; journal: string; year: number; doi: string };
  limitations?: string[];
}

export default function AlgorithmPanel({ name, version, description, assumptions, citation, limitations }: AlgorithmPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      borderRadius: THEME.R_MD,
      border: `1px solid ${THEME.BORDER}`,
      background: THEME.PANEL_INSET,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.VALUE,
        }}
      >
        <BookOpen size={14} color={THEME.SKY} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{name}</span>
        {version && <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM }}>v{version}</span>}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: '10px' }}>
          <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.LABEL, lineHeight: 1.6 }}>
            {description}
          </p>

          <div>
            <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Assumptions
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {assumptions.map((a, i) => (
                <li key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.LABEL, lineHeight: 1.5, marginBottom: '2px' }}>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {limitations && limitations.length > 0 && (
            <div>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.APRICOT, marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Limitations
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {limitations.map((l, i) => (
                  <li key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.LABEL, lineHeight: 1.5, marginBottom: '2px' }}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {citation && (
            <div style={{ padding: '8px 10px', borderRadius: THEME.R_SM, background: 'rgba(175,195,214,0.08)', border: `1px solid rgba(175,195,214,0.15)` }}>
              <div style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: THEME.VALUE, lineHeight: 1.5 }}>
                {citation.authors} ({citation.year}). {citation.title}. <em>{citation.journal}</em>.
              </div>
              {citation.doi && (
                <a href={`https://doi.org/${citation.doi}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.SKY, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  DOI: {citation.doi} <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into FBASim**

Add AlgorithmPanel to FBASim with FBA algorithm details, assumptions, and Orth et al. 2010 citation.

- [ ] **Step 3: Integrate into CETHX**

Add AlgorithmPanel with ΔG group contribution method details and Alberty citation.

- [ ] **Step 4: Commit**

---

## Phase 3: Output Layer

### Task 6: Standardize Export Across All Tools

**Files:**
- Modify: All 14 tool pages

- [ ] **Step 1: Audit existing exports**

Check which tools have ExportButton and which don't. Add to all.

- [ ] **Step 2: Add CSV export to tools missing it**

- [ ] **Step 3: Commit**

### Task 7: Create Parameter Snapshot System

**Files:**
- Create: `src/components/shared/ParameterSnapshot.tsx`
- Modify: `src/store/workbenchStore.ts`

- [ ] **Step 1: Create snapshot component**

Save/load parameter configurations as JSON. Store in workbench project.

- [ ] **Step 2: Commit**

### Task 8: Create Experiment Report Generator

**Files:**
- Create: `src/components/shared/ExperimentReport.tsx`

- [ ] **Step 1: Create report component**

Auto-generate experiment report with parameters, results, method, citations. Export as HTML.

- [ ] **Step 2: Commit**

---

## Phase 4: AI Agent Optimization (After Phase 1-3)

### Task 9: Enhance Axon with Data Awareness

- [ ] **Step 1: Update Axon system prompt to access uploaded data**
- [ ] **Step 2: Add data quality analysis to Axon responses**
- [ ] **Step 3: Commit**

### Task 10: Add Axon Report Generation

- [ ] **Step 1: Add "Generate Report" command to Axon**
- [ ] **Step 2: Axon generates methods sections with proper citations**
- [ ] **Step 3: Commit**
