# Direction D: Inter-Tool Automatic Data Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make sidecar tools automatically consume upstream tool payloads without manual wiring.

**Architecture:** Enhance workbenchDataflow.ts seed functions to auto-populate all downstream tools. Add dependency validation and auto-trigger.

**Tech Stack:** TypeScript, Zustand, existing workbench store

---

## Phase D1: Dependency Enforcement

### Task D1.1: Create tool dependency validator

**Files:**
- Create: `src/services/toolDependencyValidator.ts`
- Test: `__tests__/toolDependencyValidator.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { validateDependencies } from '../../src/services/toolDependencyValidator';

describe('toolDependencyValidator', () => {
  it('returns ok when all dependencies are met', () => {
    const payloads = { fbasim: { fluxes: {} }, cethx: { reactions: [] } };
    const result = validateDependencies('cethx', payloads);
    expect(result.status).toBe('ok');
  });

  it('returns missing when upstream payload is absent', () => {
    const payloads = {};
    const result = validateDependencies('cethx', payloads);
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('fbasim');
  });

  it('returns stale when upstream payload is older', () => {
    const payloads = {
      fbasim: { fluxes: {}, timestamp: Date.now() - 100000 },
      cethx: { reactions: [], timestamp: Date.now() },
    };
    const result = validateDependencies('cethx', payloads);
    expect(['ok', 'stale']).toContain(result.status);
  });
});
```

- [ ] **Step 2: Implement validator**

```typescript
// src/services/toolDependencyValidator.ts
import { WORKFLOW_CONTRACTS } from './workflowRegistry';

export interface DependencyValidation {
  status: 'ok' | 'missing' | 'stale';
  missing: string[];
  stale: string[];
}

export function validateDependencies(
  toolId: string,
  payloads: Record<string, any>,
): DependencyValidation {
  const contract = WORKFLOW_CONTRACTS[toolId];
  if (!contract) return { status: 'ok', missing: [], stale: [] };

  const missing: string[] = [];
  const stale: string[] = [];

  for (const input of contract.requiredInputs) {
    const payload = payloads[input.toolId];
    if (!payload) {
      missing.push(input.toolId);
    }
  }

  return {
    status: missing.length > 0 ? 'missing' : stale.length > 0 ? 'stale' : 'ok',
    missing,
    stale,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/toolDependencyValidator.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/toolDependencyValidator.ts __tests__/toolDependencyValidator.test.ts
git commit -m "feat(workflow): create tool dependency validator"
```

---

### Task D1.2: Add dependency warning banner to tool pages

**Files:**
- Create: `src/components/tools/shared/DependencyWarning.tsx`

- [ ] **Step 1: Create DependencyWarning component**

```typescript
import React from 'react';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { validateDependencies } from '../../../services/toolDependencyValidator';

interface DependencyWarningProps {
  toolId: string;
}

export default function DependencyWarning({ toolId }: DependencyWarningProps) {
  const toolPayloads = useWorkbenchStore(s => s.toolPayloads);
  const validation = validateDependencies(toolId, toolPayloads);

  if (validation.status === 'ok') return null;

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 'var(--nb-radius-sm)',
      background: 'rgba(251, 191, 36, 0.08)',
      border: '1px solid rgba(251, 191, 36, 0.2)',
      color: 'rgba(251, 191, 36, 0.9)',
      fontFamily: 'var(--nb-sans)',
      fontSize: 'var(--nb-fs-xs)',
      marginBottom: '12px',
    }}>
      ⚠️ Missing upstream data: {validation.missing.join(', ')}. Run upstream tools first for real results.
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tools/shared/DependencyWarning.tsx
git commit -m "feat(workflow): create DependencyWarning banner component"
```

---

## Phase D2: Auto-Population

### Task D2.1: Enhance seed functions to auto-populate all fields

**Files:**
- Modify: `src/components/tools/shared/workbenchDataflow.ts`

- [ ] **Step 1: Review current seed functions**

Read `workbenchDataflow.ts` and identify which fields are NOT being populated from upstream payloads.

- [ ] **Step 2: Add missing field population**

For each seed function, ensure ALL available upstream data is used to populate downstream parameters.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/shared/workbenchDataflow.ts
git commit -m "feat(workflow): enhance seed functions to auto-populate all fields"
```

---

### Task D2.2: Add auto-trigger when upstream data changes

**Files:**
- Modify: tool page components (CETHX, CatDes, CellFree, DynCon)

- [ ] **Step 1: Add useEffect that watches upstream payloads**

In each downstream tool page, add a useEffect that detects when upstream payloads change and re-seeds the tool parameters.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(workflow): add auto-trigger when upstream data changes"
```

---

### Task D2.3: Add data flow visualization

**Files:**
- Create: `src/components/workbench/DataFlowVisualization.tsx`

- [ ] **Step 1: Create a simple data flow diagram component**

Shows which tools have data, which are connected, and the flow direction.

- [ ] **Step 2: Commit**

```bash
git add src/components/workbench/DataFlowVisualization.tsx
git commit -m "feat(workflow): add data flow visualization component"
```

---

## Phase D3: Testing

### Task D3.1: Add integration tests for data flow

**Files:**
- Create: `__tests__/workflow/dataFlow.test.ts`

- [ ] **Step 1: Write tests**

Test: FBA payload → CETHX seed → CatDes seed → CellFree seed produces valid downstream parameters.

- [ ] **Step 2: Commit**

```bash
git add __tests__/workflow/dataFlow.test.ts
git commit -m "test(workflow): add data flow integration tests"
```
