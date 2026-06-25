# Task Brief: FluxParticles Geometry Disposal (Task 1)

## Task 1: Fix GPU memory leak
**File:** `src/components/ThreeScene.tsx` lines 738-741
The FluxParticles component creates `BufferGeometry` and `PointsMaterial` in a `useMemo` but never disposes them on unmount.

Find the useMemo that creates `geo` and the PointsMaterial. Add a cleanup `useEffect` that returns a disposal function:
```ts
useEffect(() => {
  return () => {
    geo.dispose();
    // also dispose the material if it's created in the same scope
  };
}, [geo]);
```

If the material is also created in useMemo, dispose it too.

## Constraints
- Do NOT change the rendering logic
- Do NOT modify other Three.js components
- Run `npx jest --no-coverage` after changes
