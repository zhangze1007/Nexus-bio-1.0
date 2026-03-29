'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Activity, FlaskConical, Dna } from 'lucide-react';

const HEADER = "'Inter',-apple-system,sans-serif";
const MONO   = "'JetBrains Mono','Fira Code',monospace";

const FEATURES = [
  {
    icon: Activity,
    title: 'Cellular Solvency & Toxicity',
    description:
      'Nexus-Bio continuously tracks intracellular ATP/NADPH cofactor ledgers across every pathway node, detecting metabolic insolvency before it crashes your fermentation run.',
    details: [
      'ATP & NADPH ledger computed per reaction step',
      'IC50 toxicity thresholds flagged for host strain growth inhibition',
      'Cofactor balance audited against genome-scale FBA models',
    ],
  },
  {
    icon: FlaskConical,
    title: 'Downstream Processing (DSP) Intelligence',
    description:
      'Our engine predicts separation costs by analyzing structural analogs sharing similar polarity, boiling points, and logP with your target molecule — the hidden cost that kills 60% of bio-scale projects.',
    details: [
      'Structural analog detection via Tanimoto similarity scoring',
      'DSP bottleneck identification for co-eluting impurities',
      'Separation cost index quantifies purification difficulty (0–1)',
    ],
  },
  {
    icon: Dna,
    title: 'Genetic ROI & Carbon Efficiency',
    description:
      'Nexus-Bio recommends precise gene Knockout (KO) or Overexpression (OE) interventions and calculates Atom Economy to maximize your Titer, Rate, and Yield (TRY) metrics.',
    details: [
      'KO/OE gene targets suggested for competing branch-point enzymes',
      'Carbon Efficiency (Atom Economy %) per intermediate node',
      'TRY-optimized flux redistribution scored against FBA predictions',
    ],
  },
];

function FeatureCard({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = feature.icon;
  const [hov, setHov] = useState(false);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.1 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '32px 28px',
        background: hov ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.012)',
        border: 'none',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
        transition: 'background 0.25s',
      }}>
      {/* Icon */}
      <div style={{
        width: '38px', height: '38px', borderRadius: '6px',
        background: 'rgba(255,255,255,0.05)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} style={{ color: 'rgba(255,255,255,0.7)' }} />
      </div>

      <h3 style={{
        fontFamily: HEADER,
        fontSize: '17px',
        fontWeight: 700,
        color: '#FFFFFF',
        margin: 0,
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
      }}>
        {feature.title}
      </h3>

      <p style={{
        fontFamily: HEADER,
        fontSize: '13px',
        color: 'rgba(255,255,255,0.40)',
        margin: 0,
        lineHeight: 1.7,
      }}>
        {feature.description}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {feature.details.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '3px', height: '3px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.32)',
              marginTop: '8px', flexShrink: 0,
            }} />
            <span style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.30)',
              lineHeight: 1.65,
            }}>
              {d}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function FeaturesArchitecture() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section
      id="architecture"
      ref={sectionRef}
      style={{ padding: 'clamp(64px,10vw,120px) clamp(16px,4vw,40px)', background: '#000' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontFamily: HEADER,
            fontSize: 'clamp(1.8rem,3.5vw,2.8rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            margin: '0 0 14px',
          }}>
            Engine Architecture
          </h2>
          <p style={{
            fontFamily: HEADER, fontSize: '14px',
            color: 'rgba(255,255,255,0.35)',
            margin: 0, lineHeight: 1.65, maxWidth: '520px',
          }}>
            Three analysis engines power every Nexus-Bio pathway — cofactor ledgers,
            DSP economics, genetic ROI. No black boxes, full auditability.
          </p>
        </motion.div>

        {/* Grid — outer border only, no per-card wrappers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
