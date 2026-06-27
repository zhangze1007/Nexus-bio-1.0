/** @jest-environment node */

/**
 * Tests for the /api/workbench endpoint (project state sync).
 *
 * Covers: GET with auth, GET without auth (401), PUT with valid payload,
 * PUT with revision conflict (409), content-type validation, and origin checking.
 */

// ── Mocks ──

jest.mock('../../src/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('../../src/server/workbenchDb', () => ({
  getWorkbenchDb: jest.fn(() => Promise.resolve()),
  readProjectState: jest.fn(() => Promise.resolve({
    schemaVersion: 1,
    revision: 0,
    lastMutationAt: 0,
    activeArtifactId: null,
    project: null,
    evidenceItems: [],
    selectedEvidenceIds: [],
    draftAnalyzeInput: '',
    workflowArtifact: null,
    analyzeArtifact: null,
    toolRuns: [],
    toolPayloads: {},
    payloadAdmissionDecisionsByToolId: {},
    runArtifacts: [],
    checkpoints: [],
    nextRecommendations: [],
    workflowControl: {
      machineState: 'idle',
      status: 'idle',
      currentToolId: null,
      nextRecommendedNode: 'pathd',
      missingEvidence: { minRequired: 0, have: 0, kinds: [] },
    },
  })),
  writeProjectState: jest.fn(() => Promise.resolve()),
  projectStateExists: jest.fn(() => Promise.resolve(true)),
  getBackendMeta: jest.fn(() => Promise.resolve({})),
  listSyncAudit: jest.fn(() => Promise.resolve([])),
  listCanonicalHistory: jest.fn(() => Promise.resolve([])),
  listProjectMembers: jest.fn(() => Promise.resolve([])),
  listExperimentRecords: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../src/domain/workflowArtifactAdapters', () => ({
  deriveAnalyzeCompatibilityProjection: jest.fn(() => null),
}));

jest.mock('../../src/store/workbenchValidation', () => ({
  sanitizeWorkbenchState: jest.fn((input: unknown) => {
    if (!input || typeof input !== 'object') return null;
    return {
      schemaVersion: 1,
      revision: 0,
      project: (input as Record<string, unknown>).project ?? null,
      ...(input as Record<string, unknown>),
    };
  }),
}));

jest.mock('../../src/services/trustPolicyEngine', () => ({
  evaluateClaimSurfacePolicy: jest.fn(() => ({ status: 'ok' })),
}));

// ── Imports ──

import { NextRequest } from 'next/server';
import { GET, PUT } from '../../app/api/workbench/route';
import { auth } from '../../src/lib/auth';
import { readProjectState, writeProjectState, listProjectMembers } from '../../src/server/workbenchDb';

const mockAuth = auth as jest.Mock;
const mockReadProjectState = readProjectState as jest.MockedFunction<typeof readProjectState>;
const mockWriteProjectState = writeProjectState as jest.MockedFunction<typeof writeProjectState>;
const mockListProjectMembers = listProjectMembers as jest.MockedFunction<typeof listProjectMembers>;

function createGetRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/workbench', {
    method: 'GET',
    headers: {
      'x-workbench-actor-id': 'user-123',
      ...headers,
    },
  });
}

function createPutRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/workbench', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-workbench-actor-id': 'user-123',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const minimalValidState = {
  state: {
    schemaVersion: 1,
    revision: 0,
    project: { id: 'test-project', name: 'Test' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──

describe('GET /api/workbench', () => {
  it('returns 200 with workbench state for authenticated user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2099-01-01',
    });

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.state).toBeDefined();
    expect(data.backend).toBeDefined();
    expect(data.audit).toBeDefined();
    expect(data.history).toBeDefined();
  });

  it('returns 401 when session has no user', async () => {
    mockAuth.mockResolvedValue(null);

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/authentication/i);
  });

  it('returns 401 when session user has no id', async () => {
    mockAuth.mockResolvedValue({
      user: { id: '', email: 'test@example.com' },
      expires: '2099-01-01',
    });

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.ok).toBe(false);
  });

  it('returns 403 when actor is not a project member', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2099-01-01',
    });
    // Members list returns users, but none match the requesting actor
    mockListProjectMembers.mockResolvedValue([
      { actorId: 'other-user', role: 'owner', joinedAt: Date.now() },
    ] as never);

    const req = createGetRequest({
      'x-workbench-project-id': 'project-abc',
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/access denied/i);
  });
});

describe('PUT /api/workbench', () => {
  it('returns 200 with updated state for valid payload', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2099-01-01',
    });

    const req = createPutRequest(minimalValidState);
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.state).toBeDefined();
    expect(mockWriteProjectState).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when revision conflicts (stale client)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2099-01-01',
    });
    // Server state has revision 5, but client sends revision 0
    mockReadProjectState.mockResolvedValue({
      schemaVersion: 1,
      revision: 5,
      lastMutationAt: Date.now(),
      activeArtifactId: null,
      project: { id: 'test-project', name: 'Test', status: 'active', isDemo: false, updatedAt: Date.now(), summary: '', targetProduct: '', sourceQuery: '' },
      evidenceItems: [],
      selectedEvidenceIds: [],
      draftAnalyzeInput: '',
      workflowArtifact: null,
      analyzeArtifact: null,
      toolRuns: [],
      toolPayloads: {},
      payloadAdmissionDecisionsByToolId: {},
      runArtifacts: [],
      checkpoints: [],
      nextRecommendations: [],
      workflowControl: {
        machineState: 'idle',
        status: 'idle',
        currentToolId: null,
        nextRecommendedNode: 'pathd',
        missingEvidence: { minRequired: 0, have: 0, kinds: [] },
      },
    } as never);

    const req = createPutRequest({
      state: { schemaVersion: 1, revision: 0, project: { id: 'test' } },
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/stale/i);
    expect(mockWriteProjectState).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid workbench payload', async () => {
    // sanitizeWorkbenchState returns null for invalid input
    const { sanitizeWorkbenchState } = require('../../src/store/workbenchValidation');
    sanitizeWorkbenchState.mockReturnValueOnce(null);

    const req = createPutRequest({ state: null });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/invalid/i);
  });

  it('returns 415 for non-JSON content type', async () => {
    const req = new NextRequest('http://localhost:3000/api/workbench', {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'hello',
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(415);
    expect(data.ok).toBe(false);
  });

  it('returns 403 for disallowed origin', async () => {
    const req = new NextRequest('http://localhost:3000/api/workbench', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://evil-site.com',
      },
      body: JSON.stringify(minimalValidState),
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/origin/i);
  });

  it('returns 413 when request body exceeds size limit', async () => {
    const req = new NextRequest('http://localhost:3000/api/workbench', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'content-length': '1000001',
      },
      body: '{}',
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(413);
    expect(data.ok).toBe(false);
  });
});
