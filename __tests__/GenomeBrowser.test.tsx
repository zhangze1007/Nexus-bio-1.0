/**
 * Tests for GenomeBrowser component.
 *
 * IGV.js is mocked since it requires real browser DOM APIs (ResizeObserver, etc.)
 * that jsdom does not provide. The tests verify component behavior at the React level.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock IGV.js — the real library needs full browser DOM
const mockOn = jest.fn();
const mockLoadTrack = jest.fn().mockResolvedValue(undefined);
const mockSearch = jest.fn();
const mockRemoveBrowser = jest.fn();
const mockCreateBrowser = jest.fn().mockResolvedValue({
  currentLoci: () => ['chr:100000-200000'],
  loadTrack: mockLoadTrack,
  search: mockSearch,
  on: mockOn,
  off: jest.fn(),
});
const mockSetDefaults = jest.fn();

jest.mock('igv', () => ({
  __esModule: true,
  default: {
    createBrowser: mockCreateBrowser,
    removeBrowser: mockRemoveBrowser,
    setDefaults: mockSetDefaults,
  },
}));

// Import after mock setup
import { GenomeBrowser, type GenomeBrowserTrack } from '../src/components/visualizations/GenomeBrowser';

describe('GenomeBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateBrowser.mockResolvedValue({
      currentLoci: () => ['chr:100000-200000'],
      loadTrack: mockLoadTrack,
      search: mockSearch,
      on: mockOn,
      off: jest.fn(),
    });
  });

  it('renders without crashing', () => {
    render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    // Should show loading text initially
    expect(screen.getByText('Loading genome browser...')).toBeInTheDocument();
  });

  it('initializes IGV.js with correct genome config', async () => {
    render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateBrowser.mock.calls[0];
    expect(callArgs[1].reference).toEqual(
      expect.objectContaining({ id: 'ecoli_K12_MG1655' }),
    );
  });

  it('sets IGV defaults for dark theme', async () => {
    render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    await waitFor(() => {
      expect(mockSetDefaults).toHaveBeenCalledWith(
        expect.objectContaining({
          showCircularView: false,
          showTrackLabels: true,
        }),
      );
    });
  });

  it('passes custom locus to browser config', async () => {
    render(
      <GenomeBrowser
        genome="ecoli_K12_MG1655"
        locus="chr:500000-600000"
      />,
    );

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateBrowser.mock.calls[0];
    expect(callArgs[1].locus).toBe('chr:500000-600000');
  });

  it('passes tracks to browser config', async () => {
    const tracks: GenomeBrowserTrack[] = [
      {
        name: 'Test Track',
        type: 'annotation',
        format: 'bed',
        features: [
          { chr: 'chr', start: 100, end: 200, name: 'gene1' },
        ],
      },
    ];

    render(
      <GenomeBrowser
        genome="ecoli_K12_MG1655"
        tracks={tracks}
      />,
    );

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateBrowser.mock.calls[0];
    expect(callArgs[1].tracks).toHaveLength(1);
    expect(callArgs[1].tracks[0].name).toBe('Test Track');
  });

  it('handles empty tracks array', async () => {
    render(
      <GenomeBrowser
        genome="ecoli_K12_MG1655"
        tracks={[]}
      />,
    );

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateBrowser.mock.calls[0];
    expect(callArgs[1].tracks).toEqual([]);
  });

  it('renders with custom height', () => {
    const { container } = render(
      <GenomeBrowser genome="ecoli_K12_MG1655" height={600} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe('600px');
  });

  it('renders with default height of 400', () => {
    const { container } = render(
      <GenomeBrowser genome="ecoli_K12_MG1655" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe('400px');
  });

  it('displays error when browser creation fails', async () => {
    mockCreateBrowser.mockRejectedValueOnce(new Error('Failed to load genome'));

    render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load genome')).toBeInTheDocument();
    });
  });

  it('cleans up browser on unmount', async () => {
    const { unmount } = render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    unmount();

    // removeBrowser should have been called during cleanup
    expect(mockRemoveBrowser).toHaveBeenCalled();
  });

  it('uses custom genome string for non-predefined genomes', async () => {
    render(<GenomeBrowser genome="hg38" />);

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateBrowser.mock.calls[0];
    expect(callArgs[1].reference).toBe('hg38');
  });

  it('registers locus change handler when onRegionSelect is provided', async () => {
    const onRegionSelect = jest.fn();

    render(
      <GenomeBrowser
        genome="ecoli_K12_MG1655"
        onRegionSelect={onRegionSelect}
      />,
    );

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith('locuschange', expect.any(Function));
    });
  });

  it('does not register locus change handler when onRegionSelect is omitted', async () => {
    render(<GenomeBrowser genome="ecoli_K12_MG1655" />);

    await waitFor(() => {
      expect(mockCreateBrowser).toHaveBeenCalled();
    });

    // on should not have been called with 'locuschange'
    const locusChangeCalls = mockOn.mock.calls.filter(
      (c: unknown[]) => c[0] === 'locuschange',
    );
    expect(locusChangeCalls).toHaveLength(0);
  });
});
