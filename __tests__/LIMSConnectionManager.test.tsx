import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LIMSConnectionManager from '../src/components/lims/LIMSConnectionManager';
import type { LIMSConfig, LIMSConnectionStatus } from '../src/services/lims/types';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function connection(overrides: Partial<LIMSConfig> = {}): LIMSConfig {
  return {
    id: 'conn-1',
    name: 'Test Benchling',
    type: 'benchling',
    baseUrl: 'https://test.benchling.com',
    authType: 'api_key',
    credentials: {},
    syncDirection: 'bidirectional',
    lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
    ...overrides,
  };
}

function status(overrides: Partial<LIMSConnectionStatus> = {}): LIMSConnectionStatus {
  return {
    configId: 'conn-1',
    connected: true,
    lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('LIMSConnectionManager', () => {
  it('renders the component wrapper', () => {
    render(<LIMSConnectionManager connections={[]} />);
    expect(screen.getByTestId('lims-connection-manager')).toBeTruthy();
  });

  it('shows empty state when no connections are provided', () => {
    render(<LIMSConnectionManager connections={[]} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/No LIMS connections configured/)).toBeTruthy();
  });

  it('renders a connection row for each config', () => {
    const connections = [
      connection({ id: 'c1', name: 'Benchling Prod' }),
      connection({ id: 'c2', name: 'LabArchives', type: 'labarchives' }),
    ];
    render(<LIMSConnectionManager connections={connections} />);
    expect(screen.getByTestId('connection-row-c1')).toBeTruthy();
    expect(screen.getByTestId('connection-row-c2')).toBeTruthy();
    expect(screen.getByText('Benchling Prod')).toBeTruthy();
    expect(screen.getByText('LabArchives')).toBeTruthy();
  });

  it('displays the connection type badge', () => {
    render(<LIMSConnectionManager connections={[connection({ type: 'benchling' })]} />);
    expect(screen.getByText('benchling')).toBeTruthy();
  });

  it('shows connected status when status reports connected', () => {
    const conns = [connection({ id: 'c1' })];
    const statuses = { c1: status({ connected: true }) };
    render(<LIMSConnectionManager connections={conns} statuses={statuses} />);
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('shows disconnected status when status reports disconnected', () => {
    const conns = [connection({ id: 'c1' })];
    const statuses = { c1: status({ connected: false }) };
    render(<LIMSConnectionManager connections={conns} statuses={statuses} />);
    expect(screen.getByText('Disconnected')).toBeTruthy();
  });

  it('shows correct connected count in header', () => {
    const conns = [
      connection({ id: 'c1' }),
      connection({ id: 'c2' }),
    ];
    const statuses = {
      c1: status({ configId: 'c1', connected: true }),
      c2: status({ configId: 'c2', connected: false }),
    };
    render(<LIMSConnectionManager connections={conns} statuses={statuses} />);
    expect(screen.getByText('1 of 2 connected')).toBeTruthy();
  });

  it('displays the base URL for each connection', () => {
    const conns = [connection({ baseUrl: 'https://custom.lims.org/api' })];
    render(<LIMSConnectionManager connections={conns} />);
    expect(screen.getByText('https://custom.lims.org/api')).toBeTruthy();
  });

  it('shows "Add Connection" button when not read-only', () => {
    render(<LIMSConnectionManager connections={[]} readOnly={false} />);
    expect(screen.getByTestId('add-connection-btn')).toBeTruthy();
  });

  it('hides "Add Connection" button in read-only mode', () => {
    render(<LIMSConnectionManager connections={[]} readOnly={true} />);
    expect(screen.queryByTestId('add-connection-btn')).toBeNull();
  });

  it('shows the add form when "Add Connection" is clicked', () => {
    render(<LIMSConnectionManager connections={[]} />);
    fireEvent.click(screen.getByTestId('add-connection-btn'));
    expect(screen.getByTestId('add-connection-form')).toBeTruthy();
    expect(screen.getByLabelText(/Connection Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Base URL/)).toBeTruthy();
  });

  it('validates required fields on submit', () => {
    render(<LIMSConnectionManager connections={[]} />);
    fireEvent.click(screen.getByTestId('add-connection-btn'));
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Base URL is required')).toBeTruthy();
    expect(screen.getByText('API key is required')).toBeTruthy();
  });

  it('calls onAdd with valid form data', () => {
    const onAdd = jest.fn();
    render(<LIMSConnectionManager connections={[]} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId('add-connection-btn'));

    fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'My LIMS' } });
    fireEvent.change(screen.getByTestId('input-url'), { target: { value: 'https://lims.example.com' } });
    fireEvent.change(screen.getByTestId('input-api-key'), { target: { value: 'sk-test123' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My LIMS',
        baseUrl: 'https://lims.example.com',
        credentials: { api_key: 'sk-test123' },
      }),
    );
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = jest.fn();
    const conns = [connection({ id: 'c1' })];
    render(<LIMSConnectionManager connections={conns} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId('remove-btn-c1'));
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('calls onSync when sync button is clicked', () => {
    const onSync = jest.fn();
    const conns = [connection({ id: 'c1' })];
    render(<LIMSConnectionManager connections={conns} onSync={onSync} />);
    fireEvent.click(screen.getByTestId('sync-btn-c1'));
    expect(onSync).toHaveBeenCalledWith('c1');
  });

  it('hides action buttons in read-only mode', () => {
    const conns = [connection({ id: 'c1' })];
    render(<LIMSConnectionManager connections={conns} readOnly={true} />);
    expect(screen.queryByTestId('remove-btn-c1')).toBeNull();
    expect(screen.queryByTestId('sync-btn-c1')).toBeNull();
  });

  it('hides form when cancel is clicked', () => {
    render(<LIMSConnectionManager connections={[]} />);
    fireEvent.click(screen.getByTestId('add-connection-btn'));
    expect(screen.getByTestId('add-connection-form')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(screen.queryByTestId('add-connection-form')).toBeNull();
  });

  it('displays auth type for each connection', () => {
    const conns = [connection({ authType: 'oauth2' })];
    render(<LIMSConnectionManager connections={conns} />);
    expect(screen.getByText('oauth2')).toBeTruthy();
  });

  it('displays sync direction for each connection', () => {
    const conns = [connection({ syncDirection: 'push' })];
    render(<LIMSConnectionManager connections={conns} />);
    expect(screen.getByText('push')).toBeTruthy();
  });
});
