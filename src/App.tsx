'use client';

/**
 * Nexus-Bio — Home Page Shell
 *
 * Layout: TopNav (fixed) → Hero (fluid+search) → Engine Architecture → Contact → Footer
 *
 * 3D Pathway Visualization lives at /tools/metabolic-eng
 * Paper Analyzer                lives at /analyze
 * Research Search               lives at /research
 */

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Hero from './components/Hero';
import TopNav from './components/TopNav';
import DevModePanel from './components/DevModePanel';
import FeaturesArchitecture from './components/FeaturesArchitecture';
import HomeInteractiveCard from './components/HomeInteractiveCard';
import { Mail, Linkedin, Dna, ShieldCheck, Zap, BarChart3 } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────
const H = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

// ── Scroll reveal ──────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ background: '#000', color: '#FFF', minHeight: '100vh' }}>
      <TopNav />

      <main>
        {/* ── HERO ── */}
        <Hero />

        {/* ── ENGINE ARCHITECTURE ── */}
        <Reveal>
          <FeaturesArchitecture />
        </Reveal>

        {/* ── CONTACT (embedded) ── */}
        <section id="contact" style={{ padding: 'clamp(64px,10vw,112px) clamp(16px,4vw,40px)', background: '#000' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <Reveal style={{ marginBottom: '48px' }}>
              <h2 style={{ fontFamily: H, fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 14px' }}>
                Get in Touch
              </h2>
              <p style={{ fontFamily: H, fontSize: '14px', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.65, maxWidth: '420px' }}>
                Open to research collaborations, consulting inquiries, and investment discussions.
              </p>
            </Reveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '0', maxWidth: '640px', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              <HomeInteractiveCard
                href="mailto:fuchanze@gmail.com"
                icon={<Mail size={16} style={{ color: 'rgba(255,255,255,0.55)' }} />}
                label="Email"
                title="fuchanze@gmail.com"
                description="Research collaborations · Consulting · General inquiries"
                footer="Send email"
              />
              <HomeInteractiveCard
                href="https://www.linkedin.com/in/zhangze-foo-3575ba359"
                icon={<Linkedin size={16} style={{ color: 'rgba(255,255,255,0.55)' }} />}
                label="LinkedIn"
                title="Zhang Ze Foo"
                description="Founder · Synthetic Biology & Metabolic Engineering · Nexus-Bio"
                footer="View profile"
                external
              />
            </div>
          </div>
        </section>

        <DevModePanel />

        {/* ── FOOTER ── */}
        <footer style={{ padding: '24px clamp(16px,4vw,40px)', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Dna size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </div>
              <span style={{ fontFamily: H, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.01em' }}>Nexus-Bio</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { icon: <ShieldCheck size={10} />, label: 'WCAG 2.2 AA' },
                { icon: <Zap size={10} />, label: 'INP ≤ 50ms' },
                { icon: <BarChart3 size={10} />, label: 'WebGL2 + FSM' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>
                  <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.22)', margin: 0 }}>
                © {new Date().getFullYear()} Nexus-Bio
              </p>
              {['Terms of Service', 'Privacy Policy'].map((t, i) => (
                <a key={i} href={t === 'Terms of Service' ? '/terms' : '/privacy'}
                  style={{ fontFamily: H, fontSize: '11px', color: 'rgba(255,255,255,0.22)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FFF'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)'; }}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
