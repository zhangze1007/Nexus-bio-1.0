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
        viewMode="umap"
        onLoadDemo={jest.fn()}
        onPickFile={jest.fn()}
        onSelectCluster={jest.fn()}
        onSelectGene={jest.fn()}
        onSetViewMode={jest.fn()}
        onToggleDeveloperMode={jest.fn()}
      />,
    );

    expect((screen.getByRole('button', { name: '2D Spatial' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '3D Spatial' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'UMAP' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('partial-dataset.h5ad')).toBeTruthy();
  });
});
