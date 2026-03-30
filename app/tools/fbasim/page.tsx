import type { Metadata } from 'next';
import FBASimPageClient from './FBASimPageClient';
export const metadata: Metadata = { title: 'FBAsim — Flux Balance Analysis | Nexus-Bio' };
export default function Page() { return <FBASimPageClient />; }
