/**
 * Re-export from config directory for backward compatibility.
 * This file maintains backward compatibility while the canonical
 * location is now in src/config/workbenchConfig.ts
 */
export {
  CROSS_STAGE_TOOL_IDS,
  getDefaultHrefForStage,
  getNextRequiredToolIds,
  getNextToolIds,
  getStageById,
  getStageForTool,
  TOOL_STAGE_MAP,
  WORKBENCH_STAGES,
  type WorkbenchStageDefinition,
  type WorkbenchStageId,
} from "../../../config/workbenchConfig";
