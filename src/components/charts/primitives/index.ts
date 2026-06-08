/**
 * Public entry for Nexus-Bio reusable chart primitives.
 *
 * Kept intentionally narrow. Primitives here are the canonical way to render
 * a bar-with-error-bar or a line-with-confidence-band in Phase 1 upgraded
 * charts. Do not add primitives speculatively — each entry should have at
 * least one real caller.
 */

export { default as ErrorBarChart } from './ErrorBarChart';
export type { ErrorBarDatum, ErrorBarChartProps } from './ErrorBarChart';

export { default as ConfidenceLineChart } from './ConfidenceLineChart';
export type {
  ConfidenceLineChartProps,
  ConfidenceSeries,
  ConfidenceSeriesPoint,
} from './ConfidenceLineChart';

export { default as SVGChartContainer } from './SVGChartContainer';
export type { SVGChartContainerProps } from './SVGChartContainer';

export { default as ChartGrid } from './ChartGrid';
export type { ChartGridProps } from './ChartGrid';

export { default as ChartAxisLabels } from './ChartAxisLabels';
export type { ChartAxisLabelsProps } from './ChartAxisLabels';

export { default as ChartLegend } from './ChartLegend';
export type { ChartLegendProps, ChartLegendItem } from './ChartLegend';

export { default as HeatmapGrid } from './HeatmapGrid';
export type { HeatmapGridProps } from './HeatmapGrid';
