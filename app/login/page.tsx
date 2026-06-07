'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Github, Chrome, User } from 'lucide-react';
import Link from 'next/link';
import { T } from '../../src/components/ide/tokens';

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = (provider: string) => {
    setLoading(provider);
    signIn(provider, { callbackUrl: '/tools' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          position: 'absolute', top: '24px', left: '24px',
          display: 'flex', alignItems: 'center', gap: '6px',
          color: 'rgba(255,255,255,0.3)',
          fontFamily: T.MONO, fontSize: '11px',
          textDecoration: 'none',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
      >
        ← Back to Nexus-Bio
      </Link>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '40px 32px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: T.BRAND,
            fontSize: '24px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}>
            Sign in to Nexus-Bio
          </h1>
          <p style={{
            fontFamily: T.SANS,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.4)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            Access your research projects, save pathway designs,<br />
            and collaborate with your team.
          </p>
        </div>

        {/* OAuth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => handleSignIn('github')}
            disabled={!!loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '12px', borderRadius: '10px',
              background: loading === 'github' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: T.SANS, fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <Github size={16} />
            Continue with GitHub
          </button>

          <button
            onClick={() => handleSignIn('google')}
            disabled={!!loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '12px', borderRadius: '10px',
              background: loading === 'google' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: T.SANS, fontSize: '14px', fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <Chrome size={16} />
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span style={{
            fontFamily: T.MONO, fontSize: '10px',
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Guest access */}
        <Link
          href="/tools"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '12px', borderRadius: '10px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: T.SANS, fontSize: '13px', fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <User size={14} />
          Continue as Guest
        </Link>

        {/* Footer */}
        <p style={{
          fontFamily: T.SANS, fontSize: '11px',
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center', margin: '24px 0 0',
          lineHeight: 1.6,
        }}>
          By signing in, you agree to our{' '}
          <Link href="/terms" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
