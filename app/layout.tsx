import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import WorkbenchSyncProvider from '../src/components/workbench/WorkbenchSyncProvider';

export const metadata: Metadata = {
  title: 'Nexus-Bio | Synthetic Biology Research Workbench',
  description:
    'Nexus-Bio is a 4-stage synthetic biology research workbench for pathway design, simulation, chassis/control strategy, and validation loops.',
  keywords:
    'Nexus-Bio, synthetic biology, research workbench, metabolic pathway, flux balance analysis, DBTL, omics, bioinformatics',
  openGraph: {
    title: 'Nexus-Bio | Synthetic Biology Research Workbench',
    description:
      'From literature to validated pathway decisions across design, simulation, chassis engineering, and test loops.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Public Sans + IBM Plex Mono support the scientific workbench typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Public+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=Source+Serif+4:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <WorkbenchSyncProvider />
        </Suspense>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
