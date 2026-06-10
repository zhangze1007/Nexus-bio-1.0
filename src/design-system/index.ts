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
// COMPONENTS
// ============================================================================

export * from './components';

// ============================================================================
// RE-EXPORT EXISTING COMPONENTS
// ============================================================================

// Re-export shared IDE components that are part of the design system
export { default as DataTable } from '../components/ide/shared/DataTable';
export { default as LegacyMetricCard } from '../components/ide/shared/MetricCard';
export { default as Pagination } from '../components/ide/shared/Pagination';

// Re-export theme tokens from workbench (backward compatibility)
export { PATHD_THEME as workbenchTheme } from '../components/workbench/workbenchTheme';
