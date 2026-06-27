"use client";

import { useCallback, useRef, useState } from "react";
import type { ToastItem, ToastType } from "../components/shared/Toast";

let counter = 0;

/**
 * Hook for managing toast notifications.
 *
 * Returns:
 * - `toasts`: current list of active toasts (pass to ToastContainer)
 * - `toast(message, type?, duration?)`: add a new toast
 * - `dismiss(id)`: manually remove a toast by id
 */
export function useToast(defaultDuration = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Keep a ref so the dismiss callback always sees the latest list without re-renders
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration: number = defaultDuration,
    ) => {
      const id = `toast-${++counter}`;
      const item: ToastItem = { id, message, type, duration };
      setToasts((prev) => [...prev, item]);
      return id;
    },
    [defaultDuration],
  );

  return { toasts, toast, dismiss };
}
