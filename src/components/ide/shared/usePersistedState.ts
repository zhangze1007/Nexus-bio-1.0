'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * useState wrapper that persists to localStorage.
 * Key format: nexus-bio:{toolId}:{paramName}
 * Falls back to defaultValue if localStorage is unavailable or corrupted.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or private browsing — silently ignore
    }
  }, [key, value]);

  const setter = useCallback((v: T | ((prev: T) => T)) => {
    setValue(v);
  }, []);

  return [value, setter];
}
