import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResearchClient from './ResearchClient';

export const metadata: Metadata = {
  title: 'Research | Nexus-Bio',
  description: 'Search 200M+ papers across PubMed, Semantic Scholar, OpenAlex, and more.',
};

export default function Page() {
  return (
    <Suspense>
      <ResearchClient />
    </Suspense>
  );
}
