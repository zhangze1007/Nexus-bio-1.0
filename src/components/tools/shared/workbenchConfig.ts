/**
 * Re-export from config directory for backward compatibility.
 * This file maintains backward compatibility while the canonical
 * location is now in src/config/workbenchConfig.ts
 */
export {
  type WorkbenchStageId,
  type WorkbenchStageDefinition,
  WORKBENCH_STAGES,
  CROSS_STAGE_TOOL_IDS,
  TOOL_STAGE_MAP,
  getStageForTool,
  getStageById,
  getDefaultHrefForStage,
  getNextToolIds,
  getNextRequiredToolIds,
} from '../../../config/workbenchConfig';
