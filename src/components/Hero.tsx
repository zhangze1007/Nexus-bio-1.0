import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Dna, BookOpen, Microscope } from 'lucide-react';
import { useRef } from 'react';

function AmbientGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.018 }}>
        <defs>
          <pattern id="grid-minor" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-major" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-minor)" />
        <rect width="100%" height="100%" fill="url(#grid-major)" />
      </svg>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vh', background: 'radial-gradient(ellipse at center, rgba(200,216,232,0.04) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', top: '20%', left: '-10%', width: '40vw', height: '40vh', background: 'radial-gradient(ellipse at center, rgba(180,200,220,0.025) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: '30vw', height: '30vh', background: 'radial-gradient(ellipse at center, rgba(200,210,230,0.02) 0%, transparent 70%)' }} />
    </div>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', minWidth: '100px' }}>
      <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(1.25rem, 2.5vw, 1.625rem)', color: 'rgba(255,255,255,0.88)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{value}</span>
      <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '9px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>{label}</span>
    </div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <header ref={ref} style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', overflow: 'hidden' }}>
      <AmbientGrid />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid rgba(255,255,255,0.055)', background: 'rgba(10,10,10,0.78)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dna size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </div>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '16px', color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>Nexus-Bio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {[['Visualize','demo'],['Search','search'],['Analyze','analyzer'],['Contact','contact']].map(([label, id]) => (
            <a key={id} href={`#${id}`} style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.38)')}>
              {label}
            </a>
          ))}
        </div>
        <a href="#analyzer" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', fontFamily: 'Arial, sans-serif', fontSize: '12px', textDecoration: 'none', transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; }}>
          Try Now <ArrowRight size={11} />
        </a>
      </nav>

      {/* Content */}
      <motion.div style={{ y: titleY, opacity: titleOpacity, position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '820px', margin: '0 auto', paddingTop: '80px' }}>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', marginBottom: '40px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(200,216,232,0.6)' }} />
          <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Next-Gen Bio-Intelligent Architecture
          </span>
        </motion.div>

        {/* Title — DM Serif Display */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.22,1,0.36,1] }}
          style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(2.5rem, 7vw, 4.75rem)', fontWeight: 400, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.93)', margin: '0 0 24px' }}>
          From literature<br />
          <em style={{ color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>to mechanistic insight.</em>
        </motion.h1>

        {/* Subtitle — Arial */}
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          style={{ fontFamily: 'Arial, sans-serif', fontSize: 'clamp(13px, 1.6vw, 15px)', lineHeight: 1.8, color: 'rgba(255,255,255,0.40)', maxWidth: '540px', margin: '0 auto 12px', letterSpacing: '-0.003em' }}>
          Nexus-Bio extracts metabolic nodes, enzymatic reactions, and pathway logic
          from any research paper — rendered as an interactive 3D map in seconds.
        </motion.p>

        {/* Tagline — DM Serif italic */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}
          style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontStyle: 'italic', fontSize: '14px', color: 'rgba(255,255,255,0.16)', margin: '0 0 52px' }}>
          Built for researchers, biotech teams, and grant-stage startups.
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '64px' }}>
          <a href="#analyzer" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 24px', borderRadius: '10px', background: '#ffffff', color: '#0a0a0a', fontFamily: 'Arial, sans-serif', fontSize: '13px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', letterSpacing: '-0.01em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e8e8e8'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
            Analyze a Paper <ArrowRight size={13} />
          </a>
          <a href="#search" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 24px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontFamily: 'Arial, sans-serif', fontSize: '13px', textDecoration: 'none', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}>
            <BookOpen size={13} /> Browse Literature
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
          <StatChip value="6" label="Literature DBs" />
          <StatChip value="3D" label="Mol. Structures" />
          <StatChip value="AI" label="Pathway Engine" />
          <StatChip value="ODE" label="Kinetic Sim." />
        </motion.div>

        {/* Feature tags */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.65 }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {[
            { icon: <Dna size={11} />, label: 'AlphaFold pLDDT' },
            { icon: <Microscope size={11} />, label: 'PubChem 3D Conformers' },
            { icon: <BookOpen size={11} />, label: 'Evidence Trace' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.22)', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
              {f.icon} {f.label}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom divider + fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, transparent, #0a0a0a)', pointerEvents: 'none' }} />
    </header>
  );
}
