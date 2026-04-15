import { randomUUID } from 'node:crypto';
import { GENE_LIST, SC_SPATIAL_DATA } from '../data/mockScSpatial';
import type {
  ScSpatialNormalizedArtifact,
  ScSpatialSparseMatrix,
} from '../types/scspatial';

function buildSparseMatrix(): ScSpatialSparseMatrix {
  return {
    encoding: 'row-sparse-v1',
    nObs: SC_SPATIAL_DATA.length,
    nVars: GENE_LIST.length,
    rows: SC_SPATIAL_DATA.map((cell) => {
      const indices: number[] = [];
      const values: number[] = [];
      GENE_LIST.forEach((gene, index) => {
        const value = cell.geneExpression[gene] ?? 0;
        if (value > 0) {
          indices.push(index);
          values.push(value);
        }
      });
      return { indices, values };
    }),
  };
}

export function createDemoScSpatialArtifact(): ScSpatialNormalizedArtifact {
  const artifactId = `scspatial-demo-${randomUUID()}`;
  const sampleIds = new Set<string>();

  return {
    schemaVersion: 1,
    artifactId,
    source: {
      fileName: 'bundled-demo.h5ad',
      uploadedAt: Date.now(),
      sampleCount: 1,
      parserVersion: 'bundled-demo/1.0.0',
      pythonVersion: null,
    },
    matrix: {
      X: buildSparseMatrix(),
      layers: {},
      defaultLayer: 'X',
    },
    obs: SC_SPATIAL_DATA.map((cell, index) => {
      const sampleId = `demo-sample-${1 + (index % 2)}`;
      sampleIds.add(sampleId);
      return {
        cellId: cell.id,
        clusterLabel: cell.cellType,
        cellType: cell.cellType,
        batchId: cell.batchId,
        sampleId,
        condition: index % 2 === 0 ? 'control' : 'engineered',
        replicate: `R${1 + (index % 3)}`,
        sampleMetadata: {
          donor: `donor-${1 + (index % 4)}`,
          tissue: 'liver',
          region: index % 2 === 0 ? 'core' : 'margin',
        },
      };
    }),
    var: GENE_LIST.map((gene) => ({
      geneId: gene,
      geneSymbol: gene,
    })),
    obsm: {
      spatial: SC_SPATIAL_DATA.map((cell) => [cell.spatialX, cell.spatialY]),
      embeddings: {},
    },
    metadata: {
      warnings: ['Bundled demo dataset loaded by explicit user action.'],
      missingFields: [],
      availableViews: {
        spatial2d: true,
        spatial3d: true,
        umap: false,
        trajectory: true,
        table: true,
      },
      extractedKeys: {
        layers: [],
        embeddings: [],
        clusterLabelKey: 'cellType',
        cellTypeKey: 'cellType',
        batchKey: 'batchId',
        sampleMetadataKeys: ['sampleId', 'condition', 'replicate'],
      },
      hasSpatialCoords: true,
      hasClusterLabels: true,
      hasPrecomputedUmap: false,
    },
  };
}
