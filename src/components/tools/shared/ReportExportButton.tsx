"use client";

import { Check, Download } from "lucide-react";
import { useCallback, useState } from "react";
import { renderMarkdown } from "../../../services/report/markdownRenderer";
import { collectReportData } from "../../../services/report/reportCollector";
import { useWorkbenchStore } from "../../../store/workbenchStore";
import { THEME } from "../../../theme";

/**
 * ReportExportButton — One-click Markdown report export.
 *
 * Reads tool payloads and project metadata from the workbench store,
 * generates a structured Markdown report via the report service pipeline,
 * and triggers a browser download.
 */
export default function ReportExportButton() {
  const [exported, setExported] = useState(false);

  const handleClick = useCallback(() => {
    const { toolPayloads, project } = useWorkbenchStore.getState();

    // Collect structured report data from all tool payloads
    const report = collectReportData({ toolPayloads: toolPayloads as Record<string, unknown> });

    // Override metadata with project info when available
    if (project) {
      report.metadata.projectTitle = project.title || report.metadata.projectTitle;
      report.metadata.targetProduct = project.targetProduct || report.metadata.targetProduct;
    }

    // Render to Markdown
    const markdown = renderMarkdown(report);

    // Build filename with today's date
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `nexus-bio-report-${dateStr}.md`;

    // Trigger download
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    // Flash success state
    setExported(true);
    setTimeout(() => setExported(false), 1800);
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Export report as Markdown"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        height: "24px",
        padding: "0 8px",
        borderRadius: "999px",
        border: `1px solid ${exported ? "rgba(191,220,205,0.35)" : THEME.BORDER}`,
        background: exported ? "rgba(191,220,205,0.14)" : THEME.PANEL_GLASS_STRONG,
        color: exported ? THEME.MINT : THEME.LABEL,
        fontFamily: THEME.SANS,
        fontSize: "10px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 120ms, border-color 120ms, color 120ms",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!exported) {
          (e.currentTarget as HTMLElement).style.background = "rgba(175,195,214,0.12)";
          (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER_ACTIVE;
          (e.currentTarget as HTMLElement).style.color = THEME.VALUE;
        }
      }}
      onMouseLeave={(e) => {
        if (!exported) {
          (e.currentTarget as HTMLElement).style.background = THEME.PANEL_GLASS_STRONG;
          (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER;
          (e.currentTarget as HTMLElement).style.color = THEME.LABEL;
        }
      }}
    >
      {exported ? <Check size={11} /> : <Download size={11} />}
      {exported ? "Exported" : "Export"}
    </button>
  );
}
