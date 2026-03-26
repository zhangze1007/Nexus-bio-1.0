import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service · Nexus-Bio',
};

export default function TermsPage() {
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
          Terms of Service
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
          Please read these Terms of Service carefully before using Nexus-Bio. By accessing or using
          our platform, you agree to be bound by these terms.
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
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing and using Nexus-Bio (&ldquo;the Service&rdquo;), you accept and agree to be
          bound by these Terms of Service. If you do not agree to these terms, please do not use the
          Service.
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
          2. Description of Service
        </h2>
        <p>
          Nexus-Bio is a web-based tool that uses artificial intelligence to extract metabolic
          pathway information from scientific literature and visualize it in an interactive 3D
          format. The Service is intended for research, educational, and informational purposes only.
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
          3. Intellectual Property
        </h2>
        <p>
          The Nexus-Bio platform, including its design, interface, code, and original content, is
          the intellectual property of Nexus-Bio. The AI-generated pathway visualizations produced
          from your input are provided for your personal or research use.
        </p>
        <p>
          Scientific papers and abstracts accessed through PubMed integration remain the
          intellectual property of their respective authors and publishers. Nexus-Bio does not claim
          ownership over third-party research content.
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
          4. Acceptable Use
        </h2>
        <p>
          You agree to use the Service only for lawful purposes. You must not use the Service to
          infringe upon any third-party intellectual property rights, distribute harmful content, or
          attempt to reverse-engineer the platform.
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
          5. AI-Generated Content Disclaimer
        </h2>
        <p>
          Pathway visualizations and analyses generated by our AI are for informational purposes
          only and may not be scientifically accurate in all cases. Do not rely solely on
          AI-generated outputs for critical research decisions. Always verify results against primary
          literature.
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
          6. Third-Party Services
        </h2>
        <p>
          The Service integrates with Google Gemini AI and the PubMed/NCBI database. Use of these
          services is subject to their respective terms of service and privacy policies. Nexus-Bio
          is not responsible for the availability or accuracy of third-party services.
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
          7. Limitation of Liability
        </h2>
        <p>
          Nexus-Bio is provided &ldquo;as is&rdquo; without warranties of any kind. We shall not be
          liable for any damages arising from the use or inability to use the Service, including but
          not limited to inaccuracies in AI-generated scientific content.
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
          8. Changes to Terms
        </h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the Service after
          changes constitutes acceptance of the new terms.
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
          9. Contact
        </h2>
        <p>
          For questions regarding these Terms of Service, please contact us through the contact
          section on our main page.
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
          <Link href="/privacy" style={{ color: '#6495ED', textDecoration: 'none' }}>
            Privacy Policy
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
