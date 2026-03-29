import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus-Bio | Next-Gen Bio-Intelligent Architecture',
  description:
    'Nexus-Bio: AI-powered synthetic biology research platform. Extract metabolic pathways, visualize 3D molecular structures, and simulate enzyme kinetics from any research paper.',
  keywords:
    'Nexus-Bio, synthetic biology, metabolic pathway, AlphaFold, PubChem, enzyme kinetics, bioinformatics',
  openGraph: {
    title: 'Nexus-Bio | Next-Gen Bio-Intelligent Architecture',
    description:
      'From literature to mechanistic insight — AI-powered metabolic pathway visualization and analysis.',
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
        {/* DM Serif Display — editorial titles */}
        {/* Inter — clean body text */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
