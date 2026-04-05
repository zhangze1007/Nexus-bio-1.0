import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkbenchDirectoryPage from '../../src/components/workbench/WorkbenchDirectoryPage';

export const metadata: Metadata = {
  title: 'Tools Directory | Nexus-Bio',
  description:
    'Browse, compare, and enter Nexus-Bio research tools through a unified scientific workbench directory.',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkbenchDirectoryPage />
    </Suspense>
  );
}
