"use client";

import { motion, useInView } from "framer-motion";
import { CircuitBoard, Dna, GitBranch, Microscope, Timer, Wrench } from "lucide-react";
import { useRef } from "react";
import { THEME } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Template data                                                      */
/* ------------------------------------------------------------------ */

interface TemplateProject {
  id: string;
  name: string;
  description: string;
  tools: string[];
  estimatedTime: string;
  accent: string;
  icon: React.ElementType;
}

const TEMPLATES: TemplateProject[] = [
  {
    id: "artemisinin",
    name: "Artemisinin Pathway",
    description:
      "Design the full artemisinin biosynthesis route from acetyl-CoA to artemisinin. Includes enzyme selection, thermodynamic feasibility, and flux balance analysis.",
    tools: ["PathD", "CETHX", "FBASim", "CATDES"],
    estimatedTime: "~15 min",
    accent: THEME.MINT,
    icon: GitBranch,
  },
  {
    id: "ecoli-fba",
    name: "E. coli FBA",
    description:
      "Run flux balance analysis on an E. coli genome-scale metabolic model. Explore knockout strategies, carbon efficiency, and community FBA with multiple species.",
    tools: ["FBASim", "GenMIM", "MultiO"],
    estimatedTime: "~20 min",
    accent: THEME.SKY,
    icon: Microscope,
  },
  {
    id: "gene-circuit",
    name: "Gene Circuit Design",
    description:
      "Build a toggle switch or oscillator gene circuit with Hill function modeling. Simulate dynamics, optimize gate parameters, and test stability.",
    tools: ["GECAIR", "DynCon", "CellFree"],
    estimatedTime: "~12 min",
    accent: THEME.LILAC,
    icon: CircuitBoard,
  },
];

/* ------------------------------------------------------------------ */
/*  Card component                                                     */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, type: "spring" as const, stiffness: 300, damping: 26 },
  }),
};

interface TemplateCardProps {
  template: TemplateProject;
  index: number;
  onSelect?: (id: string) => void;
}

function TemplateCard({ template, index, onSelect }: TemplateCardProps) {
  const Icon = template.icon as React.ComponentType<{ size?: number; color?: string }>;

  return (
    <motion.button
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => onSelect?.(template.id)}
      data-testid={`template-card-${template.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: THEME.SP_MD,
        padding: THEME.SP_LG,
        background: THEME.PANEL_GRADIENT,
        border: `1px solid ${THEME.BORDER}`,
        borderRadius: THEME.R_MD,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        maxWidth: 360,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${template.accent}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: THEME.R_SM,
          background: `${template.accent}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} color={template.accent} />
      </div>

      {/* Name */}
      <h3
        style={{
          fontFamily: THEME.BRAND,
          fontSize: THEME.FS_LG,
          color: THEME.INK,
          margin: 0,
        }}
      >
        {template.name}
      </h3>

      {/* Description */}
      <p
        style={{
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_SM,
          color: THEME.LABEL,
          margin: 0,
          lineHeight: 1.6,
          flex: 1,
        }}
      >
        {template.description}
      </p>

      {/* Tools used */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {template.tools.map((tool) => (
          <span
            key={tool}
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: template.accent,
              background: `${template.accent}14`,
              border: `1px solid ${template.accent}28`,
              borderRadius: 999,
              padding: "2px 10px",
            }}
          >
            {tool}
          </span>
        ))}
      </div>

      {/* Estimated time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: THEME.SP_XS,
          marginTop: THEME.SP_XS,
        }}
      >
        <Timer size={14} color={THEME.DIM} />
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.DIM,
          }}
        >
          {template.estimatedTime}
        </span>
      </div>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface TemplateSelectorProps {
  onSelect?: (id: string) => void;
  title?: string;
  subtitle?: string;
}

export default function TemplateSelector({
  onSelect,
  title = "Start with a Template",
  subtitle = "Jump into a guided project to explore Nexus-Bio's capabilities.",
}: TemplateSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      data-testid="template-selector"
      style={{
        padding: `${THEME.SP_XL}px 0`,
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ marginBottom: THEME.SP_LG, textAlign: "center" }}
      >
        <h2
          style={{
            fontFamily: THEME.BRAND,
            fontSize: THEME.FS_XL,
            color: THEME.INK,
            margin: 0,
            marginBottom: THEME.SP_XS,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_MD,
            color: THEME.LABEL,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </motion.div>

      {/* Cards grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: THEME.SP_LG,
          justifyContent: "center",
        }}
      >
        {TEMPLATES.map((t, i) => (
          <TemplateCard key={t.id} template={t} index={i} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export { TEMPLATES };
export type { TemplateProject };
