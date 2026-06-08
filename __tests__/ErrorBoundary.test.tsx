/**
 * Tests for src/components/shared/ErrorBoundary.tsx
 *
 * Covers:
 *  - Normal rendering (no error)
 *  - Error catching and fallback rendering
 *  - Custom fallback prop
 *  - onError callback
 *  - Reset functionality ("Try again" button)
 *  - Edge cases
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../src/components/shared/ErrorBoundary';

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// ── Helper component that throws ─────────────────────────────────────────────

function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child rendered successfully</div>;
}

function StableComponent() {
  return <div>Stable child</div>;
}

// ── Normal rendering ─────────────────────────────────────────────────────────

describe('ErrorBoundary normal rendering', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <StableComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Stable child')).toBeInTheDocument();
  });

  it('renders multiple children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
  });
});

// ── Error catching ───────────────────────────────────────────────────────────

describe('ErrorBoundary error catching', () => {
  it('catches errors and renders default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders the default fallback with "Try again" button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('renders error description text', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/A component in this view encountered an unexpected error/)).toBeInTheDocument();
  });

  it('does not render children when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Child rendered successfully')).not.toBeInTheDocument();
  });
});

// ── Custom fallback ──────────────────────────────────────────────────────────

describe('ErrorBoundary custom fallback', () => {
  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders custom fallback instead of default alert', () => {
    render(
      <ErrorBoundary fallback={<div role="status">Oops</div>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ── onError callback ─────────────────────────────────────────────────────────

describe('ErrorBoundary onError callback', () => {
  it('calls onError when an error is caught', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('passes the correct error message to onError', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(onError.mock.calls[0][0].message).toBe('Test error');
  });

  it('does not call onError when no error occurs', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <StableComponent />
      </ErrorBoundary>,
    );
    expect(onError).not.toHaveBeenCalled();
  });
});

// ── Reset functionality ──────────────────────────────────────────────────────

describe('ErrorBoundary reset functionality', () => {
  it('resets error state when "Try again" is clicked', () => {
    // We need a component that can toggle between throwing and not throwing
    let shouldThrow = true;
    function ToggleComponent() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>,
    );

    // Error state
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the component
    shouldThrow = false;

    // Click "Try again" to reset the error boundary
    fireEvent.click(screen.getByText('Try again'));

    // After reset, the boundary tries to re-render children
    // The component should now render successfully
    rerender(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('hides the error UI after reset', () => {
    let shouldThrow = true;
    function ToggleComponent() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>OK</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    rerender(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('ErrorBoundary edge cases', () => {
  it('handles null children gracefully', () => {
    render(
      <ErrorBoundary>
        {null}
      </ErrorBoundary>,
    );
    // Should render nothing, no error
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles empty fragment children', () => {
    render(
      <ErrorBoundary>
        <></>
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('catches errors from deeply nested children', () => {
    function DeepChild(): never {
      throw new Error('Deep error');
    }
    function MiddleLayer() {
      return (
        <div>
          <DeepChild />
        </div>
      );
    }

    render(
      <ErrorBoundary>
        <MiddleLayer />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders with default fallback when fallback prop is undefined', () => {
    render(
      <ErrorBoundary fallback={undefined}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
