import type { Metadata } from 'next';
import CatalystDesignerPageClient from './CatalystDesignerPageClient';
export const metadata: Metadata = { title: 'CATDES — Catalyst Designer | Nexus-Bio' };
export default function Page() { return <CatalystDesignerPageClient />; }
