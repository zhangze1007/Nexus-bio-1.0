import type { Metadata } from 'next';
import { Suspense } from 'react';
import ApiDocsClient from './ApiDocsClient';

export const metadata: Metadata = {
  title: 'API Documentation | Nexus-Bio',
  description:
    'Interactive API documentation for the Nexus-Bio synthetic biology platform — endpoints for AI analysis, FBA simulation, protein structure, and more.',
};

export default function ApiDocsPage() {
  return (
    <Suspense fallback={null}>
      <ApiDocsClient />
    </Suspense>
  );
}
