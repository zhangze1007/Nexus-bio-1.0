"use client";

import { motion } from "framer-motion";
import { ClipboardList, FlaskConical, Microscope } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useWorkbenchStore, type WorkbenchRunArtifact } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import { TOOL_BY_ID } from "../tools/shared/toolRegistry";
import {
  accentLeftBorder,
  cardVariants,
  chipRow,
  chipVariants,
  getChipStyle,
  glassPanel,
  glassPanelInset,
  iconContainer,
  sectionHeaderRow,
  staggerContainer,
  statusAccent,
  statusChip,
  typography,
} from "./workbenchDesignSystem";
import { buildExperimentLedger, getAuthorityTier } from "./workbenchTrust";

interface WorkbenchExperimentLedgerProps {
  title?: string;
  limit?: number;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkbenchExperimentLedger({
  title = "Experiment Ledger",
  limit = 5,
}: WorkbenchExperimentLedgerProps) {
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const entries = useMemo(() => buildExperimentLedger(runArtifacts, limit), [limit, runArtifacts]);
  const artifactById = useMemo(() => new Map(runArtifacts.map((artifact) => [artifact.id, artifact])), [runArtifacts]);

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={{ display: "grid", gap: "12px" }}
    >
      {/* Section Header */}
      <motion.div variants={cardVariants} style={sectionHeaderRow}>
        <span style={iconContainer(THEME.APRICOT, 20)}>
          <ClipboardList size={11} color={THEME.APRICOT} />
        </span>
        <span style={typography.sectionTitle}>{title}</span>
      </motion.div>

      {/* Entries */}
      {entries.length ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: "grid", gap: "12px" }}
        >
          {entries.map((entry) => {
            const tool = TOOL_BY_ID[entry.toolId];
            const accent = statusAccent(entry.status);
            const chipStyle = getChipStyle(entry.status);
            const Icon = entry.toolId === "cellfree" || entry.toolId === "dbtlflow" ? FlaskConical : Microscope;
            const artifact = artifactById.get(entry.id);
            return (
              <ExperimentCard
                key={entry.id}
                entry={entry}
                tool={tool}
                accent={accent}
                chipStyle={chipStyle}
                Icon={Icon}
                artifact={artifact}
                formatTime={formatTime}
              />
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          variants={cardVariants}
          style={{
            ...glassPanel,
            ...glassPanelInset,
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ ...typography.body, maxWidth: "280px", margin: "0 auto" }}>
            No experimental ledger entries yet.
          </div>
          <div style={{ ...typography.caption, maxWidth: "280px", margin: "0 auto", opacity: 0.6 }}>
            Execute Cell-free, DBTL, or downstream omics tools to populate the recorded test trail.
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}

function ExperimentCard({
  entry,
  tool,
  accent,
  chipStyle,
  Icon,
  artifact,
  formatTime,
}: {
  entry: {
    id: string;
    toolId: string;
    title: string;
    summary: string;
    status: string;
    createdAt: number;
    metrics: string[];
  };
  tool: { shortLabel?: string } | undefined;
  accent: string;
  chipStyle: React.CSSProperties;
  Icon: typeof FlaskConical;
  artifact: WorkbenchRunArtifact | undefined;
  formatTime: (ts: number) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  return (
    <motion.div
      variants={cardVariants}
      whileHover="hover"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...glassPanel,
        ...accentLeftBorder(accent),
        borderColor: hovered ? "rgba(255, 255, 255, 0.12)" : glassPanel.borderColor,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)" : "none",
      }}
    >
      {/* Top row: icon + title + status chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span style={iconContainer(accent)}>
            <Icon size={12} color={accent} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={typography.cardTitle}>{entry.title}</div>
            <div style={typography.caption}>
              {tool?.shortLabel ?? entry.toolId.toUpperCase()} · {formatTime(entry.createdAt)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <motion.span variants={chipVariants} style={chipStyle}>
            {entry.status}
          </motion.span>
          <span style={typography.caption}>{artifact ? getAuthorityTier(artifact) : "unknown"}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={typography.body}>{entry.summary}</div>

      {/* Metrics */}
      {entry.metrics.length > 0 && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={chipRow}>
          {entry.metrics.map((metric) => (
            <motion.span key={metric} variants={chipVariants} style={statusChip.neutral}>
              {metric}
            </motion.span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
