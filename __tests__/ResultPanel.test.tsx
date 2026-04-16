/**
 * ResultPanel render tests (PR-2a).
 *
 * Three scenarios, one per audit contract mode:
 *   1. clean structured answer  → ResearchAnswerRenderer output, no banner
 *   2. meta.parseError=INVALID_SYNTAX → malformed banner + raw fallback pre
 *   3. plain prose (NO_OBJECT)  → no banner, answer rendered
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ResultPanel from '../src/components/tools/nexai/ResultPanel';
import type { NEXAIResult } from '../src/types';

function citations() {
  return [
    {
      id: 'c1',
      title: 'Amorphadiene synthase engineering',
      authors: 'Ro et al.',
      year: 2006,
      relevance: 0.9,
      x: 120,
      y: 180,
    },
  ];
}

function baseResult(answer: string): NEXAIResult {
  return {
    query: 'What should we run next?',
    answer,
    citations: citations(),
    confidence: 0.82,
    generatedAt: Date.now(),
  };
}

describe('ResultPanel', () => {
  it('renders structured sections for a clean enriched answer', () => {
    const answer = [
      'Summary: the amorphadiene branch is rate-limiting because flux through ADS is capped at 42%.',
      '',
      'Key observations: ADS turnover number is low; upstream FPP pool appears sufficient.',
      '',
      'Recommended next steps: run ProEvol on ADS and then rerun FBA to confirm the lifted ceiling.',
    ].join('\n');

    render(
      <ResultPanel result={baseResult(answer)} parseError={null} rawText={null} />,
    );

    expect(screen.getByTestId('nexai-result-panel')).toBeTruthy();
    expect(screen.queryByTestId('nexai-parse-error-banner')).toBeNull();
    expect(screen.queryByTestId('nexai-result-raw-fallback')).toBeNull();
    expect(screen.queryByTestId('nexai-result-ungrounded-note')).toBeNull();
    // At least one "Summary" occurrence — the section heading, independent
    // of whether the prose also includes the word.
    expect(screen.getAllByText(/Summary/i).length).toBeGreaterThan(0);
  });

  it('shows malformed banner and raw fallback when backend reports INVALID_SYNTAX', () => {
    const result = baseResult('partial broken envelope text');
    render(
      <ResultPanel
        result={result}
        rawText={'{"nodes":[{"id":"a"'}
        parseError={{ code: 'INVALID_SYNTAX', message: 'Unexpected end of JSON input' }}
      />,
    );

    expect(screen.getByTestId('nexai-result-panel')).toBeTruthy();
    expect(screen.getByTestId('nexai-parse-error-banner')).toBeTruthy();
    const pre = screen.getByTestId('nexai-result-raw-fallback');
    expect(pre.textContent).toContain('{"nodes":[{"id":"a"');
    // raw fallback chip must surface in the header strip
    expect(screen.getByText(/raw fallback/i)).toBeTruthy();
  });

  it('renders prose as structured answer when parseError is NO_OBJECT (benign)', () => {
    const proseAnswer =
      'The thermodynamic risk lives in the ADS step: its ΔG is near zero under cytosolic conditions, so any downstream pull can stall the pathway.';
    render(
      <ResultPanel
        result={baseResult(proseAnswer)}
        rawText={proseAnswer}
        parseError={{ code: 'NO_OBJECT', message: 'Model answered in prose' }}
      />,
    );

    expect(screen.getByTestId('nexai-result-panel')).toBeTruthy();
    // NO_OBJECT is benign — no parse-error banner, no raw fallback pre
    expect(screen.queryByTestId('nexai-parse-error-banner')).toBeNull();
    expect(screen.queryByTestId('nexai-result-raw-fallback')).toBeNull();
    expect(
      screen.getByText(/thermodynamic risk lives in the ADS step/i),
    ).toBeTruthy();
  });

  it('renders apiError banner and suppresses the panel entirely', () => {
    render(
      <ResultPanel result={null} apiError="Axon provider down after 4 retries" />,
    );
    expect(screen.getByTestId('nexai-result-api-error')).toBeTruthy();
    expect(screen.queryByTestId('nexai-result-panel')).toBeNull();
    expect(screen.getByText(/Axon provider down/i)).toBeTruthy();
  });

  it('renders idle state when there is no result and no error', () => {
    render(<ResultPanel result={null} />);
    expect(screen.getByTestId('nexai-result-idle')).toBeTruthy();
  });
});
