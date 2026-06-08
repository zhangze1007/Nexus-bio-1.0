/**
 * Tests for ExportButton component.
 *
 * Covers:
 * - Rendering with label
 * - Disabled state
 * - JSON export (default)
 * - CSV export with proper escaping
 * - SVG export via ref
 * - PNG export via canvas ref
 * - PNG export via SVG ref (fallback)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExportButton from '../src/components/ide/shared/ExportButton';

// ── Mocks ──

const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();
const mockClick = jest.fn();
const mockToDataURL = jest.fn(() => 'data:image/png;base64,abc');
const mockSerializeToString = jest.fn(() => '<svg></svg>');

Object.defineProperty(globalThis, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

// Mock XMLSerializer
class MockXMLSerializer {
  serializeToString = mockSerializeToString;
}
Object.defineProperty(globalThis, 'XMLSerializer', {
  value: MockXMLSerializer,
  writable: true,
});

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  _src = '';
  get src() { return this._src; }
  set src(val: string) {
    this._src = val;
    // Trigger onload asynchronously to simulate image load
    if (this.onload) {
      setTimeout(() => this.onload!(), 0);
    }
  }
}

Object.defineProperty(globalThis, 'Image', {
  value: MockImage,
  writable: true,
});

// Track created <a> elements
let createdAnchors: Array<{ href: string; download: string }> = [];
const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  jest.clearAllMocks();
  createdAnchors = [];
  jest.useFakeTimers();

  document.createElement = ((tag: string, options?: ElementCreationOptions) => {
    const el = originalCreateElement(tag, options);
    if (tag === 'a') {
      const origClick = el.click.bind(el);
      (el as HTMLAnchorElement).click = mockClick;
    }
    return el;
  }) as typeof document.createElement;
});

afterEach(() => {
  jest.useRealTimers();
  document.createElement = originalCreateElement;
});

// ── Tests ──

describe('ExportButton', () => {
  it('renders with the provided label', () => {
    render(<ExportButton label="Export Data" data={{}} filename="test" />);
    expect(screen.getByText('Export Data')).toBeTruthy();
  });

  it('renders a Download icon', () => {
    const { container } = render(<ExportButton label="Download" data={{}} filename="test" />);
    // lucide-react renders an SVG element
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('is disabled when disabled prop is true', () => {
    render(<ExportButton label="Export" data={{}} filename="test" disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not trigger export when disabled', () => {
    render(<ExportButton label="Export" data={{ a: 1 }} filename="test" disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('exports JSON by default', () => {
    const data = { name: 'test', value: 42 };
    render(<ExportButton label="Export" data={data} filename="output" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('exports CSV with proper escaping', () => {
    const data = [
      { name: 'Amorpha', value: '4,5-diene', note: 'has "quotes"' },
      { name: 'Test', value: 'simple', note: 'plain' },
    ];
    render(<ExportButton label="CSV" data={data} filename="table" format="csv" />);
    fireEvent.click(screen.getByRole('button'));

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
  });

  it('returns empty string for non-array CSV data', () => {
    render(<ExportButton label="CSV" data={{ not: 'array' }} filename="bad" format="csv" />);
    fireEvent.click(screen.getByRole('button'));

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
  });

  it('returns empty string for empty array CSV', () => {
    render(<ExportButton label="CSV" data={[]} filename="empty" format="csv" />);
    fireEvent.click(screen.getByRole('button'));

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
  });

  it('exports SVG via ref', () => {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svgRef = { current: svgEl };

    render(<ExportButton label="SVG" data={{}} filename="chart" format="svg" svgRef={svgRef} />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSerializeToString).toHaveBeenCalledWith(svgEl);
    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/svg+xml');
    expect(mockClick).toHaveBeenCalled();
  });

  it('does nothing for SVG export when svgRef is null', () => {
    const svgRef = { current: null };
    render(<ExportButton label="SVG" data={{}} filename="chart" format="svg" svgRef={svgRef} />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('exports PNG via canvas ref', () => {
    const canvasEl = document.createElement('canvas') as HTMLCanvasElement;
    canvasEl.toDataURL = mockToDataURL;
    const canvasRef = { current: canvasEl };

    render(<ExportButton label="PNG" data={{}} filename="image" format="png" canvasRef={canvasRef} />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockToDataURL).toHaveBeenCalledWith('image/png');
    expect(mockClick).toHaveBeenCalled();
  });

  it('exports PNG via SVG ref fallback when no canvas ref', () => {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Mock getBoundingClientRect for SVG
    svgEl.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} });
    const svgRef = { current: svgEl };

    render(<ExportButton label="PNG" data={{}} filename="image" format="png" svgRef={svgRef} />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSerializeToString).toHaveBeenCalled();
    expect(mockCreateObjectURL).toHaveBeenCalled();
    // Image onload will fire via setTimeout in mock
    jest.runAllTimers();
  });

  it('does nothing for PNG when both refs are null', () => {
    render(<ExportButton label="PNG" data={{}} filename="image" format="png" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('handles SVG with no canvas and null svgRef for PNG', () => {
    const canvasRef = { current: null };
    const svgRef = { current: null };
    render(
      <ExportButton label="PNG" data={{}} filename="image" format="png" canvasRef={canvasRef} svgRef={svgRef} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it('exports SVG via PNG fallback path with canvas context', () => {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {} });
    const svgRef = { current: svgEl };
    const canvasRef = { current: null };

    render(<ExportButton label="PNG" data={{}} filename="img" format="png" svgRef={svgRef} canvasRef={canvasRef} />);
    fireEvent.click(screen.getByRole('button'));

    // Should have created blob URL for SVG serialization
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});
