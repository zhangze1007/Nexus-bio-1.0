import type { Metadata } from 'next';
import CellFreePageClient from './CellFreePageClient';
export const metadata: Metadata = { title: 'CFS — Cell-Free Sandbox | Nexus-Bio' };
export default function Page() { return <CellFreePageClient />; }
