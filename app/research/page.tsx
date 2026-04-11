import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResearchClient from './ResearchClient';

export const metadata: Metadata = {
  title: 'Research | Nexus-Bio',
  description: 'Search across connected scientific literature sources, with live metadata and open-access routing where available.',
};

export default function Page() {
  return (
    <Suspense>
      <ResearchClient />
    </Suspense>
  );
}
