import React from 'react';
import { render, screen } from '@testing-library/react';
import ScSpatialControlRail from '../src/components/tools/scspatial/ScSpatialControlRail';

describe('ScSpatialControlRail', () => {
  it('disables unavailable view modes from the normalized artifact contract', () => {
    render(
      <ScSpatialControlRail
        availableClusters={['Cluster A']}
        availableGenes={['GAPDH']}
        datasetMeta={{
          availableViews: {
            spatial2d: false,
            spatial3d: false,
            umap: true,
            trajectory: true,
            table: true,
          },
          cellCount: 12,
          geneCount: 24,
          sampleCount: 2,
          fileName: 'partial-dataset.h5ad',
          missingFields: ['obsm.spatial'],
          parserVersion: 'test/1.0.0',
          sampleMetadataKeys: ['sample_id', 'condition'],
          warnings: ['No spatial coordinates found.'],
        }}
        developerMode={false}
        loadState="ready"
        selectedCluster={null}
        selectedGene="GAPDH"
        compareGene=""
        showKde={false}
        showNeighbors={false}
        neighborK={6}
        analysisParams={{
          leidenResolution: 1.0,
          nNeighbors: 15,
          nPcs: 30,
          nTopGenes: 2000,
          moranPerms: 1000,
          coordType: 'auto',
        }}
        onLoadDemo={jest.fn()}
        onPickFile={jest.fn()}
        onSelectCluster={jest.fn()}
        onSelectGene={jest.fn()}
        onSetCompareGene={jest.fn()}
        onToggleDeveloperMode={jest.fn()}
        onToggleKde={jest.fn()}
        onToggleNeighbors={jest.fn()}
        onSetNeighborK={jest.fn()}
        onAnalysisParamChange={jest.fn()}
      />,
    );

    expect(screen.getByText('test/1.0.0')).toBeTruthy();
  });
});
