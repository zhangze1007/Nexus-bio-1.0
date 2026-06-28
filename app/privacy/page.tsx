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
              background: '#0a0a0a',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#e2e8f0',
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
          Last updated: June 2026
        </p>

        <p>
          Nexus-Bio is committed to protecting your privacy. This policy explains what information
          we collect, how we use it, and how you can exercise your data rights under GDPR.
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
          We store project data, experiment records, and audit logs in a server-side SQLite database
          to support the workbench feature. Project data includes pathway designs, experiment
          parameters, and run artifacts. Audit logs record sync events and project history for
          traceability. We use PostHog for anonymous usage analytics to improve the platform. UI
          preferences such as panel layout and theme settings are stored locally in your browser
          via localStorage and never leave your device.
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
          Research queries you submit are processed by Groq (primary) and Google Gemini (fallback)
          AI APIs to generate pathway analyses, literature summaries, and scientific insights.
          Submitted text is sent to these providers solely to fulfill your request and is subject to
          their respective privacy policies. We do not sell or share your data with third parties
          for advertising purposes. PostHog analytics data is anonymized and used only to understand
          aggregate usage patterns and improve the platform.
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
          We use the following third-party services: Groq and Google Gemini for AI-powered research
          analysis, PostHog for anonymous analytics, and external scientific databases (PubChem,
          AlphaFold, KEGG, NCBI) for data retrieval. Each service has its own privacy policy
          governing how it handles data.
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
          4. Cookies and Session Management
        </h2>
        <p>
          We use cookies for session management to maintain your authenticated state across page
          loads. These cookies are essential for the workbench sync feature and are not used for
          tracking or advertising. You may disable cookies in your browser settings, though this
          may limit workbench functionality.
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
          5. Legal Basis for Processing (GDPR Art. 6)
        </h2>
        <p>
          We process personal data on the following legal bases: (a) <strong>Consent</strong> — when you
          explicitly agree to analytics or marketing communications; (b) <strong>Legitimate interest</strong> —
          to maintain and improve the platform, prevent abuse, and ensure security; (c) <strong>Contractual
          necessity</strong> — to provide the services you request, including workbench state persistence
          and AI-powered analysis. You may withdraw consent at any time without affecting the lawfulness
          of processing based on consent before its withdrawal.
        </p>

        <h2
        </h2>
        <p>
          Under the General Data Protection Regulation, you have the right to request access to,
          correction of, or deletion of your personal data. You can also request a portable export
          of your data. To exercise these rights, use the GDPR endpoints available through the
          platform API or contact us directly. We will respond to verified requests within 30 days.
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
          6. Changes to This Policy
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
          7. Contact
        </h2>
        <p>
          For privacy-related inquiries or data deletion requests, please email
          fuchanze@gmail.com or use the contact form on our main page.
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
