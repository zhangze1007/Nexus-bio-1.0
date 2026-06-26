/**
 * Tests for useAnalytics hook.
 *
 * posthog-js is mocked so no real analytics calls are made.
 */

import { renderHook, act } from '@testing-library/react';

// Mock posthog-js before importing the hook
const mockCapture = jest.fn();
const mockIdentify = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    __loaded: true,
    capture: mockCapture,
    identify: mockIdentify,
  },
}));

// Must import after mock is set up
import { useAnalytics, EVENTS } from '../../src/hooks/useAnalytics';

describe('useAnalytics', () => {
  beforeEach(() => {
    mockCapture.mockClear();
    mockIdentify.mockClear();
    // Ensure window is defined (jsdom provides this)
  });

  describe('track', () => {
    it('calls posthog.capture with event and properties', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.track(EVENTS.FBA_RUN, { model: 'iJO1366', reactions: 83 });
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(EVENTS.FBA_RUN, {
        model: 'iJO1366',
        reactions: 83,
      });
    });

    it('calls posthog.capture with event only when no properties', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.track(EVENTS.SIGN_UP);
      });

      expect(mockCapture).toHaveBeenCalledWith(EVENTS.SIGN_UP, undefined);
    });
  });

  describe('identify', () => {
    it('calls posthog.identify with userId and properties', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.identify('user-123', { name: 'Test User' });
      });

      expect(mockIdentify).toHaveBeenCalledTimes(1);
      expect(mockIdentify).toHaveBeenCalledWith('user-123', { name: 'Test User' });
    });
  });

  describe('page', () => {
    it('calls posthog.capture with $pageview event', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.page('/tools/fbasim', { referrer: 'home' });
      });

      expect(mockCapture).toHaveBeenCalledWith('$pageview', {
        $current_url: '/tools/fbasim',
        referrer: 'home',
      });
    });
  });

  describe('EVENTS constant', () => {
    it('defines all expected event names', () => {
      expect(EVENTS.TOOL_OPENED).toBe('tool_opened');
      expect(EVENTS.EXPERIMENT_CREATED).toBe('experiment_created');
      expect(EVENTS.FBA_RUN).toBe('fba_run');
      expect(EVENTS.AI_QUERY).toBe('ai_query');
      expect(EVENTS.TASK_CREATED).toBe('task_created');
      expect(EVENTS.INVENTORY_ITEM_CREATED).toBe('inventory_item_created');
      expect(EVENTS.SHARE_LINK_CREATED).toBe('share_link_created');
      expect(EVENTS.SIGN_UP).toBe('sign_up');
      expect(EVENTS.LOGIN).toBe('login');
    });
  });
});
