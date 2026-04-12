'use client';

import { useRef, useState, useEffect } from 'react';

declare global { interface Window { $3Dmol: any; } }

const THREEDMOL_CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.5.3/3Dmol-min.js',
  'https://3Dmol.org/build/3Dmol-min.js',
];

/** Load 3Dmol.js from CDN with fallback chain. Resolves when window.$3Dmol is available. */
export function load3Dmol(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.$3Dmol) return Promise.resolve();

  return THREEDMOL_CDNS.reduce<Promise<void>>(
    (chain, url) =>
      chain.catch(
        () =>
          new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => (window.$3Dmol ? resolve() : reject(new Error('3Dmol not defined')));
            s.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(s);
          }),
      ),
    Promise.reject<void>(),
  );
}

export interface Use3DmolConfig {
  backgroundColor?: string;
}

export interface Use3DmolResult {
  viewer: any | null;
  status: 'loading' | 'ready' | 'error';
}

/**
 * Hook that loads 3Dmol.js via CDN and creates a viewer bound to the given container ref.
 * Returns the viewer instance and status. Cleans up on unmount.
 */
export function use3Dmol(
  containerRef: React.RefObject<HTMLDivElement | null>,
  config: Use3DmolConfig = {},
): Use3DmolResult {
  const { backgroundColor = '0x0d0f14' } = config;
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      try {
        await load3Dmol();
        if (cancelled) return;
        if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
        containerRef.current.innerHTML = '';

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor, antialias: true,
        });
        viewerRef.current = viewer;
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
    };
  }, [backgroundColor, containerRef]);

  return { viewer: viewerRef.current, status };
}
