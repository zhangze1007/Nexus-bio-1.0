import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThreeScene from '../components/ThreeScene';

// Mock ResizeObserver which is required by @react-three/fiber
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Mock canvas to avoid WebGL context issues in JSDOM
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="mock-canvas">{children}</div>,
  useFrame: () => {},
}));

jest.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="mock-orbit-controls" />,
  Text: ({ children }: any) => <div data-testid="mock-text">{children}</div>,
  Sphere: ({ children }: any) => <div data-testid="mock-sphere">{children}</div>,
  Line: () => <div data-testid="mock-line" />,
}));

const mockNodes = [
  {
    id: 'test-node',
    label: 'Test Node',
    position: [0, 0, 0] as [number, number, number],
    summary: 'Test summary',
    citation: 'Test citation',
    color: '#ffffff'
  }
];

describe('ThreeScene Component', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <ThreeScene nodes={mockNodes} onNodeClick={jest.fn()} />
    );
    expect(getByTestId('mock-canvas')).toBeInTheDocument();
  });
});
