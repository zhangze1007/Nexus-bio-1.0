/**
 * Shared workbench integration hook for tool pages (R-11).
 *
 * Encapsulates the common pattern of reading workbench state and
 * publishing tool payloads. Reduces duplication across 12+ tool pages.
 *
 * Usage:
 *   const { project, analyzeArtifact, setPayload } = useToolWorkbench('fbasim');
 */

import { useCallback } from "react";
import { useWorkbenchStore } from "../../../store/workbenchStore";

/** Tool dependency map — which tools feed into which */
const TOOL_DEPENDENCIES: Record<string, string[]> = {
  catdes: ["fbasim", "cethx", "dbtlflow"],
  cellfree: ["fbasim", "cethx"],
  cethx: ["fbasim"],
  dyncon: ["fbasim", "catdes"],
  fbasim: [],
  gecair: ["catdes", "dyncon"],
  genmim: ["fbasim"],
  multio: ["fbasim", "scspatial"],
  nexai: [],
  proevol: ["catdes"],
  scspatial: ["fbasim"],
};

/**
 * Hook for tool pages to integrate with the workbench store.
 *
 * @param toolId - The tool's identifier (e.g., 'fbasim', 'catdes')
 * @returns Workbench state and actions for this tool
 */
export function useToolWorkbench(toolId: string) {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const dependencies = TOOL_DEPENDENCIES[toolId] ?? [];
  const upstreamPayloads: Record<string, unknown> = {};
  for (const dep of dependencies) {
    if ((toolPayloads as Record<string, unknown>)[dep]) {
      upstreamPayloads[dep] = (toolPayloads as Record<string, unknown>)[dep];
    }
  }

  const setPayload = useCallback(
    (payload: Record<string, unknown>) => {
      setToolPayload(toolId as keyof typeof toolPayloads, payload as never);
    },
    [toolId, setToolPayload],
  );

  return {
    project,
    analyzeArtifact,
    upstreamPayloads,
    setPayload,
    ownPayload: (toolPayloads as Record<string, unknown>)[toolId],
  };
}
