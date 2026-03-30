import type { Metadata } from 'next';
import DBTLflowPageClient from './DBTLflowPageClient';
export const metadata: Metadata = { title: 'DBTLflow — DBTL Tracker | Nexus-Bio' };
export default function Page() { return <DBTLflowPageClient />; }
