'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Activity, FlaskConical, Dna } from 'lucide-react';

const BODY  = "'Public Sans', -apple-system, sans-serif";
const UI_MONO = "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', ui-monospace, monospace";

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

// ── Algorithm Showcase Data ───────────────────────────────────────────
const FORMULA_BLOCKS = [
  {
    label: 'Block 1',
    title: 'Thermodynamic Viability (Risk Score)',
    accent: '#EF4444',
    formula: 'ΔG = ΔH − TΔS',
    calculation: 'ΔG = (−45.2 kJ/mol) − (298 K × −0.04 kJ/K·mol)',
    resultValue: 'ΔG = −33.28 kJ/mol',
    resultLabel: 'Spontaneous / High Yield Confirmed',
    resultColor: '#10B981',
  },
  {
    label: 'Block 2',
    title: 'Downstream Processing Complexity (DSP Cost)',
    accent: '#F59E0B',
    formula: 'ΔlogP = |logP(Target) − logP(Impurity)|',
    calculation: 'Target (Artemisinic Acid) logP = 3.2  |  Impurity (Arteannuin B) logP = 3.15',
    resultValue: 'ΔlogP = 0.05',
    resultLabel: 'Separation Cost Index → 91% (Critical Bottleneck Alert)',
    resultColor: '#EF4444',
  },
  {
    label: 'Block 3',
    title: 'Carbon ROI (Atom Economy)',
    accent: '#8B5CF6',
    formula: 'AE = (MW_Product / Σ MW_Reactants) × 100%',
    calculation: '(282.33 / 564.66) × 100%',
    resultValue: '50.0% Carbon Asset Efficiency',
    resultLabel: '',
    resultColor: '#F59E0B',
  },
];

// ── Formula Block Component ───────────────────────────────────────────
function FormulaBlock({ block, index }: { block: typeof FORMULA_BLOCKS[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.15 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '28px 24px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px',
        transition: 'border-color 300ms ease-out, filter 300ms ease-out',
        filter: isHovered ? 'brightness(1.03)' : 'brightness(1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: block.accent, flexShrink: 0,
        }} />
        <span style={{
          fontFamily: BODY, fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.25)',
        }}>
          {block.label}
        </span>
      </div>

      <h4 style={{
        fontFamily: BODY, fontSize: '17px', fontWeight: 600,
        color: '#FFFFFF', margin: 0,
        lineHeight: 1.3, letterSpacing: '-0.02em',
      }}>
        {block.title}
      </h4>

      {/* Formula */}
      <div style={{
        padding: '14px 18px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <p style={{
          fontFamily: UI_MONO, fontSize: '16px',
          color: '#9CA3AF', margin: 0,
          lineHeight: 1.5, letterSpacing: '0.02em',
        }}>
          {block.formula}
        </p>
      </div>

      {/* Calculation */}
      <p style={{
        fontFamily: UI_MONO, fontSize: '12px',
        color: 'rgba(255,255,255,0.35)', margin: 0,
        lineHeight: 1.7, fontFeatureSettings: "'tnum' 1",
      }}>
        {block.calculation}
      </p>

      {/* Result — glowing border */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.15 * index + 0.4 }}
        style={{
          padding: '12px 16px', borderRadius: '8px',
          background: `${block.resultColor}08`,
          border: `1px solid ${block.resultColor}30`,
        }}
      >
        <p style={{
          fontFamily: UI_MONO, fontSize: '15px', fontWeight: 600,
          color: block.resultColor, margin: 0,
          lineHeight: 1.4, fontFeatureSettings: "'tnum' 1",
        }}>
          {block.resultValue}
        </p>
        {block.resultLabel && (
          <p style={{
            fontFamily: UI_MONO, fontSize: '11px',
            color: `${block.resultColor}BB`, margin: '6px 0 0',
            lineHeight: 1.4, fontFeatureSettings: "'tnum' 1",
          }}>
            {block.resultLabel}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── AlgorithmShowcase Component ───────────────────────────────────────
function AlgorithmShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <div ref={ref}>
      {/* Sub-header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: '24px' }}
      >
        <p style={{
          fontFamily: BODY, fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.2)', margin: '0 0 8px',
        }}>
          Step-by-step derivation
        </p>
        <p style={{
          fontFamily: BODY, fontSize: '13px',
          color: 'rgba(255,255,255,0.35)', margin: 0,
          lineHeight: 1.65, maxWidth: '520px',
        }}>
          The exact formulas and real-world data our engine uses — fully auditable,
          no black boxes.
        </p>
      </motion.div>

      {/* Formula blocks grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {FORMULA_BLOCKS.map((block, i) => (
          <FormulaBlock key={block.label} block={block} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────
function FeatureCard({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = feature.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: 0.12 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '32px 28px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
        transition: 'border-color 300ms ease-out, filter 300ms ease-out',
        filter: isHovered ? 'brightness(1.03)' : 'brightness(1)',
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
        fontFamily: BODY,
        fontSize: '20px',
        fontWeight: 600,
        color: '#FFFFFF',
        margin: 0,
        lineHeight: 1.25,
        letterSpacing: '-0.02em',
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

// ── Main Section ──────────────────────────────────────────────────────
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
            fontFamily: BODY,
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight: 600,
            color: '#FFFFFF',
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
          marginBottom: '48px',
        }}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>

        {/* Algorithm Showcase — Mathematical Derivations */}
        <AlgorithmShowcase />
      </div>
    </section>
  );
}
