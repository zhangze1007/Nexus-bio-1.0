# Connect Real Algorithms to UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect existing real scientific algorithms to tool page UIs, replacing decorative formulas with actual computations.

**Architecture:** Each tool page will call its existing backend (eQuilibrator sidecar, Simplex LP API, proevolAnalysis.ts, mockGECAIR.ts ODE functions) and display real results. Fallback to mock data when backend unavailable.

**Tech Stack:** TypeScript, React, Next.js API routes, Python sidecar (eQuilibrator)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/tools/CETHXPage.tsx` | Thermodynamics page — connect to eQuilibrator |
| `src/components/tools/FBASimPage.tsx` | FBA page — connect to Simplex LP API |
| `src/components/tools/ProEvolPage.tsx` | Protein evolution page — add CSV upload |
| `src/components/tools/GECAIRPage.tsx` | Gene circuit page — add Toggle Switch ODE |
| `src/data/mockGECAIR.ts` | Add Toggle Switch and Logic Cascade ODE functions |
| `__tests__/thermodynamics.test.ts` | Test eQuilibrator integration |
| `__tests__/communityFbaHonesty.test.ts` | Test FBA API integration |

---

## Task 1: CETHX ← eQuilibrator Integration

**Files:**
- Modify: `src/components/tools/CETHXPage.tsx:1-50`
- Test: `__tests__/thermodynamics.test.ts`

- [ ] **Step 1: Check current CETHX implementation**

Read `src/components/tools/CETHXPage.tsx` to understand current data flow:
```bash
grep -n "computeThermo\|mockCETHX\|deltaG" src/components/tools/CETHXPage.tsx | head -20
```

Expected: Find where hardcoded ΔG values are used.

- [ ] **Step 2: Check useEquilibrator hook**

Read `src/hooks/useEquilibrator.ts` to understand the API:
```bash
grep -n "export\|function\|return" src/hooks/useEquilibrator.ts | head -20
```

Expected: Find `useEquilibrator` hook that calls eQuilibrator sidecar.

- [ ] **Step 3: Add eQuilibrator import to CETHXPage**

In `src/components/tools/CETHXPage.tsx`, add import at top:
```typescript
import { useEquilibrator } from '../../hooks/useEquilibrator';
```

- [ ] **Step 4: Call eQuilibrator in component**

In `src/components/tools/CETHXPage.tsx`, add hook call:
```typescript
const { calculateDG, loading: eqLoading } = useEquilibrator();
```

- [ ] **Step 5: Replace hardcoded ΔG with eQuilibrator results**

Find where `deltaG` is displayed and add eQuilibrator call:
```typescript
// Before: const deltaG = step.deltaG; // hardcoded
// After:
const [realDeltaG, setRealDeltaG] = useState<number | null>(null);

useEffect(() => {
  if (step.reaction) {
    calculateDG(step.reaction, { pH: 7.0, temperature: 298.15 })
      .then(result => setRealDeltaG(result.dg_prime))
      .catch(() => setRealDeltaG(null)); // fallback to hardcoded
  }
}, [step.reaction]);

const displayDeltaG = realDeltaG ?? step.deltaG; // use real if available
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "cethx" | head -5
```

Expected: No errors.

- [ ] **Step 7: Run tests**

```bash
npx jest __tests__/thermodynamics.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/tools/CETHXPage.tsx
git commit -m "feat: connect CETHX to eQuilibrator for condition-aware ΔG'"
```

---

## Task 2: FBAsim ← Simplex LP Integration

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx:1-50`
- Test: `__tests__/communityFbaHonesty.test.ts`

- [ ] **Step 1: Check current FBASim implementation**

Read `src/components/tools/FBASimPage.tsx` to find where mock data is used:
```bash
grep -n "mockFBA\|computeFBA\|fluxes" src/components/tools/FBASimPage.tsx | head -20
```

Expected: Find where hardcoded fluxes are used.

- [ ] **Step 2: Check /api/fba endpoint**

Read `app/api/fba/route.ts` to understand the API:
```bash
grep -n "export\|POST\|GET" app/api/fba/route.ts | head -10
```

Expected: Find POST endpoint that calls Simplex LP solver.

- [ ] **Step 3: Add API call function**

In `src/components/tools/FBASimPage.tsx`, add fetch function:
```typescript
async function callFBA(params: {
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
}): Promise<FBAResult | null> {
  try {
    const res = await fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'single',
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: params.glucoseUptake,
        oxygenUptake: params.oxygenUptake,
        knockouts: params.knockouts,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add state for real FBA results**

In component, add state:
```typescript
const [realFBA, setRealFBA] = useState<FBAResult | null>(null);
const [fbaLoading, setFbaLoading] = useState(false);
```

- [ ] **Step 5: Call API when parameters change**

Add useEffect to call FBA:
```typescript
useEffect(() => {
  setFbaLoading(true);
  callFBA({
    glucoseUptake: params.glucoseUptake,
    oxygenUptake: params.oxygenUptake,
    knockouts: selectedKnockouts,
  }).then(result => {
    setRealFBA(result);
    setFbaLoading(false);
  });
}, [params.glucoseUptake, params.oxygenUptake, selectedKnockouts]);
```

- [ ] **Step 6: Display real fluxes when available**

Replace hardcoded flux display:
```typescript
// Before: const fluxes = mockFluxes;
// After:
const fluxes = realFBA?.fluxes ?? mockFluxes; // use real if available
const growthRate = realFBA?.growthRate ?? mockGrowthRate;
```

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "fbasim" | head -5
```

Expected: No errors.

- [ ] **Step 8: Run tests**

```bash
npx jest __tests__/communityFbaHonesty.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "feat: connect FBASim to Simplex LP solver for real flux analysis"
```

---

## Task 3: ProEvol ← CSV Upload Integration

**Files:**
- Modify: `src/components/tools/ProEvolPage.tsx:1-50`
- Test: `__tests__/proevolAnalysis.test.ts`

- [ ] **Step 1: Check current ProEvol implementation**

Read `src/components/tools/ProEvolPage.tsx` to understand current structure:
```bash
grep -n "campaign\|artifact\|analysis" src/components/tools/ProEvolPage.tsx | head -20
```

Expected: Find where synthetic data is used.

- [ ] **Step 2: Check proevolAnalysis.ts functions**

Read `src/services/proevolAnalysis.ts` to find available functions:
```bash
grep -n "export function" src/services/proevolAnalysis.ts
```

Expected: Find `shannonForReplicate`, `diversityCurve`, `selectionCoefficient`, etc.

- [ ] **Step 3: Add CSV upload state**

In `src/components/tools/ProEvolPage.tsx`, add state:
```typescript
const [csvData, setCsvData] = useState<CSVRow[] | null>(null);
const [uploadError, setUploadError] = useState<string | null>(null);
```

- [ ] **Step 4: Add CSV parser function**

Add parser:
```typescript
function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return {
      variant_id: values[0],
      round: parseInt(values[1]),
      replicate: parseInt(values[2]),
      read_count: parseInt(values[3]),
    };
  });
}
```

- [ ] **Step 5: Add file upload handler**

Add handler:
```typescript
const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setCsvData(data);
      setUploadError(null);
    } catch (err) {
      setUploadError('Invalid CSV format');
      setCsvData(null);
    }
  };
  reader.readAsText(file);
}, []);
```

- [ ] **Step 6: Add CSV upload UI**

Add upload component:
```typescript
<div style={{ marginBottom: '16px' }}>
  <label style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
    Upload CSV (variant_id, round, replicate, read_count)
  </label>
  <input
    type="file"
    accept=".csv"
    onChange={handleCSVUpload}
    style={{ display: 'block', marginTop: '8px' }}
  />
  {uploadError && <div style={{ color: '#FA8072', fontSize: '12px' }}>{uploadError}</div>}
</div>
```

- [ ] **Step 7: Call proevolAnalysis when CSV uploaded**

Add effect to analyze CSV data:
```typescript
const realAnalysis = useMemo(() => {
  if (!csvData) return null;

  // Group by variant
  const byVariant = new Map<string, CSVRow[]>();
  csvData.forEach(row => {
    const existing = byVariant.get(row.variant_id) || [];
    existing.push(row);
    byVariant.set(row.variant_id, existing);
  });

  // Calculate Shannon diversity
  const totalReads = csvData.reduce((sum, row) => sum + row.read_count, 0);
  const frequencies = Array.from(byVariant.entries()).map(([id, rows]) => ({
    id,
    frequency: rows.reduce((sum, r) => sum + r.read_count, 0) / totalReads,
  }));

  const shannon = -frequencies.reduce((sum, f) => {
    const p = f.frequency;
    return sum - p * Math.log2(Math.max(p, 1e-10));
  }, 0);

  return { shannon, frequencies, totalReads };
}, [csvData]);
```

- [ ] **Step 8: Display real analysis when available**

Replace synthetic display:
```typescript
// Before: const diversity = syntheticDiversity;
// After:
const diversity = realAnalysis ?? syntheticDiversity;
```

- [ ] **Step 9: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "proevol" | head -5
```

Expected: No errors.

- [ ] **Step 10: Run tests**

```bash
npx jest __tests__/proevolAnalysis.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/tools/ProEvolPage.tsx
git commit -m "feat: add CSV upload to ProEvol for real experimental data analysis"
```

---

## Task 4: GECAIR ← Toggle Switch ODE

**Files:**
- Modify: `src/data/mockGECAIR.ts:150-200`
- Modify: `src/components/tools/GECAIRPage.tsx:6-10`

- [ ] **Step 1: Check current GECAIR ODE implementation**

Read `src/data/mockGECAIR.ts` to find Repressilator ODE:
```bash
grep -n "runRepressilator\|RepressilatorState" src/data/mockGECAIR.ts | head -10
```

Expected: Find existing Repressilator ODE function.

- [ ] **Step 2: Add Toggle Switch ODE function**

In `src/data/mockGECAIR.ts`, add after Repressilator code:
```typescript
// Toggle Switch ODE dynamics (Gardner et al., 2000, Nature)
// 2-variable system: 2 mRNA + 2 protein
export interface ToggleSwitchState {
  mA: number;  // mRNA A
  mB: number;  // mRNA B
  pA: number;  // Protein A
  pB: number;  // Protein B
}

export function runToggleSwitch(
  params: RepressilatorParams = DEFAULT_REPRESSILATOR_PARAMS,
  duration: number = 300,
  dt: number = 0.5,
): ToggleSwitchState[] {
  const { alpha, alpha0, beta, gamma, n, K } = params;

  // Initial conditions: asymmetric to show switching behavior
  let state: ToggleSwitchState = { mA: 20, mB: 5, pA: 200, pB: 50 };
  const trajectory: ToggleSwitchState[] = [{ ...state }];

  const derivatives = (s: ToggleSwitchState): ToggleSwitchState => ({
    mA: alpha0 + alpha * hillInhibition(s.pB, K, n) - s.mA,
    mB: alpha0 + alpha * hillInhibition(s.pA, K, n) - s.mB,
    pA: beta * s.mA - gamma * s.pA,
    pB: beta * s.mB - gamma * s.pB,
  });

  const addStates = (a: ToggleSwitchState, b: ToggleSwitchState, scale: number): ToggleSwitchState => ({
    mA: a.mA + b.mA * scale,
    mB: a.mB + b.mB * scale,
    pA: a.pA + b.pA * scale,
    pB: a.pB + b.pB * scale,
  });

  const steps = Math.floor(duration / dt);
  for (let t = 0; t < steps; t++) {
    const k1 = derivatives(state);
    const s2 = addStates(state, k1, dt / 2);
    const k2 = derivatives(s2);
    const s3 = addStates(state, k2, dt / 2);
    const k3 = derivatives(s3);
    const s4 = addStates(state, k3, dt);
    const k4 = derivatives(s4);

    state = {
      mA: Math.max(0, state.mA + (dt / 6) * (k1.mA + 2 * k2.mA + 2 * k3.mA + k4.mA)),
      mB: Math.max(0, state.mB + (dt / 6) * (k1.mB + 2 * k2.mB + 2 * k3.mB + k4.mB)),
      pA: Math.max(0, state.pA + (dt / 6) * (k1.pA + 2 * k2.pA + 2 * k3.pA + k4.pA)),
      pB: Math.max(0, state.pB + (dt / 6) * (k1.pB + 2 * k2.pB + 2 * k3.pB + k4.pB)),
    };

    trajectory.push({ ...state });
  }

  return trajectory;
}
```

- [ ] **Step 3: Add circuit type selector state**

In `src/components/tools/GECAIRPage.tsx`, add state:
```typescript
const [circuitType, setCircuitType] = useState<'repressilator' | 'toggle'>('repressilator');
```

- [ ] **Step 4: Import Toggle Switch function**

In `src/components/tools/GECAIRPage.tsx`, update import:
```typescript
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation, runRepressilator, runToggleSwitch } from '../../data/mockGECAIR';
import type { GateType, RepressilatorState, ToggleSwitchState } from '../../data/mockGECAIR';
```

- [ ] **Step 5: Add circuit type selector UI**

Add selector before the ODE visualization:
```typescript
<div style={{ marginBottom: '12px' }}>
  <label style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.paperLabel }}>
    Circuit Type
  </label>
  <select
    value={circuitType}
    onChange={(e) => setCircuitType(e.target.value as 'repressilator' | 'toggle')}
    style={{ marginLeft: '8px', padding: '4px 8px', background: '#1a1a2e', color: '#C8D8E8', border: '1px solid #333' }}
  >
    <option value="repressilator">Repressilator (Oscillator)</option>
    <option value="toggle">Toggle Switch (Bistable)</option>
  </select>
</div>
```

- [ ] **Step 6: Update ODE visualization to use selected circuit**

Replace the existing ODE visualization:
```typescript
{(() => {
  const trajectory = circuitType === 'repressilator'
    ? runRepressilator(undefined, 300, 1.0)
    : runToggleSwitch(undefined, 300, 1.0);

  const maxP = circuitType === 'repressilator'
    ? Math.max(...(trajectory as RepressilatorState[]).flatMap(s => [s.pA, s.pB, s.pC]))
    : Math.max(...(trajectory as ToggleSwitchState[]).flatMap(s => [s.pA, s.pB]));

  const w = 240, h = 60;
  const toPath = (key: string) => {
    const pts = trajectory.map((s, i) => {
      const val = (s as Record<string, number>)[key];
      return `${(i / trajectory.length) * w},${h - (val / maxP) * h}`;
    });
    return `M${pts.join(' L')}`;
  };

  return (
    <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${PATHD_THEME.paperBorder}`, background: PATHD_THEME.paperSurfaceStrong }}>
      <div style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {circuitType === 'repressilator' ? 'Repressilator' : 'Toggle Switch'} Dynamics (RK4 ODE)
      </div>
      <svg width={w} height={h} style={{ display: 'block', width: '100%' }}>
        <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={1.5} />
        <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={1.5} />
        {circuitType === 'repressilator' && <path d={toPath('pC')} fill="none" stroke="#DDD0E8" strokeWidth={1.5} />}
      </svg>
      <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontFamily: T.MONO, fontSize: '10px' }}>
        <span style={{ color: '#C8D8E8' }}>■ {circuitType === 'repressilator' ? 'LacI' : 'A'}</span>
        <span style={{ color: '#C8E0D0' }}>■ {circuitType === 'repressilator' ? 'TetR' : 'B'}</span>
        {circuitType === 'repressilator' && <span style={{ color: '#DDD0E8' }}>■ cI</span>}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -i "gecair" | head -5
```

Expected: No errors.

- [ ] **Step 8: Run tests**

```bash
npx jest __tests__/communityFbaHonesty.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/data/mockGECAIR.ts src/components/tools/GECAIRPage.tsx
git commit -m "feat: add Toggle Switch ODE model to GECAIR"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: All 1575 tests pass.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: connect all real algorithms to UI (CETHX, FBASim, ProEvol, GECAIR)"
```

---

## Summary

| Task | Tool | Connection | Time Est. |
|------|------|------------|-----------|
| 1 | CETHX | eQuilibrator sidecar | 30 min |
| 2 | FBASim | Simplex LP API | 1 hour |
| 3 | ProEvol | CSV upload + proevolAnalysis | 1 hour |
| 4 | GECAIR | Toggle Switch ODE | 30 min |
| 5 | Verification | Full test suite | 15 min |

**Total: ~3.25 hours**

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-10-connect-real-algorithms.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
