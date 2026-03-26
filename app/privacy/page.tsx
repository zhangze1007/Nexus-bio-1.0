import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy · Nexus-Bio',
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#a3a3a3',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: '14px',
        lineHeight: 1.8,
        padding: '0 1rem',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '6rem 0 4rem' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'rgba(255,255,255,0.25)',
            fontSize: '12px',
            fontFamily: 'monospace',
            textDecoration: 'none',
            marginBottom: '3rem',
            transition: 'color 0.15s',
          }}
        >
          ← Back to Nexus-Bio
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2.5rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              background: '#fff',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#000',
            }}
          >
            N
          </div>
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>Nexus-Bio</span>
        </div>
        <h1
          style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: '0.5rem',
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.2)',
            marginBottom: '3rem',
          }}
        >
          Last updated: March 2026
        </p>

        <p>
          Nexus-Bio is committed to protecting your privacy. This policy explains what information
          we collect and how we use it.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          1. Information We Collect
        </h2>
        <p>
          Nexus-Bio does not require account creation and does not collect personal information such
          as your name or email address. When you use the Service, text you submit for analysis is
          processed by Google Gemini AI and is subject to Google&apos;s privacy policy.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          2. How We Use Your Data
        </h2>
        <p>
          Text and files you submit are sent to the Google Gemini API solely to generate pathway
          visualizations. We do not store, log, or share your submitted content on our servers.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          3. Third-Party Services
        </h2>
        <p>
          We use the following third-party services: Google Gemini AI for content analysis, and the
          NCBI PubMed API for literature search. These services have their own privacy policies
          which govern how they handle data.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          4. Cookies
        </h2>
        <p>
          Nexus-Bio does not use tracking cookies or analytics tools that collect personal
          information.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          5. Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify users of significant
          changes by updating the date at the top of this page.
        </p>

        <h2
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '2.5rem 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          6. Contact
        </h2>
        <p>
          For privacy-related inquiries, please reach out through the contact section on our main
          page.
        </p>

        <div
          style={{
            marginTop: '4rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.15)',
          }}
        >
          © 2026 Nexus-Bio ·{' '}
          <Link href="/terms" style={{ color: '#6495ED', textDecoration: 'none' }}>
            Terms of Service
          </Link>{' '}
          ·{' '}
          <Link href="/" style={{ color: '#6495ED', textDecoration: 'none' }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
