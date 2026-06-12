'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { Github, Chrome, ArrowRight, Shield, Lock, Globe } from 'lucide-react';
import Link from 'next/link';

/**
 * Login Page — Scientific Elegance
 *
 * Design direction: Institutional authority meets research precision.
 * Target: Synthetic biology researchers, PhDs, enterprise consultants.
 *
 * Typography: Source Serif 4 (headings) + IBM Plex Sans (body)
 * Aesthetic: Dark, refined, subtle molecular visualization
 */

// ─── Design Tokens ────────────────────────────────────────────────────────

const T = {
  // Surfaces
  BG: '#08090c',
  CARD: 'rgba(14, 16, 22, 0.85)',
  CARD_BORDER: 'rgba(255, 255, 255, 0.06)',
  CARD_GLOW: 'rgba(191, 220, 205, 0.03)',

  // Text
  INK: 'rgba(250, 246, 240, 0.94)',
  INK_MID: 'rgba(250, 246, 240, 0.6)',
  INK_SOFT: 'rgba(250, 246, 240, 0.35)',
  INK_GHOST: 'rgba(250, 246, 240, 0.18)',

  // Accents
  MINT: '#BFDCCD',
  LILAC: '#CFC4E3',
  SKY: '#AFC3D6',
  APRICOT: '#E8D8C4',
  CORAL: '#E8A3A1',

  // Fonts
  SERIF: "'Source Serif 4', 'Georgia', serif",
  SANS: "'IBM Plex Sans', -apple-system, sans-serif",
  MONO: "'IBM Plex Mono', 'Menlo', monospace",

  // Spacing
  SP_XS: 4,
  SP_SM: 8,
  SP_MD: 16,
  SP_LG: 24,
  SP_XL: 40,
  SP_2XL: 64,

  // Radius
  R_SM: 8,
  R_MD: 12,
  R_LG: 16,
  R_XL: 20,
};

// ─── Molecular Visualization ──────────────────────────────────────────────

function MolecularGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Nodes — positioned to suggest a metabolic pathway
    const nodes = [
      { x: 0.12, y: 0.25, r: 3, label: 'Acetyl-CoA' },
      { x: 0.28, y: 0.18, r: 2.5, label: 'HMG-CoA' },
      { x: 0.42, y: 0.32, r: 3, label: 'Mevalonate' },
      { x: 0.58, y: 0.22, r: 2, label: 'FPP' },
      { x: 0.72, y: 0.35, r: 3.5, label: 'Amorpha-4,11-diene' },
      { x: 0.85, y: 0.28, r: 2.5, label: 'Artemisinic acid' },
      { x: 0.92, y: 0.42, r: 4, label: 'Artemisinin' },
      // Branch points
      { x: 0.2, y: 0.55, r: 1.5, label: '' },
      { x: 0.35, y: 0.65, r: 2, label: '' },
      { x: 0.55, y: 0.58, r: 1.5, label: '' },
      { x: 0.75, y: 0.62, r: 2, label: '' },
      { x: 0.88, y: 0.55, r: 1.5, label: '' },
    ];

    // Edges — pathway connections
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
      [0, 7], [7, 8], [8, 9], [9, 10], [10, 11],
      [2, 8], [4, 9], [5, 10],
    ];

    let time = 0;

    function draw() {
      if (!ctx || !canvas) return;
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Draw edges
      edges.forEach(([a, b]) => {
        const na = nodes[a];
        const nb = nodes[b];
        const ax = na.x * w;
        const ay = na.y * h;
        const bx = nb.x * w;
        const by = nb.y * h;

        // Animated flow
        const flowOffset = (time * 0.0005) % 1;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = `rgba(191, 220, 205, ${0.04 + Math.sin(time * 0.001 + a) * 0.02})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Flow dot
        const dotX = ax + (bx - ax) * flowOffset;
        const dotY = ay + (by - ay) * flowOffset;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(191, 220, 205, ${0.15 + Math.sin(time * 0.002) * 0.1})`;
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach((node, i) => {
        const x = node.x * w;
        const y = node.y * h;
        const pulse = Math.sin(time * 0.002 + i * 0.5) * 0.3 + 0.7;

        // Glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, node.r * 8);
        gradient.addColorStop(0, `rgba(191, 220, 205, ${0.08 * pulse})`);
        gradient.addColorStop(1, 'rgba(191, 220, 205, 0)');
        ctx.beginPath();
        ctx.arc(x, y, node.r * 8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(x, y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(191, 220, 205, ${0.3 + pulse * 0.2})`;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(x, y, node.r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(191, 220, 205, ${0.08 + pulse * 0.05})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      time += 16;
      requestAnimationFrame(draw);
    }

    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Trust Badges ─────────────────────────────────────────────────────────

function TrustBar() {
  const items = [
    { icon: Shield, label: 'End-to-end encrypted' },
    { icon: Lock, label: 'SOC 2 compliant' },
    { icon: Globe, label: 'GDPR ready' },
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: T.SP_LG,
      marginTop: T.SP_XL,
      opacity: 0,
      animation: 'fadeInUp 0.6s ease 0.8s forwards',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: T.MONO,
          fontSize: '10px',
          color: T.INK_GHOST,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          <item.icon size={11} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ─── OAuth Button ─────────────────────────────────────────────────────────

function OAuthButton({
  provider,
  icon,
  label,
  sublabel,
  loading,
  onClick,
  delay,
}: {
  provider: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  loading: string | null;
  onClick: (provider: string) => void;
  delay: number;
}) {
  const isActive = loading === provider;
  const isDisabled = !!loading;

  return (
    <button
      onClick={() => onClick(provider)}
      disabled={isDisabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: T.SP_MD,
        width: '100%',
        padding: '14px 16px',
        borderRadius: T.R_MD,
        background: isActive ? 'rgba(191, 220, 205, 0.06)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isActive ? 'rgba(191, 220, 205, 0.15)' : T.CARD_BORDER}`,
        color: T.INK,
        fontFamily: T.SANS,
        fontSize: '14px',
        fontWeight: 500,
        cursor: isDisabled ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: 0,
        animation: `fadeInUp 0.5s ease ${delay}s forwards`,
        textAlign: 'left',
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          e.currentTarget.style.background = 'rgba(191, 220, 205, 0.04)';
          e.currentTarget.style.borderColor = 'rgba(191, 220, 205, 0.12)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isActive ? 'rgba(191, 220, 205, 0.06)' : 'rgba(255, 255, 255, 0.02)';
        e.currentTarget.style.borderColor = isActive ? 'rgba(191, 220, 205, 0.15)' : T.CARD_BORDER;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Icon container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: T.R_SM,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        flexShrink: 0,
      }}>
        {isActive ? (
          <div style={{
            width: 16,
            height: 16,
            border: `2px solid ${T.INK_GHOST}`,
            borderTopColor: T.MINT,
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }} />
        ) : (
          <span style={{ color: T.INK_MID }}>{icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</div>
        <div style={{
          fontFamily: T.MONO,
          fontSize: '11px',
          color: T.INK_SOFT,
          marginTop: 2,
        }}>
          {sublabel}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight size={14} style={{
        color: T.INK_GHOST,
        transition: 'transform 0.2s',
      }} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

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
        setError('Unable to connect. Please try again.');
        setLoading(null);
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Connection failed. Please try again.');
      setLoading(null);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: T.BG,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* ─── Left: Molecular Visualization ─── */}
        <div style={{
          flex: '1 1 55%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: T.SP_2XL,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 1s ease 0.2s',
        }}>
          <MolecularGrid />

          {/* Brand mark */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontFamily: T.MONO,
              fontSize: '11px',
              color: T.INK_GHOST,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: T.SP_LG,
              opacity: 0,
              animation: 'fadeInUp 0.6s ease 0.3s forwards',
            }}>
              Synthetic Biology Research Workbench
            </div>

            <h1 style={{
              fontFamily: T.SERIF,
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 400,
              color: T.INK,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
              maxWidth: 480,
              opacity: 0,
              animation: 'fadeInUp 0.6s ease 0.4s forwards',
            }}>
              From literature to{' '}
              <span style={{ color: T.MINT, fontStyle: 'italic' }}>validated</span>{' '}
              pathway decisions
            </h1>

            <p style={{
              fontFamily: T.SANS,
              fontSize: '15px',
              color: T.INK_MID,
              lineHeight: 1.7,
              marginTop: T.SP_LG,
              maxWidth: 400,
              opacity: 0,
              animation: 'fadeInUp 0.6s ease 0.5s forwards',
            }}>
              14 integrated tools for pathway design, flux balance analysis,
              protein evolution, and multi-omics validation.
            </p>

            {/* Stats */}
            <div style={{
              display: 'flex',
              gap: T.SP_XL,
              marginTop: T.SP_XL,
              opacity: 0,
              animation: 'fadeInUp 0.6s ease 0.6s forwards',
            }}>
              {[
                { value: '14', label: 'Research Tools' },
                { value: '4', label: 'DBTL Stages' },
                { value: '< 2ms', label: 'FBA Solve Time' },
              ].map((stat, i) => (
                <div key={i}>
                  <div style={{
                    fontFamily: T.SERIF,
                    fontSize: '28px',
                    fontWeight: 600,
                    color: T.MINT,
                    letterSpacing: '-0.02em',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontFamily: T.MONO,
                    fontSize: '10px',
                    color: T.INK_GHOST,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginTop: 4,
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right: Sign In Card ─── */}
        <div style={{
          flex: '0 0 440px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: T.SP_2XL,
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Subtle left border glow */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: '10%',
            bottom: '10%',
            width: 1,
            background: `linear-gradient(to bottom, transparent, ${T.CARD_BORDER}, transparent)`,
          }} />

          <div style={{
            maxWidth: 360,
            margin: '0 auto',
            width: '100%',
          }}>
            {/* Card header */}
            <div style={{
              opacity: 0,
              animation: 'fadeInUp 0.5s ease 0.4s forwards',
            }}>
              <h2 style={{
                fontFamily: T.SERIF,
                fontSize: '24px',
                fontWeight: 600,
                color: T.INK,
                letterSpacing: '-0.02em',
                margin: 0,
              }}>
                Sign in
              </h2>
              <p style={{
                fontFamily: T.SANS,
                fontSize: '13px',
                color: T.INK_SOFT,
                margin: '8px 0 0',
                lineHeight: 1.5,
              }}>
                Access your research projects and pathway designs.
              </p>
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              background: T.CARD_BORDER,
              margin: `${T.SP_LG}px 0`,
              opacity: 0,
              animation: 'fadeInUp 0.5s ease 0.5s forwards',
            }} />

            {/* OAuth buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: T.SP_SM,
            }}>
              <OAuthButton
                provider="github"
                icon={<Github size={18} />}
                label="Continue with GitHub"
                sublabel="For researchers & developers"
                loading={loading}
                onClick={handleSignIn}
                delay={0.55}
              />
              <OAuthButton
                provider="google"
                icon={<Chrome size={18} />}
                label="Continue with Google"
                sublabel="For institutional accounts"
                loading={loading}
                onClick={handleSignIn}
                delay={0.65}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: T.SP_MD,
                padding: '10px 14px',
                borderRadius: T.R_SM,
                background: 'rgba(232, 163, 161, 0.06)',
                border: '1px solid rgba(232, 163, 161, 0.15)',
                fontFamily: T.SANS,
                fontSize: '12px',
                color: T.CORAL,
                textAlign: 'center',
                animation: 'fadeInUp 0.3s ease',
              }}>
                {error}
              </div>
            )}

            {/* Guest link */}
            <div style={{
              marginTop: T.SP_LG,
              textAlign: 'center',
              opacity: 0,
              animation: 'fadeInUp 0.5s ease 0.75s forwards',
            }}>
              <Link
                href="/tools"
                style={{
                  fontFamily: T.MONO,
                  fontSize: '11px',
                  color: T.INK_GHOST,
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = T.INK_SOFT; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.INK_GHOST; }}
              >
                Continue as guest →
              </Link>
            </div>

            {/* Trust bar */}
            <TrustBar />

            {/* Footer */}
            <div style={{
              marginTop: T.SP_XL,
              textAlign: 'center',
              opacity: 0,
              animation: 'fadeInUp 0.5s ease 0.9s forwards',
            }}>
              <p style={{
                fontFamily: T.MONO,
                fontSize: '10px',
                color: T.INK_GHOST,
                lineHeight: 1.6,
                margin: 0,
              }}>
                By signing in, you agree to our{' '}
                <Link href="/terms" style={{ color: T.INK_SOFT, textDecoration: 'none' }}>Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" style={{ color: T.INK_SOFT, textDecoration: 'none' }}>Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Background gradient ─── */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '60%',
          height: '60%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${T.CARD_GLOW} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
      </div>
    </>
  );
}
