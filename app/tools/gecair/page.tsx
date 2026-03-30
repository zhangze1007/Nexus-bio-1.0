import type { Metadata } from 'next';
import GECAIRPageClient from './GECAIRPageClient';
export const metadata: Metadata = { title: 'GECAIR — Gene Circuit Reasoner | Nexus-Bio' };
export default function Page() { return <GECAIRPageClient />; }
