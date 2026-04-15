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
});
