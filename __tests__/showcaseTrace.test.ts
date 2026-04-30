import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TrustShowcaseSummary } from '../src/components/reports/TrustShowcaseSummary';
import { evaluateClaimSurfacePolicy } from '../src/services/trustPolicyEngine';
import type { BlockedShowcaseTrace, ShowcaseTrace, ShowcaseTraceStep } from '../src/types/showcaseTrace';
import {
  parseShowcaseTraceDocument,
  showcaseSteps,
  validateShowcaseTraceDocument,
} from '../src/validation/showcaseTraceValidator';

const repoRoot = path.resolve(__dirname, '..');
const safePath = path.join(repoRoot, 'examples', 'showcase', 'safe-pathway.json');
const blockedPath = path.join(repoRoot, 'examples', 'showcase', 'blocked-cethx-claim.json');

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function loadSafeTrace(): ShowcaseTrace {
  const parsed = parseShowcaseTraceDocument(readJson(safePath));
  if (!('steps' in parsed)) throw new Error('safe-pathway.json did not parse as ShowcaseTrace');
  return parsed;
}

function loadBlockedTrace(): BlockedShowcaseTrace {
  const parsed = parseShowcaseTraceDocument(readJson(blockedPath));
  if (!('blockedStep' in parsed)) throw new Error('blocked-cethx-claim.json did not parse as BlockedShowcaseTrace');
  return parsed;
}

function evaluateStep(step: ShowcaseTraceStep) {
  return evaluateClaimSurfacePolicy({
    toolId: step.toolId,
    surface: step.surface,
    validityTier: step.validityTier,
    isDraft: false,
    provenanceIds: step.provenanceIds,
    evidenceIds: step.evidenceIds,
    assumptionIds: step.assumptionIds,
  });
}

function documentText(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

const forbiddenPositiveClaims = [
  `wet-lab ${'validated'}`,
  `validated biological ${'design'}`,
  `scientifically ${'validated'}`,
  `optimized ${'artemisinin'}`,
  `improved pathway ${'yield'}`,
  `real wet-lab ${'result'}`,
  `full sbol ${'compliance'}`,
];

describe('Step 16 showcase traces', () => {
  it('keeps the showcase example files present and structurally valid', () => {
    expect(fs.existsSync(safePath)).toBe(true);
    expect(fs.existsSync(blockedPath)).toBe(true);

    for (const filePath of [safePath, blockedPath]) {
      const validation = validateShowcaseTraceDocument(readJson(filePath));
      expect(validation.issues).toEqual([]);
      expect(validation.ok).toBe(true);
    }
  });

  it('shows a safe partial path with provenance and policy-engine ok decisions', () => {
    const safeTrace = loadSafeTrace();
    expect(safeTrace.showcaseId).toBe('nexus-safe-pathway-v1');
    expect(safeTrace.steps.length).toBeGreaterThan(0);
    expect(safeTrace.nonClaims.length).toBeGreaterThan(0);
    expect(safeTrace.steps.some((step) => step.provenanceIds.length > 0)).toBe(true);

    for (const step of safeTrace.steps) {
      const decision = evaluateStep(step);
      expect(decision.status).toBe(step.expectedGateStatus);
      expect(decision.blockCode).toBe(step.expectedBlockCode);
    }
  });

  it('blocks the CETHX demo trace from a formal protocol surface', () => {
    const blockedTrace = loadBlockedTrace();
    const step = blockedTrace.blockedStep;
    const decision = evaluateStep(step);

    expect(step.toolId).toBe('cethx');
    expect(step.validityTier).toBe('demo');
    expect(step.surface).toBe('protocol');
    expect(step.surface).not.toBe('payload');
    expect(step.expectedGateStatus).not.toBe('ok');
    expect(step.expectedBlockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(decision.status).toBe(step.expectedGateStatus);
    expect(decision.blockCode).toBe(step.expectedBlockCode);
  });

  it('keeps example IDs and claims honest', () => {
    for (const document of [loadSafeTrace(), loadBlockedTrace()]) {
      const text = documentText(document);
      for (const forbidden of forbiddenPositiveClaims) {
        expect(text).not.toContain(forbidden);
      }
      expect(text).not.toContain('"doi"');
      expect(document.nonClaims.length).toBeGreaterThan(0);
      for (const step of showcaseSteps(document)) {
        for (const id of [...step.evidenceIds, ...step.provenanceIds]) {
          expect(id.startsWith('demo-')).toBe(true);
        }
      }
    }
  });

  it('renders the static showcase summary with safe and blocked paths', () => {
    render(React.createElement(TrustShowcaseSummary, {
      safeTrace: loadSafeTrace(),
      blockedTrace: loadBlockedTrace(),
    }));

    expect(screen.getByText('A Narrow Trust-Gated Pathway Trace')).toBeTruthy();
    expect(screen.getByText('Safe Path')).toBeTruthy();
    expect(screen.getByText('Blocked Path')).toBeTruthy();
    expect(screen.getByText(/DEMO_OUTPUT_PROTOCOL_BLOCKED/)).toBeTruthy();
    expect(screen.getByText(/Not wet-lab validation/)).toBeTruthy();
    expect(screen.getByText(/Demo output cannot become a formal protocol claim/)).toBeTruthy();
  });
});
