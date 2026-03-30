import type { Metadata } from 'next';
import GenMIMPageClient from './GenMIMPageClient';
export const metadata: Metadata = { title: 'GENMIM — Gene Minimization | Nexus-Bio' };
export default function Page() { return <GenMIMPageClient />; }
