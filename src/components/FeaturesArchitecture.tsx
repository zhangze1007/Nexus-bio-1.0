'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Activity, FlaskConical, Dna } from 'lucide-react';

const SERIF = "'DM Serif Display', Georgia, serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";

const FEATURES = [
  {
    icon: Activity,
    title: 'Cellular Solvency & Toxicity',
    accent: '#EF4444',
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
    accent: '#F59E0B',
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
    accent: '#10B981',
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

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: 0.12 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '32px 28px',
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 48px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '12px',
        background: `${feature.accent}18`,
        border: `1px solid ${feature.accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: feature.accent }} />
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: SERIF,
        fontSize: '20px',
        fontWeight: 400,
        color: 'rgba(255,255,255,0.9)',
        margin: 0,
        lineHeight: 1.25,
        letterSpacing: '-0.01em',
      }}>
        {feature.title}
      </h3>

      {/* Description */}
      <p style={{
        fontFamily: BODY,
        fontSize: '13px',
        color: 'rgba(255,255,255,0.45)',
        margin: 0,
        lineHeight: 1.7,
      }}>
        {feature.description}
      </p>

      {/* Detail bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {feature.details.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: feature.accent,
              marginTop: '6px', flexShrink: 0, opacity: 0.7,
            }} />
            <span style={{
              fontFamily: BODY,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.6,
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
      style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: '48px' }}
        >
          <p style={{
            fontFamily: BODY, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.22)', margin: '0 0 12px',
          }}>
            02 · Engine Architecture
          </p>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: '0 0 14px',
          }}>
            Under the Hood
          </h2>
          <p style={{
            fontFamily: BODY, fontSize: '14px',
            color: 'rgba(255,255,255,0.35)',
            margin: 0, lineHeight: 1.65, maxWidth: '560px',
          }}>
            Three proprietary analysis engines power every Nexus-Bio pathway — from cofactor
            ledgers to DSP economics. No black boxes, full auditability.
          </p>
        </motion.div>

        {/* 3-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
