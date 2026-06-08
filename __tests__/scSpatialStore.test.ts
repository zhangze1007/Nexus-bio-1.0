/**
 * Tests for src/store/scSpatialStore.ts
 *
 * Covers:
 *  - Initial state
 *  - beginUpload / beginQuery / fail / hydrateFromQuery
 *  - setSelectedGene / setSelectedCluster / setSelectedCellId
 *  - setViewMode / toggleDeveloperMode / toggleHelp
 *  - reset
 *  - Edge cases: state transitions, null values
 */

import { useScSpatialStore } from '../src/store/scSpatialStore';
import type { ScSpatialQueryResponse } from '../src/types/scspatial';

// Reset store before each test
beforeEach(() => {
  useScSpatialStore.getState().reset();
});

// ── Helper ───────────────────────────────────────────────────────────────────

function makeQueryResponse(overrides: Partial<ScSpatialQueryResponse> = {}): ScSpatialQueryResponse {
  return {
    artifactId: 'art-001',
    validity: 'real',
    datasetMeta: {
      artifactId: 'art-001',
      datasetName: 'Test Dataset',
      fileName: 'test.h5ad',
      cellCount: 5000,
      geneCount: 2000,
      sampleCount: 1,
      hasSpatialCoords: true,
      hasPrecomputedUmap: true,
      availableViews: {
        spatial2d: true,
        spatial3d: true,
        umap: true,
        trajectory: false,
        table: true,
      },
      warnings: [],
      missingFields: [],
      sampleMetadataKeys: [],
      availableLayers: ['X'],
      availableEmbeddings: ['umap'],
      parserVersion: '1.0',
    },
    availableGenes: ['GENE_A', 'GENE_B', 'GENE_C'],
    availableClusters: ['cluster-0', 'cluster-1', 'cluster-2'],
    selection: {
      selectedGene: 'GENE_A',
      selectedCluster: 'cluster-0',
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    },
    centerView: {
      mode: 'spatial-2d',
      points: [],
      xLabel: 'x',
      yLabel: 'y',
    },
    rightPanel: {
      clusterSummaries: [],
      selectedClusterSummary: null,
      selectedCell: null,
      hotspots: [],
      coexpression: [],
      provenance: {
        source: 'upload',
        fileName: 'test.h5ad',
        validity: 'real',
        warnings: [],
        missingFields: [],
      },
    },
    exportData: {
      clusterAnnotations: [],
      hotspotTable: [],
      spatialPoints: [],
    },
    developer: {
      warnings: [],
      missingFields: [],
      availableEmbeddings: ['umap'],
      availableLayers: ['X'],
    },
    ...overrides,
  };
}

// ── Initial state ────────────────────────────────────────────────────────────

describe('scSpatialStore initial state', () => {
  it('has correct initial values after reset', () => {
    const state = useScSpatialStore.getState();
    expect(state.artifactId).toBeNull();
    expect(state.validity).toBeNull();
    expect(state.datasetMeta).toBeNull();
    expect(state.availableGenes).toEqual([]);
    expect(state.availableClusters).toEqual([]);
    expect(state.selectedGene).toBe('');
    expect(state.selectedCluster).toBeNull();
    expect(state.selectedCellId).toBeNull();
    expect(state.viewMode).toBe('spatial-2d');
    expect(state.developerMode).toBe(false);
    expect(state.helpOpen).toBe(false);
    expect(state.loadState).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.query).toBeNull();
  });
});

// ── beginUpload ──────────────────────────────────────────────────────────────

describe('scSpatialStore.beginUpload', () => {
  it('sets loadState to uploading and clears error', () => {
    useScSpatialStore.getState().fail('previous error');
    useScSpatialStore.getState().beginUpload();
    const state = useScSpatialStore.getState();
    expect(state.loadState).toBe('uploading');
    expect(state.error).toBeNull();
  });
});

// ── beginQuery ───────────────────────────────────────────────────────────────

describe('scSpatialStore.beginQuery', () => {
  it('sets loadState to querying when artifactId is set', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().beginQuery();
    expect(useScSpatialStore.getState().loadState).toBe('querying');
  });

  it('does not change loadState when artifactId is null', () => {
    useScSpatialStore.getState().beginQuery();
    expect(useScSpatialStore.getState().loadState).toBe('idle');
  });

  it('clears error when beginning query', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().fail('some error');
    useScSpatialStore.getState().beginQuery();
    expect(useScSpatialStore.getState().error).toBeNull();
  });
});

// ── fail ─────────────────────────────────────────────────────────────────────

describe('scSpatialStore.fail', () => {
  it('sets loadState to error and stores message', () => {
    useScSpatialStore.getState().fail('Upload failed');
    const state = useScSpatialStore.getState();
    expect(state.loadState).toBe('error');
    expect(state.error).toBe('Upload failed');
  });

  it('overwrites previous error', () => {
    useScSpatialStore.getState().fail('first error');
    useScSpatialStore.getState().fail('second error');
    expect(useScSpatialStore.getState().error).toBe('second error');
  });
});

// ── hydrateFromQuery ─────────────────────────────────────────────────────────

describe('scSpatialStore.hydrateFromQuery', () => {
  it('sets all fields from query response', () => {
    const query = makeQueryResponse();
    useScSpatialStore.getState().hydrateFromQuery(query);
    const state = useScSpatialStore.getState();
    expect(state.artifactId).toBe('art-001');
    expect(state.validity).toBe('real');
    expect(state.datasetMeta).toBe(query.datasetMeta);
    expect(state.availableGenes).toEqual(['GENE_A', 'GENE_B', 'GENE_C']);
    expect(state.availableClusters).toEqual(['cluster-0', 'cluster-1', 'cluster-2']);
    expect(state.selectedGene).toBe('GENE_A');
    expect(state.selectedCluster).toBe('cluster-0');
    expect(state.selectedCellId).toBeNull();
    expect(state.viewMode).toBe('spatial-2d');
    expect(state.developerMode).toBe(false);
    expect(state.loadState).toBe('ready');
    expect(state.error).toBeNull();
    expect(state.query).toBe(query);
  });

  it('sets loadState to ready', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    expect(useScSpatialStore.getState().loadState).toBe('ready');
  });

  it('clears previous error', () => {
    useScSpatialStore.getState().fail('old error');
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    expect(useScSpatialStore.getState().error).toBeNull();
  });
});

// ── setSelectedGene ──────────────────────────────────────────────────────────

describe('scSpatialStore.setSelectedGene', () => {
  it('updates selected gene', () => {
    useScSpatialStore.getState().setSelectedGene('GENE_B');
    expect(useScSpatialStore.getState().selectedGene).toBe('GENE_B');
  });

  it('clears selectedCellId when gene changes', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().setSelectedCellId('cell-1');
    useScSpatialStore.getState().setSelectedGene('GENE_C');
    expect(useScSpatialStore.getState().selectedCellId).toBeNull();
  });
});

// ── setSelectedCluster ───────────────────────────────────────────────────────

describe('scSpatialStore.setSelectedCluster', () => {
  it('updates selected cluster', () => {
    useScSpatialStore.getState().setSelectedCluster('cluster-1');
    expect(useScSpatialStore.getState().selectedCluster).toBe('cluster-1');
  });

  it('allows null cluster', () => {
    useScSpatialStore.getState().setSelectedCluster('cluster-1');
    useScSpatialStore.getState().setSelectedCluster(null);
    expect(useScSpatialStore.getState().selectedCluster).toBeNull();
  });

  it('clears selectedCellId when cluster changes', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().setSelectedCellId('cell-1');
    useScSpatialStore.getState().setSelectedCluster('cluster-2');
    expect(useScSpatialStore.getState().selectedCellId).toBeNull();
  });
});

// ── setSelectedCellId ────────────────────────────────────────────────────────

describe('scSpatialStore.setSelectedCellId', () => {
  it('updates selected cell id', () => {
    useScSpatialStore.getState().setSelectedCellId('cell-42');
    expect(useScSpatialStore.getState().selectedCellId).toBe('cell-42');
  });

  it('allows null cell id', () => {
    useScSpatialStore.getState().setSelectedCellId('cell-1');
    useScSpatialStore.getState().setSelectedCellId(null);
    expect(useScSpatialStore.getState().selectedCellId).toBeNull();
  });
});

// ── setViewMode ──────────────────────────────────────────────────────────────

describe('scSpatialStore.setViewMode', () => {
  it('updates view mode', () => {
    useScSpatialStore.getState().setViewMode('umap');
    expect(useScSpatialStore.getState().viewMode).toBe('umap');
  });

  it('supports all view modes', () => {
    const modes = ['spatial-2d', 'spatial-3d', 'umap', 'trajectory', 'table'] as const;
    for (const mode of modes) {
      useScSpatialStore.getState().setViewMode(mode);
      expect(useScSpatialStore.getState().viewMode).toBe(mode);
    }
  });
});

// ── toggleDeveloperMode ──────────────────────────────────────────────────────

describe('scSpatialStore.toggleDeveloperMode', () => {
  it('toggles from false to true', () => {
    expect(useScSpatialStore.getState().developerMode).toBe(false);
    useScSpatialStore.getState().toggleDeveloperMode();
    expect(useScSpatialStore.getState().developerMode).toBe(true);
  });

  it('toggles from true to false', () => {
    useScSpatialStore.getState().toggleDeveloperMode();
    useScSpatialStore.getState().toggleDeveloperMode();
    expect(useScSpatialStore.getState().developerMode).toBe(false);
  });
});

// ── toggleHelp ───────────────────────────────────────────────────────────────

describe('scSpatialStore.toggleHelp', () => {
  it('toggles from false to true', () => {
    expect(useScSpatialStore.getState().helpOpen).toBe(false);
    useScSpatialStore.getState().toggleHelp();
    expect(useScSpatialStore.getState().helpOpen).toBe(true);
  });

  it('toggles from true to false', () => {
    useScSpatialStore.getState().toggleHelp();
    useScSpatialStore.getState().toggleHelp();
    expect(useScSpatialStore.getState().helpOpen).toBe(false);
  });
});

// ── reset ────────────────────────────────────────────────────────────────────

describe('scSpatialStore.reset', () => {
  it('resets all state to initial values', () => {
    // Modify state
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().setSelectedGene('GENE_X');
    useScSpatialStore.getState().setSelectedCluster('cluster-5');
    useScSpatialStore.getState().setSelectedCellId('cell-99');
    useScSpatialStore.getState().setViewMode('umap');
    useScSpatialStore.getState().toggleDeveloperMode();
    useScSpatialStore.getState().toggleHelp();

    // Reset
    useScSpatialStore.getState().reset();

    const state = useScSpatialStore.getState();
    expect(state.artifactId).toBeNull();
    expect(state.validity).toBeNull();
    expect(state.datasetMeta).toBeNull();
    expect(state.availableGenes).toEqual([]);
    expect(state.availableClusters).toEqual([]);
    expect(state.selectedGene).toBe('');
    expect(state.selectedCluster).toBeNull();
    expect(state.selectedCellId).toBeNull();
    expect(state.viewMode).toBe('spatial-2d');
    expect(state.developerMode).toBe(false);
    expect(state.helpOpen).toBe(false);
    expect(state.loadState).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.query).toBeNull();
  });
});

// ── State transition sequences ───────────────────────────────────────────────

describe('scSpatialStore state transitions', () => {
  it('upload -> hydrate -> ready workflow', () => {
    useScSpatialStore.getState().beginUpload();
    expect(useScSpatialStore.getState().loadState).toBe('uploading');

    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    expect(useScSpatialStore.getState().loadState).toBe('ready');
    expect(useScSpatialStore.getState().artifactId).toBe('art-001');
  });

  it('upload -> fail -> error workflow', () => {
    useScSpatialStore.getState().beginUpload();
    useScSpatialStore.getState().fail('Network error');
    expect(useScSpatialStore.getState().loadState).toBe('error');
    expect(useScSpatialStore.getState().error).toBe('Network error');
  });

  it('hydrate -> query -> ready workflow', () => {
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().beginQuery();
    expect(useScSpatialStore.getState().loadState).toBe('querying');

    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse({
      selection: {
        selectedGene: 'GENE_B',
        selectedCluster: 'cluster-1',
        selectedCellId: null,
        viewMode: 'umap',
        developerMode: false,
      },
    }));
    expect(useScSpatialStore.getState().loadState).toBe('ready');
    expect(useScSpatialStore.getState().selectedGene).toBe('GENE_B');
  });

  it('full lifecycle: upload -> hydrate -> select -> reset', () => {
    useScSpatialStore.getState().beginUpload();
    useScSpatialStore.getState().hydrateFromQuery(makeQueryResponse());
    useScSpatialStore.getState().setSelectedGene('GENE_C');
    useScSpatialStore.getState().setSelectedCluster('cluster-2');
    useScSpatialStore.getState().setViewMode('3d' as any);

    useScSpatialStore.getState().reset();
    expect(useScSpatialStore.getState().loadState).toBe('idle');
    expect(useScSpatialStore.getState().selectedGene).toBe('');
  });
});
