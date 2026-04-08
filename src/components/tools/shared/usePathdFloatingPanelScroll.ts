import { useCallback, useRef } from 'react';

type TouchState = {
  active: boolean;
  identifier: number | null;
  lastY: number;
};

const INTERACTIVE_SELECTOR = [
  'input',
  'button',
  'a',
  'textarea',
  'select',
  '[role="button"]',
  '[data-touch-scroll-ignore="true"]',
].join(', ');

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function usePathdFloatingPanelScroll() {
  const touchState = useRef<TouchState>({
    active: false,
    identifier: null,
    lastY: 0,
  });

  const resetTouchState = useCallback(() => {
    touchState.current.active = false;
    touchState.current.identifier = null;
    touchState.current.lastY = 0;
  }, []);

  const containPanelInteraction = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const handlePanelWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const panel = event.currentTarget;
    if (panel.scrollHeight > panel.clientHeight) {
      panel.scrollTop += event.deltaY;
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const panel = event.currentTarget;
    if (panel.scrollHeight <= panel.clientHeight || isInteractiveTarget(event.target)) {
      resetTouchState();
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      resetTouchState();
      return;
    }

    touchState.current.active = true;
    touchState.current.identifier = touch.identifier;
    touchState.current.lastY = touch.clientY;
  }, [resetTouchState]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const state = touchState.current;
    if (!state.active) return;

    const panel = event.currentTarget;
    if (panel.scrollHeight <= panel.clientHeight) {
      resetTouchState();
      return;
    }

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === state.identifier)
      ?? Array.from(event.touches).find((item) => item.identifier === state.identifier);

    if (!touch) return;

    const deltaY = touch.clientY - state.lastY;
    if (deltaY === 0) return;

    panel.scrollTop -= deltaY;
    state.lastY = touch.clientY;
    event.preventDefault();
  }, [resetTouchState]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const state = touchState.current;
    const ended = Array.from(event.changedTouches).some((touch) => touch.identifier === state.identifier);
    if (ended) resetTouchState();
  }, [resetTouchState]);

  return {
    containPanelInteraction,
    handlePanelWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetTouchState,
  };
}
