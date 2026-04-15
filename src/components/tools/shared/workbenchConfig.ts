import { getToolDefinition } from './toolRegistry';
import { getDependencyEdges } from './workbenchGraph';

export type WorkbenchStageId =
  | 'stage-1'
  | 'stage-2'
  | 'stage-3'
  | 'stage-4';

export interface WorkbenchStageDefinition {
  id: WorkbenchStageId;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  defaultToolId: string;
  toolIds: string[];
  entryRoutes?: Array<{ label: string; href: string }>;
}

export const WORKBENCH_STAGES: WorkbenchStageDefinition[] = [
  {
    id: 'stage-1',
    label: 'Design & Discovery',
    shortLabel: 'Stage 1',
    description: 'Move from literature and targets into an analyzed pathway object.',
    accent: '#AFC3D6',
    defaultToolId: 'pathd',
    toolIds: ['pathd'],
    entryRoutes: [
      { label: 'Research', href: '/research' },
      { label: 'Analyze', href: '/analyze' },
    ],
  },
  {
    id: 'stage-2',
    label: 'Simulation & Component Optimization',
    shortLabel: 'Stage 2',
    description: 'Quantify flux, thermodynamics, catalyst selection, and component bottlenecks.',
    accent: '#E7C7A9',
    defaultToolId: 'fbasim',
    toolIds: ['fbasim', 'cethx', 'catdes', 'proevol'],
  },
  {
    id: 'stage-3',
    label: 'Chassis Engineering & Control',
    shortLabel: 'Stage 3',
    description: 'Translate bottlenecks into genome, circuit, and dynamic-control interventions.',
    accent: '#CFC4E3',
    defaultToolId: 'genmim',
    toolIds: ['genmim', 'gecair', 'dyncon'],
  },
  {
    id: 'stage-4',
    label: 'Test, Analyze & Iterate',
    shortLabel: 'Stage 4',
    description: 'Validate in cell-free or omics loops, capture evidence, and feed learning back.',
    accent: '#BFDCCD',
    defaultToolId: 'cellfree',
    toolIds: ['cellfree', 'dbtlflow', 'multio', 'scspatial'],
  },
];

// NEXAI is being repositioned from a "cross-stage tool" into a dedicated
// Copilot surface (see audit P0.10). The list is intentionally empty for now
// — the `/tools/nexai` route stays live, but it no longer renders inside
// the launcher / sidebar / status-bar cross-stage sections.
export const CROSS_STAGE_TOOL_IDS = [] as const;

export const TOOL_STAGE_MAP = WORKBENCH_STAGES.reduce<Record<string, WorkbenchStageId>>((acc, stage) => {
  stage.toolIds.forEach((toolId) => {
    acc[toolId] = stage.id;
  });
  return acc;
}, {});

export function getStageForTool(toolId?: string | null): WorkbenchStageDefinition | null {
  if (!toolId) return null;
  const stageId = TOOL_STAGE_MAP[toolId];
  return WORKBENCH_STAGES.find((stage) => stage.id === stageId) ?? null;
}

export function getStageById(stageId?: WorkbenchStageId | null): WorkbenchStageDefinition | null {
  if (!stageId) return null;
  return WORKBENCH_STAGES.find((stage) => stage.id === stageId) ?? null;
}

export function getDefaultHrefForStage(stageId: WorkbenchStageId): string {
  const stage = getStageById(stageId);
  if (!stage) return '/tools';
  const tool = getToolDefinition(stage.defaultToolId);
  return tool?.href ?? '/tools';
}

export function getNextToolIds(toolId?: string | null): string[] {
  if (!toolId) return [];
  return getDependencyEdges({ toolId, direction: 'downstream' }).map((edge) => edge.toToolId);
}
