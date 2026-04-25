/** @jest-environment node */
/**
 * Contract parity tests.
 *
 * Asserts that the declarative ToolContract registry stays in lock-step
 * with TOOL_DEFINITIONS (display registry) and TOOL_VALIDITY (validity
 * badges). Drift here is the single most common way an architecture
 * audit silently rots — these tests fail CI before the rot ships.
 */
import { TOOL_DEFINITIONS } from '../../src/components/tools/shared/toolRegistry';
import { TOOL_VALIDITY } from '../../src/components/tools/shared/toolValidity';
import {
  GOLDEN_PATH_TOOL_IDS,
  TOOL_IDS,
  VALIDITY_ORDER,
  isGoldenPathToolId,
  isToolId,
  meetsValidityFloor,
} from '../../src/domain/workflowContract';
import {
  WORKFLOW_CONTRACTS,
  getGoldenPath,
  getGoldenPathPredecessor,
  getGoldenPathSuccessor,
  getSidecarIds,
  getToolContract,
  tryGetToolContract,
} from '../../src/services/workflowRegistry';

describe('workflowContract — TOOL_IDS', () => {
  it('contains every TOOL_DEFINITIONS id at least once', () => {
    const definitionIds = TOOL_DEFINITIONS.map((d) => d.id);
    for (const id of definitionIds) {
      expect(TOOL_IDS).toContain(id);
    }
  });

  it('isToolId narrows correctly', () => {
    expect(isToolId('pathd')).toBe(true);
    expect(isToolId('not-a-tool')).toBe(false);
  });
});

describe('workflowRegistry — coverage', () => {
  it('has exactly one ToolContract per TOOL_IDS entry', () => {
    const keys = Object.keys(WORKFLOW_CONTRACTS).sort();
    const expected = [...TOOL_IDS].sort();
    expect(keys).toEqual(expected);
  });

  it('every TOOL_DEFINITIONS id resolves to a contract', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(() => getToolContract(def.id as (typeof TOOL_IDS)[number])).not.toThrow();
    }
  });

  it('tryGetToolContract returns undefined for unknown ids', () => {
    expect(tryGetToolContract('not-a-tool')).toBeUndefined();
  });

  it('every contract.toolId matches its registry key', () => {
    for (const [key, contract] of Object.entries(WORKFLOW_CONTRACTS)) {
      expect(contract.toolId).toBe(key);
    }
  });

  it('every contract has a non-empty stageId / primaryIntent', () => {
    for (const contract of Object.values(WORKFLOW_CONTRACTS)) {
      expect(contract.stageId).toMatch(/^stage-[1-4]$/);
      expect(contract.primaryIntent.length).toBeGreaterThan(0);
    }
  });

  it('every semantically incomplete executable contract is explicitly scoped out', () => {
    for (const contract of Object.values(WORKFLOW_CONTRACTS)) {
      expect(['workflow', 'sidecar', 'contractOnly', 'demoOnly', 'alias']).toContain(contract.contractScope);

      if (contract.contractScope === 'workflow') {
        expect(contract.outputArtifacts.length).toBeGreaterThan(0);
        expect(contract.failureModes.length).toBeGreaterThan(0);
        expect(contract.outputArtifacts.some((artifact) => artifact.payloadPath && artifact.rationale)).toBe(true);
        continue;
      }

      if (contract.outputArtifacts.length === 0 || contract.failureModes.length === 0) {
        expect(['sidecar', 'contractOnly', 'demoOnly', 'alias']).toContain(contract.contractScope);
      }
    }
  });
});

describe('workflowRegistry — golden path', () => {
  it('exposes the declared PATHD → FBASim → CatDes → DynCon → CellFree → DBTLflow ordering', () => {
    expect(getGoldenPath()).toEqual([
      'pathd',
      'fbasim',
      'catdes',
      'dyncon',
      'cellfree',
      'dbtlflow',
    ]);
  });

  it('every golden-path id has isGoldenPath: true and every other has false', () => {
    for (const id of TOOL_IDS) {
      const contract = getToolContract(id);
      expect(contract.isGoldenPath).toBe(isGoldenPathToolId(id));
      expect(contract.contractScope === 'workflow').toBe(isGoldenPathToolId(id));
    }
  });

  it('successor / predecessor walk matches the declared ordering', () => {
    expect(getGoldenPathPredecessor('pathd')).toBeNull();
    expect(getGoldenPathSuccessor('pathd')).toBe('fbasim');
    expect(getGoldenPathSuccessor('dbtlflow')).toBeNull();
    expect(getGoldenPathPredecessor('dbtlflow')).toBe('cellfree');
    // Sidecar is not on the path → both ends null.
    expect(getGoldenPathSuccessor('cethx')).toBeNull();
    expect(getGoldenPathPredecessor('cethx')).toBeNull();
  });

  it('each golden-path step (except PATHD) requires its predecessor in requiredInputs', () => {
    for (let i = 1; i < GOLDEN_PATH_TOOL_IDS.length; i += 1) {
      const cur = GOLDEN_PATH_TOOL_IDS[i];
      const prev = GOLDEN_PATH_TOOL_IDS[i - 1];
      const required = getToolContract(cur).requiredInputs;
      const found = required.some((ref) => ref.toolId === prev && ref.required);
      expect(found).toBe(true);
    }
  });

  it('PATHD has no required inputs', () => {
    expect(getToolContract('pathd').requiredInputs).toEqual([]);
  });

  it('sidecars declare no required inputs', () => {
    for (const id of getSidecarIds()) {
      expect(getToolContract(id).requiredInputs).toEqual([]);
    }
  });
});

describe('workflowRegistry — validity baseline parity', () => {
  it('every contract validityBaseline.floor is consistent with TOOL_VALIDITY when present', () => {
    for (const id of TOOL_IDS) {
      const validity = TOOL_VALIDITY[id];
      if (!validity) continue;
      const floor = getToolContract(id).validityBaseline.floor;
      // The contract floor must not exceed the tool's actual validity.
      // floor=real demands real; floor=partial allows partial or real; floor=demo allows anything.
      expect(VALIDITY_ORDER[validity.level]).toBeGreaterThanOrEqual(VALIDITY_ORDER[floor]);
    }
  });

  it('meetsValidityFloor enforces the ordering correctly', () => {
    expect(meetsValidityFloor('real', 'real')).toBe(true);
    expect(meetsValidityFloor('partial', 'real')).toBe(false);
    expect(meetsValidityFloor('partial', 'partial')).toBe(true);
    expect(meetsValidityFloor('demo', 'partial')).toBe(false);
    expect(meetsValidityFloor('demo', 'demo')).toBe(true);
  });
});

describe('workflowRegistry — nextRecommendedNodes', () => {
  it('every recommended node id is a registered ToolId', () => {
    for (const contract of Object.values(WORKFLOW_CONTRACTS)) {
      for (const next of contract.nextRecommendedNodes) {
        expect(isToolId(next)).toBe(true);
      }
    }
  });
});
