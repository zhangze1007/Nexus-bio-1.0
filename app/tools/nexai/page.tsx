import type { Metadata } from 'next';
import NEXAIPageClient from './NEXAIPageClient';
export const metadata: Metadata = { title: 'NEXAI — AI Research Agent | Nexus-Bio' };
export default function Page() { return <NEXAIPageClient />; }
