"use client";

import { ArrowUpRight, BrainCircuit, Microscope } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { getUpstreamToolIds } from "../../config/workbenchGraph";
import { useUIStore } from "../../store/uiStore";
import type { WorkbenchToolPayloadMap } from "../../store/workbenchPayloads";
import { useWorkbenchStore } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import { canPassToDownstream } from "../../utils/runtimeGating";
import RuntimeGatingNotice from "../tools/shared/RuntimeGatingNotice";
import { TOOL_BY_ID } from "../tools/shared/toolRegistry";
import { getStageForTool } from "../tools/shared/workbenchConfig";
import { getToolFreshness } from "./workbenchTrust";
import { buildWorkflowHandoffSummary, workflowStatusLabel } from "./workflowExperience";

interface WorkbenchInlineContextProps {
  toolId: string;
  title: string;
  summary: string;
  compact?: boolean;
  isSimulated?: boolean;
}

const BORDER = THEME.BORDER;
const SURFACE = THEME.PANEL_GLASS_STRONG;
const LABEL = THEME.LABEL;
const VALUE = THEME.VALUE;

function handoffColor(status: string) {
  if (status === "available") return THEME.MINT;
  if (status === "blocked") return THEME.CORAL;
  if (status === "demoOnly" || status === "humanGate") return THEME.APRICOT;
  return LABEL;
}

export default function WorkbenchInlineContext({
  toolId,
  title,
  summary,
  compact = false,
  isSimulated = false,
}: WorkbenchInlineContextProps) {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const workflowControl = useWorkbenchStore((s) => s.workflowControl);
  const stage = getStageForTool(toolId);

  const actionBtn: React.CSSProperties & Record<`--${string}`, string> = {
    minHeight: compact ? "34px" : "30px",
    padding: compact ? "0 12px" : "0 10px",
    borderRadius: compact ? "12px" : "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    textDecoration: "none",
    border: "1px solid var(--nb-control-border)",
    background: "var(--nb-control-bg)",
    color: "var(--nb-control-color)",
    fontFamily: THEME.SANS,
    fontSize: compact ? "10px" : "11px",
    fontWeight: 700,
    transition:
      "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
    cursor: "pointer",
    width: compact ? "100%" : undefined,
    minWidth: 0,
    ["--nb-control-bg"]: "rgba(255,255,255,0.10)",
    ["--nb-control-border"]: "rgba(255,255,255,0.14)",
    ["--nb-control-color"]: "rgba(255,255,255,0.60)",
    ["--nb-control-hover-bg"]: "rgba(255,255,255,0.94)",
    ["--nb-control-hover-border"]: "rgba(255,255,255,0.94)",
    ["--nb-control-hover-color"]: "#111318",
    ["--nb-control-active-bg"]: "#ffffff",
    ["--nb-control-active-border"]: "#ffffff",
    ["--nb-control-active-color"]: "#111318",
  };

  const evidenceTrace = useMemo(() => {
    const traceIds = analyzeArtifact?.evidenceTraceIds ?? selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id)).slice(0, compact ? 1 : 2);
  }, [analyzeArtifact?.evidenceTraceIds, compact, evidenceItems, selectedEvidenceIds]);

  const bottleneck = analyzeArtifact?.bottleneckAssumptions[0];
  const nextTool = workflowControl.nextRecommendedNode ? TOOL_BY_ID[workflowControl.nextRecommendedNode] : null;
  const latestRunArtifact = useMemo(
    () => runArtifacts.find((artifact) => artifact.toolId === toolId),
    [runArtifacts, toolId],
  );
  const freshness = useMemo(
    () => getToolFreshness(runArtifacts, toolId, { project, analyzeArtifact }),
    [analyzeArtifact, project, runArtifacts, toolId],
  );
  const handoffSummary = useMemo(
    () => buildWorkflowHandoffSummary(toolId, workflowControl, runArtifacts),
    [runArtifacts, toolId, workflowControl],
  );
  const runtimeGates = useMemo(() => {
    return getUpstreamToolIds(toolId, { deep: false, includeSupport: false })
      .map((sourceToolId) => {
        const payload = toolPayloads[sourceToolId as keyof WorkbenchToolPayloadMap];
        if (!payload) return null;
        return {
          sourceToolId,
          decision: canPassToDownstream(payload, toolId),
        };
      })
      .filter((entry): entry is { sourceToolId: string; decision: ReturnType<typeof canPassToDownstream> } =>
        Boolean(entry),
      );
  }, [toolId, toolPayloads]);
  const committedFeedback = dbtlPayload?.feedbackSource === "committed" ? dbtlPayload : null;
  const compactItems = [
    { label: "Evidence", value: `${selectedEvidenceIds.length} selected` },
    {
      label: "Feedback",
      value: committedFeedback
        ? `DBTL ${committedFeedback.result.latestPhase} · pass ${committedFeedback.result.passRate.toFixed(0)}%`
        : "No committed DBTL feedback",
    },
    {
      label: "Freshness",
      value:
        freshness.status === "fresh"
          ? "Fresh"
          : freshness.status === "stale"
            ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(", ")}`
            : freshness.status === "awaiting-upstream"
              ? "Awaiting rerun"
              : "No auditable run",
    },
    { label: "Bottleneck", value: bottleneck?.label ?? "Awaiting analyze artifact" },
  ];

  return (
    <div
      className={`nb-workbench-inline-context${compact ? " nb-workbench-inline-context--compact" : ""}`}
      style={{
        borderRadius: compact ? "16px" : "18px",
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: compact ? "12px" : "14px 16px",
        display: "grid",
        gap: compact ? "12px" : "12px",
        marginBottom: compact ? "10px" : "16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: compact ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: compact ? "10px" : "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "10px",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {stage?.shortLabel ?? "Workbench"} context
          </span>
          <span style={{ fontFamily: THEME.SANS, fontSize: compact ? "12px" : "14px", color: VALUE, fontWeight: 700 }}>
            {project?.targetProduct || analyzeArtifact?.targetProduct || project?.title || "No active project object"}
          </span>
        </div>
        <span
          style={{
            padding: compact ? "2px 7px" : "3px 8px",
            borderRadius: "999px",
            border: `1px solid ${isSimulated || project?.isDemo ? THEME.CHIP_BORDER_WARM : BORDER}`,
            background: isSimulated || project?.isDemo ? "rgba(231,199,169,0.22)" : "rgba(175,195,214,0.2)",
            color: VALUE,
            fontFamily: THEME.MONO,
            fontSize: compact ? "10px" : "11px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {isSimulated || project?.isDemo ? "Simulated Context" : "Project-Linked"}
        </span>
      </div>

      <div
        className="nb-workbench-inline-context__summary"
        style={{
          fontFamily: THEME.SANS,
          fontSize: compact ? "10.5px" : "12px",
          color: LABEL,
          lineHeight: compact ? 1.4 : 1.6,
          ...(compact
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }
            : {}),
        }}
      >
        {summary}
      </div>

      {(isSimulated || project?.isDemo) && (
        <div
          className="nb-workbench-inline-context__simulated"
          style={{
            borderRadius: compact ? "10px" : "12px",
            border: `1px solid ${THEME.CHIP_BORDER_WARM}`,
            background: "rgba(231,199,169,0.12)",
            padding: compact ? "6px 8px" : "10px 12px",
            display: "grid",
            gap: compact ? "6px" : "4px",
          }}
        >
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: compact ? "10px" : "11px",
              color: VALUE,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Demo / simulated context
          </div>
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: compact ? "10px" : "11px",
              color: LABEL,
              lineHeight: compact ? 1.4 : 1.55,
            }}
          >
            Outputs on this page may come from local models or bundled synthetic datasets until a project-linked
            evidence bundle or live analysis artifact is attached.
          </div>
        </div>
      )}

      {handoffSummary && (
        <div
          style={{
            borderRadius: compact ? "10px" : "12px",
            border: `1px solid ${BORDER}`,
            background: THEME.PANEL_SURFACE,
            padding: compact ? "8px 9px" : "10px 12px",
            display: "grid",
            gap: compact ? "6px" : "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: compact ? "10px" : "11px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Tool handoff
            </span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: "999px",
                border: `1px solid ${BORDER}`,
                background: THEME.CHIP_NEUTRAL,
                color: handoffColor(handoffSummary.availability),
                fontFamily: THEME.MONO,
                fontSize: compact ? "10px" : "11px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {workflowStatusLabel(handoffSummary.availability)}
            </span>
          </div>
          {handoffSummary.upstreamRows.length > 0 && (
            <div style={{ display: "grid", gap: "4px" }}>
              {handoffSummary.upstreamRows.map((row) => (
                <div
                  key={`${row.toolId}-${row.artifactPath}`}
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: compact ? "10px" : "11px",
                    color: LABEL,
                    lineHeight: 1.45,
                  }}
                >
                  Requires {row.toolId.toUpperCase()}{" "}
                  <span style={{ fontFamily: THEME.MONO, color: VALUE }}>{row.artifactPath}</span> ·{" "}
                  {row.present ? "present" : workflowStatusLabel(row.status)}
                </div>
              ))}
            </div>
          )}
          {handoffSummary.nextToolId && (
            <div
              style={{ fontFamily: THEME.SANS, fontSize: compact ? "10px" : "11px", color: LABEL, lineHeight: 1.45 }}
            >
              Next {handoffSummary.nextToolId.toUpperCase()} expects{" "}
              <span style={{ fontFamily: THEME.MONO, color: VALUE }}>
                {handoffSummary.nextArtifactPath ?? "a published artifact"}
              </span>{" "}
              · {handoffSummary.nextArtifactPresent ? "present" : workflowStatusLabel(handoffSummary.availability)}
            </div>
          )}
          <div style={{ fontFamily: THEME.SANS, fontSize: compact ? "10px" : "11px", color: LABEL, lineHeight: 1.45 }}>
            {handoffSummary.reason}
          </div>
        </div>
      )}

      {runtimeGates.length > 0 && (
        <div style={{ display: "grid", gap: compact ? "6px" : "8px" }}>
          {runtimeGates.map(({ sourceToolId, decision }) => (
            <RuntimeGatingNotice
              key={`${sourceToolId}-${toolId}`}
              decision={decision}
              sourceLabel={sourceToolId}
              targetLabel={toolId}
              compact={compact}
            />
          ))}
        </div>
      )}

      {compact ? (
        <div
          className="nb-workbench-inline-context__metrics nb-workbench-inline-context__metrics--compact"
          style={{ display: "grid", gap: "6px" }}
        >
          {compactItems.map((item) => (
            <div
              key={item.label}
              className="nb-workbench-inline-context__metric nb-workbench-inline-context__metric--compact"
              style={{
                padding: "7px 9px",
                borderRadius: "12px",
                border: `1px solid ${BORDER}`,
                background: THEME.PANEL_SURFACE,
                display: "grid",
                gap: "4px",
                minHeight: "unset",
                maxWidth: "100%",
                minWidth: 0,
              }}
            >
              <span
                className="nb-workbench-inline-context__metric-label"
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "10px",
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {item.label}
              </span>
              <span
                className="nb-workbench-inline-context__metric-value"
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "10px",
                  color: VALUE,
                  lineHeight: 1.4,
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Evidence
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE }}>
              {selectedEvidenceIds.length} selected
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Bottleneck
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE }}>
              {bottleneck?.label ?? "Awaiting structured analyze artifact"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Loop Feedback
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, lineHeight: 1.55 }}>
              {committedFeedback
                ? `DBTL committed · pass ${committedFeedback.result.passRate.toFixed(0)}% · ${committedFeedback.result.latestPhase}`
                : "No committed DBTL feedback applied yet"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Freshness
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, lineHeight: 1.55 }}>
              {freshness.status === "fresh"
                ? "Fresh against current upstream context"
                : freshness.status === "stale"
                  ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(", ")} updated`
                  : freshness.status === "awaiting-upstream"
                    ? "Upstream data is available, but this tool has not been rerun"
                    : "No auditable run recorded yet"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Evidence trace
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, lineHeight: 1.55 }}>
              {evidenceTrace.length > 0
                ? evidenceTrace.map((item) => item.title).join(" · ")
                : "Manual or demo context"}
            </div>
          </div>
        </div>
      )}

      {latestRunArtifact && !compact && (
        <div
          style={{
            borderRadius: "12px",
            border: `1px solid ${BORDER}`,
            background: THEME.PANEL_SURFACE,
            padding: "10px 12px",
            display: "grid",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: "10px",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Latest audited run
          </div>
          <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, lineHeight: 1.55 }}>
            {latestRunArtifact.summary}
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>
            upstream {latestRunArtifact.upstreamArtifactIds.length} ·{" "}
            {new Date(latestRunArtifact.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      )}

      <div
        className={`nb-workbench-inline-context__actions${compact ? " nb-workbench-inline-context__actions--compact" : ""}`}
        style={{
          display: compact ? "grid" : "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: compact ? undefined : "wrap",
          gridTemplateColumns: compact ? "1fr" : undefined,
        }}
      >
        <Link href="/analyze" className="nb-ui-control nb-workbench-inline-context__action" style={actionBtn}>
          <Microscope size={12} />
          Analyze
        </Link>
        {toolId !== "nexai" && (
          <button
            type="button"
            onClick={() => useUIStore.getState().setCopilotOpen(true)}
            data-testid="workbench-inline-ask-axon"
            className="nb-ui-control nb-workbench-inline-context__action"
            style={{ ...actionBtn, cursor: "pointer" }}
          >
            <BrainCircuit size={12} />
            Ask Axon
          </button>
        )}
        {nextTool && (
          <Link
            href={handoffSummary?.nextHref ?? nextTool.href}
            className="nb-ui-control nb-workbench-inline-context__action"
            style={actionBtn}
          >
            Next:{" "}
            {handoffSummary?.nextToolId
              ? (TOOL_BY_ID[handoffSummary.nextToolId]?.shortLabel ?? nextTool.shortLabel)
              : nextTool.shortLabel}
            <ArrowUpRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
