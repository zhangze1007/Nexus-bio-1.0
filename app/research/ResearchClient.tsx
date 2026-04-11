'use client';
/**
 * /research — Full-page semantic search
 * Dark Mode 2.0 background, no fluid (clean professional layout).
 */

import dynamic from 'next/dynamic';
import TopNav from '../../src/components/TopNav';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useWorkbenchStore } from '../../src/store/workbenchStore';

const SemanticSearch = dynamic(
  () => import('../../src/components/SemanticSearch'),
  { ssr: false }
);
export default function ResearchClient() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const router = useRouter();
  const searchEventRef = useRef<CustomEvent | null>(null);
  const setDraftAnalyzeInput = useWorkbenchStore((s) => s.setDraftAnalyzeInput);

  // Auto-fire search if q param present
  useEffect(() => {
    if (!q) return;
    const ev = new CustomEvent('heroSearchQuery', { detail: { query: q } });
    searchEventRef.current = ev;
    window.dispatchEvent(ev);
  }, [q]);

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <SemanticSearch
          initialQuery={q}
          onAnalyzePaper={(text) => {
            setDraftAnalyzeInput(text);
            router.push('/analyze');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('autoFillAnalyzer', { detail: { text } }));
            }, 500);
          }}
        />
      </div>
    </div>
  );
}
