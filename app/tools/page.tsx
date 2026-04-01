import type { Metadata } from 'next';
import ToolsDirectoryPage from '../../src/components/tools/ToolsDirectoryPage';

export const metadata: Metadata = {
  title: 'Tools Directory | Nexus-Bio',
  description:
    'Browse, compare, and enter Nexus-Bio research tools through a unified scientific workbench directory.',
};

export default function Page() {
  return <ToolsDirectoryPage />;
}

