import React from 'react';
import { render, screen } from '@testing-library/react';
import AutomationDrawer from '../src/components/tools/nexai/AutomationDrawer';
import type { AxonTask } from '../src/services/AxonOrchestrator';

function task(partial: Partial<AxonTask>): AxonTask {
  return {
    id: 't1',
    tool: 'pathd',
    label: 'Design pathway for artemisinin',
    input: { targetProduct: 'artemisinin' },
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
    createdAt: 1_700_000_000_000,
    ...partial,
  };
}

describe('AutomationDrawer', () => {
  it('does not render when the feature flag is off', () => {
    const { container } = render(<AutomationDrawer enabled={false} tasks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an empty-state when enabled with no tasks', () => {
    render(<AutomationDrawer enabled={true} tasks={[]} />);
    expect(screen.getByTestId('nexai-automation-empty')).toBeTruthy();
  });

  it('renders a pending task row', () => {
    render(<AutomationDrawer enabled={true} tasks={[task({})]} />);
    const row = screen.getByTestId('nexai-automation-task-t1');
    expect(row.dataset.status).toBe('pending');
    expect(row.dataset.tool).toBe('pathd');
    expect(row.textContent).toMatch(/Pending/i);
  });

  it('renders a running task row', () => {
    render(<AutomationDrawer enabled={true} tasks={[task({ status: 'running', startedAt: 1_700_000_001_000 })]} />);
    const row = screen.getByTestId('nexai-automation-task-t1');
    expect(row.dataset.status).toBe('running');
    expect(row.textContent).toMatch(/Running/i);
  });

  it('renders a done task row with adapter summary', () => {
    render(
      <AutomationDrawer
        enabled={true}
        tasks={[task({
          status: 'done',
          finishedAt: 1_700_000_002_000,
          result: { provider: 'groq', nodeCount: 7, bottleneckCount: 2 },
        })]}
      />,
    );
    const row = screen.getByTestId('nexai-automation-task-t1');
    expect(row.dataset.status).toBe('done');
    expect(screen.getByTestId('nexai-automation-task-summary-t1').textContent).toMatch(/7 node/i);
    expect(screen.getByTestId('nexai-automation-task-summary-t1').textContent).toMatch(/2 bottleneck/i);
    expect(screen.getByTestId('nexai-automation-task-summary-t1').textContent).toMatch(/groq/i);
  });

  it('renders an error task with the error message', () => {
    render(
      <AutomationDrawer
        enabled={true}
        tasks={[task({ status: 'error', error: 'backend unreachable', finishedAt: 1_700_000_002_000 })]}
      />,
    );
    const row = screen.getByTestId('nexai-automation-task-t1');
    expect(row.dataset.status).toBe('error');
    expect(screen.getByTestId('nexai-automation-task-summary-t1').textContent).toMatch(/backend unreachable/i);
  });

  it('shows the clear button only when there are terminal tasks', () => {
    const { rerender } = render(
      <AutomationDrawer enabled={true} tasks={[task({})]} onClear={() => {}} />,
    );
    expect(screen.queryByTestId('nexai-automation-clear')).toBeNull();

    rerender(
      <AutomationDrawer
        enabled={true}
        tasks={[task({ status: 'done', finishedAt: 2 })]}
        onClear={() => {}}
      />,
    );
    expect(screen.getByTestId('nexai-automation-clear')).toBeTruthy();
  });
});
