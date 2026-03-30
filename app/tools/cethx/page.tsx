import type { Metadata } from 'next';
import CETHXPageClient from './CETHXPageClient';
export const metadata: Metadata = { title: 'CETHX — Cell Thermodynamics | Nexus-Bio' };
export default function Page() { return <CETHXPageClient />; }
