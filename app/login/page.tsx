'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Github, Chrome, User, Dna } from 'lucide-react';
import Link from 'next/link';
import { THEME } from '../../src/theme';
export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignIn = async (provider: string) => {
    setLoading(provider);
    setError(null);
    try {
      const result = await signIn(provider, {
        callbackUrl: '/tools',
        redirect: false,
      });
      if (result?.error) {
        setError(`OAuth provider "${provider}" is not configured. Please check server environment variables.`);
        setLoading(null);
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Sign-in failed. The OAuth provider may not be configured on this server.');
      setLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.PAPER,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${THEME.LILAC}12 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${THEME.MINT}0a 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Back link */}
      <Link
        href="/"
        style={{
          position: 'absolute', top: '24px', left: '24px',
          display: 'flex', alignItems: 'center', gap: '6px',
          color: THEME.PAPER_MUTED,
          fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
          textDecoration: 'none',
          transition: 'color 0.2s ease',
          opacity: mounted ? 1 : 0,
          transitionProperty: 'color, opacity',
          transitionDuration: '0.2s, 0.4s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = THEME.INK; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = THEME.PAPER_MUTED; }}
      >
        ← Back to Nexus-Bio
      </Link>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        borderRadius: THEME.R_LG,
        background: THEME.PANEL_STRONG,
        border: `1px solid ${THEME.PAPER_BORDER}`,
        padding: '44px 36px 36px',
        position: 'relative',
        boxShadow: THEME.SHADOW_HIGH,
        backdropFilter: 'blur(12px)',
        // Fade-in animation
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '2px',
          borderRadius: '1px',
          background: THEME.PROGRESS_GRADIENT,
          opacity: 0.6,
        }} />

        {/* Logo + Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '36px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${THEME.LILAC}18, ${THEME.MINT}12)`,
            border: `1px solid ${THEME.PAPER_BORDER}`,
            marginBottom: '20px',
          }}>
            <Dna size={24} color={THEME.LILAC} strokeWidth={1.8} />
          </div>
          <h1 style={{
            fontFamily: THEME.BRAND,
            fontSize: THEME.FS_XL,
            fontWeight: 700,
            color: THEME.INK,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
          }}>
            Sign in to Nexus-Bio
          </h1>
          <p style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.PAPER_LABEL,
            margin: 0,
            lineHeight: 1.6,
          }}>
            Access your research projects, save pathway designs,<br />
            and collaborate with your team.
          </p>
        </div>

        {/* OAuth buttons */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s',
        }}>
          <OAuthButton
            provider="github"
            icon={<Github size={16} />}
            label="Continue with GitHub"
            loading={loading}
            onClick={handleSignIn}
          />
          <OAuthButton
            provider="google"
            icon={<Chrome size={16} />}
            label="Continue with Google"
            loading={loading}
            onClick={handleSignIn}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: THEME.R_SM,
            background: `${THEME.CORAL}12`,
            border: `1px solid ${THEME.CORAL}28`,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_XS,
            color: THEME.CORAL,
            lineHeight: 1.5,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
          }}>
            {error}
          </div>
        )}

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: THEME.PAPER_BORDER }} />
          <span style={{
            fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', background: THEME.PAPER_BORDER }} />
        </div>

        {/* Guest access */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.6s ease 0.35s',
        }}>
          <Link
            href="/tools"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px', borderRadius: THEME.R_MD,
              background: 'transparent',
              border: `1px solid ${THEME.PAPER_BORDER}`,
              color: THEME.PAPER_MUTED,
              fontFamily: THEME.SANS, fontSize: '13px', fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.2s, color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = THEME.PANEL_INSET;
              (e.currentTarget as HTMLElement).style.color = THEME.INK;
              (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER_STRONG;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = THEME.PAPER_MUTED;
              (e.currentTarget as HTMLElement).style.borderColor = THEME.PAPER_BORDER;
            }}
          >
            <User size={14} />
            Continue as Guest
          </Link>
        </div>

        {/* OAuth info note */}
        <p style={{
          fontFamily: THEME.MONO, fontSize: '9px',
          color: THEME.INK_SOFT,
          textAlign: 'center', margin: '16px 0 0',
          lineHeight: 1.6,
          letterSpacing: '0.02em',
          opacity: mounted ? 0.6 : 0,
          transition: 'opacity 0.6s ease 0.4s',
        }}>
          OAuth providers require server-side configuration.<br />
          Guest access works without setup.
        </p>

        {/* Footer */}
        <p style={{
          fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
          color: THEME.INK_SOFT,
          textAlign: 'center', margin: '16px 0 0',
          lineHeight: 1.6,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.6s ease 0.45s',
        }}>
          By signing in, you agree to our{' '}
          <Link href="/terms" style={{ color: THEME.PAPER_MUTED, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = THEME.SKY; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = THEME.PAPER_MUTED; }}
          >Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{ color: THEME.PAPER_MUTED, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = THEME.SKY; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = THEME.PAPER_MUTED; }}
          >Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

/* ─── OAuth Button Subcomponent ─── */

function OAuthButton({
  provider,
  icon,
  label,
  loading,
  onClick,
}: {
  provider: string;
  icon: React.ReactNode;
  label: string;
  loading: string | null;
  onClick: (provider: string) => void;
}) {
  const isActive = loading === provider;
  const isDisabled = !!loading;

  return (
    <button
      onClick={() => onClick(provider)}
      disabled={isDisabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '12px', borderRadius: THEME.R_MD,
        background: isActive ? THEME.PANEL_INSET : THEME.PANEL_SURFACE,
        border: `1px solid ${isActive ? THEME.BORDER_STRONG : THEME.PAPER_BORDER}`,
        color: THEME.INK,
        fontFamily: THEME.SANS, fontSize: '14px', fontWeight: 500,
        cursor: isDisabled ? 'wait' : 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.1s ease',
        transform: 'translateY(0)',
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.background = THEME.PANEL_INSET;
          (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER_STRONG;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = isActive ? THEME.PANEL_INSET : THEME.PANEL_SURFACE;
        (e.currentTarget as HTMLElement).style.borderColor = isActive ? THEME.BORDER_STRONG : THEME.PAPER_BORDER;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {isActive ? (
        <span style={{
          width: '14px', height: '14px',
          border: `2px solid ${THEME.PAPER_BORDER}`,
          borderTopColor: THEME.SKY,
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
