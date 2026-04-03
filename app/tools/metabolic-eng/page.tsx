import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pathway & Enzyme Design | Nexus-Bio',
  description:
    'Redirecting to the unified Pathway & Enzyme Design workbench.',
};

// LAB merged into PATHD — redirect for backward compatibility
export default function Page() {
  redirect('/tools/pathd');
}
