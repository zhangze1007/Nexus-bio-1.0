import type { Metadata } from 'next';
import ScSpatialPageClient from './ScSpatialPageClient';
export const metadata: Metadata = { title: 'sc-Spatial — Single-cell & Spatial | Nexus-Bio' };
export default function Page() { return <ScSpatialPageClient />; }
