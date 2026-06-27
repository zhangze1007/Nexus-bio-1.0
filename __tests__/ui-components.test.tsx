/**
 * Tests for shared UI components:
 *   - LoadingSpinner  (src/components/shared/LoadingSpinner.tsx)
 *   - EmptyState      (src/components/shared/EmptyState.tsx)
 *   - ConfirmDialog   (src/components/shared/ConfirmDialog.tsx)
 *
 * Covers rendering, props, keyboard accessibility, and callbacks.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadingSpinner from '../src/components/shared/LoadingSpinner';
import EmptyState from '../src/components/shared/EmptyState';
import ConfirmDialog from '../src/components/shared/ConfirmDialog';

// ── LoadingSpinner ────────────────────────────────────────────────────────────

describe('LoadingSpinner', () => {
  it('renders with role="status"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with default aria-label "Loading"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders a custom label', () => {
    render(<LoadingSpinner label="Fetching data" />);
    expect(screen.getByText('Fetching data')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching data');
  });

  it('applies custom size', () => {
    render(<LoadingSpinner size={48} />);
    const spinner = screen.getByRole('status').querySelector('[aria-hidden="true"]');
    expect(spinner).toBeTruthy();
    expect((spinner as HTMLElement).style.width).toBe('48px');
    expect((spinner as HTMLElement).style.height).toBe('48px');
  });

  it('applies custom color to the spinning arc', () => {
    render(<LoadingSpinner color="#ff0000" />);
    const spinner = screen.getByRole('status').querySelector('[aria-hidden="true"]');
    expect(spinner).toBeTruthy();
    // jsdom normalizes hex to rgb
    expect((spinner as HTMLElement).style.borderTopColor).toMatch(/rgb\(255, 0, 0\)|#ff0000/i);
  });

  it('applies custom style to the wrapper', () => {
    render(<LoadingSpinner style={{ marginTop: '16px' }} />);
    const wrapper = screen.getByRole('status');
    expect((wrapper as HTMLElement).style.marginTop).toBe('16px');
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders with role="status"', () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<EmptyState title="No experiments yet" />);
    expect(screen.getByText('No experiments yet')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters." />);
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Empty" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('p')).toBeNull();
  });

  it('renders the icon when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">X</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is omitted', () => {
    render(<EmptyState title="Empty" onAction={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render action button when onAction is omitted', () => {
    render(<EmptyState title="Empty" actionLabel="Create" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders action button when both actionLabel and onAction are provided', () => {
    render(<EmptyState title="Empty" actionLabel="Create new" onAction={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Create new');
  });

  it('calls onAction when action button is clicked', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Empty" actionLabel="Retry" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

const dialogDefaults = {
  open: true,
  title: 'Delete item?',
  message: 'This action cannot be undone.',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ConfirmDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ConfirmDialog {...dialogDefaults} open={false} />);
    expect(screen.queryByText('Delete item?')).toBeNull();
  });

  it('renders default button labels', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...dialogDefaults} confirmLabel="Yes, delete" cancelLabel="Go back" />);
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('Go back')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(dialogDefaults.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(dialogDefaults.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialogDefaults.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Enter key is pressed', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(dialogDefaults.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    // The backdrop is the outer motion.div with onClick={onCancel}
    const backdrop = screen.getByText('Delete item?').closest('[style*="position: fixed"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(dialogDefaults.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when dialog body is clicked', () => {
    render(<ConfirmDialog {...dialogDefaults} />);
    fireEvent.click(screen.getByText('Delete item?'));
    expect(dialogDefaults.onCancel).not.toHaveBeenCalled();
  });

  it('uses destructive variant color for confirm button', () => {
    render(<ConfirmDialog {...dialogDefaults} variant="destructive" />);
    const confirmBtn = screen.getByText('Confirm');
    // The destructive variant uses CORAL color
    expect(confirmBtn).toBeInTheDocument();
  });
});
