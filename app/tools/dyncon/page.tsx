import type { Metadata } from 'next';
import DynConPageClient from './DynConPageClient';
export const metadata: Metadata = { title: 'DYNCON — Dynamic Control | Nexus-Bio' };
export default function Page() { return <DynConPageClient />; }
