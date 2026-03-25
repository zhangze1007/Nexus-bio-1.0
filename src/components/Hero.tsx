import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Dna, BookOpen, Microscope } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';

// ── Typography system ─────────────────────────────────────────────────
const SERIF = "'DM Serif Display', Georgia, 'Times New Roman', serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";
const MONO  = "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace";

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
          background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.055) 0%, rgba(59,130,246,0.025) 45%, transparent 70%)',
          filter: 'blur(60px)',
          transform: `translate(${cx.x * -18}px, ${cx.y * -12}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
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
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.04) 0%, rgba(59,130,246,0.015) 45%, transparent 70%)',
          filter: 'blur(80px)',
          transform: `translate(${cx.x * 14}px, ${cx.y * 10}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
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
          background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.018) 0%, transparent 65%)',
          filter: 'blur(40px)',
          transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
        }}
      />

      {/* Fine square grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.7 }}>
        <defs>
          <pattern id="sg" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.028)" strokeWidth="0.5"/>
          </pattern>
          <pattern id="lg" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M 140 0 L 0 0 0 140" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sg)" />
        <rect width="100%" height="100%" fill="url(#lg)" />
      </svg>

      {/* Slow scan line */}
      <motion.div
        animate={{ y: ['5vh', '95vh'] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: 'linear-gradient(to right, transparent 0%, rgba(0,212,255,0.04) 30%, rgba(0,212,255,0.07) 50%, rgba(0,212,255,0.04) 70%, transparent 100%)',
        }}
      />

      {/* Vertical accent lines */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18vw', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.04) 70%, transparent)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: '18vw', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.03) 70%, transparent)' }} />

      {/* Noise grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        backgroundSize: '180px',
        opacity: 0.4,
        mixBlendMode: 'overlay',
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
        background: hov ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hov ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.07)'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: hov
          ? '0 0 20px rgba(0,212,255,0.1), 0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,212,255,0.06)'
          : '0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'default',
      }}>
      <span style={{ fontFamily: SERIF, fontSize: '1.75rem', color: hov ? '#00d4ff' : 'rgba(255,255,255,0.78)', lineHeight: 1.1, letterSpacing: '-0.02em', textShadow: hov ? '0 0 20px rgba(0,212,255,0.4)' : 'none', transition: 'all 0.3s' }}>
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
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,255,0.15)',
          }}>
            <Dna size={13} style={{ color: 'rgba(0,212,255,0.85)' }} />
          </div>
          <span style={{ fontFamily: SERIF, fontSize: '15px', color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em' }}>
            Nexus-Bio
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
              onMouseEnter={e => (e.currentTarget.style.color = '#00d4ff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}>
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <a href="#analyzer" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 18px', borderRadius: '16px',
          background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.22)',
          backdropFilter: 'blur(12px)',
          color: 'rgba(0,212,255,0.75)',
          fontFamily: BODY, fontSize: '12px', fontWeight: 500,
          textDecoration: 'none', transition: 'all 0.22s',
          boxShadow: '0 0 12px rgba(0,212,255,0.08)',
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(0,212,255,0.12)';
            el.style.color = '#00d4ff';
            el.style.borderColor = 'rgba(0,212,255,0.4)';
            el.style.boxShadow = '0 0 20px rgba(0,212,255,0.2), 0 4px 20px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(0,212,255,0.06)';
            el.style.color = 'rgba(0,212,255,0.75)';
            el.style.borderColor = 'rgba(0,212,255,0.22)';
            el.style.boxShadow = '0 0 12px rgba(0,212,255,0.08)';
          }}>
          Try Now <ArrowRight size={11} />
        </a>
      </nav>

      {/* ── Hero content — parallax layer ── */}
      <motion.div style={{
        y, opacity, scale,
        position: 'relative', zIndex: 10,
        textAlign: 'center', maxWidth: '860px', width: '100%',
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
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.18)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 20px rgba(0,212,255,0.06), 0 2px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(0,212,255,0.06)',
          }}>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(0,212,255,0.8)', boxShadow: '0 0 8px rgba(0,212,255,0.6)', flexShrink: 0 }}
          />
          <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em' }}>
            AI-Powered Bio Platform
          </span>
        </motion.div>

        {/* Main title — DM Serif Display */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: [0.22,1,0.36,1] }}
          style={{
            fontFamily: SERIF, fontWeight: 400, fontStyle: 'normal',
            fontSize: 'clamp(3.5rem, 9vw, 6.5rem)',
            lineHeight: 1.0, letterSpacing: '-0.03em',
            color: 'rgba(255,255,255,0.95)',
            margin: '0 0 24px',
            textShadow: '0 0 80px rgba(0,212,255,0.12)',
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
            fontFamily: BODY, fontSize: 'clamp(13px, 1.55vw, 15px)',
            fontWeight: 400, lineHeight: 1.9,
            color: 'rgba(255,255,255,0.35)',
            maxWidth: '540px', margin: '0 auto 12px',
            letterSpacing: '0.01em',
          }}>
          Nexus-Bio extracts metabolic nodes, enzymatic reactions, and pathway logic
          from any research paper — rendered as an interactive 3D map in seconds.
        </motion.p>

        {/* Tagline — DM Serif */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            fontFamily: SERIF, fontStyle: 'normal', fontSize: '14px',
            color: 'rgba(255,255,255,0.14)',
            margin: '0 0 60px', letterSpacing: '0.01em',
          }}>
          Built for researchers, biotech teams, and grant-stage startups.
        </motion.p>

        {/* CTAs — glass buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.36 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '72px' }}>

          {/* Primary CTA */}
          <a href="#analyzer" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '13px 28px', borderRadius: '20px',
            background: '#ffffff', color: '#07090d',
            fontFamily: BODY, fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', letterSpacing: '-0.01em',
            boxShadow: '0 0 0 0 rgba(255,255,255,0)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#e8e8e8';
              el.style.transform = 'translateY(-3px) scale(1.01)';
              el.style.boxShadow = '0 8px 30px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#ffffff';
              el.style.transform = 'none';
              el.style.boxShadow = '0 0 0 0 rgba(255,255,255,0)';
            }}>
            Analyze a Paper <ArrowRight size={13} />
          </a>

          {/* Secondary CTA — neon glass */}
          <a href="#search" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '13px 28px', borderRadius: '20px',
            background: 'rgba(139,92,246,0.05)',
            border: '1px solid rgba(139,92,246,0.2)',
            backdropFilter: 'blur(16px)',
            color: 'rgba(139,92,246,0.75)',
            fontFamily: BODY, fontSize: '13px', fontWeight: 400,
            textDecoration: 'none',
            boxShadow: '0 0 12px rgba(139,92,246,0.06)',
            transition: 'all 0.22s ease',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(139,92,246,0.1)';
              el.style.color = '#a78bfa';
              el.style.borderColor = 'rgba(139,92,246,0.4)';
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = '0 0 24px rgba(139,92,246,0.18), 0 6px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(139,92,246,0.05)';
              el.style.color = 'rgba(139,92,246,0.75)';
              el.style.borderColor = 'rgba(139,92,246,0.2)';
              el.style.transform = 'none';
              el.style.boxShadow = '0 0 12px rgba(139,92,246,0.06)';
            }}>
            <BookOpen size={13} /> Browse Literature
          </a>
        </motion.div>

        {/* Stats — glass chips with stagger */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '44px' }}>
          {[
            { value: '6', label: 'Literature DBs', delay: 0.52 },
            { value: '3D', label: 'Structures', delay: 0.6 },
            { value: 'AI', label: 'Pathway Engine', delay: 0.68 },
            { value: 'ODE', label: 'Kinetic Sim.', delay: 0.76 },
          ].map(s => <GlassChip key={s.value} {...s} />)}
        </div>

        {/* Feature tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {[
            { icon: <Dna size={10} />, label: 'AlphaFold pLDDT' },
            { icon: <Microscope size={10} />, label: 'PubChem 3D Conformers' },
            { icon: <BookOpen size={10} />, label: 'Evidence Trace' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 13px', borderRadius: '100px',
              background: 'rgba(0,212,255,0.03)',
              border: '1px solid rgba(0,212,255,0.1)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(0,212,255,0.35)',
              fontFamily: MONO, fontSize: '10px',
              letterSpacing: '0.04em',
              transition: 'all 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(0,212,255,0.8)';
                el.style.borderColor = 'rgba(0,212,255,0.3)';
                el.style.background = 'rgba(0,212,255,0.07)';
                el.style.boxShadow = '0 0 12px rgba(0,212,255,0.08)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(0,212,255,0.35)';
                el.style.borderColor = 'rgba(0,212,255,0.1)';
                el.style.background = 'rgba(0,212,255,0.03)';
                el.style.boxShadow = 'none';
              }}>
              {f.icon} {f.label}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px',
        background: 'linear-gradient(to bottom, transparent, rgba(6,8,16,0.95))',
        pointerEvents: 'none',
      }} />
    </header>
  );
}
