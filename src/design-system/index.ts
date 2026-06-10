/**
 * Nexus-Bio Design System
 *
 * Central export for all design system components and tokens.
 * Import from '@/design-system' for consistent access.
 */

// ============================================================================
// TOKENS
// ============================================================================

export {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  tokens,
} from './tokens';

export type { Tokens } from './tokens';

// ============================================================================
// COMPONENTS - Charts
// ============================================================================

// TODO: Export chart components as they are created
// export { LineChart } from './components/charts/LineChart';
// export { BarChart } from './components/charts/BarChart';
// export { ScatterPlot } from './components/charts/ScatterPlot';
// export { Heatmap } from './components/charts/Heatmap';
// export { RadarChart } from './components/charts/RadarChart';

// ============================================================================
// COMPONENTS - 3D
// ============================================================================

// TODO: Export 3D components as they are created
// export { Scene3D } from './components/3d/Scene3D';
// export { MoleculeViewer } from './components/3d/MoleculeViewer';
// export { ProteinViewer } from './components/3d/ProteinViewer';

// ============================================================================
// COMPONENTS - Forms
// ============================================================================

// TODO: Export form components as they are created
// export { Input } from './components/forms/Input';
// export { Select } from './components/forms/Select';
// export { Checkbox } from './components/forms/Checkbox';
// export { Radio } from './components/forms/Radio';
// export { Slider } from './components/forms/Slider';
// export { Toggle } from './components/forms/Toggle';

// ============================================================================
// COMPONENTS - Layout
// ============================================================================

// TODO: Export layout components as they are created
// export { Container } from './components/layout/Container';
// export { Grid } from './components/layout/Grid';
// export { Stack } from './components/layout/Stack';
// export { Divider } from './components/layout/Divider';
// export { Spacer } from './components/layout/Spacer';

// ============================================================================
// RE-EXPORT EXISTING COMPONENTS
// ============================================================================

// Re-export shared IDE components that are part of the design system
export { default as DataTable } from '../components/ide/shared/DataTable';
export { default as MetricCard } from '../components/ide/shared/MetricCard';
export { default as Pagination } from '../components/ide/shared/Pagination';

// Re-export theme tokens from workbench (backward compatibility)
export { PATHD_THEME as workbenchTheme } from '../components/workbench/workbenchTheme';
