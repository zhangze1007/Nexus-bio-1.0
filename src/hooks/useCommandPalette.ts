"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook that manages command palette open/close state and the Cmd+K / Ctrl+K
 * keyboard shortcut.
 *
 * Returns:
 * - `open`: whether the palette is visible
 * - `toggle()`: flip open/closed
 * - `openPalette()`: force open
 * - `closePalette()`: force close
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (macOS) or Ctrl+K (Windows/Linux)
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return { open, toggle, openPalette, closePalette };
}
