import type { Metadata } from 'next';
import MultiOPageClient from './MultiOPageClient';
export const metadata: Metadata = { title: 'MULTIO — Multi-Omics | Nexus-Bio' };
export default function Page() { return <MultiOPageClient />; }
