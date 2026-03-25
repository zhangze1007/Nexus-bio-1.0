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

// ── Animated orb background — sci-fi neon version ─────────────────────
function DeepBackground({ cx }: { cx: { x: number; y: number } }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>

      {/* Orb 1 — cyan top-left */}
      <motion.div
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '-20%', left: '-10%',
          width: '70vw', height: '70vw',
          background: 'radial-gradient(ellipse at center, rgba(56,189,248,0.07) 0%, rgba(56,189,248,0.025) 40%, transparent 70%)',
          filter: 'blur(70px)',
          transform: `translate(${cx.x * -18}px, ${cx.y * -12}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
        }}
      />

      {/* Orb 2 — purple bottom-right */}
      <motion.div
        animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{
          position: 'absolute',
          bottom: '-25%', right: '-15%',
          width: '65vw', height: '65vw',
          background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.06) 0%, rgba(96,165,250,0.025) 45%, transparent 70%)',
          filter: 'blur(90px)',
          transform: `translate(${cx.x * 14}px, ${cx.y * 10}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
        }}
      />

      {/* Orb 3 — blue center, pulsing */}
      <motion.div
        animate={{ scale: [1, 1.12, 0.95, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: `translate(-50%, -50%) translate(${cx.x * -8}px, ${cx.y * -6}px)`,
          width: '50vw', height: '50vw',
          background: 'radial-gradient(ellipse at center, rgba(96,165,250,0.04) 0%, transparent 65%)',
          filter: 'blur(50px)',
          transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)',
          borderRadius: '50%',
        }}
      />

      {/* Fine sci-fi grid — cyan tinted */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.6 }}>
        <defs>
          <pattern id="sg" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(56,189,248,0.04)" strokeWidth="0.5"/>
          </pattern>
          <pattern id="lg" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M 140 0 L 0 0 0 140" fill="none" stroke="rgba(56,189,248,0.07)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sg)" />
        <rect width="100%" height="100%" fill="url(#lg)" />
      </svg>

      {/* Slow neon scan line */}
      <motion.div
        animate={{ y: ['5vh', '95vh'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: 'linear-gradient(to right, transparent 0%, rgba(56,189,248,0.08) 20%, rgba(56,189,248,0.18) 50%, rgba(56,189,248,0.08) 80%, transparent 100%)',
          boxShadow: '0 0 8px rgba(56,189,248,0.12)',
        }}
      />

      {/* Vertical neon accent lines */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18vw', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(56,189,248,0.06) 30%, rgba(56,189,248,0.06) 70%, transparent)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: '18vw', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(167,139,250,0.05) 30%, rgba(167,139,250,0.05) 70%, transparent)' }} />

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

// ── Stat chip — neon accent version ──────────────────────────────────
function GlassChip({ value, label, delay, accent = 'cyan' }: { value: string; label: string; delay: number; accent?: 'cyan' | 'blue' | 'purple' }) {
  const [hov, setHov] = useState(false);
  const colors = {
    cyan:   { glow: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.28)', text: '#38bdf8' },
    blue:   { glow: 'rgba(96,165,250,0.18)', border: 'rgba(96,165,250,0.28)',  text: '#60a5fa' },
    purple: { glow: 'rgba(167,139,250,0.18)', border: 'rgba(167,139,250,0.28)', text: '#a78bfa' },
  };
  const c = colors[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 22px', borderRadius: '14px', minWidth: '96px',
        background: hov ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${hov ? c.border : 'rgba(255,255,255,0.07)'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04), ${c.glow.replace('0.18', '0.25').replace('rgba', '0 0 20px rgba')}` : '0 2px 12px rgba(0,0,0,0.2)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'default',
      }}>
      <span style={{ fontFamily: SERIF, fontSize: '1.6rem', color: hov ? c.text : 'rgba(255,255,255,0.82)', lineHeight: 1.1, letterSpacing: '-0.02em', textShadow: hov ? `0 0 16px ${c.text}80` : 'none', transition: 'all 0.28s' }}>
        {value}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '8.5px', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '6px' }}>
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

      {/* ── Navbar — sci-fi edition ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '58px',
        background: 'rgba(4,6,10,0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(56,189,248,0.1)',
        boxShadow: '0 1px 0 rgba(56,189,248,0.04), 0 4px 24px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(96,165,250,0.08) 100%)',
            border: '1px solid rgba(56,189,248,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <Dna size={13} style={{ color: '#38bdf8' }} />
          </div>
          <span style={{ fontFamily: SERIF, fontSize: '15px', color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>
            Nexus-Bio
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {[['Visualize','demo'],['Search','search'],['Analyze','analyzer'],['Contact','contact']].map(([label, id]) => (
            <a key={id} href={`#${id}`} style={{
              fontFamily: BODY, fontSize: '12px', fontWeight: 500,
              color: 'rgba(255,255,255,0.32)',
              textDecoration: 'none', letterSpacing: '0.04em',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#38bdf8'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.32)'; }}>
              {label}
            </a>
          ))}
        </div>

        {/* CTA — neon outline button */}
        <a href="#analyzer" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 18px', borderRadius: '10px',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.28)',
          color: '#38bdf8',
          fontFamily: BODY, fontSize: '12px', fontWeight: 500,
          textDecoration: 'none', transition: 'all 0.22s',
          boxShadow: '0 0 12px rgba(56,189,248,0.1)',
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(56,189,248,0.16)';
            el.style.borderColor = 'rgba(56,189,248,0.5)';
            el.style.boxShadow = '0 0 20px rgba(56,189,248,0.22)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(56,189,248,0.08)';
            el.style.borderColor = 'rgba(56,189,248,0.28)';
            el.style.boxShadow = '0 0 12px rgba(56,189,248,0.1)';
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

        {/* Badge — neon pill */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22,1,0.36,1] }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '9px',
            padding: '5px 16px', borderRadius: '100px', marginBottom: '40px',
            background: 'rgba(56,189,248,0.06)',
            border: '1px solid rgba(56,189,248,0.22)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 16px rgba(56,189,248,0.1)',
          }}>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px rgba(56,189,248,0.8)', flexShrink: 0 }}
          />
          <span style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.12em' }}>
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
            textShadow: '0 0 80px rgba(56,189,248,0.12)',
          }}>
          From Literature
          <br />
          <span style={{ color: 'rgba(255,255,255,0.22)', fontStyle: 'normal' }}>
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
            color: 'rgba(255,255,255,0.38)',
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
            color: 'rgba(255,255,255,0.13)',
            margin: '0 0 60px', letterSpacing: '0.01em',
          }}>
          Built for researchers, biotech teams, and grant-stage startups.
        </motion.p>

        {/* CTAs — sci-fi neon buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.36 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '72px' }}>

          {/* Primary CTA — neon cyan */}
          <a href="#analyzer" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 28px', borderRadius: '12px',
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.4)',
            color: '#38bdf8',
            fontFamily: BODY, fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.01em',
            boxShadow: '0 0 20px rgba(56,189,248,0.15)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(56,189,248,0.2)';
              el.style.borderColor = 'rgba(56,189,248,0.65)';
              el.style.transform = 'translateY(-2px) scale(1.01)';
              el.style.boxShadow = '0 0 32px rgba(56,189,248,0.3), 0 8px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(56,189,248,0.12)';
              el.style.borderColor = 'rgba(56,189,248,0.4)';
              el.style.transform = 'none';
              el.style.boxShadow = '0 0 20px rgba(56,189,248,0.15)';
            }}>
            Analyze a Paper <ArrowRight size={13} />
          </a>

          {/* Secondary CTA — glass */}
          <a href="#search" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 28px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: BODY, fontSize: '13px', fontWeight: 400,
            textDecoration: 'none',
            transition: 'all 0.22s ease',
          }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.08)';
              el.style.color = '#fff';
              el.style.borderColor = 'rgba(255,255,255,0.18)';
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = '0 6px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.04)';
              el.style.color = 'rgba(255,255,255,0.45)';
              el.style.borderColor = 'rgba(255,255,255,0.1)';
              el.style.transform = 'none';
              el.style.boxShadow = 'none';
            }}>
            <BookOpen size={13} /> Browse Literature
          </a>
        </motion.div>

        {/* Stats — neon accent chips */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '44px' }}>
          {[
            { value: '6', label: 'Literature DBs', delay: 0.52, accent: 'cyan' as const },
            { value: '3D', label: 'Structures', delay: 0.6, accent: 'blue' as const },
            { value: 'AI', label: 'Pathway Engine', delay: 0.68, accent: 'purple' as const },
            { value: 'ODE', label: 'Kinetic Sim.', delay: 0.76, accent: 'cyan' as const },
          ].map(s => <GlassChip key={s.value} {...s} />)}
        </div>

        {/* Feature tags — neon pill chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {[
            { icon: <Dna size={10} />, label: 'AlphaFold pLDDT', color: 'rgba(56,189,248,0.22)' },
            { icon: <Microscope size={10} />, label: 'PubChem 3D Conformers', color: 'rgba(96,165,250,0.22)' },
            { icon: <BookOpen size={10} />, label: 'Evidence Trace', color: 'rgba(167,139,250,0.22)' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 13px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${f.color}`,
              color: 'rgba(255,255,255,0.28)',
              fontFamily: MONO, fontSize: '10px',
              letterSpacing: '0.02em',
              transition: 'all 0.22s',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(255,255,255,0.65)';
                el.style.background = 'rgba(255,255,255,0.055)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = 'rgba(255,255,255,0.28)';
                el.style.background = 'rgba(255,255,255,0.025)';
              }}>
              {f.icon} {f.label}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px',
        background: 'linear-gradient(to bottom, transparent, rgba(4,6,10,0.98))',
        pointerEvents: 'none',
      }} />
    </header>
  );
}
