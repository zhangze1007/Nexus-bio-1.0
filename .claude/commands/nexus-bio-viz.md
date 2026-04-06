# nexus-bio-viz — Nexus-Bio Visualization Upgrade Skill

You are upgrading a bioinformatics tool visualization in the Nexus-Bio platform to match professional bioinformatics software aesthetics. Follow these rules exactly.

## Reference aesthetics

| Tool type | Target look |
|-----------|-------------|
| Spatial transcriptomics | 10x Visium hexagonal spot grid, cluster UMAP with convex hull territories (Scanpy palette) |
| Multi-omics embedding | VAE/UMAP scatter with per-layer convex hull halos, volcano with gene labels |
| Metabolic flux map | Escher-style: subsystem background rects, flux-width Bezier edges with arrowhead markers |
| Fitness landscape | Viridis-palette heatmap with marching-squares contour lines, peak markers |
| Gene circuit | Hill curve with area fill, logic surface heatmap with isocontours |
| Genome browser | IGV-style horizontal arrow gene bodies on chromosome ideogram |
| Citation network | Year×relevance scatter, quadratic arc bridge edges, glow halos on high-relevance nodes |
| DBTL cycle | Circular 4-arc progress ring, iteration waterfall |
| Dynamics | Multi-lane time-series with setpoint bands, RK4 trajectory |
| Thermodynamics | Waterfall ΔG cascade with ATP-step highlights |

## Design rules (non-negotiable)

1. **Dark background only** — `#050505` or `#05070b` SVG backgrounds. Never white or light grey.
2. **Pastel accent palette** — `#C8D8E8`, `#C8E0D0`, `#DDD0E8`, `#E8DCC8`, `#93CB52`, `#5151CD`, `#FA8072`
3. **meshLambertMaterial** for any Three.js geometry — never meshStandardMaterial
4. **Real algorithms only** — no placeholder math. Use the actual scientific formula.
5. **Evidence-traceable** — every computed value must be derivable from the input data.
6. **Convex hulls** — use `computeConvexHull` + `expandHull` from `src/utils/vizUtils.ts` for cluster territories.
7. **Arrowhead markers** — define `<marker>` in SVG `<defs>` for all directed edges.
8. **No mock data** — never hardcode final values; compute from props/state.

## Step-by-step process

When the user runs `/nexus-bio-viz [ToolName]`:

1. **Read** the target tool file at `src/components/tools/[ToolName]Page.tsx`
2. **Identify** the main SVG/Canvas visualization function
3. **Assess** which reference aesthetic applies (see table above)
4. **Implement** the upgrade in-place — do not create a new file
5. **Run** `npx tsc --noEmit` — fix any type errors before finishing
6. **Summarise** what changed in 3 bullet points

## Forbidden files (never modify)

- `IDEShell.tsx`, `IDETopBar.tsx`, `IDESidebar.tsx`
- `ProEvolPage.tsx`, `GECAIRPage.tsx`, `DBTLflowPage.tsx`

## Hexagonal spot grid (Visium spatial)

For ScSpatialPage spatial map, replace circle markers with hexagonal spots:

```tsx
// Hex center offsets for pointy-top hex grid
function hexPath(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = (cx + r * Math.cos(angle)).toFixed(2);
    const y = (cy + r * Math.sin(angle)).toFixed(2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ' Z';
}
```

Apply with `r = 4` for regular spots, `r = 3 + intensity * 3` for expression mode.
