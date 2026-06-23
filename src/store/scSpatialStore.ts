import { create } from 'zustand';
import type {
  ScSpatialDatasetMeta,
  ScSpatialQueryResponse,
  ScSpatialValidity,
  ScSpatialViewMode,
} from '../types/scspatial';

type ScSpatialLoadState = 'idle' | 'uploading' | 'querying' | 'ready' | 'error';

interface ScSpatialState {
  artifactId: string | null;
  validity: ScSpatialValidity | null;
  datasetMeta: ScSpatialDatasetMeta | null;
  availableGenes: string[];
  availableClusters: string[];
  selectedGene: string;
  compareGene: string;
  selectedCluster: string | null;
  selectedCellId: string | null;
  viewMode: ScSpatialViewMode;
  developerMode: boolean;
  helpOpen: boolean;
  showKde: boolean;
  showNeighbors: boolean;
  neighborK: number;
  loadState: ScSpatialLoadState;
  error: string | null;
  query: ScSpatialQueryResponse | null;
  beginUpload: () => void;
  beginQuery: () => void;
  fail: (message: string) => void;
  hydrateFromQuery: (query: ScSpatialQueryResponse) => void;
  setSelectedGene: (gene: string) => void;
  setCompareGene: (gene: string) => void;
  setSelectedCluster: (cluster: string | null) => void;
  setSelectedCellId: (cellId: string | null) => void;
  setViewMode: (viewMode: ScSpatialViewMode) => void;
  toggleDeveloperMode: () => void;
  toggleHelp: () => void;
  toggleKde: () => void;
  toggleNeighbors: () => void;
  setNeighborK: (k: number) => void;
  reset: () => void;
}

const EMPTY_STATE = {
  artifactId: null,
  validity: null,
  datasetMeta: null,
  availableGenes: [],
  availableClusters: [],
  selectedGene: '',
  compareGene: '',
  selectedCluster: null,
  selectedCellId: null,
  viewMode: 'spatial-2d' as const,
  developerMode: false,
  helpOpen: false,
  showKde: false,
  showNeighbors: false,
  neighborK: 6,
  loadState: 'idle' as const,
  error: null,
  query: null,
};

export const useScSpatialStore = create<ScSpatialState>((set) => ({
  ...EMPTY_STATE,

  beginUpload: () => set((state) => ({
    ...state,
    loadState: 'uploading',
    error: null,
  })),

  beginQuery: () => set((state) => ({
    ...state,
    loadState: state.artifactId ? 'querying' : state.loadState,
    error: null,
  })),

  fail: (message) => set((state) => ({
    ...state,
    loadState: 'error',
    error: message,
  })),

  hydrateFromQuery: (query) => set((state) => ({
    ...state,
    artifactId: query.artifactId,
    validity: query.validity,
    datasetMeta: query.datasetMeta,
    availableGenes: query.availableGenes,
    availableClusters: query.availableClusters,
    selectedGene: query.selection.selectedGene,
    selectedCluster: query.selection.selectedCluster,
    selectedCellId: query.selection.selectedCellId,
    viewMode: query.selection.viewMode,
    developerMode: query.selection.developerMode,
    loadState: 'ready',
    error: null,
    query,
  })),

  setSelectedGene: (selectedGene) => set((state) => ({
    ...state,
    selectedGene,
    selectedCellId: null,
  })),

  setCompareGene: (compareGene) => set((state) => ({
    ...state,
    compareGene,
  })),

  setSelectedCluster: (selectedCluster) => set((state) => ({
    ...state,
    selectedCluster,
    selectedCellId: null,
  })),

  setSelectedCellId: (selectedCellId) => set((state) => ({
    ...state,
    selectedCellId,
  })),

  setViewMode: (viewMode) => set((state) => ({
    ...state,
    viewMode,
  })),

  toggleDeveloperMode: () => set((state) => ({
    ...state,
    developerMode: !state.developerMode,
  })),

  toggleHelp: () => set((state) => ({
    ...state,
    helpOpen: !state.helpOpen,
  })),

  toggleKde: () => set((state) => ({
    ...state,
    showKde: !state.showKde,
  })),

  toggleNeighbors: () => set((state) => ({
    ...state,
    showNeighbors: !state.showNeighbors,
  })),

  setNeighborK: (neighborK) => set((state) => ({
    ...state,
    neighborK,
  })),

  reset: () => set(() => ({
    ...EMPTY_STATE,
  })),
}));
