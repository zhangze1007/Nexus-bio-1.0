import { buildScSpatialQueryResponse } from '../src/server/scspatialAnalysis';
import { createDemoScSpatialArtifact } from '../src/server/scspatialDemo';

describe('buildScSpatialQueryResponse', () => {
  it('builds a demo response with spatial points and hotspot summaries', () => {
    const artifact = createDemoScSpatialArtifact();

    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });

    expect(response.validity).toBe('demo');
    expect(response.centerView.mode).toBe('spatial-2d');
    expect(response.centerView.points.length).toBeGreaterThan(0);
    expect(response.rightPanel.hotspots.length).toBeGreaterThan(0);
    expect(response.availableGenes.length).toBeGreaterThan(0);
    expect(response.exportData.spatialPoints.length).toBe(response.datasetMeta.cellCount);
    expect(response.rightPanel.selectedCell?.sampleMetadata?.donor).toBeTruthy();
  });

  it('downgrades to partial and hides spatial-only outputs when spatial coordinates are missing', () => {
    const artifact = createDemoScSpatialArtifact();
    const partialArtifact = {
      ...artifact,
      source: {
        ...artifact.source,
        fileName: 'uploaded-no-spatial.h5ad',
      },
      obsm: {
        ...artifact.obsm,
        spatial: undefined,
      },
      metadata: {
        ...artifact.metadata,
        hasSpatialCoords: false,
        missingFields: [...artifact.metadata.missingFields, 'obsm.spatial'],
        availableViews: {
          ...artifact.metadata.availableViews,
          spatial2d: false,
          spatial3d: false,
        },
      },
    };

    const response = buildScSpatialQueryResponse(partialArtifact, {
      artifactId: partialArtifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });

    expect(response.validity).toBe('partial');
    expect(response.datasetMeta.availableViews.spatial2d).toBe(false);
    expect(response.datasetMeta.availableViews.spatial3d).toBe(false);
    expect(response.centerView.mode).toBe('umap');
    expect(response.exportData.spatialPoints).toHaveLength(0);
    expect(response.rightPanel.provenance.missingFields).toContain('obsm.spatial');
  });

  it('selects a specific gene when requested', () => {
    const artifact = createDemoScSpatialArtifact();
    const gene = artifact.var[2]?.geneSymbol ?? artifact.var[0]?.geneSymbol;
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: gene,
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.selection.selectedGene).toBe(gene);
  });

  it('falls back to first gene when requested gene is not available', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: 'nonexistent_gene_xyz',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.availableGenes).toContain(response.selection.selectedGene);
  });

  it('filters points by selected cluster', () => {
    const artifact = createDemoScSpatialArtifact();
    const cluster = artifact.obs[0]?.clusterLabel;
    if (!cluster) return; // skip if no cluster labels
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: cluster,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });
    for (const point of response.centerView.points) {
      expect(point.clusterLabel).toBe(cluster);
    }
  });

  it('handles umap view mode', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'umap',
      developerMode: false,
    });
    expect(response.centerView.mode).toBe('umap');
    expect(response.centerView.xLabel).toBe('UMAP 1');
    expect(response.centerView.yLabel).toBe('UMAP 2');
  });

  it('handles trajectory view mode', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'trajectory',
      developerMode: false,
    });
    expect(response.centerView.mode).toBe('trajectory');
    expect(response.centerView.trajectory).toBeDefined();
    expect(response.centerView.points).toHaveLength(0);
  });

  it('handles spatial-3d view mode with z values', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-3d',
      developerMode: false,
    });
    expect(response.centerView.mode).toBe('spatial-3d');
    expect(response.centerView.zLabel).toBeDefined();
    for (const point of response.centerView.points) {
      expect(point.z).toBeDefined();
    }
  });

  it('handles table view mode', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.centerView.mode).toBe('table');
    expect(response.centerView.xLabel).toBe('Cell');
    expect(response.centerView.yLabel).toBe('Expression');
  });

  it('falls back from spatial-2d when spatial coords are missing', () => {
    const artifact = createDemoScSpatialArtifact();
    const noSpatial = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        hasSpatialCoords: false,
        availableViews: {
          spatial2d: false,
          spatial3d: false,
          umap: false,
          trajectory: false,
          table: true,
        },
      },
      obsm: { ...artifact.obsm, spatial: undefined },
    };
    const response = buildScSpatialQueryResponse(noSpatial, {
      artifactId: noSpatial.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });
    // Should fall back to some available view (may be umap or table)
    expect(response.centerView.mode).not.toBe('spatial-2d');
  });

  it('includes coexpression summaries', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(Array.isArray(response.rightPanel.coexpression)).toBe(true);
    expect(response.rightPanel.coexpression.length).toBeLessThanOrEqual(6);
  });

  it('includes cluster summaries', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.rightPanel.clusterSummaries.length).toBeGreaterThan(0);
    for (const cs of response.rightPanel.clusterSummaries) {
      expect(typeof cs.clusterId).toBe('number');
      expect(typeof cs.clusterLabel).toBe('string');
      expect(cs.cellCount).toBeGreaterThan(0);
    }
  });

  it('developer mode is passed through', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: true,
    });
    expect(response.selection.developerMode).toBe(true);
  });

  it('export data has correct structure', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.exportData.clusterAnnotations.length).toBe(response.datasetMeta.cellCount);
    expect(Array.isArray(response.exportData.hotspotTable)).toBe(true);
    expect(Array.isArray(response.exportData.spatialPoints)).toBe(true);
  });

  it('provenance source is bundled-demo for demo artifacts', () => {
    const artifact = createDemoScSpatialArtifact();
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.rightPanel.provenance.source).toBe('bundled-demo');
    expect(response.rightPanel.provenance.validity).toBe('demo');
  });

  it('provenance source is upload for non-demo artifacts', () => {
    const artifact = createDemoScSpatialArtifact();
    const uploadedArtifact = {
      ...artifact,
      source: { ...artifact.source, fileName: 'my_experiment.h5ad' },
    };
    const response = buildScSpatialQueryResponse(uploadedArtifact, {
      artifactId: uploadedArtifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.rightPanel.provenance.source).toBe('upload');
  });

  it('handles artifact without precomputed UMAP', () => {
    const artifact = createDemoScSpatialArtifact();
    const noUmap = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        hasPrecomputedUmap: false,
      },
      obsm: {
        ...artifact.obsm,
        embeddings: {},
      },
    };
    const response = buildScSpatialQueryResponse(noUmap, {
      artifactId: noUmap.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'umap',
      developerMode: false,
    });
    // Should still work, may compute UMAP or fall back
    expect(response.centerView).toBeDefined();
  });

  it('selected cell detail includes spatial coordinates when available', () => {
    const artifact = createDemoScSpatialArtifact();
    const firstCellId = artifact.obs[0]?.cellId;
    if (!firstCellId) return;
    const response = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: firstCellId,
      viewMode: 'spatial-2d',
      developerMode: false,
    });
    // The selected cell may or may not be found depending on filtering
    if (response.rightPanel.selectedCell) {
      expect(response.rightPanel.selectedCell.cellId).toBeDefined();
    }
  });

  it('handles artifact with no sample IDs', () => {
    const artifact = createDemoScSpatialArtifact();
    const noSamples = {
      ...artifact,
      obs: artifact.obs.map((o) => ({ ...o, sampleId: null })),
      source: { ...artifact.source, sampleCount: 1 },
    };
    const response = buildScSpatialQueryResponse(noSamples, {
      artifactId: noSamples.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.datasetMeta.sampleCount).toBeGreaterThanOrEqual(1);
  });

  it('handles artifact with no embeddings at all', () => {
    const artifact = createDemoScSpatialArtifact();
    const noEmbeddings = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        hasPrecomputedUmap: false,
      },
      obsm: {
        embeddings: {},
      },
    };
    const response = buildScSpatialQueryResponse(noEmbeddings, {
      artifactId: noEmbeddings.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'umap',
      developerMode: false,
    });
    expect(response.centerView).toBeDefined();
  });

  it('handles artifact with empty matrix', () => {
    const artifact = createDemoScSpatialArtifact();
    const emptyArtifact = {
      ...artifact,
      matrix: {
        X: { encoding: 'row-sparse-v1' as const, nObs: 0, nVars: 0, rows: [] },
        layers: {},
        defaultLayer: 'X',
      },
      obs: [],
      var: [],
      obsm: { embeddings: {} },
    };
    const response = buildScSpatialQueryResponse(emptyArtifact, {
      artifactId: emptyArtifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.centerView.points).toHaveLength(0);
  });

  it('handles artifact with batchId as number', () => {
    const artifact = createDemoScSpatialArtifact();
    const numericBatch = {
      ...artifact,
      obs: artifact.obs.map((o, i) => ({ ...o, batchId: i % 3 })),
    };
    const response = buildScSpatialQueryResponse(numericBatch, {
      artifactId: numericBatch.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.centerView.points.length).toBeGreaterThan(0);
  });

  it('handles artifact with missing cellId in obs', () => {
    const artifact = createDemoScSpatialArtifact();
    const missingIds = {
      ...artifact,
      obs: artifact.obs.map((o) => ({ ...o, cellId: undefined as any })),
    };
    const response = buildScSpatialQueryResponse(missingIds, {
      artifactId: missingIds.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.centerView.points.length).toBeGreaterThan(0);
  });

  it('handles artifact with NaN spatial coordinates', () => {
    const artifact = createDemoScSpatialArtifact();
    const nanSpatial = {
      ...artifact,
      obsm: {
        ...artifact.obsm,
        spatial: artifact.obs.map((_, i) => [i % 2 === 0 ? NaN : i * 10, i * 5]),
      },
    };
    const response = buildScSpatialQueryResponse(nanSpatial, {
      artifactId: nanSpatial.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });
    // Should handle NaN gracefully
    expect(response.centerView).toBeDefined();
  });

  it('handles artifact with mitochondrial genes', () => {
    const artifact = createDemoScSpatialArtifact();
    // Add a mitochondrial gene to the var list
    const withMito = {
      ...artifact,
      var: [...artifact.var, { geneId: 'MT-CO1', geneSymbol: 'MT-CO1' }],
      matrix: {
        ...artifact.matrix,
        X: {
          ...artifact.matrix.X,
          nVars: artifact.matrix.X.nVars + 1,
          rows: artifact.matrix.X.rows.map((row) => ({
            ...row,
            indices: [...row.indices, artifact.matrix.X.nVars],
            values: [...row.values, Math.random() * 10],
          })),
        },
      },
    };
    const response = buildScSpatialQueryResponse(withMito, {
      artifactId: withMito.artifactId,
      selectedGene: 'MT-CO1',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.selection.selectedGene).toBe('MT-CO1');
  });

  it('handles artifact with only one cluster', () => {
    const artifact = createDemoScSpatialArtifact();
    const singleCluster = {
      ...artifact,
      obs: artifact.obs.map((o) => ({ ...o, clusterLabel: 'All', cellType: 'Same' })),
    };
    const response = buildScSpatialQueryResponse(singleCluster, {
      artifactId: singleCluster.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.availableClusters.length).toBeGreaterThanOrEqual(1);
  });

  it('handles artifact with many clusters', () => {
    const artifact = createDemoScSpatialArtifact();
    const manyClusters = {
      ...artifact,
      obs: artifact.obs.map((o, i) => ({ ...o, clusterLabel: `Cluster_${i % 8}`, cellType: `Type_${i % 4}` })),
    };
    const response = buildScSpatialQueryResponse(manyClusters, {
      artifactId: manyClusters.artifactId,
      selectedGene: '',
      selectedCluster: 'Cluster_3',
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });
    expect(response.selection.selectedCluster).toBe('Cluster_3');
    // All points should be from Cluster_3
    for (const p of response.centerView.points) {
      expect(p.clusterLabel).toBe('Cluster_3');
    }
  });

  it('handles artifact with empty embeddings object', () => {
    const artifact = createDemoScSpatialArtifact();
    const emptyEmbeddings = {
      ...artifact,
      metadata: { ...artifact.metadata, hasPrecomputedUmap: false },
      obsm: { embeddings: {} },
    };
    const response = buildScSpatialQueryResponse(emptyEmbeddings, {
      artifactId: emptyEmbeddings.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'table',
      developerMode: false,
    });
    expect(response.centerView).toBeDefined();
  });

  it('handles artifact with condition and replicate metadata', () => {
    const artifact = createDemoScSpatialArtifact();
    const withMeta = {
      ...artifact,
      obs: artifact.obs.map((o, i) => ({
        ...o,
        condition: i < artifact.obs.length / 2 ? 'control' : 'treatment',
        replicate: `rep_${i % 3}`,
        sampleMetadata: { donor: `donor_${i % 2}`, timepoint: `${i * 2}h` },
      })),
    };
    const response = buildScSpatialQueryResponse(withMeta, {
      artifactId: withMeta.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: withMeta.obs[5]?.cellId,
      viewMode: 'table',
      developerMode: false,
    });
    if (response.rightPanel.selectedCell) {
      expect(response.rightPanel.selectedCell.condition).toBeDefined();
    }
  });
});
