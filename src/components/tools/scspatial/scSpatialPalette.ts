export const CLUSTER_COLORS = [
  '#BFDCCD',
  '#AFC3D6',
  '#E8A3A1',
  '#E7C7A9',
  '#CFC4E3',
  '#D9BC5D',
  '#E58F46',
  '#D96562',
];

export const SCSPATIAL_VIEW_LABELS = {
  'spatial-2d': '2D Spatial',
  'spatial-3d': '3D Spatial',
  umap: 'UMAP',
  trajectory: 'PAGA Trajectory',
  table: 'Cell Table',
} as const;

export function colorForCluster(clusterId: number) {
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
}

export function validityClassName(validity: 'real' | 'partial' | 'demo' | null) {
  if (validity === 'real') return 'real';
  if (validity === 'partial') return 'partial';
  if (validity === 'demo') return 'demo';
  return 'partial';
}
