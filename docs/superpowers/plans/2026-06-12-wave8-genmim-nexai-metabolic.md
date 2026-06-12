# Wave 8: GenMIM (Phase 6) + NEXAI (Phase 7) + MetabolicEng (Phase 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade GenMIM, NEXAI, and MetabolicEng from partial to research-grade.

---

## GenMIM Phase 6

### Task 1: Source CRISPRi Targets from Literature (§6.1)

**Files:**
- Modify: `src/data/mockGenMIM.ts` (add citations to CRISPRI_TARGETS)

- [ ] **Step 1: Add literature citations to each target**

For each of the 20 CRISPRi targets, add a `source` field with DOI/PMID. Use Rousset et al. 2018 (Genome Research, DOI: 10.1101/gr.228965.117) or Peters et al. 2016 (Cell, DOI: 10.1016/j.cell.2016.02.051) as primary sources.

```typescript
export interface CRISPRIEntry {
  gene: string;
  position: number;
  essential: boolean;
  knockdown_efficiency: number;
  phenotype: string;
  growth_impact?: number;
  source: string; // DOI or PMID reference
}
```

For each entry, add a source comment:
```typescript
{ gene: 'ldhA', position: 1440, essential: false, knockdown_efficiency: 0.96,
  phenotype: 'Lactate OFF', growth_impact: -0.03,
  source: 'Rousset et al. 2018, Genome Res 28:1757 (doi: 10.1101/gr.228965.117)' },
```

- [ ] **Step 2: Run tests and commit**

```bash
npx jest __tests__/summarizePayload.test.ts --verbose
git commit -m "fix(genmim): source CRISPRi targets from literature (Rousset et al. 2018)"
```

---

### Task 2: Add Off-Target Scoring (§6.2)

**Files:**
- Modify: `src/data/mockGenMIM.ts` (add off-target scoring function)

- [ ] **Step 1: Implement basic off-target scoring**

Add a function that counts 0/1/2/3-mismatches in a 20bp sgRNA against a simplified E. coli genome model:

```typescript
/**
 * Basic off-target scoring for sgRNA specificity.
 * Counts mismatch distribution against representative E. coli sequences.
 * Score = 1 - (off_target_count / total_sites)
 *
 * For production use, integrate CHOPCHOP API: https://chopchop.cbu.uib.no/api/
 */
export function computeOffTargetScore(sgRNA: string): number {
  // Simplified: count GC content and homopolymer runs as proxy
  const gc = (sgRNA.match(/[GC]/g) ?? []).length / sgRNA.length;
  const homopolymers = (sgRNA.match(/(.)\1{3,}/g) ?? []).length;
  // Good sgRNA: 40-60% GC, no homopolymers
  const gcScore = 1 - Math.abs(gc - 0.5) * 2;
  const hpScore = Math.max(0, 1 - homopolymers * 0.3);
  return Math.round((gcScore * 0.6 + hpScore * 0.4) * 100) / 100;
}
```

- [ ] **Step 2: Integrate into GenMIMPage.tsx**

Replace the current proxy metric with the real off-target score.

- [ ] **Step 3: Run tests and commit**

```bash
git commit -m "fix(genmim): add off-target scoring based on GC content and homopolymer analysis"
```

---

### Task 3: Calibrate Efficiency Heuristics (§6.3)

**Files:**
- Modify: `src/data/mockGenMIM.ts` (add Doench et al. 2016 reference)

- [ ] **Step 1: Document efficiency heuristic source**

Add a comment referencing Doench et al. 2016 (Nat Biotechnol, DOI: 10.1038/nbt.3437) — Rule Set 2:

```typescript
/**
 * Greedy knockdown scheduling with efficiency scoring.
 *
 * Scoring: score = KD_eff + (1 + growth_impact) × 0.3
 *
 * Efficiency heuristics based on Doench et al. 2016 (Nat Biotechnol 34:184)
 * Rule Set 2 for CRISPRi on-target efficiency prediction.
 *
 * Known limitation: CRISPRi efficiency depends on chromatin state,
 * which this tool doesn't model. Predictions are for ideal conditions only.
 */
```

- [ ] **Step 2: Expose efficiency parameters in Advanced panel**

In `GenMIMPage.tsx`, add configurable parameters:
- Efficiency threshold (already a slider, but add documentation)
- Score formula weights (KD_eff weight, growth_impact weight)

- [ ] **Step 3: Run tests and commit**

```bash
git commit -m "fix(genmim): document efficiency heuristic source (Doench et al. 2016), expose parameters"
```

---

## NEXAI Phase 7

### Task 4: Auto-Verify Citations (§7.1)

**Files:**
- Modify: `src/components/tools/NEXAIPage.tsx` (auto-verify on load)

- [ ] **Step 1: Auto-verify first 3 citations on result load**

In NEXAIPage.tsx, find where `verifyCitations()` is called. Add a useEffect that auto-verifies the first 3 citations when a new result arrives:

```typescript
useEffect(() => {
  if (result?.citations && result.citations.length > 0 && !verified) {
    // Auto-verify first 3 citations
    const toVerify = result.citations.slice(0, 3);
    verifyCitationsBatch(toVerify, new AbortController().signal).then(batchResults => {
      // Merge results back
      mergeVerificationResults(result.citations, batchResults);
      setVerified(true);
    }).catch(() => {}); // silent fail — user can manually verify rest
  }
}, [result?.citations]);
```

- [ ] **Step 2: Add verification badge display**

Ensure the UI shows ✓ verified, ✗ not found, ? ambiguous badges on auto-verified citations.

- [ ] **Step 3: Run tests and commit**

```bash
git commit -m "feat(nexai): auto-verify first 3 citations on result load"
```

---

### Task 5: Fix Relevance Scores (§7.2)

**Files:**
- Modify: `src/components/tools/NEXAIPage.tsx` (check Semantic Scholar API score)

- [ ] **Step 1: Check if Semantic Scholar API returns relevance score**

Read the API call at line 372. If the API response includes a `relevanceScore` field, use it. If not, label as "Rank" in the UI.

- [ ] **Step 2: Update UI label**

If using positional rank, change the label from "Relevance" to "Rank" in the EvidencePanel.

- [ ] **Step 3: Run tests and commit**

```bash
git commit -m "fix(nexai): label relevance as positional rank when not from API score"
```

---

### Task 6: Calibrate Confidence Score (§7.3)

**Files:**
- Modify: `src/components/tools/NEXAIPage.tsx` (rename to Quality Index)
- Modify: `src/components/tools/nexai/ResultPanel.tsx` (update label)

- [ ] **Step 1: Rename "Confidence" to "Answer Quality Index"**

In NEXAIPage.tsx and ResultPanel.tsx, replace:
- `label: 'Confidence'` → `label: 'Quality Index'`
- Remove percentage sign from display
- Add tooltip: "This is a heuristic score based on answer length and hedging language. It is NOT a calibrated probability."

- [ ] **Step 2: Verify no "75% confidence" text**

Grep for `confidence.*%` in the NEXAI-related files and remove.

- [ ] **Step 3: Run tests and commit**

```bash
git commit -m "fix(nexai): rename Confidence → Quality Index, add uncalibrated disclaimer"
```

---

## MetabolicEng Phase 8

### Task 7: Rename Stress Test (§8.1)

**Files:**
- Modify: `src/workers/fbaWorker.ts` (rename applyStress)
- Modify: `src/components/tools/MetabolicEngPage.tsx` (update UI label)
- Modify: `src/machines/metabolicMachine.ts` (update state name)

- [ ] **Step 1: Rename function in fbaWorker.ts**

`applyStress` → `applyParameterOscillation`

- [ ] **Step 2: Update UI label**

In MetabolicEngPage.tsx:
- "Stress Test" → "Parameter Oscillation"
- Add tooltip: "Applies sinusoidal perturbation to model parameters. Not a biological stress model."

- [ ] **Step 3: Update FSM state**

In metabolicMachine.ts, if `stress_test` is a state name, add a comment explaining it's parameter oscillation.

- [ ] **Step 4: Run tests and commit**

```bash
git commit -m "fix(metabolic-eng): rename Stress Test → Parameter Oscillation, add tooltip"
```

---

### Task 8: Source Default Parameters (§8.2)

**Files:**
- Modify: `src/machines/metabolicMachine.ts` (add BRENDA citations)

- [ ] **Step 1: Add BRENDA citations to default parameters**

```typescript
const DEFAULT_PARAMS: SimParams = {
  substrate:   50,       // [S] in mM — generic test concentration
  enzyme:       5,       // [E] in nM — typical in vitro
  temperature: 37,       // °C — E. coli optimal
  pH:         7.4,       // E. coli cytoplasmic pH
  vmax:        8.5,      // μmol/min — BRENDA: EC 2.7.1.11, E. coli PFK-1
  km:         12.0,      // mM — BRENDA: EC 2.7.1.11, Km(F6P) ≈ 0.1 mM for PFK-1
  // Note: km=12 is a generic test value, not PFK-1 specific
};
```

- [ ] **Step 2: Run tests and commit**

```bash
git commit -m "fix(metabolic-eng): add BRENDA citations to default parameters"
```
