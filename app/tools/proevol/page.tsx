import type { Metadata } from 'next';
import ProEvolPageClient from './ProEvolPageClient';
export const metadata: Metadata = { title: 'PROEVOL — Protein Evolution Campaign Workbench | Nexus-Bio' };
export default function Page() { return <ProEvolPageClient />; }
