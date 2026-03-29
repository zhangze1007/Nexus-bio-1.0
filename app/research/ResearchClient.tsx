'use client';
/**
 * /research — Full-page semantic search
 * Dark Mode 2.0 background, no fluid (clean professional layout).
 */

import dynamic from 'next/dynamic';
import TopNav from '../../src/components/TopNav';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const SemanticSearch = dynamic(
  () => import('../../src/components/SemanticSearch'),
  { ssr: false }
);
const PaperAnalyzer = dynamic(
  () => import('../../src/components/PaperAnalyzer'),
  { ssr: false }
);

export default function ResearchClient() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const router = useRouter();
  const searchEventRef = useRef<CustomEvent | null>(null);

  // Auto-fire search if q param present
  useEffect(() => {
    if (!q) return;
    const ev = new CustomEvent('heroSearchQuery', { detail: { query: q } });
    searchEventRef.current = ev;
    window.dispatchEvent(ev);
  }, [q]);

  return (
    <div style={{ background: '#0A0D14', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <SemanticSearch
          initialQuery={q}
          onAnalyzePaper={(text) => {
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
