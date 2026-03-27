'use client';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Dna, BookOpen, Microscope, ShieldCheck, Activity } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';

// ── Typography system ─────────────────────────────────────────────────
const SERIF = "'DM Serif Display', Georgia, 'Times New Roman', serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";
const MONO  = "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace";
const METAL_HIGHLIGHT = 'rgb(var(--accent-primary-rgb) / 0.16)';
const METAL_SHEEN = 'rgb(var(--accent-secondary-rgb) / 0.06)';
const METAL_SHEEN_SOFT = 'rgb(var(--accent-secondary-rgb) / 0.05)';
const METAL_SURFACE = 'rgb(var(--bg-elevated-rgb) / 0.92)';
const METAL_DEPTH = 'rgb(var(--bg-surface-rgb) / 0.92)';
const METAL_DEPTH_SOFT = 'rgb(var(--bg-surface-rgb) / 0.18)';

// ── Font loader ───────────────────────────────────────────────────────
function useFonts() {
  useEffect(() => {
    if (document.getElementById('nexus-fonts')) return;
    const link = document.createElement('link');
    link.id = 'nexus-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ── Cursor parallax ───────────────────────────────────────────────────
function useCursorParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setPos({ x, y });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return pos;
}

// ── Animated orb background ───────────────────────────────────────────
function DeepBackground({ cx }: { cx: { x: number; y: number } }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>

      {/* Base */}
      <div style={{ position: 'absolute', inset: 0, background: 'transparent' }} />

      {/* Orb 1 — top left, slow drift */}
      <motion.div
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-20%', left: '-10%',
          width: '70vw', height: '70vw',
          background: `linear-gradient(140deg, ${METAL_HIGHLIGHT} 0%, ${METAL_SHEEN} 24%, ${METAL_DEPTH} 62%, transparent 82%)`,
          filter: 'blur(22px)',
          transform: `translate(${cx.x * -18}px, ${cx.y * -12}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '48% 52% 64% 36% / 42% 40% 60% 58%',
          boxShadow: 'inset -18px -20px 40px rgba(0,0,0,0.55), inset 10px 12px 18px rgba(255,255,255,0.08)',
          opacity: 0.9,
        }}
      />

      {/* Orb 2 — bottom right */}
      <motion.div
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{
          position: 'absolute',
          bottom: '-25%', right: '-15%',
          width: '65vw', height: '65vw',
          background: `linear-gradient(220deg, rgb(var(--accent-primary-rgb) / 0.14) 0%, ${METAL_SHEEN_SOFT} 22%, ${METAL_SURFACE} 58%, transparent 80%)`,
          filter: 'blur(28px)',
          transform: `translate(${cx.x * 14}px, ${cx.y * 10}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '58% 42% 38% 62% / 44% 58% 42% 56%',
          boxShadow: 'inset 20px 16px 28px rgba(255,255,255,0.05), inset -26px -24px 50px rgba(0,0,0,0.6)',
          opacity: 0.88,
        }}
      />

      {/* Orb 3 — center, very faint */}
      <motion.div
        animate={{ scale: [1, 1.12, 0.95, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: `translate(-50%, -50%) translate(${cx.x * -8}px, ${cx.y * -6}px)`,
          width: '50vw', height: '50vw',
          background: `radial-gradient(ellipse at 42% 34%, rgb(var(--accent-primary-rgb) / 0.14) 0%, ${METAL_SHEEN_SOFT} 28%, ${METAL_DEPTH_SOFT} 52%, transparent 72%)`,
          filter: 'blur(26px)',
          transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '42% 58% 46% 54% / 58% 42% 58% 42%',
        }}
      />

      {/* Noise grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        backgroundSize: '180px',
        opacity: 0.3,
        mixBlendMode: 'soft-light',
      }} />
    </div>
  );
}

// ── Glass card ────────────────────────────────────────────────────────
function GlassChip({ value, label, delay }: { value: string; label: string; delay: number }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 24px', borderRadius: '14px', minWidth: '100px',
        background: hov ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: hov
          ? '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'default',
      }}>
      <span style={{ fontFamily: SERIF, fontSize: '1.75rem', color: hov ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '6px' }}>
        {label}
      </span>
    </motion.div>
  );
}

// ── Scroll reveal wrapper ─────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export { Reveal };

// ── Main Hero ─────────────────────────────────────────────────────────
export default function Hero() {
  useFonts();
  const ref = useRef<HTMLElement>(null);
  const cursor = useCursorParallax();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y       = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale   = useTransform(scrollYProgress, [0, 0.5], [1, 0.97]);

  return (
    <header ref={ref} style={{
      position: 'relative', width: '100%', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      <DeepBackground cx={cursor} />

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '60px',
        background: 'rgba(7,10,14,0.75)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
        pointerEvents: 'auto',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(180,210,240,0.08)',
          }}>
            <Dna size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </div>
          <span style={{ fontFamily: SERIF, fontSize: '15px', color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em' }}>
            Nexus-Bio 1.1
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {[['Visualize','demo'],['Search','search'],['Analyze','analyzer'],['Contact','contact']].map(([label, id]) => (
            <a key={id} href={`#${id}`} style={{
              fontFamily: BODY, fontSize: '12px', fontWeight: 400,
              color: 'rgba(255,255,255,0.32)',
              textDecoration: 'none', letterSpacing: '0.03em',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.78)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}> 
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <a href="#analyzer" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 18px', borderRadius: '16px',
          background: 'rgba(255,255,255,0.055)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(12px)',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: BODY, fontSize: '12px', fontWeight: 400,
          textDecoration: 'none', transition: 'all 0.2s',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(255,255,255,0.1)';
            el.style.color = '#fff';
            el.style.borderColor = 'rgba(255,255,255,0.16)';
            el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(255,255,255,0.055)';
            el.style.color = 'rgba(255,255,255,0.6)';
            el.style.borderColor = 'rgba(255,255,255,0.09)';
            el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06)';
          }}>
          Access Engine <ArrowRight size={11} />
        </a>
      </nav>

      {/* ── Hero content — parallax layer ── */}
      <motion.div style={{
        y, opacity, scale,
        position: 'relative', zIndex: 10,
        textAlign: 'center', maxWidth: '1000px', width: '100%',
        paddingTop: '80px',
        transform: `translate(${cursor.x * -6}px, ${cursor.y * -4}px)`,
        transition: 'transform 1s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'auto',
      }}>

        {/* Badge — glass pill */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22,1,0.36,1] }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '9px',
            padding: '6px 18px', borderRadius: '100px', marginBottom: '40px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 2px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(180,215,245,0.6)', boxShadow: '0 0 6px rgba(180,215,245,0.4)', flexShrink: 0 }}
          />
          <span style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>
            Next-Gen Biosynthesis Engine
          </span>
        </motion.div>

        {/* Main title — 保持放大的尺寸，但颜色回归高级黑白灰 */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: [0.22,1,0.36,1] }}
          style={{
            fontFamily: SERIF, fontWeight: 400, fontStyle: 'normal',
            fontSize: 'clamp(2.5rem, 6.5vw, 5rem)',
            lineHeight: 1.1, letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.95)',
            margin: '0 0 24px',
            textShadow: '0 0 80px rgba(180,210,240,0.15)',
          }}>
          From Literature
          <br />
          <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'normal' }}>
            to Mechanistic Insight
          </span>
        </motion.h1>

        {/* Subtitle — Arial/body */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.18 }}
          style={{
            fontFamily: BODY, fontSize: 'clamp(14px, 1.8vw, 18px)',
            fontWeight: 400, lineHeight: 1.8,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: '680px', margin: '0 auto 16px',
            letterSpacing: '0.01em',
          }}>
          Transform complex metabolic engineering papers into verifiable 3D actionable pathways. Predict impurities, optimize yield, and track every decision in minutes.
        </motion.p>

        {/* CTAs — glass buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.36 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '36px', marginBottom: '64px' }}>

          {/* Primary CTA */}
          <a href="#analyzer" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '16px 36px', borderRadius: '30px',
            background: '#ffffff', color: '#07090d',
            fontFamily: BODY, fontSize: '14px', fontWeight: 700,
            textDecoration: 'none', letterSpacing: '-0.01em',
            boxShadow: '0 0 0 0 rgba(255,255,255,0)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#e8e8e8';
              el.style.transform = 'translateY(-3px) scale(1.02)';
              el.style.boxShadow = '0 8px 30px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#ffffff';
              el.style.transform = 'none';
              el.style.boxShadow = '0 0 0 0 rgba(255,255,255,0)';
            }}>
            Initialize Pilot Demo <ArrowRight size={14} />
          </a>

          {/* Secondary CTA */}
          <a href="#search" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '16px 36px', borderRadius: '30px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(16px)',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: BODY, fontSize: '14px', fontWeight: 600,
            textDecoration: 'none',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'all 0.22s ease',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.1)';
              el.style.color = '#fff';
              el.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.04)';
              el.style.color = 'rgba(255,255,255,0.8)';
              el.style.transform = 'none';
            }}>
            <BookOpen size={14} /> View Technical Paper
          </a>
        </motion.div>

        {/* Stats — 还原原版配色，保留商业指标文案 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '44px' }}>
          {[
            { value: '< 2.5m', label: 'Analysis Time', delay: 0.52 },
            { value: '100%', label: 'Audit Trace', delay: 0.6 },
            { value: 'ADMET', label: 'Risk Predict', delay: 0.68 },
            { value: '3D', label: 'Spatial Map', delay: 0.76 },
          ].map(s => <GlassChip key={s.value} {...s} />)}
        </div>

        {/* Feature tags - 还原原版玻璃质感，保留商业 IP 标签 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          {[
            { icon: <Activity size={10} />, label: 'Separation Cost Index' },
            { icon: <Dna size={10} />, label: 'AlphaFold 3 Integration' },
            { icon: <ShieldCheck size={10} />, label: 'Verifiable Source Data' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 16px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.022)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.2)',
              fontFamily: MONO, fontSize: '10px',
              letterSpacing: '0.04em', textTransform: 'uppercase',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(255,255,255,0.55)';
                el.style.borderColor = 'rgba(255,255,255,0.12)';
                el.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(255,255,255,0.2)';
                el.style.borderColor = 'rgba(255,255,255,0.06)';
                el.style.background = 'rgba(255,255,255,0.022)';
              }}>
              {f.icon} {f.label}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px',
        background: 'linear-gradient(to bottom, transparent, rgba(7,10,14,1))',
        pointerEvents: 'none',
      }} />
    </header>
  );
}
