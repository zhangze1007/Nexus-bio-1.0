import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact | Nexus-Bio',
  description: 'Get in touch with the Nexus-Bio team.',
};

export default function Page() {
  return <ContactClient />;
}
