import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import '../src/styles/fonts.css';
import '../src/styles/animations.css';
import WorkbenchSyncProvider from '../src/components/workbench/WorkbenchSyncProvider';
import { RouteTransition } from '../src/components/shared/RouteTransition';
import { OnboardingOverlay } from '../src/components/shared/OnboardingOverlay';
import AuthProvider from '../src/components/auth/AuthProvider';
import QueryProvider from '../src/components/providers/QueryProvider';
import WebVitals from '../src/components/WebVitals';
import WorkflowBanner from '../src/components/WorkflowBanner';

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
      <head />
      <body>
        <WebVitals />
        {/* Skip-to-content: keyboard a11y — first focusable element */}
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <QueryProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <WorkbenchSyncProvider />
            </Suspense>
            <div id="root">
              <WorkflowBanner />
              <RouteTransition>
                <main id="main-content">{children}</main>
              </RouteTransition>
            </div>
            <OnboardingOverlay />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
