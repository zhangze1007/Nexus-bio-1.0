import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import ScSpatialPage from '../src/components/tools/ScSpatialPage';
import { buildScSpatialQueryResponse } from '../src/server/scspatialAnalysis';
import { createDemoScSpatialArtifact } from '../src/server/scspatialDemo';
import { useScSpatialStore } from '../src/store/scSpatialStore';
import { useWorkbenchStore } from '../src/store/workbenchStore';

jest.mock('../src/services/ScSpatialAuthorityClient', () => ({
  ingestScSpatialDemo: jest.fn(),
  ingestScSpatialFile: jest.fn(),
  queryScSpatial: jest.fn(),
}));

jest.mock('../src/components/tools/scspatial/ScSpatialControlRail', () => (
  function MockScSpatialControlRail(props: {
    datasetMeta: { fileName: string } | null;
    loadState: string;
  }) {
    return (
      <div data-testid="scspatial-control-rail">
        {props.datasetMeta?.fileName ?? 'no-dataset'}::{props.loadState}
      </div>
    );
  }
));

jest.mock('../src/components/tools/scspatial/ScSpatialViewport', () => (
  function MockScSpatialViewport(props: {
    query: { centerView: { mode: string } } | null;
  }) {
    return (
      <div data-testid="scspatial-viewport">
        {props.query?.centerView.mode ?? 'empty'}
      </div>
    );
  }
));

jest.mock('../src/components/tools/scspatial/ScSpatialInsightRail', () => (
  function MockScSpatialInsightRail(props: {
    query: { rightPanel: { provenance: { validity: string } } } | null;
  }) {
    return (
      <div data-testid="scspatial-insight-rail">
        {props.query?.rightPanel.provenance.validity ?? 'idle'}
      </div>
    );
  }
));

jest.mock('../src/components/tools/scspatial/ScSpatialHelpDialog', () => (
  function MockScSpatialHelpDialog(props: { open: boolean }) {
    return props.open ? <div>Help dialog</div> : null;
  }
));

const authorityClient = jest.requireMock('../src/services/ScSpatialAuthorityClient') as {
  queryScSpatial: jest.Mock;
};

describe('ScSpatialPage', () => {
  beforeEach(() => {
    useScSpatialStore.getState().reset();
    useWorkbenchStore.getState().resetWorkbench();
    authorityClient.queryScSpatial.mockReset();
    window.localStorage.clear();
  });

  it('renders the upload-first empty state before an artifact is loaded', () => {
    render(<ScSpatialPage />);

    expect(screen.getByText('No normalized artifact is loaded.')).toBeTruthy();
    expect(screen.getByTestId('scspatial-control-rail').textContent).toContain('no-dataset::idle');
    expect(screen.getByTestId('scspatial-viewport').textContent).toContain('empty');
  });

  it('renders hydrated workbench data and refreshes from the query endpoint', async () => {
    const artifact = createDemoScSpatialArtifact();
    const query = buildScSpatialQueryResponse(artifact, {
      artifactId: artifact.artifactId,
      selectedGene: '',
      selectedCluster: null,
      selectedCellId: null,
      viewMode: 'spatial-2d',
      developerMode: false,
    });

    authorityClient.queryScSpatial.mockResolvedValue(query);

    act(() => {
      useScSpatialStore.getState().hydrateFromQuery(query);
    });

    render(<ScSpatialPage />);

    await waitFor(() => {
      expect(authorityClient.queryScSpatial).toHaveBeenCalled();
    });
    expect(screen.getByTestId('scspatial-control-rail').textContent).toMatch(/bundled-demo\.h5ad::(ready|querying)/);
    expect(screen.getByTestId('scspatial-viewport').textContent).toContain('spatial-2d');
    expect(screen.getByTestId('scspatial-insight-rail').textContent).toContain('demo');
  });
});
