/**
 * Markdown Report Renderer
 *
 * Renders a {@link ReportData} object into a complete Markdown document
 * with metadata header, per-tool sections, tables, and provenance blockquotes.
 *
 * @module src/services/report/markdownRenderer
 */

import type { ReportData, ReportSection } from './reportCollector';

// ── Table Renderer ────────────────────────────────────────────

/**
 * Render a single table in Markdown format.
 *
 * @param tableIndex - 1-based table number within the section
 * @param caption    - Human-readable caption
 * @param headers    - Column headers
 * @param rows       - Data rows (array of string arrays)
 */
function renderTable(
  tableIndex: number,
  caption: string,
  headers: string[],
  rows: string[][],
): string {
  const lines: string[] = [];

  // Caption
  lines.push(`**Table ${tableIndex}: ${caption}**`);
  lines.push('');

  // Header row
  lines.push(`| ${headers.join(' | ')} |`);

  // Separator row
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  // Data rows
  for (const row of rows) {
    lines.push(`| ${row.join(' | ')} |`);
  }

  lines.push('');
  return lines.join('\n');
}

// ── Provenance Renderer ───────────────────────────────────────

/**
 * Render provenance metadata as a Markdown blockquote.
 */
function renderProvenance(provenance: {
  source: string;
  validityTier: string;
  assumptions: string[];
}): string {
  const lines: string[] = [];
  lines.push(`> **Data source:** ${provenance.source}`);
  lines.push(`> **Validity tier:** ${provenance.validityTier}`);
  lines.push(
    `> **Assumptions:** ${provenance.assumptions.length > 0 ? provenance.assumptions.join('; ') : ''}`,
  );
  lines.push('');
  return lines.join('\n');
}

// ── Section Renderer ──────────────────────────────────────────

/**
 * Render a single report section: title, content, tables, and provenance.
 */
function renderSection(section: ReportSection): string {
  const parts: string[] = [];

  // Section heading
  parts.push(`## ${section.title}`);
  parts.push('');

  // Content text
  if (section.content) {
    parts.push(section.content);
    parts.push('');
  }

  // Tables
  section.tables.forEach((table, idx) => {
    parts.push(renderTable(idx + 1, table.caption, table.headers, table.rows));
  });

  // Provenance
  parts.push(renderProvenance(section.provenance));

  return parts.join('\n');
}

// ── Public API ────────────────────────────────────────────────

/**
 * Render a {@link ReportData} object into a complete Markdown document.
 *
 * Structure:
 * 1. H1 header with project title
 * 2. Metadata line (generated date, target product)
 * 3. Summary section (if present)
 * 4. Per-tool sections with tables and provenance blockquotes
 *
 * @param report - The structured report data to render
 * @returns Complete Markdown string
 */
export function renderMarkdown(report: ReportData): string {
  const parts: string[] = [];

  // ── Header ──
  parts.push(`# ${report.metadata.projectTitle}`);
  parts.push('');
  parts.push(
    `**Generated:** ${report.metadata.generatedAt} | **Target:** ${report.metadata.targetProduct}`,
  );
  parts.push('');

  // ── Summary ──
  if (report.summary) {
    parts.push(report.summary);
    parts.push('');
  }

  // ── Sections ──
  for (const section of report.sections) {
    parts.push(renderSection(section));
  }

  return parts.join('\n');
}
