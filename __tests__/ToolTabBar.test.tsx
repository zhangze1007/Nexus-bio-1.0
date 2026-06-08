/**
 * Tests for ToolTabBar component.
 *
 * Covers:
 * - Rendering tabs with labels
 * - Active tab styling (aria-selected)
 * - Click to switch tabs
 * - Keyboard navigation: ArrowRight, ArrowLeft, Home, End
 * - ARIA attributes
 * - Mouse hover/focus events
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ToolTabBar from '../src/components/tools/shared/ToolTabBar';
import type { ToolTab } from '../src/components/tools/shared/ToolTabBar';

// ── Mock framer-motion ──
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      // Filter out framer-motion specific props that cause DOM warnings
      const { layoutId, transition, ...domProps } = props as Record<string, unknown>;
      return <div {...domProps}>{children}</div>;
    },
  },
}));

// ── Mock tokens ──
jest.mock('../src/components/ide/tokens', () => ({
  T: { SANS: 'Inter, sans-serif' },
}));

jest.mock('../src/components/workbench/workbenchTheme', () => ({
  PATHD_THEME: {
    sepiaPanelBorder: 'rgba(200,180,150,0.2)',
    sepiaPanelMuted: 'rgba(20,18,14,0.6)',
    sky: '#7EB8DA',
    label: 'rgba(200,195,185,0.55)',
    value: '#E8DCC8',
  },
}));

// ── Test data ──

const sampleTabs: ToolTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'structure', label: 'Structure', accent: '#C8E0D0' },
  { id: 'analysis', label: 'Analysis' },
];

// ── Tests ──

describe('ToolTabBar', () => {
  it('renders all tab labels', () => {
    render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true', () => {
    render(<ToolTabBar tabs={sampleTabs} activeId="structure" onChange={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('sets tabIndex=0 on active tab and -1 on inactive', () => {
    render(<ToolTabBar tabs={sampleTabs} activeId="analysis" onChange={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '-1');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[2]).toHaveAttribute('tabindex', '0');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = jest.fn();
    render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
    fireEvent.click(screen.getByText('Analysis'));
    expect(onChange).toHaveBeenCalledWith('analysis');
  });

  it('renders with role=tablist', () => {
    render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('sets aria-label on tablist', () => {
    render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Tool sections');
  });

  it('sets ARIA id and controls attributes', () => {
    render(
      <ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} instanceId="test" />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('id', 'test-tab-overview');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'test-panel-overview');
    expect(tabs[1]).toHaveAttribute('id', 'test-tab-structure');
    expect(tabs[1]).toHaveAttribute('aria-controls', 'test-panel-structure');
  });

  // ── Keyboard navigation ──

  describe('keyboard navigation', () => {
    it('moves to next tab on ArrowRight', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('structure');
    });

    it('wraps to first tab on ArrowRight from last tab', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="analysis" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('overview');
    });

    it('moves to previous tab on ArrowLeft', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="structure" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith('overview');
    });

    it('wraps to last tab on ArrowLeft from first tab', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith('analysis');
    });

    it('moves to next tab on ArrowDown', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith('structure');
    });

    it('moves to previous tab on ArrowUp', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="structure" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenCalledWith('overview');
    });

    it('moves to first tab on Home', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="analysis" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'Home' });
      expect(onChange).toHaveBeenCalledWith('overview');
    });

    it('moves to last tab on End', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'End' });
      expect(onChange).toHaveBeenCalledWith('analysis');
    });

    it('does nothing for unrecognized keys', () => {
      const onChange = jest.fn();
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={onChange} />);
      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'Tab' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ── Mouse events ──

  describe('mouse events', () => {
    it('changes background on mouseEnter for inactive tab', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.mouseEnter(tabs[1]);
      // jsdom normalizes rgba to rgb format
      expect(tabs[1].style.background).toContain('255');
    });

    it('does not change background on mouseEnter for active tab', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      const bgBefore = tabs[0].style.background;
      fireEvent.mouseEnter(tabs[0]);
      // Active tab should not have hover background applied
      expect(tabs[0].style.background).toBe(bgBefore);
    });

    it('resets background on mouseLeave for inactive tab', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.mouseEnter(tabs[1]);
      fireEvent.mouseLeave(tabs[1]);
      expect(tabs[1].style.background).toBe('transparent');
    });

    it('adds boxShadow on focus', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.focus(tabs[1]);
      expect(tabs[1].style.boxShadow).toContain('0 0 0 2px');
    });

    it('removes boxShadow on blur', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="overview" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      fireEvent.focus(tabs[1]);
      fireEvent.blur(tabs[1]);
      expect(tabs[1].style.boxShadow).toBe('none');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles single tab', () => {
      const onChange = jest.fn();
      const singleTab = [{ id: 'only', label: 'Only' }];
      render(<ToolTabBar tabs={singleTab} activeId="only" onChange={onChange} />);
      expect(screen.getByText('Only')).toBeInTheDocument();
      const tablist = screen.getByRole('tablist');
      // ArrowRight on single tab should wrap to itself
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('only');
    });

    it('uses custom accent color when provided', () => {
      render(<ToolTabBar tabs={sampleTabs} activeId="structure" onChange={jest.fn()} />);
      const tabs = screen.getAllByRole('tab');
      // Active tab with accent should have that color (jsdom normalizes hex to rgb)
      expect(tabs[1].style.color).toContain('200');
      expect(tabs[1].style.color).toContain('224');
    });
  });
});
