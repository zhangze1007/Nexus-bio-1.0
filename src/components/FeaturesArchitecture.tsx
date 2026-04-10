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
  formulas: string[];
  notes: string[];
  icon: LucideIcon;
}

const ENGINE_BLOCKS: EngineBlock[] = [
  {
    label: 'Constraint',
    title: 'Flux',
    description:
      'Pathway performance is solved as a constrained stoichiometric system so growth, production, and resource pressure remain on one quantitative state.',
    formulas: [
      'max cᵀv',
      'Sv = 0,  l ≤ v ≤ u',
      '∂μ/∂x = shadow price(x)',
    ],
    notes: [
      'Backs FBASIM growth, ATP yield, and shadow-price readouts.',
      'This remains the platform’s primary mass-balance engine.',
    ],
    icon: Activity,
  },
  {
    label: 'Yield',
    title: 'Carbon ROI',
    description:
      'Carbon retention is treated as a first-class economic signal, not a side metric, so atom economy and diversion penalties stay visible during route choice.',
    formulas: [
      'η_C = (C_product / C_substrate) × 100%',
      'AE = retained atoms / input atoms',
    ],
    notes: [
      'The older ROI framing is still meaningful when anchored to carbon efficiency.',
      'PATHD and FBASIM both surface this as route pressure, not marketing language.',
    ],
    icon: Zap,
  },
  {
    label: 'Energy',
    title: 'Cofactor Ledger',
    description:
      'ATP, NADH, and NADPH accounting stays attached to pathway nodes and burden ledgers so energetic solvency can be read directly from the design surface.',
    formulas: [
      'ATP_net = Σ ATP_i',
      'NADPH_net = Σ NADPH_i',
    ],
    notes: [
      'This is still one of the most distinctive Nexus-Bio signatures.',
      'The live product uses it in PATHD, Catalyst burden, and thermodynamic interpretation.',
    ],
    icon: Zap,
  },
  {
    label: 'Feasibility',
    title: 'Thermo Load',
    description:
      'Free-energy burden is evaluated explicitly so route plausibility is grounded in chemical driving force rather than only topology or visual appeal.',
    formulas: [
      'ΔG = ΔG° + RT ln(Q)',
      'K_eq = e^(−ΔG°/RT)',
    ],
    notes: [
      'CETHX and PATHD analysis both still depend on this core expression.',
      'The old thermodynamic language stays, but with cleaner naming.',
    ],
    icon: Activity,
  },
  {
    label: 'Purification',
    title: 'DSP Intelligence',
    description:
      'Purification risk is modeled as a real engineering penalty through structural similarity and separation difficulty, not left for downstream surprises.',
    formulas: [
      'sim ≈ Tanimoto(fp₁, fp₂)',
      'separation_cost_index ∈ [0,1]',
    ],
    notes: [
      'DSP survives from the older site because it still exists in PATHD, Analyze, and node evidence.',
      'Physicochemical similarity and co-elution risk remain part of the platform identity.',
    ],
    icon: Layers,
  },
  {
    label: 'Safety',
    title: 'Toxicity Window',
    description:
      'Host tolerance and impurity risk are treated as threshold problems with explicit IC50 or growth-impact windows when the data supports them.',
    formulas: [
      'risk_score ∈ [0,1]',
      'IC50 = arg where growth ≤ 50%',
    ],
    notes: [
      'This extends the older solvency-and-toxicity idea into a clearer threshold card.',
      'PATHD and PaperAnalyzer still attach toxicity to node-level evidence.',
    ],
    icon: AlertTriangle,
  },
  {
    label: 'Dynamics',
    title: 'Control Dynamics',
    description:
      'Time-dependent pathway behavior is modeled with enzyme kinetics, Hill regulation, Monod growth, and RK4 integration so stability is treated as a control problem.',
    formulas: [
      'v = Vmax[S] / (Km + [S])',
      'f(x) = Kⁿ / (Kⁿ + xⁿ)',
      'μ = μmax·S/(Ks+S)·O/(Ko+O)',
    ],
    notes: [
      'Used across PATHD kinetics, GECAIR logic, and DYNCON bioreactor control.',
      'This is the platform’s main time-evolution layer.',
    ],
    icon: Gauge,
  },
  {
    label: 'Catalysis',
    title: 'Catalyst Search',
    description:
      'Catalyst selection couples binding energy, sequence plausibility, burden, and route ranking so enzyme choices remain tied to system viability.',
    formulas: [
      'K_d = exp(ΔG_bind / RT)',
      'ΔΔG ≈ Σ BLOSUM(wt, mut)',
      'rank = Pareto(ΔG, yield, burden)',
    ],
    notes: [
      'CATDES still combines structure and system cost in one reasoning surface.',
      'The card keeps the premium molecular-engineering identity without becoming a tool summary.',
    ],
    icon: Sparkles,
  },
  {
    label: 'Search',
    title: 'Evolution Search',
    description:
      'Adaptive improvement is modeled as an explicit search process with basin-climbing acceptance rather than a vague “AI optimization” claim.',
    formulas: [
      'P_accept = min(1, e^(ΔF/kT))',
      'best basin = argmax F(x, y)',
    ],
    notes: [
      'PROEVOL’s fitness-landscape logic is distinct enough to remain visible as its own engine.',
      'Search temperature and fitness acceptance remain legible, not hidden behind narrative copy.',
    ],
    icon: Dna,
  },
  {
    label: 'Selection',
    title: 'Intervention Logic',
    description:
      'Genome and control interventions are ranked with explicit viability penalties so design choice stays readable instead of disappearing into heuristic black boxes.',
    formulas: [
      'score = KD_eff + (1 + GI) × 0.3',
      'GI = Σ growth_impact_i',
    ],
    notes: [
      'GENMIM still uses a real greedy CRISPRi ranker with stated limits.',
      'Intervention scoring deserves its own card instead of being buried under evolution or control.',
    ],
    icon: Activity,
  },
  {
    label: 'Validation',
    title: 'TXTL Dynamics',
    description:
      'Cell-free validation is modeled as a resource-aware TX-TL system with fitting and in-vitro to in-vivo translation, not just a downstream checkbox.',
    formulas: [
      'dP_i/dt = k_tl,i·[mRNA_i]·R_free / (K_tl,i + R_free)',
      'dATP/dt = −k_consumeΣtranslation + k_regen[PEP] − k_decay[ATP]',
    ],
    notes: [
      'The cell-free engine contributes real dynamic structure even where parts of the pipeline remain approximate.',
      'Keeping this visible prevents validation from feeling like a generic final stage.',
    ],
    icon: Zap,
  },
  {
    label: 'Inference',
    title: 'Omics Inference',
    description:
      'Omics interpretation uses low-rank factorization, linear embeddings, and spatial autocorrelation to turn assay layers into structured bottleneck evidence.',
    formulas: [
      'X_v ≈ ZW_vᵀ',
      'I = (N/W)·Σᵢⱼ wᵢⱼ(xᵢ−x̄)(xⱼ−x̄) / Σᵢ(xᵢ−x̄)²',
    ],
    notes: [
      'MULTIO and SCSPATIAL share this evidence-reading family even when method honesty differs by tool.',
      'This keeps omics and spatial statistics visible without forcing them into a stage diagram.',
    ],
    icon: Layers,
  },
];

function FormulaStack({ formulas }: { formulas: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '14px 14px 12px',
        borderRadius: '14px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)',
        border: '0.5px solid rgba(255,255,255,0.09)',
      }}
    >
      {formulas.map((formula) => (
        <div
          key={formula}
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.74)',
            letterSpacing: '-0.01em',
            wordBreak: 'break-word',
          }}
        >
          {formula}
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
        focusable
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormulaStack formulas={block.formulas} />
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
                    fontFamily: MONO,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.31)',
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
            Representative formulas below are drawn from the live codebase; detailed real / partial / demo labeling remains in-tool.
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
