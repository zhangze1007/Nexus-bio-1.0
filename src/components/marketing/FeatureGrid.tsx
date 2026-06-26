"use client";

import { motion, useInView } from "framer-motion";
import {
  Beaker,
  Binary,
  BookOpen,
  CircuitBoard,
  Dna,
  FlaskConical,
  Gauge,
  GitBranch,
  Microscope,
  Network,
  Scan,
  Thermometer,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { THEME } from "../../theme";

interface ToolCard {
  name: string;
  slug: string;
  description: string;
  icon: React.ElementType;
  category: "design" | "simulate" | "analyze" | "collaborate";
}

const TOOLS: ToolCard[] = [
  // Design
  {
    name: "Pathway Designer",
    slug: "pathd",
    description: "Visual metabolic pathway design with enzyme selection and route optimization.",
    icon: GitBranch,
    category: "design",
  },
  {
    name: "Metabolic Engineering",
    slug: "metabolic-eng",
    description: "3D metabolic lab with flux simulation, node editing, and DBTL integration.",
    icon: Network,
    category: "design",
  },
  {
    name: "Catalyst Designer",
    slug: "catdes",
    description: "Enzyme design with binding affinity analysis, mutagenesis targeting, and Pareto optimization.",
    icon: Zap,
    category: "design",
  },
  {
    name: "Gene Circuit Reasoner",
    slug: "gecair",
    description: "Logic gate design with Hill function modeling and circuit dynamics simulation.",
    icon: CircuitBoard,
    category: "design",
  },
  // Simulate
  {
    name: "Flux Balance Analysis",
    slug: "fbasim",
    description: "LP-based FBA solver for single-species and community metabolic models.",
    icon: Gauge,
    category: "simulate",
  },
  {
    name: "Cell-Free Simulation",
    slug: "cellfree",
    description: "Gene construct design and expression yield prediction for cell-free systems.",
    icon: FlaskConical,
    category: "simulate",
  },
  {
    name: "Dynamic Control",
    slug: "dyncon",
    description: "Bioreactor simulation with Hill function feedback and RK4 ODE integration.",
    icon: Workflow,
    category: "simulate",
  },
  {
    name: "Cell Thermodynamics",
    slug: "cethx",
    description: "Waterfall delta-G cascade analysis, ATP accounting, and pathway feasibility checks.",
    icon: Thermometer,
    category: "simulate",
  },
  // Analyze
  {
    name: "Multi-Omics",
    slug: "multio",
    description: "VAE/UMAP embeddings, volcano plots, MOFA+ factors, and perturbation prediction.",
    icon: Binary,
    category: "analyze",
  },
  {
    name: "Single-Cell Spatial",
    slug: "scspatial",
    description: "Hexagonal spot grids, UMAP spatial visualization, and cluster gene expression analysis.",
    icon: Scan,
    category: "analyze",
  },
  {
    name: "Protein Evolution",
    slug: "proevol",
    description: "Fitness landscape heatmaps, evolution trajectory tracking, and basin climbing optimization.",
    icon: Dna,
    category: "analyze",
  },
  {
    name: "AI Research Agent",
    slug: "nexai",
    description: "Citation network analysis, Socratic questioning, and literature support mapping.",
    icon: BookOpen,
    category: "analyze",
  },
  // Collaborate
  {
    name: "DBTL Cycle Tracker",
    slug: "dbtlflow",
    description: "Design-Build-Test-Learn iteration tracking with protocol generation and SBOL export.",
    icon: Workflow,
    category: "collaborate",
  },
  {
    name: "Gene Minimization",
    slug: "genmim",
    description: "CRISPRi knockdown scheduling, genome map visualization, and greedy optimization.",
    icon: Microscope,
    category: "collaborate",
  },
];

const CATEGORIES = [
  { key: "design", label: "Design", color: THEME.MINT },
  { key: "simulate", label: "Simulate", color: THEME.SKY },
  { key: "analyze", label: "Analyze", color: THEME.LILAC },
  { key: "collaborate", label: "Collaborate", color: THEME.APRICOT },
] as const;

function ToolCardComponent({ tool, index }: { tool: ToolCard; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const Icon = tool.icon as React.ComponentType<{ size?: number; className?: string }>;
  const cat = CATEGORIES.find((c) => c.key === tool.category);
  const accentColor: string = cat?.color ?? THEME.MINT;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.04, ease: "easeOut" }}
    >
      <Link
        href={`/tools/${tool.slug}`}
        className="group block p-5 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg h-full"
        style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
            style={{
              backgroundColor: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
            }}
          >
            <span style={{ color: accentColor, display: "flex" }}>
              <Icon size={18} />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold truncate" style={{ fontFamily: THEME.SANS, color: THEME.VALUE }}>
                {tool.name}
              </h3>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  fontFamily: THEME.MONO,
                  backgroundColor: `${accentColor}12`,
                  color: accentColor,
                  border: `1px solid ${accentColor}20`,
                }}
              >
                {cat?.label}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
              {tool.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function FeatureGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="features" className="py-24 lg:py-32" style={{ backgroundColor: "#0d0f14" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4"
            style={{
              fontFamily: THEME.MONO,
              color: THEME.MINT,
              backgroundColor: "rgba(191, 220, 205, 0.08)",
              border: "1px solid rgba(191, 220, 205, 0.15)",
            }}
          >
            Platform
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}>
            14 Integrated Tools, One Platform
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}>
            Every stage of the synthetic biology research cycle — from pathway discovery to validated designs.
          </p>
        </motion.div>

        {/* Category-grouped grid */}
        {CATEGORIES.map((cat) => {
          const catTools = TOOLS.filter((t) => t.category === cat.key);
          return (
            <div key={cat.key} className="mb-12 last:mb-0">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2"
                style={{ fontFamily: THEME.MONO, color: cat.color }}
              >
                <span className="w-3 h-px" style={{ backgroundColor: cat.color, opacity: 0.4 }} />
                {cat.label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {catTools.map((tool, i) => (
                  <ToolCardComponent key={tool.slug} tool={tool} index={TOOLS.indexOf(tool)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
