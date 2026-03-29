import type { Metadata } from 'next';
import MetabolicEngClient from './MetabolicEngClient';

export const metadata: Metadata = {
  title: 'Metabolic Engineering Lab | Nexus-Bio',
  description:
    'Real-time flux balance analysis, Michaelis-Menten kinetics simulation, and cytoplasm fluid dynamics for metabolic pathway engineering.',
};

// Server Component — only renders the client shell (no WebGL here)
export default function Page() {
  return <MetabolicEngClient />;
}
