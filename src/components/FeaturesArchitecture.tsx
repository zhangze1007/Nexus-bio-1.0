'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Activity,
  BrainCircuit,
  Dna,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers3,
  type LucideIcon,
} from 'lucide-react';
import HomeInteractiveCard from './HomeInteractiveCard';
import { TOOL_BY_ID } from './tools/shared/toolRegistry';
import { WORKBENCH_STAGES } from './tools/shared/workbenchConfig';

const HEADER = "'Public Sans',-apple-system,sans-serif";
const MONO = "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace";

type StageOutputMap = Record<string, string[]>;

const STAGE_OUTPUTS: StageOutputMap = {
  'stage-1': ['Pathway object', 'Node evidence trace', 'Target intake'],
  'stage-2': ['Flux + deltaG view', 'Catalyst ranking', 'Bottleneck signals'],
  'stage-3': ['Chassis edits', 'Gene-circuit logic', 'Control stability'],
  'stage-4': ['Cell-free validation', 'DBTL loop', 'Omics and spatial feedback'],
};

interface EngineBlock {
  label: string;
  title: string;
  description: string;
  notes: string[];
  icon: LucideIcon;
  toolIds: string[];
}

const ENGINE_BLOCKS: EngineBlock[] = [
  {
    label: 'Route Ranking',
    title: 'Pathway design stays tied to yield, burden, and plausibility',
    description:
      'Stage 1 is not just a literature summary. Route ranking reads pathway length, cofactor burden, and thermodynamic feasibility together so the design surface already carries engineering judgment.',
    notes: [
      'Paper intake becomes a route object instead of a static note.',
      'Node drill-down keeps evidence, structures, and local kinetics attached.',
    ],
    icon: GitBranch,
    toolIds: ['pathd', 'cethx'],
  },
  {
    label: 'System Quantification',
    title: 'Flux balance and thermodynamics turn route ideas into constraints',
    description:
      'FBASIM and CETHX quantify whether a route is viable under growth, energy, and cofactor limits, so Stage 2 answers more than "can this reaction exist?".',
    notes: [
      'Flux, ATP, and deltaG pressure remain visible in one workflow.',
      'Bottlenecks can be carried forward into catalyst or chassis decisions.',
    ],
    icon: Activity,
    toolIds: ['fbasim', 'cethx'],
  },
  {
    label: 'Catalyst Programs',
    title: 'Catalyst design and evolution are treated as campaigns, not isolated scores',
    description:
      'CATDES and PROEVOL turn candidate enzymes into ranked design programs, where affinity, burden, library narrowing, and next-round strategy stay connected.',
    notes: [
      'The platform helps compare candidate enzymes inside the route context.',
      'Directed evolution is framed as a multi-round decision surface.',
    ],
    icon: Dna,
    toolIds: ['catdes', 'proevol'],
  },
  {
    label: 'Control Layer',
    title: 'Chassis, circuits, and dynamics sit in the main path, not on the side',
    description:
      'GENMIM, GECAIR, and DYNCON answer the next question after route design: what host edits and control logic are needed to keep the system stable in operation?',
    notes: [
      'Genome intervention, logic, and dynamic response form one layer.',
      'Dynamic control is modeled as a stability problem, not a decorative chart.',
    ],
    icon: Gauge,
    toolIds: ['genmim', 'gecair', 'dyncon'],
  },
  {
    label: 'Validation Loop',
    title: 'Cell-free and DBTL close the gap between design and experiment',
    description:
      'CELLFREE and DBTLflow make testing first-class. The site now emphasizes that validation is part of the product architecture, not a postscript after design.',
    notes: [
      'Fast assay-scale validation reduces the cost of wrong decisions.',
      'The loop matters because Stage 4 can feed results back upstream.',
    ],
    icon: FlaskConical,
    toolIds: ['cellfree', 'dbtlflow'],
  },
  {
    label: 'Inference',
    title: 'Multi-omics and spatial layers feed the next design cycle',
    description:
      'MULTIO and SCSPATIAL turn later-stage assay data into actionable pressure signals, so the platform can move from descriptive plots back to route and host decisions.',
    notes: [
      'High-dimensional data is framed as comparative evidence, not decoration.',
      'AI support helps synthesize, but the quantitative modules remain primary.',
    ],
    icon: Layers3,
    toolIds: ['multio', 'scspatial', 'nexai'],
  },
];

const PLATFORM_PRINCIPLES = [
  {
    label: 'One Research Object',
    detail: 'The same pathway or construct should survive handoff between modules instead of being recreated from scratch in each page.',
  },
  {
    label: 'Evidence Over Ornament',
    detail: 'Scientific credibility comes from linked evidence, active constraints, and visible assumptions, not from generic dashboard cards.',
  },
  {
    label: 'Iteration Is Core',
    detail: 'Testing, omics, and spatial readouts should feed the next round of design rather than end as passive reports.',
  },
];

function StageCard({
  stage,
  index,
}: {
  stage: typeof WORKBENCH_STAGES[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-70px' });
  const defaultTool = TOOL_BY_ID[stage.defaultToolId];
  const outputs = STAGE_OUTPUTS[stage.id] ?? [];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.58, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: '100%' }}
    >
      <Link
        href={defaultTool?.href ?? '/tools'}
        className="nb-home-stage-card"
        style={{
          minHeight: '100%',
          borderRadius: '22px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: `linear-gradient(160deg, rgba(255,255,255,0.05) 0%, ${stage.accent}26 42%, rgba(255,255,255,0.025) 100%)`,
          display: 'grid',
          gap: '18px',
          padding: '20px',
          textDecoration: 'none',
          boxShadow: '0 16px 36px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 9px',
                borderRadius: '999px',
                border: `1px solid ${stage.accent}80`,
                background: `${stage.accent}26`,
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.84)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {stage.shortLabel}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.34)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {stage.toolIds.length} tool{stage.toolIds.length > 1 ? 's' : ''}
            </span>
          </div>

          <div
            style={{
              fontFamily: HEADER,
              fontSize: '22px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1.08,
            }}
          >
            {stage.label}
          </div>

          <div
            style={{
              fontFamily: HEADER,
              fontSize: '13px',
              lineHeight: 1.68,
              color: 'rgba(255,255,255,0.58)',
            }}
          >
            {stage.description}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.34)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Core outputs
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {outputs.map((output) => (
              <span
                key={output}
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.045)',
                  fontFamily: HEADER,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                {output}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px', marginTop: 'auto' }}>
          <div style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.34)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tools in this stage
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {stage.toolIds.map((toolId) => (
              <span
                key={toolId}
                style={{
                  padding: '6px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(10,13,20,0.26)',
                  fontFamily: MONO,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.68)',
                  letterSpacing: '0.03em',
                }}
              >
                {TOOL_BY_ID[toolId]?.shortLabel ?? toolId.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
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
      transition={{ duration: 0.58, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: '100%' }}
    >
      <HomeInteractiveCard
        icon={<Icon size={16} style={{ color: 'rgba(255,255,255,0.66)' }} />}
        label={block.label}
        title={block.title}
        description={block.description}
        labelStyle={{ color: 'rgba(255,255,255,0.34)', marginBottom: '8px' }}
        titleStyle={{ fontSize: '18px', fontWeight: 680, marginBottom: '10px', letterSpacing: '-0.02em' }}
        descriptionStyle={{ color: 'rgba(255,255,255,0.42)' }}
        focusable
        style={{
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        }}
      >
        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gap: '9px' }}>
            {block.notes.map((note) => (
              <div key={note} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                <div
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.34)',
                    marginTop: '8px',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: HEADER,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.38)',
                    lineHeight: 1.62,
                  }}
                >
                  {note}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {block.toolIds.map((toolId) => (
              <span
                key={toolId}
                style={{
                  padding: '6px 9px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: toolId === 'nexai' ? 'rgba(198,219,255,0.07)' : 'rgba(255,255,255,0.045)',
                  fontFamily: MONO,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.68)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {TOOL_BY_ID[toolId]?.shortLabel ?? toolId.toUpperCase()}
              </span>
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
      id="workflow"
      ref={sectionRef}
      style={{ padding: 'clamp(72px,10vw,124px) clamp(16px,4vw,40px)', background: '#000' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gap: '56px' }}>
        <div style={{ display: 'grid', gap: '18px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gap: '14px', maxWidth: '860px' }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.32)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              4-stage platform architecture
            </span>
            <h2
              style={{
                fontFamily: HEADER,
                fontSize: 'clamp(2rem,4vw,3.4rem)',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1.02,
                margin: 0,
              }}
            >
              The site now leads with the workflow the product actually implements
            </h2>
            <p
              style={{
                fontFamily: HEADER,
                fontSize: '15px',
                color: 'rgba(255,255,255,0.5)',
                margin: 0,
                lineHeight: 1.74,
                maxWidth: '760px',
              }}
            >
              The original website leaned heavily on individual features. This pass reshapes the
              story around the Nexus-Bio workbench itself: a staged flow from route discovery to
              simulation, chassis/control, and validation, with AI support layered on top rather
              than replacing the quantitative tools underneath.
            </p>
          </motion.div>

          <div className="nb-home-stage-grid">
            {WORKBENCH_STAGES.map((stage, index) => (
              <StageCard key={stage.id} stage={stage} index={index} />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '18px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gap: '14px', maxWidth: '860px' }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.32)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              Quantitative engines
            </span>
            <h3
              style={{
                fontFamily: HEADER,
                fontSize: 'clamp(1.6rem,3vw,2.4rem)',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              Core modules are explained as research decisions, not a flat tool list
            </h3>
            <p
              style={{
                fontFamily: HEADER,
                fontSize: '14px',
                color: 'rgba(255,255,255,0.48)',
                margin: 0,
                lineHeight: 1.72,
                maxWidth: '780px',
              }}
            >
              Each engine below is framed around the question it answers in the workflow, which
              makes the website read closer to the PDF and the live product: serious, staged, and
              grounded in constraints instead of feature slogans.
            </p>
          </motion.div>

          <div className="nb-home-engine-grid">
            {ENGINE_BLOCKS.map((block, index) => (
              <EngineCard key={block.title} block={block} index={index} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: '26px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            padding: '22px',
            display: 'grid',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <BrainCircuit size={16} color="rgba(255,255,255,0.52)" />
            <span
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.34)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              Platform principles
            </span>
          </div>

          <div className="nb-home-principle-grid">
            {PLATFORM_PRINCIPLES.map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '16px',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: HEADER,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: HEADER,
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.48)',
                    lineHeight: 1.68,
                  }}
                >
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        .nb-home-stage-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .nb-home-stage-card {
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        .nb-home-stage-card:hover,
        .nb-home-stage-card:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.16) !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.24);
          outline: none;
        }

        .nb-home-engine-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .nb-home-principle-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1080px) {
          .nb-home-engine-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .nb-home-stage-grid,
          .nb-home-principle-grid {
            grid-template-columns: minmax(0, 1fr);
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
