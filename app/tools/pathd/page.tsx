import type { Metadata } from 'next';
import PathDClient from './PathDClient';

export const metadata: Metadata = {
  title: 'PATHD — Pathway & Enzyme Design | Nexus-Bio',
  description: '3D metabolic pathway visualization with flux particles, enzyme design, and AI-extracted biosynthesis routes.',
};

export default function Page() {
  return <PathDClient />;
}
