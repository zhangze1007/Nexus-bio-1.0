---
name: nexus-bio-perf
description: Bundle analysis and performance profiling for Nexus-Bio
---

# /nexus-bio-perf

Run performance analysis and identify optimization opportunities.

## Steps

1. **Bundle analysis**: Run `npm run analyze` and report:
   - Total bundle size
   - Top 10 largest modules
   - Three.js / Recharts / Framer Motion sizes
   - Any unexpected large dependencies

2. **Build time**: Run `time npm run build` and report duration

3. **Code splitting check**: Verify tool pages use `next/dynamic` for lazy loading:
   ```bash
   grep -rn "next/dynamic" src/components/tools/
   ```

4. **Worker usage check**: Verify heavy computations use Web Workers:
   ```bash
   grep -rn "new Worker" src/
   ```

5. **Memoization check**: Verify expensive computations use `useMemo`:
   ```bash
   grep -c "useMemo" src/components/tools/*Page.tsx
   ```

## Output
A performance report with actionable optimization recommendations.
