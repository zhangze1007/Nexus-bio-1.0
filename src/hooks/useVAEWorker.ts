'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { OmicsRow } from '../types';
import type { VAETrainingResult } from '../services/MOIEngine';
import type { VAEWorkerIn, VAEWorkerOut } from '../workers/vaeWorker';

interface UseVAEWorkerOptions {
  data: OmicsRow[];
  latentDim?: number;
  beta?: number;
  epochs?: number;
  lr?: number;
  batchLabels?: number[];
}

interface UseVAEWorkerReturn {
  result: VAETrainingResult | null;
  loading: boolean;
  error: string | null;
  train: () => void;
}

export function useVAEWorker({
  data,
  latentDim = 8,
  beta = 0.5,
  epochs = 100,
  lr = 0.005,
  batchLabels,
}: UseVAEWorkerOptions): UseVAEWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<VAETrainingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/vaeWorker.ts', import.meta.url),
      { type: 'module' },
    );

    const w = workerRef.current;
    w.onmessage = (e: MessageEvent<VAEWorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'RESULT') {
        setResult(msg.result);
        setLoading(false);
        setError(null);
      } else if (msg.type === 'ERROR') {
        setError(msg.message);
        setLoading(false);
      }
    };

    w.onerror = (e) => {
      setError(e.message ?? 'Worker error');
      setLoading(false);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const train = useCallback(() => {
    if (!workerRef.current) return;
    setLoading(true);
    setError(null);
    const msg: VAEWorkerIn = {
      type: 'TRAIN',
      data,
      latentDim,
      beta,
      epochs,
      lr,
      batchLabels,
    };
    workerRef.current.postMessage(msg);
  }, [data, latentDim, beta, epochs, lr, batchLabels]);

  return { result, loading, error, train };
}
