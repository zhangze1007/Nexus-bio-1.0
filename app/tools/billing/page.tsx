import type { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';

export const metadata: Metadata = {
  title: 'Billing — Nexus-Bio',
  description: 'Manage your Nexus-Bio subscription and billing',
};

export default function Page() {
  return <BillingPageClient />;
}
