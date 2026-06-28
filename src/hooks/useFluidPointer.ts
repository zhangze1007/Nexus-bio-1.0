import { useRef, useCallback } from "react";
import type { FluidPointer } from "../store/uiStore";

/**
 * Ref-based hook for reading fluidPointer state at 60Hz without causing re-renders.
 *
 * The global mouse handler in the UI continues to write via `setFluidPointer` in
 * the Zustand store. Components that only READ the pointer (e.g. Three.js render
 * loops, background shaders) should use this hook instead of subscribing to
 * `uiStore.fluidPointer`, which triggers a Zustand-driven re-render on every
 * mouse-move frame (~60 Hz).
 *
 * Usage:
 *   const { pointerRef, updatePointer } = useFluidPointer();
 *   // In a mouse handler:  updatePointer({ x, y, dx, dy, active: true })
 *   // In a render loop:    const { x, y } = pointerRef.current;
 */
export function useFluidPointer() {
  const pointerRef = useRef<FluidPointer>({ x: 0, y: 0, dx: 0, dy: 0, active: false });

  const updatePointer = useCallback((p: FluidPointer) => {
    pointerRef.current = p;
  }, []);

  return { pointerRef, updatePointer };
}
