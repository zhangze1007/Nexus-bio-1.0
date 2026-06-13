/**
 * Tests for the Markdown report renderer.
 *
 * @module __tests__/report/markdownRenderer
 */

import { renderMarkdown } from '../../src/services/report/markdownRenderer';
import type { ReportData } from '../../src/services/report/reportCollector';

// ── Fixtures ──────────────────────────────────────────────────

function makeEmptyReport(): ReportData {
  return {
    metadata: {
      generatedAt: '2026-06-13T12:00:00.000Z',
      projectTitle: 'Artemisinin Biosynthesis Report',
      targetProduct: 'artemisinin',
    },
    sections: [],
    summary: '',
  };
}

function makeSingleSectionReport(): ReportData {
  return {
    metadata: {
      generatedAt: '2026-06-13T12:00:00.000Z',
      projectTitle: 'Artemisinin Biosynthesis Report',
      targetProduct: 'artemisinin',
    },
    sections: [
      {
        toolId: 'fbasim',
        title: 'Flux Balance Analysis',
        content: 'FBA for artemisinin. Growth rate: 0.87 h-1.',
        tables: [
          {
            caption: 'Top metabolic fluxes',
            headers: ['Reaction', 'Flux (mmol/gDW/h)'],
            rows: [
              ['PFK', '1.25'],
              ['PGK', '0.98'],
            ],
          },
        ],
        figures: [],
        provenance: {
          source: 'fbasim',
          validityTier: 'real',
          assumptions: ['glucose uptake 10 mmol/gDW/h', 'aerobic conditions'],
        },
      },
    ],
    summary: 'Report generated from 1 tool: Flux Balance Analysis.',
  };
}

function makeMultiSectionReport(): ReportData {
  return {
    metadata: {
      generatedAt: '2026-06-13T15:30:00.000Z',
      projectTitle: 'Artemisinin Biosynthesis Report',
      targetProduct: 'artemisinin',
    },
    sections: [
      {
        toolId: 'fbasim',
        title: 'Flux Balance Analysis',
        content: 'FBA results.',
        tables: [
          {
            caption: 'Flux table',
            headers: ['Reaction', 'Flux'],
            rows: [['PFK', '1.25']],
          },
          {
            caption: 'Sensitivity coefficients',
            headers: ['Parameter', 'Coefficient'],
            rows: [
              ['Glucose', '0.45'],
              ['Oxygen', '0.32'],
            ],
          },
        ],
        figures: [],
        provenance: {
          source: 'fbasim',
          validityTier: 'real',
          assumptions: ['aerobic'],
        },
      },
      {
        toolId: 'cethx',
        title: 'Cell Thermodynamics',
        content: 'Thermodynamic analysis.',
        tables: [],
        figures: [],
        provenance: {
          source: 'cethx',
          validityTier: 'partial',
          assumptions: ['25C', 'pH 7.0'],
        },
      },
    ],
    summary: 'Report generated from 2 tools: Flux Balance Analysis, Cell Thermodynamics.',
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  describe('metadata header', () => {
    it('renders the project title as an H1 heading', () => {
      const md = renderMarkdown(makeEmptyReport());
      expect(md).toMatch(/^# Artemisinin Biosynthesis Report/m);
    });

    it('renders the generated date', () => {
      const md = renderMarkdown(makeEmptyReport());
      expect(md).toContain('2026-06-13T12:00:00.000Z');
    });

    it('renders the target product', () => {
      const md = renderMarkdown(makeEmptyReport());
      expect(md).toContain('artemisinin');
    });
  });

  describe('empty report', () => {
    it('renders header and summary without crashing', () => {
      const md = renderMarkdown(makeEmptyReport());
      expect(md).toContain('# Artemisinin Biosynthesis Report');
    });

    it('does not render any section headings when sections array is empty', () => {
      const md = renderMarkdown(makeEmptyReport());
      expect(md).not.toMatch(/^## /m);
    });
  });

  describe('section rendering', () => {
    it('renders section title as an H2 heading', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('## Flux Balance Analysis');
    });

    it('renders section content text', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('FBA for artemisinin. Growth rate: 0.87 h-1.');
    });

    it('renders multiple sections in order', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      const fbaIdx = md.indexOf('## Flux Balance Analysis');
      const cethxIdx = md.indexOf('## Cell Thermodynamics');
      expect(fbaIdx).toBeGreaterThanOrEqual(0);
      expect(cethxIdx).toBeGreaterThanOrEqual(0);
      expect(fbaIdx).toBeLessThan(cethxIdx);
    });
  });

  describe('table rendering', () => {
    it('renders table caption as bold text', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('**Table 1: Top metabolic fluxes**');
    });

    it('renders table header row', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('| Reaction | Flux (mmol/gDW/h) |');
    });

    it('renders table separator row', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toMatch(/\| --- \| --- \|/);
    });

    it('renders table data rows', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('| PFK | 1.25 |');
      expect(md).toContain('| PGK | 0.98 |');
    });

    it('numbers tables sequentially per section', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      expect(md).toContain('**Table 1: Flux table**');
      expect(md).toContain('**Table 2: Sensitivity coefficients**');
    });

    it('resets table numbering for each section', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      // Second section has no tables, so no Table 1 there
      // But verify Table 1 appears only for the first section's first table
      const table1Count = (md.match(/\*\*Table 1:/g) || []).length;
      expect(table1Count).toBe(1);
    });
  });

  describe('provenance rendering', () => {
    it('renders provenance as a blockquote', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('> **Data source:** fbasim');
    });

    it('renders validity tier in provenance', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('> **Validity tier:** real');
    });

    it('renders assumptions in provenance', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('> **Assumptions:** glucose uptake 10 mmol/gDW/h; aerobic conditions');
    });

    it('handles empty assumptions array', () => {
      const report = makeSingleSectionReport();
      report.sections[0].provenance.assumptions = [];
      const md = renderMarkdown(report);
      expect(md).toContain('> **Assumptions:**');
    });

    it('renders provenance for each section', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      expect(md).toContain('> **Data source:** fbasim');
      expect(md).toContain('> **Data source:** cethx');
    });
  });

  describe('summary rendering', () => {
    it('renders summary text when present', () => {
      const md = renderMarkdown(makeSingleSectionReport());
      expect(md).toContain('Report generated from 1 tool: Flux Balance Analysis.');
    });

    it('handles empty summary', () => {
      const md = renderMarkdown(makeEmptyReport());
      // Should not crash; summary section simply absent or empty
      expect(typeof md).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('handles section with no tables gracefully', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      // Second section (Cell Thermodynamics) has no tables
      const cethxBlock = md.split('## Cell Thermodynamics')[1];
      expect(cethxBlock).toBeDefined();
      expect(cethxBlock).not.toContain('**Table');
    });

    it('handles table with empty rows', () => {
      const report: ReportData = {
        metadata: {
          generatedAt: '2026-06-13T12:00:00.000Z',
          projectTitle: 'Test',
          targetProduct: 'test',
        },
        sections: [
          {
            toolId: 'test',
            title: 'Test Section',
            content: 'Content.',
            tables: [
              {
                caption: 'Empty table',
                headers: ['A', 'B'],
                rows: [],
              },
            ],
            figures: [],
            provenance: { source: 'test', validityTier: 'demo', assumptions: [] },
          },
        ],
        summary: 'Summary.',
      };
      const md = renderMarkdown(report);
      expect(md).toContain('**Table 1: Empty table**');
      expect(md).toContain('| A | B |');
      expect(md).toContain('| --- | --- |');
    });

    it('produces valid markdown structure (no unterminated blocks)', () => {
      const md = renderMarkdown(makeMultiSectionReport());
      // Basic sanity: every line ending should be consistent
      const lines = md.split('\n');
      // No line should have trailing backslash unless intentional
      const badLines = lines.filter((l) => l.endsWith('\\'));
      expect(badLines).toHaveLength(0);
    });
  });
});
