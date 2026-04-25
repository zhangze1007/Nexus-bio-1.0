import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkbenchDirectoryPage from '../../src/components/workbench/WorkbenchDirectoryPage';

export const metadata: Metadata = {
  title: 'Workbench Directory | Nexus-Bio',
  description:
    'Browse and enter the Nexus-Bio 4-stage research workbench across design, simulation, chassis engineering, and validation loops.',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkbenchDirectoryPage />
    </Suspense>
  );
}
