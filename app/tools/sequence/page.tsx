import type { Metadata } from 'next';
import SequencePageClient from './SequencePageClient';
export const metadata: Metadata = { title: 'SEQED — Sequence Editor | Nexus-Bio' };
export default function Page() { return <SequencePageClient />; }
