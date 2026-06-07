'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Github, Chrome, User, Dna } from 'lucide-react';
import Link from 'next/link';
import { T } from '../../src/components/ide/tokens';
import { PATHD_THEME } from '../../src/components/workbench/workbenchTheme';

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
      background: PATHD_THEME.paper,
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
        background: `radial-gradient(circle, ${PATHD_THEME.lilac}12 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${PATHD_THEME.mint}0a 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Back link */}
      <Link
        href="/"
        style={{
          position: 'absolute', top: '24px', left: '24px',
          display: 'flex', alignItems: 'center', gap: '6px',
          color: PATHD_THEME.paperMuted,
          fontFamily: T.MONO, fontSize: T.FS_XS,
          textDecoration: 'none',
          transition: 'color 0.2s ease',
          opacity: mounted ? 1 : 0,
          transitionProperty: 'color, opacity',
          transitionDuration: '0.2s, 0.4s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.ink; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.paperMuted; }}
      >
        ← Back to Nexus-Bio
      </Link>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        borderRadius: T.R_LG,
        background: PATHD_THEME.paperSurfaceStrong,
        border: `1px solid ${PATHD_THEME.paperBorder}`,
        padding: '44px 36px 36px',
        position: 'relative',
        boxShadow: T.SHADOW_HIGH,
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
          background: PATHD_THEME.progressGradient,
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
            background: `linear-gradient(135deg, ${PATHD_THEME.lilac}18, ${PATHD_THEME.mint}12)`,
            border: `1px solid ${PATHD_THEME.paperBorder}`,
            marginBottom: '20px',
          }}>
            <Dna size={24} color={PATHD_THEME.lilac} strokeWidth={1.8} />
          </div>
          <h1 style={{
            fontFamily: T.BRAND,
            fontSize: T.FS_XL,
            fontWeight: 700,
            color: PATHD_THEME.ink,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
          }}>
            Sign in to Nexus-Bio
          </h1>
          <p style={{
            fontFamily: T.SANS,
            fontSize: T.FS_SM,
            color: PATHD_THEME.paperLabel,
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
            borderRadius: T.R_SM,
            background: `${PATHD_THEME.coral}12`,
            border: `1px solid ${PATHD_THEME.coral}28`,
            fontFamily: T.SANS,
            fontSize: T.FS_XS,
            color: PATHD_THEME.coral,
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
          <div style={{ flex: 1, height: '1px', background: PATHD_THEME.paperBorder }} />
          <span style={{
            fontFamily: T.MONO, fontSize: T.FS_XS,
            color: PATHD_THEME.inkSoft,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', background: PATHD_THEME.paperBorder }} />
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
              width: '100%', padding: '12px', borderRadius: T.R_MD,
              background: 'transparent',
              border: `1px solid ${PATHD_THEME.paperBorder}`,
              color: PATHD_THEME.paperMuted,
              fontFamily: T.SANS, fontSize: '13px', fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.2s, color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = PATHD_THEME.panelInset;
              (e.currentTarget as HTMLElement).style.color = PATHD_THEME.ink;
              (e.currentTarget as HTMLElement).style.borderColor = PATHD_THEME.paperBorderStrong;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = PATHD_THEME.paperMuted;
              (e.currentTarget as HTMLElement).style.borderColor = PATHD_THEME.paperBorder;
            }}
          >
            <User size={14} />
            Continue as Guest
          </Link>
        </div>

        {/* OAuth info note */}
        <p style={{
          fontFamily: T.MONO, fontSize: '9px',
          color: PATHD_THEME.inkSoft,
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
          fontFamily: T.SANS, fontSize: T.FS_XS,
          color: PATHD_THEME.inkSoft,
          textAlign: 'center', margin: '16px 0 0',
          lineHeight: 1.6,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.6s ease 0.45s',
        }}>
          By signing in, you agree to our{' '}
          <Link href="/terms" style={{ color: PATHD_THEME.paperMuted, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.sky; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.paperMuted; }}
          >Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{ color: PATHD_THEME.paperMuted, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.sky; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = PATHD_THEME.paperMuted; }}
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
        width: '100%', padding: '12px', borderRadius: T.R_MD,
        background: isActive ? PATHD_THEME.panelInset : PATHD_THEME.panelSurface,
        border: `1px solid ${isActive ? PATHD_THEME.paperBorderStrong : PATHD_THEME.paperBorder}`,
        color: PATHD_THEME.ink,
        fontFamily: T.SANS, fontSize: '14px', fontWeight: 500,
        cursor: isDisabled ? 'wait' : 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.1s ease',
        transform: 'translateY(0)',
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLElement).style.background = PATHD_THEME.panelInset;
          (e.currentTarget as HTMLElement).style.borderColor = PATHD_THEME.paperBorderStrong;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = isActive ? PATHD_THEME.panelInset : PATHD_THEME.panelSurface;
        (e.currentTarget as HTMLElement).style.borderColor = isActive ? PATHD_THEME.paperBorderStrong : PATHD_THEME.paperBorder;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {isActive ? (
        <span style={{
          width: '14px', height: '14px',
          border: `2px solid ${PATHD_THEME.paperBorder}`,
          borderTopColor: PATHD_THEME.sky,
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
