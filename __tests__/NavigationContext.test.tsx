/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationProvider, useNavigation } from '../src/contexts/NavigationContext';

// Mock next/navigation
const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

// Test component that uses the navigation context
function TestConsumer() {
  const { handleBack, backHref } = useNavigation();
  return (
    <div>
      <span data-testid="backHref">{backHref}</span>
      <button data-testid="backBtn" onClick={handleBack}>
        Go Back
      </button>
    </div>
  );
}

describe('NavigationProvider', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders children', () => {
    render(
      <NavigationProvider>
        <div data-testid="child">Child content</div>
      </NavigationProvider>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('provides default context value when used outside provider', () => {
    // The context has a default value
    function NakedConsumer() {
      const ctx = useNavigation();
      return <span data-testid="default">{ctx.backHref}</span>;
    }
    render(<NakedConsumer />);
    expect(screen.getByTestId('default').textContent).toBe('/');
  });
});

describe('resolveBackHref — path resolution', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('resolves /tools/cethx to /tools', () => {
    mockPathname = '/tools/cethx';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/tools');
  });

  it('resolves /tools/metabolic-eng to /tools', () => {
    mockPathname = '/tools/metabolic-eng';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/tools');
  });

  it('resolves /tools to /', () => {
    mockPathname = '/tools';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves /analyze to /', () => {
    mockPathname = '/analyze';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves / to /', () => {
    mockPathname = '/';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves /contact to /', () => {
    mockPathname = '/contact';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves /research to /', () => {
    mockPathname = '/research';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves empty pathname to /', () => {
    mockPathname = '';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves /tools/fbasim to /tools', () => {
    mockPathname = '/tools/fbasim';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/tools');
  });

  it('resolves /tools/nexai to /tools', () => {
    mockPathname = '/tools/nexai';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/tools');
  });

  it('resolves /terms to /', () => {
    mockPathname = '/terms';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });

  it('resolves /privacy to /', () => {
    mockPathname = '/privacy';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('backHref').textContent).toBe('/');
  });
});

describe('handleBack — navigation behavior', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('calls router.push with /tools when on a tool page', () => {
    mockPathname = '/tools/cethx';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    fireEvent.click(screen.getByTestId('backBtn'));
    expect(mockPush).toHaveBeenCalledWith('/tools');
  });

  it('calls router.push with / when on /tools', () => {
    mockPathname = '/tools';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    fireEvent.click(screen.getByTestId('backBtn'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('calls router.push with / when on /analyze', () => {
    mockPathname = '/analyze';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    fireEvent.click(screen.getByTestId('backBtn'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('calls router.push with / when on /', () => {
    mockPathname = '/';
    render(
      <NavigationProvider>
        <TestConsumer />
      </NavigationProvider>,
    );
    fireEvent.click(screen.getByTestId('backBtn'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});

describe('useNavigation hook', () => {
  it('returns handleBack and backHref', () => {
    let result: ReturnType<typeof useNavigation> | null = null;
    function HookConsumer() {
      result = useNavigation();
      return null;
    }
    render(
      <NavigationProvider>
        <HookConsumer />
      </NavigationProvider>,
    );
    expect(result).not.toBeNull();
    expect(typeof result!.handleBack).toBe('function');
    expect(typeof result!.backHref).toBe('string');
  });
});
