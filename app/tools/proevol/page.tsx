import type { Metadata } from 'next';
import ProEvolPageClient from './ProEvolPageClient';
export const metadata: Metadata = { title: 'PROEVOL — Protein Evolution | Nexus-Bio' };
export default function Page() { return <ProEvolPageClient />; }
