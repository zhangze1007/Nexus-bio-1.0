import type { Metadata } from 'next';
import { Suspense } from 'react';
import AnalyzeClient from './AnalyzeClient';

export const metadata: Metadata = {
  title: 'Analyze | Nexus-Bio',
  description: 'Extract metabolic pathways from papers using AI — Groq + Gemini pipeline.',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AnalyzeClient />
    </Suspense>
  );
}
