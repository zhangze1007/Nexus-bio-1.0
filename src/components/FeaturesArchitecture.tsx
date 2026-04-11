'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Dna,
  Gauge,
  Layers,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import HomeInteractiveCard from './HomeInteractiveCard';

const HEADER = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

interface EngineBlock {
  label: string;
  title: string;
  description: string;
  models: Array<{
    name: string;
    detail: string;
  }>;
  notes: string[];
  icon: LucideIcon;
}

const ENGINE_BLOCKS: EngineBlock[] = [
  {
    label: 'Safety',
    title: 'Cellular Solvency & Toxicity',
    description:
      'Host tolerance, energetic solvency, and impurity burden are read as one viability envelope so route promise never detaches from what a cell can actually sustain.',
    models: [
      {
        name: 'Toxicity window',
        detail: 'Exposure is judged against viability thresholds rather than generic hazard flags.',
      },
      {
        name: 'Cellular solvency',
        detail: 'Energy demand, impurity load, and growth pressure remain visible inside one viability picture.',
      },
    ],
    notes: [
      'Defines whether a route is biologically tolerable before downstream ranking begins.',
      'Keeps pathway ambition grounded in host survivability and burden.',
    ],
    icon: AlertTriangle,
  },
  {
    label: 'Purification',
    title: 'Downstream Processing (DSP) Intelligence',
    description:
      'Purification difficulty is treated as an engineering cost through structural similarity, co-elution pressure, and separation burden rather than left for downstream surprise.',
    models: [
      {
        name: 'Similarity screening',
        detail: 'Fingerprint similarity estimates separation conflict and purification ambiguity.',
      },
      {
        name: 'Separation burden',
        detail: 'DSP cost stays attached to the route instead of surfacing only at the end.',
      },
    ],
    notes: [
      'Keeps downstream processing visible at the same level as upstream pathway design.',
      'Preserves one of Nexus-Bio’s signature engineering distinctions.',
    ],
    icon: Layers,
  },
  {
    label: 'Yield',
    title: 'Genetic ROI & Carbon Efficiency',
    description:
      'Carbon retention is treated as an engineering return signal so atom economy, diversion loss, and chassis burden stay visible during route choice.',
    models: [
      {
        name: 'Carbon retention',
        detail: 'Product yield is judged by retained carbon, not only by headline titer or flux volume.',
      },
      {
        name: 'Genetic ROI',
        detail: 'Genetic burden and wasted atoms are read as engineering loss against pathway return.',
      },
    ],
    notes: [
      'Owns route economics rather than stoichiometric feasibility.',
      'Keeps ROI grounded in measurable carbon efficiency instead of generic optimization language.',
    ],
    icon: Zap,
  },
  {
    label: 'Constraint',
    title: 'Stoichiometric Flux Solver',
    description:
      'Pathway performance is solved as a constrained stoichiometric system so growth, production, and limiting resources remain on one quantitative state.',
    models: [
      {
        name: 'Steady-state LP',
        detail: 'Constraint-based flux optimization runs under stoichiometric balance and bounded exchange.',
      },
      {
        name: 'Shadow-price sensitivity',
        detail: 'Dual sensitivities expose which substrates and cofactors are limiting the design.',
      },
    ],
    notes: [
      'Backs FBASIM growth, ATP yield, and shadow-price readouts.',
      'Owns mass-balance solution, not route economics or thermodynamic plausibility.',
    ],
    icon: Activity,
  },
  {
    label: 'Energy',
    title: 'Cofactor Ledger',
    description:
      'ATP, NADH, and NADPH accounting stays attached to pathway nodes and burden ledgers so energetic cost is readable directly from the design surface.',
    models: [
      {
        name: 'ATP accounting',
        detail: 'Energetic turnover is accumulated across reactions instead of hidden behind aggregate scores.',
      },
      {
        name: 'Redox accounting',
        detail: 'Reducing-equivalent demand stays visible when routes compete for the same cofactor pool.',
      },
    ],
    notes: [
      'Owns energetic bookkeeping rather than reaction-level feasibility.',
      'Remains one of the clearest quantitative signatures in the platform.',
    ],
    icon: Zap,
  },
  {
    label: 'Feasibility',
    title: 'Thermodynamic Feasibility',
    description:
      'Free-energy plausibility is evaluated explicitly so route viability is grounded in driving force, reversibility, and reaction slack rather than topology alone.',
    models: [
      {
        name: 'Gibbs free energy',
        detail: 'Reaction favorability is interpreted against the current concentration state, not just network shape.',
      },
      {
        name: 'Reaction reversibility',
        detail: 'Thermodynamic slack and equilibrium pressure remain visible at the reaction level.',
      },
    ],
    notes: [
      'Owns reaction plausibility rather than host toxicity or cofactor bookkeeping.',
      'Keeps route chemistry legible inside PATHD and thermodynamic analysis.',
    ],
    icon: Activity,
  },
  {
    label: 'Dynamics',
    title: 'Regulatory Control Dynamics',
    description:
      'Time-dependent pathway behavior is modeled with enzyme kinetics, Hill regulation, Monod growth, and RK4 integration so stability is treated as a control problem.',
    models: [
      {
        name: 'Kinetic regulation',
        detail: 'Michaelis-Menten and Hill responses define the local logic of enzyme and circuit control.',
      },
      {
        name: 'Control response',
        detail: 'Monod growth and RK4 time-stepping keep stability, lag, and overshoot legible.',
      },
    ],
    notes: [
      'Owns closed-loop behavior across PATHD kinetics, GECAIR, and DYNCON.',
      'Distinct from cell-free validation, which focuses on resource-coupled assay behavior.',
    ],
    icon: Gauge,
  },
  {
    label: 'Catalysis',
    title: 'Catalyst Design & Ranking',
    description:
      'Catalyst choice couples binding plausibility, sequence design, and multi-objective ranking so enzyme selection remains tied to system viability.',
    models: [
      {
        name: 'Binding design',
        detail: 'Affinity and structural fit act as design constraints within catalyst selection.',
      },
      {
        name: 'Pareto ranking',
        detail: 'Candidates are compared across burden, yield, and route quality at the same time.',
      },
    ],
    notes: [
      'Owns catalyst choice, not the adaptive search that follows it.',
      'Keeps molecular design tied to pathway-level trade-offs.',
    ],
    icon: Sparkles,
  },
  {
    label: 'Search',
    title: 'Directed Evolution Search',
    description:
      'Directed evolution is modeled as an explicit search over fitness landscapes, with acceptance dynamics and basin structure kept readable in the design loop.',
    models: [
      {
        name: 'Acceptance schedule',
        detail: 'Candidate steps are accepted against a temperature-controlled fitness landscape.',
      },
      {
        name: 'Fitness landscape',
        detail: 'Search quality is evaluated by basin structure, not only by a single end-point score.',
      },
    ],
    notes: [
      'Owns adaptive search over sequence space rather than catalyst ranking or intervention choice.',
      'Keeps evolutionary exploration legible at the architecture level.',
    ],
    icon: Dna,
  },
  {
    label: 'Selection',
    title: 'Genetic Intervention Scoring',
    description:
      'Genome and control interventions are ranked with explicit knockdown efficiency and viability penalties so design choice stays readable instead of disappearing into heuristics.',
    models: [
      {
        name: 'Intervention ranking',
        detail: 'Interventions are scored with explicit knockdown efficiency and growth-impact terms.',
      },
      {
        name: 'Growth-impact penalty',
        detail: 'Selection stays readable because the growth-cost tradeoff is surfaced directly.',
      },
    ],
    notes: [
      'Owns intervention choice rather than catalyst design or evolution search.',
      'Keeps CRISPRi-style prioritization quantitative and bounded.',
    ],
    icon: Activity,
  },
  {
    label: 'Validation',
    title: 'Cell-Free TXTL Validation',
    description:
      'Cell-free validation is modeled as a resource-aware TXTL system so expression burden, reagent depletion, and translation capacity remain measurable before in vivo transfer.',
    models: [
      {
        name: 'TXTL resource model',
        detail: 'Protein synthesis is tied to ribosome and transcript competition instead of a flat yield lookup.',
      },
      {
        name: 'Energy regeneration',
        detail: 'Expression demand is balanced against depletion and regeneration inside the assay mix.',
      },
    ],
    notes: [
      'Owns assay-scale validation rather than pathway-scale control dynamics.',
      'Keeps TXTL visible as a quantitative bridge between design and experiment.',
    ],
    icon: Zap,
  },
  {
    label: 'Inference',
    title: 'Omics & Spatial Inference',
    description:
      'Omics interpretation uses low-rank factorization, linear embeddings, and spatial autocorrelation to turn assay and spatial layers into structured bottleneck evidence.',
    models: [
      {
        name: 'Latent factor model',
        detail: 'Latent factors compress assay layers into interpretable biological pressure axes.',
      },
      {
        name: 'Spatial autocorrelation',
        detail: 'Local structure is surfaced quantitatively rather than treated as visual decoration.',
      },
    ],
    notes: [
      'Owns evidence extraction from assay layers rather than generative pathway design.',
      'Keeps omics and spatial statistics visible as one quantitative inference family.',
    ],
    icon: Layers,
  },
];

function ModelStack({ models }: { models: EngineBlock['models'] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px',
        borderRadius: '14px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)',
        border: '0.5px solid rgba(255,255,255,0.09)',
      }}
    >
      {models.map((model) => (
        <div
          key={model.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontFamily: HEADER,
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.84)',
              letterSpacing: '-0.01em',
            }}
          >
            {model.name}
          </span>
          <span
            style={{
              fontFamily: HEADER,
              fontSize: '11px',
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.46)',
              letterSpacing: '-0.005em',
            }}
          >
            {model.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

function EngineCard({ block, index }: { block: EngineBlock; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = block.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: '100%' }}
    >
      <HomeInteractiveCard
        icon={<Icon size={16} style={{ color: 'rgba(255,255,255,0.62)' }} />}
        label={block.label}
        title={block.title}
        description={block.description}
        labelStyle={{ color: 'rgba(255,255,255,0.32)', marginBottom: '7px' }}
        titleStyle={{ fontSize: '17px', fontWeight: 650, marginBottom: '10px', letterSpacing: '-0.016em' }}
        descriptionStyle={{ color: 'rgba(255,255,255,0.4)' }}
        focusable
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <ModelStack models={block.models} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {block.notes.map((note) => (
              <div key={note} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  style={{
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.34)',
                    marginTop: '8px',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: HEADER,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.36)',
                    lineHeight: 1.62,
                  }}
                >
                  {note}
                </span>
              </div>
            ))}
          </div>
        </div>
      </HomeInteractiveCard>
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
      style={{ padding: 'clamp(64px,10vw,120px) clamp(16px,4vw,40px)', background: '#000' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: '48px' }}
        >
          <h2
            style={{
              fontFamily: HEADER,
              fontSize: 'clamp(1.8rem,3.5vw,2.8rem)',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              margin: '0 0 14px',
            }}
          >
            Engine Architecture
          </h2>
          <p
            style={{
              fontFamily: HEADER,
              fontSize: '14px',
              color: 'rgba(255,255,255,0.35)',
              margin: '0 0 12px',
              lineHeight: 1.65,
              maxWidth: '760px',
            }}
          >
            Nexus-Bio is powered by a matrix of quantitative engines behind the platform:
            flux solvers, carbon and cofactor ledgers, DSP and toxicity screens, dynamic control,
            catalytic search, and validation inference that all carry real computational identity.
          </p>
          <p
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.26)',
              margin: 0,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Model families below are derived from the live codebase; detailed real / partial / demo labeling remains in-tool.
          </p>
        </motion.div>

        <div className="nb-home-engine-grid">
          {ENGINE_BLOCKS.map((block, index) => (
            <EngineCard key={block.title} block={block} index={index} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .nb-home-engine-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          border: 0.5px solid rgba(255, 255, 255, 0.08);
        }

        @media (max-width: 1100px) {
          .nb-home-engine-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .nb-home-engine-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
