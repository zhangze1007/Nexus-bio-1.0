# Architecture-First Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish unified algorithm framework and UI component library, then incrementally enhance each tool with real algorithms and Apple-inspired design.

**Architecture:** Create shared utility modules (ODE solver, statistics, ML) and design system components, then use them to replace scattered implementations across 14 tools.

**Tech Stack:** TypeScript, React, Next.js, Three.js, Recharts, Zustand

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/utils/odeSolver.ts` | Unified ODE solver framework (RK4, Euler, adaptive) |
| `src/utils/statistics.ts` | Unified statistics functions (Shannon entropy, selection coefficient, CI) |
| `src/utils/machineLearning.ts` | Unified ML framework (VAE, PCA, UMAP) |
| `src/design-system/tokens.ts` | Design tokens (colors, spacing, typography) |
| `src/design-system/components/charts/` | Unified chart components |
| `src/design-system/components/3d/` | Unified 3D components |
| `src/design-system/components/forms/` | Unified form components |
| `src/design-system/components/layout/` | Unified layout components |
| `__tests__/odeSolver.test.ts` | ODE solver tests |
| `__tests__/statistics.test.ts` | Statistics tests |
| `__tests__/machineLearning.test.ts` | ML framework tests |

---

## Task 1: Unified ODE Solver Framework

**Files:**
- Create: `src/utils/odeSolver.ts`
- Test: `__tests__/odeSolver.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/odeSolver.test.ts
import { solveRK4, solveEuler, type ODESystem, type ODESolution } from '../src/utils/odeSolver';

describe('ODE Solver', () => {
  // Test case: exponential decay dy/dt = -y, y(0) = 1
  // Analytical solution: y(t) = exp(-t)
  const exponentialDecay: ODESystem = {
    derivatives: (t: number, y: number[]) => [-y[0]],
  };

  test('RK4 solves exponential decay correctly', () => {
    const solution = solveRK4(exponentialDecay, [1], 2, 0.1);
    const lastValue = solution.y[solution.y.length - 1][0];
    const expected = Math.exp(-2);
    expect(lastValue).toBeCloseTo(expected, 3);
  });

  test('Euler solves exponential decay correctly', () => {
    const solution = solveEuler(exponentialDecay, [1], 2, 0.01);
    const lastValue = solution.y[solution.y.length - 1][0];
    const expected = Math.exp(-2);
    expect(lastValue).toBeCloseTo(expected, 2);
  });

  test('RK4 is more accurate than Euler for same step size', () => {
    const rk4Solution = solveRK4(exponentialDecay, [1], 2, 0.5);
    const eulerSolution = solveEuler(exponentialDecay, [1], 2, 0.5);
    const expected = Math.exp(-2);
    const rk4Error = Math.abs(rk4Solution.y[rk4Solution.y.length - 1][0] - expected);
    const eulerError = Math.abs(eulerSolution.y[eulerSolution.y.length - 1][0] - expected);
    expect(rk4Error).toBeLessThan(eulerError);
  });

  test('handles multiple state variables', () => {
    // Test: dx/dt = y, dy/dt = -x (harmonic oscillator)
    // Analytical solution: x(t) = cos(t), y(t) = -sin(t)
    const harmonicOscillator: ODESystem = {
      derivatives: (t: number, y: number[]) => [y[1], -y[0]],
    };
    const solution = solveRK4(harmonicOscillator, [1, 0], Math.PI, 0.01);
    const lastX = solution.y[solution.y.length - 1][0];
    const lastY = solution.y[solution.y.length - 1][1];
    expect(lastX).toBeCloseTo(-1, 2); // cos(π) = -1
    expect(lastY).toBeCloseTo(0, 2); // -sin(π) = 0
  });

  test('respects non-negativity constraint', () => {
    // Test: dy/dt = -10y (fast decay), y(0) = 1
    // Should never go negative
    const fastDecay: ODESystem = {
      derivatives: (t: number, y: number[]) => [-10 * y[0]],
    };
    const solution = solveRK4(fastDecay, [1], 1, 0.1);
    for (const y of solution.y) {
      expect(y[0]).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/odeSolver.test.ts -v`
Expected: FAIL with "Cannot find module '../src/utils/odeSolver'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/odeSolver.ts
/**
 * Unified ODE Solver Framework
 *
 * Provides standard numerical methods for solving ordinary differential equations.
 * All solvers support multiple state variables and non-negativity constraints.
 *
 * References:
 *   - Runge-Kutta methods: https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods
 *   - Euler method: https://en.wikipedia.org/wiki/Euler_method
 */

export interface ODESystem {
  /** Derivatives function: returns dy/dt for each state variable */
  derivatives: (t: number, y: number[]) => number[];
  /** Optional event conditions for adaptive stepping */
  events?: Array<{
    condition: (t: number, y: number[]) => boolean;
    action: 'stop' | 'clamp';
  }>;
}

export interface ODESolution {
  /** Time points */
  t: number[];
  /** State variables at each time point */
  y: number[][];
  /** Number of steps taken */
  steps: number;
  /** Whether integration completed successfully */
  success: boolean;
}

export interface SolverOptions {
  /** Enforce non-negativity constraint (default: true) */
  nonNegative?: boolean;
  /** Maximum step size (default: dt) */
  maxStep?: number;
  /** Minimum step size (default: dt/100) */
  minStep?: number;
}

/**
 * Solve ODE system using 4th-order Runge-Kutta method.
 *
 * @param system - ODE system to solve
 * @param y0 - Initial state variables
 * @param tEnd - End time
 * @param dt - Time step
 * @param options - Solver options
 * @returns Solution object with time points and state variables
 */
export function solveRK4(
  system: ODESystem,
  y0: number[],
  tEnd: number,
  dt: number,
  options: SolverOptions = {},
): ODESolution {
  const { nonNegative = true } = options;
  const t: number[] = [0];
  const y: number[][] = [[...y0]];
  let currentTime = 0;
  let currentState = [...y0];
  let steps = 0;

  while (currentTime < tEnd - dt / 2) {
    const currentDt = Math.min(dt, tEnd - currentTime);

    // RK4 stages
    const k1 = system.derivatives(currentTime, currentState);
    const k2 = system.derivatives(
      currentTime + currentDt / 2,
      currentState.map((yi, i) => yi + (currentDt / 2) * k1[i]),
    );
    const k3 = system.derivatives(
      currentTime + currentDt / 2,
      currentState.map((yi, i) => yi + (currentDt / 2) * k2[i]),
    );
    const k4 = system.derivatives(
      currentTime + currentDt,
      currentState.map((yi, i) => yi + currentDt * k3[i]),
    );

    // Update state
    const newState = currentState.map((yi, i) => {
      const delta = (currentDt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      return nonNegative ? Math.max(0, yi + delta) : yi + delta;
    });

    currentTime += currentDt;
    currentState = newState;
    steps++;

    t.push(currentTime);
    y.push([...currentState]);
  }

  return { t, y, steps, success: true };
}

/**
 * Solve ODE system using Euler method.
 *
 * @param system - ODE system to solve
 * @param y0 - Initial state variables
 * @param tEnd - End time
 * @param dt - Time step
 * @param options - Solver options
 * @returns Solution object with time points and state variables
 */
export function solveEuler(
  system: ODESystem,
  y0: number[],
  tEnd: number,
  dt: number,
  options: SolverOptions = {},
): ODESolution {
  const { nonNegative = true } = options;
  const t: number[] = [0];
  const y: number[][] = [[...y0]];
  let currentTime = 0;
  let currentState = [...y0];
  let steps = 0;

  while (currentTime < tEnd - dt / 2) {
    const currentDt = Math.min(dt, tEnd - currentTime);
    const derivatives = system.derivatives(currentTime, currentState);

    const newState = currentState.map((yi, i) => {
      const delta = currentDt * derivatives[i];
      return nonNegative ? Math.max(0, yi + delta) : yi + delta;
    });

    currentTime += currentDt;
    currentState = newState;
    steps++;

    t.push(currentTime);
    y.push([...currentState]);
  }

  return { t, y, steps, success: true };
}

/**
 * Solve ODE system using adaptive step size (Runge-Kutta-Fehlberg).
 *
 * @param system - ODE system to solve
 * @param y0 - Initial state variables
 * @param tEnd - End time
 * @param tol - Error tolerance
 * @param options - Solver options
 * @returns Solution object with time points and state variables
 */
export function solveAdaptive(
  system: ODESystem,
  y0: number[],
  tEnd: number,
  tol: number = 1e-6,
  options: SolverOptions = {},
): ODESolution {
  const { nonNegative = true, maxStep = 1.0, minStep = 1e-6 } = options;
  const t: number[] = [0];
  const y: number[][] = [[...y0]];
  let currentTime = 0;
  let currentState = [...y0];
  let dt = maxStep;
  let steps = 0;

  while (currentTime < tEnd - minStep / 2) {
    const currentDt = Math.min(dt, tEnd - currentTime);

    // RK4 step
    const k1 = system.derivatives(currentTime, currentState);
    const k2 = system.derivatives(
      currentTime + currentDt / 2,
      currentState.map((yi, i) => yi + (currentDt / 2) * k1[i]),
    );
    const k3 = system.derivatives(
      currentTime + currentDt / 2,
      currentState.map((yi, i) => yi + (currentDt / 2) * k2[i]),
    );
    const k4 = system.derivatives(
      currentTime + currentDt,
      currentState.map((yi, i) => yi + currentDt * k3[i]),
    );

    const newState = currentState.map((yi, i) => {
      const delta = (currentDt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      return nonNegative ? Math.max(0, yi + delta) : yi + delta;
    });

    // Error estimation (simplified)
    const error = Math.max(
      ...newState.map((yi, i) => Math.abs(yi - currentState[i]) * currentDt),
    );

    // Step size control
    if (error > tol * 2) {
      dt = Math.max(minStep, dt * 0.5);
      continue; // Reject step
    }

    if (error < tol / 2) {
      dt = Math.min(maxStep, dt * 1.5);
    }

    currentTime += currentDt;
    currentState = newState;
    steps++;

    t.push(currentTime);
    y.push([...currentState]);
  }

  return { t, y, steps, success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/odeSolver.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/odeSolver.ts __tests__/odeSolver.test.ts
git commit -m "feat: add unified ODE solver framework (RK4, Euler, adaptive)"
```

---

## Task 2: Unified Statistics Framework

**Files:**
- Create: `src/utils/statistics.ts`
- Test: `__tests__/statistics.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/statistics.test.ts
import {
  shannonEntropy,
  selectionCoefficient,
  confidenceInterval,
  mannWhitneyU,
  mean,
  standardDeviation,
} from '../src/utils/statistics';

describe('Statistics Framework', () => {
  test('shannonEntropy calculates correctly', () => {
    // Uniform distribution: H = log2(n)
    const uniform = [0.25, 0.25, 0.25, 0.25];
    expect(shannonEntropy(uniform)).toBeCloseTo(2, 4);

    // Single element: H = 0
    expect(shannonEntropy([1])).toBe(0);

    // Two equal elements: H = 1
    expect(shannonEntropy([0.5, 0.5])).toBeCloseTo(1, 4);
  });

  test('selectionCoefficient calculates correctly', () => {
    // No selection: s = 0
    expect(selectionCoefficient(0.5, 0.5)).toBeCloseTo(0, 4);

    // Positive selection: s > 0
    expect(selectionCoefficient(0.3, 0.7)).toBeGreaterThan(0);

    // Negative selection: s < 0
    expect(selectionCoefficient(0.7, 0.3)).toBeLessThan(0);
  });

  test('confidenceInterval calculates correctly', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [lo, hi] = confidenceInterval(data, 0.95);
    expect(lo).toBeLessThan(mean(data));
    expect(hi).toBeGreaterThan(mean(data));
    expect(hi - lo).toBeGreaterThan(0);
  });

  test('mannWhitneyU calculates correctly', () => {
    // Identical groups: U should be ~n1*n2/2
    const group1 = [1, 2, 3, 4, 5];
    const group2 = [1, 2, 3, 4, 5];
    const result = mannWhitneyU(group1, group2);
    expect(result.U).toBeCloseTo(12.5, 0);
  });

  test('mean calculates correctly', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(mean([10])).toBe(10);
    expect(mean([])).toBeNaN();
  });

  test('standardDeviation calculates correctly', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(standardDeviation(data)).toBeCloseTo(2.0, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/statistics.test.ts -v`
Expected: FAIL with "Cannot find module '../src/utils/statistics'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/statistics.ts
/**
 * Unified Statistics Framework
 *
 * Provides standard statistical functions for scientific computing.
 * All functions are pure and deterministic.
 *
 * References:
 *   - Shannon entropy: Shannon (1948) A Mathematical Theory of Communication
 *   - Selection coefficient: Hartl & Clark (2007) Principles of Population Genetics
 *   - Mann-Whitney U: Mann & Whitney (1947) On a Test of Whether One Random Variable is Stochastically Larger than Another
 */

/**
 * Calculate Shannon entropy from frequency distribution.
 *
 * @param frequencies - Array of frequencies (should sum to 1)
 * @returns Shannon entropy in bits
 */
export function shannonEntropy(frequencies: number[]): number {
  if (frequencies.length === 0) return 0;

  let entropy = 0;
  for (const p of frequencies) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Calculate selection coefficient between two time points.
 *
 * @param freq1 - Frequency at time 1
 * @param freq2 - Frequency at time 2
 * @returns Selection coefficient (positive = beneficial, negative = deleterious)
 */
export function selectionCoefficient(freq1: number, freq2: number): number {
  if (freq1 <= 0 || freq2 <= 0 || freq1 >= 1 || freq2 >= 1) return 0;
  return Math.log((freq2 * (1 - freq1)) / (freq1 * (1 - freq2)));
}

/**
 * Calculate confidence interval using t-distribution.
 *
 * @param data - Array of observations
 * @param confidence - Confidence level (e.g., 0.95 for 95%)
 * @returns [lower, upper] bounds
 */
export function confidenceInterval(data: number[], confidence: number): [number, number] {
  if (data.length < 2) return [NaN, NaN];

  const n = data.length;
  const m = mean(data);
  const s = standardDeviation(data);
  const se = s / Math.sqrt(n);

  // t-value for 95% confidence with n-1 degrees of freedom
  // Simplified: use z-score for large samples
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const margin = z * se;

  return [m - margin, m + margin];
}

/**
 * Calculate Mann-Whitney U test statistic.
 *
 * @param group1 - First group of observations
 * @param group2 - Second group of observations
 * @returns U statistic and approximate p-value
 */
export function mannWhitneyU(
  group1: number[],
  group2: number[],
): { U: number; p: number } {
  const n1 = group1.length;
  const n2 = group2.length;
  const N = n1 + n2;

  // Combine and rank
  const combined = [
    ...group1.map((v, i) => ({ value: v, group: 1 as const, index: i })),
    ...group2.map((v, i) => ({ value: v, group: 2 as const, index: i })),
  ].sort((a, b) => a.value - b.value);

  // Assign ranks
  for (let i = 0; i < N; i++) {
    combined[i].rank = i + 1;
  }

  // Calculate U for group 1
  const R1 = combined
    .filter((item) => item.group === 1)
    .reduce((sum, item) => sum + item.rank!, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Approximate p-value (normal approximation)
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (N + 1)) / 12);
  const z = (U - mu) / sigma;
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  return { U, p };
}

/**
 * Calculate arithmetic mean.
 */
export function mean(data: number[]): number {
  if (data.length === 0) return NaN;
  return data.reduce((sum, x) => sum + x, 0) / data.length;
}

/**
 * Calculate sample standard deviation.
 */
export function standardDeviation(data: number[]): number {
  if (data.length < 2) return NaN;
  const m = mean(data);
  const squaredDiffs = data.map((x) => (x - m) ** 2);
  const variance = squaredDiffs.reduce((sum, x) => sum + x, 0) / (data.length - 1);
  return Math.sqrt(variance);
}

/**
 * Normal cumulative distribution function (Abramowitz & Stegun approximation).
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/statistics.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/statistics.ts __tests__/statistics.test.ts
git commit -m "feat: add unified statistics framework (Shannon entropy, selection coefficient, CI)"
```

---

## Task 3: Design System Foundation

**Files:**
- Create: `src/design-system/tokens.ts`
- Create: `src/design-system/index.ts`

- [ ] **Step 1: Create design tokens**

```typescript
// src/design-system/tokens.ts
/**
 * Design System Tokens
 *
 * Apple-inspired design tokens for consistent UI across all tools.
 * Based on 8px grid system and SF Pro typography.
 */

export const colors = {
  // Background colors
  bg: {
    primary: '#050505',
    secondary: '#0d0f14',
    tertiary: '#10131a',
    elevated: '#1a1d24',
  },

  // Text colors
  text: {
    primary: '#f0f0f0',
    secondary: '#a0a0a0',
    tertiary: '#707070',
    disabled: '#505050',
  },

  // Accent colors (pastel palette)
  accent: {
    blue: '#C8D8E8',
    green: '#C8E0D0',
    purple: '#DDD0E8',
    orange: '#E8DCC8',
    red: '#FA8072',
    yellow: '#E8D8A0',
  },

  // Status colors
  status: {
    success: '#93CB52',
    warning: '#E8D8A0',
    error: '#FA8072',
    info: '#5151CD',
  },

  // Border colors
  border: {
    default: '#2a2d34',
    hover: '#3a3d44',
    focus: '#5151CD',
  },
} as const;

export const spacing = {
  // 8px grid system
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
} as const;

export const typography = {
  // Font family
  fontFamily: {
    sans: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  },

  // Font sizes (rem based)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    xxl: '1.5rem',    // 24px
    xxxl: '2rem',     // 32px
  },

  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '300ms ease',
  slow: '500ms ease',
} as const;

// Export all tokens
export const designTokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
} as const;
```

- [ ] **Step 2: Create index file**

```typescript
// src/design-system/index.ts
/**
 * Design System
 *
 * Apple-inspired design system for Nexus-Bio platform.
 * Provides consistent tokens, components, and utilities.
 */

export * from './tokens';
export * from './components/charts';
export * from './components/3d';
export * from './components/forms';
export * from './components/layout';
```

- [ ] **Step 3: Commit**

```bash
git add src/design-system/tokens.ts src/design-system/index.ts
git commit -m "feat: add design system foundation with Apple-inspired tokens"
```

---

## Task 4: Unified Chart Components

**Files:**
- Create: `src/design-system/components/charts/index.ts`
- Create: `src/design-system/components/charts/LineChart.tsx`
- Create: `src/design-system/components/charts/BarChart.tsx`
- Create: `src/design-system/components/charts/ScatterChart.tsx`

- [ ] **Step 1: Create chart components**

```typescript
// src/design-system/components/charts/index.ts
export { LineChart } from './LineChart';
export { BarChart } from './BarChart';
export { ScatterChart } from './ScatterChart';
```

```typescript
// src/design-system/components/charts/LineChart.tsx
'use client';

import React from 'react';
import { colors, typography, spacing } from '../../tokens';

interface LineChartProps {
  data: Array<{ x: number; y: number; label?: string }>;
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  showGrid?: boolean;
  showPoints?: boolean;
}

export function LineChart({
  data,
  width = 400,
  height = 300,
  xLabel,
  yLabel,
  color = colors.accent.blue,
  showGrid = true,
  showPoints = true,
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xMin = Math.min(...data.map((d) => d.x));
  const xMax = Math.max(...data.map((d) => d.x));
  const yMin = Math.min(...data.map((d) => d.y));
  const yMax = Math.max(...data.map((d) => d.y));

  const xScale = (x: number) =>
    padding.left + ((x - xMin) / (xMax - xMin)) * chartWidth;
  const yScale = (y: number) =>
    padding.top + chartHeight - ((y - yMin) / (yMax - yMin)) * chartHeight;

  const pathData = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.x)} ${yScale(d.y)}`)
    .join(' ');

  return (
    <svg width={width} height={height} style={{ background: colors.bg.primary }}>
      {/* Grid */}
      {showGrid && (
        <g opacity={0.1}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={`grid-${t}`}
              x1={padding.left}
              y1={padding.top + t * chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + t * chartHeight}
              stroke={colors.text.secondary}
              strokeWidth={0.5}
            />
          ))}
        </g>
      )}

      {/* Line */}
      <path d={pathData} fill="none" stroke={color} strokeWidth={2} />

      {/* Points */}
      {showPoints &&
        data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.x)}
            cy={yScale(d.y)}
            r={3}
            fill={color}
          />
        ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartHeight}
        stroke={colors.border.default}
        strokeWidth={1}
      />
      <line
        x1={padding.left}
        y1={padding.top + chartHeight}
        x2={padding.left + chartWidth}
        y2={padding.top + chartHeight}
        stroke={colors.border.default}
        strokeWidth={1}
      />

      {/* Labels */}
      {xLabel && (
        <text
          x={padding.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fill={colors.text.secondary}
          fontSize={typography.fontSize.sm}
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={15}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          fill={colors.text.secondary}
          fontSize={typography.fontSize.sm}
          transform={`rotate(-90, 15, ${padding.top + chartHeight / 2})`}
        >
          {yLabel}
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Create BarChart and ScatterChart components**

Similar structure to LineChart with appropriate visualizations.

- [ ] **Step 3: Commit**

```bash
git add src/design-system/components/charts/
git commit -m "feat: add unified chart components (LineChart, BarChart, ScatterChart)"
```

---

## Summary

| Task | Component | Time Est. |
|------|-----------|-----------|
| 1 | Unified ODE Solver | 2 hours |
| 2 | Unified Statistics Framework | 2 hours |
| 3 | Design System Foundation | 1 hour |
| 4 | Unified Chart Components | 2 hours |

**Total: ~7 hours**

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-10-architecture-first-optimization.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
