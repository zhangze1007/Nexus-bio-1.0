import { render, screen, fireEvent, act } from "@testing-library/react";
import ToastContainer, {
  ToastNotification,
} from "../src/components/shared/Toast";
import type { ToastItem } from "../src/components/shared/Toast";
import { useToast } from "../src/hooks/useToast";
import React, { type MutableRefObject } from "react";

// ── ToastNotification component tests ──────────────────────────────────

describe("ToastNotification", () => {
  const baseToast: ToastItem = {
    id: "t1",
    message: "Operation completed",
    type: "success",
    duration: 0, // no auto-dismiss for unit tests
  };

  it("renders the message text", () => {
    render(<ToastNotification toast={baseToast} onRemove={jest.fn()} />);
    expect(screen.getByText("Operation completed")).toBeTruthy();
  });

  it("renders the correct icon for success type", () => {
    render(<ToastNotification toast={baseToast} onRemove={jest.fn()} />);
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("renders the correct icon for error type", () => {
    const errorToast = { ...baseToast, type: "error" as const };
    render(<ToastNotification toast={errorToast} onRemove={jest.fn()} />);
    expect(screen.getByText("✗")).toBeTruthy();
  });

  it("renders the correct icon for warning type", () => {
    const warningToast = { ...baseToast, type: "warning" as const };
    render(<ToastNotification toast={warningToast} onRemove={jest.fn()} />);
    expect(screen.getByText("⚠")).toBeTruthy();
  });

  it("renders the correct icon for info type", () => {
    const infoToast = { ...baseToast, type: "info" as const };
    render(<ToastNotification toast={infoToast} onRemove={jest.fn()} />);
    expect(screen.getByText("ℹ")).toBeTruthy();
  });

  it("calls onRemove when dismiss button is clicked", () => {
    const onRemove = jest.fn();
    render(<ToastNotification toast={baseToast} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(onRemove).toHaveBeenCalledWith("t1");
  });

  it("auto-dismisses after duration", () => {
    jest.useFakeTimers();
    const onRemove = jest.fn();
    const timedToast = { ...baseToast, duration: 2000 };
    render(<ToastNotification toast={timedToast} onRemove={onRemove} />);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onRemove).toHaveBeenCalledWith("t1");
    jest.useRealTimers();
  });

  it("does not auto-dismiss when duration is 0", () => {
    jest.useFakeTimers();
    const onRemove = jest.fn();
    const noDismissToast = { ...baseToast, duration: 0 };
    render(<ToastNotification toast={noDismissToast} onRemove={onRemove} />);
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(onRemove).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("has role=alert for accessibility", () => {
    render(<ToastNotification toast={baseToast} onRemove={jest.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

// ── ToastContainer tests ───────────────────────────────────────────────

describe("ToastContainer", () => {
  it("renders multiple toasts", () => {
    const toasts: ToastItem[] = [
      { id: "a", message: "First", type: "info", duration: 0 },
      { id: "b", message: "Second", type: "success", duration: 0 },
    ];
    render(<ToastContainer toasts={toasts} onRemove={jest.fn()} />);
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("renders nothing when toast list is empty", () => {
    const { container } = render(
      <ToastContainer toasts={[]} onRemove={jest.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("has an accessible label", () => {
    render(<ToastContainer toasts={[]} onRemove={jest.fn()} />);
    expect(screen.getByLabelText("Notifications")).toBeTruthy();
  });
});

// ── useToast hook tests ────────────────────────────────────────────────

/**
 * Test harness that exposes the hook API via a mutable ref,
 * so tests always read the latest toasts/state after act() calls.
 */
function HookHarness({ apiRef }: { apiRef: React.MutableRefObject<ReturnType<typeof useToast> | null> }) {
  const api = useToast(5000);
  // Keep the ref updated every render
  apiRef.current = api;
  return (
    <div>
      <span data-testid="count">{api.toasts.length}</span>
      {api.toasts.map((t) => (
        <span key={t.id} data-testid={`toast-${t.id}`}>
          {t.message}
        </span>
      ))}
    </div>
  );
}

describe("useToast hook", () => {
  it("starts with an empty toast list", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    expect(ref.current!.toasts).toEqual([]);
  });

  it("adds a toast with default type info", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    const { getByTestId } = render(<HookHarness apiRef={ref} />);
    act(() => {
      ref.current!.toast("Hello world");
    });
    expect(ref.current!.toasts).toHaveLength(1);
    expect(ref.current!.toasts[0].message).toBe("Hello world");
    expect(ref.current!.toasts[0].type).toBe("info");
    expect(getByTestId("count").textContent).toBe("1");
  });

  it("adds a toast with a specific type", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    act(() => {
      ref.current!.toast("Error occurred", "error");
    });
    expect(ref.current!.toasts[0].type).toBe("error");
  });

  it("dismisses a toast by id", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    let id: string;
    act(() => {
      id = ref.current!.toast("Temporary");
    });
    expect(ref.current!.toasts).toHaveLength(1);
    act(() => {
      ref.current!.dismiss(id!);
    });
    expect(ref.current!.toasts).toHaveLength(0);
  });

  it("returns a unique id for each toast", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    let id1 = "";
    let id2 = "";
    act(() => {
      id1 = ref.current!.toast("First");
      id2 = ref.current!.toast("Second");
    });
    expect(id1).not.toBe(id2);
  });

  it("supports custom duration", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    act(() => {
      ref.current!.toast("Custom", "warning", 10000);
    });
    expect(ref.current!.toasts[0].duration).toBe(10000);
  });

  it("dismiss is a no-op for unknown id", () => {
    const ref: React.MutableRefObject<ReturnType<typeof useToast> | null> = { current: null };
    render(<HookHarness apiRef={ref} />);
    act(() => {
      ref.current!.toast("Keep me");
    });
    expect(ref.current!.toasts).toHaveLength(1);
    act(() => {
      ref.current!.dismiss("nonexistent-id");
    });
    expect(ref.current!.toasts).toHaveLength(1);
  });
});
