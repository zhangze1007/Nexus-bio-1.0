/** @jest-environment node */

/**
 * Tests for the /api/fba endpoint (Flux Balance Analysis).
 *
 * Covers: valid single-species FBA, community FBA, invalid input,
 * timeout handling, content-type validation, and body size limits.
 */

// ── Mocks ──

jest.mock('../../src/server/fbaEngine', () => ({
  solveAuthorityFBA: jest.fn(),
  solveAuthorityCommunityFBA: jest.fn(),
  buildAuthorityFBAModel: jest.fn(() => ({
    variables: [],
    constraints: [],
    objective: [],
  })),
  solveExpandedFBA: jest.fn(),
  solveDynamicFBA: jest.fn(),
}));

jest.mock('../../src/server/highsSolver', () => ({
  solveLP: jest.fn(() => Promise.resolve({ status: 'optimal', objectiveValue: 0.87, variables: {} })),
}));

jest.mock('../../src/server/fbaFVA', () => ({
  runFVA: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../src/server/fbaPFBA', () => ({
  runPFBA: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../src/server/fbaGPR', () => ({
  getKnockoutReactions: jest.fn(() => []),
}));

jest.mock('../../src/data/iJO1366Subset', () => ({
  IJO1366_REACTIONS: [],
}));

jest.mock('../../src/utils/provenance', () => ({
  createProvenanceEntry: jest.fn((input: unknown) => ({
    ...(input as Record<string, unknown>),
    createdAt: Date.now(),
  })),
}));

// ── Imports ──

import { POST } from '../../app/api/fba/route';
import { solveAuthorityFBA, solveAuthorityCommunityFBA } from '../../src/server/fbaEngine';

const mockSolveFBA = solveAuthorityFBA as jest.MockedFunction<typeof solveAuthorityFBA>;
const mockSolveCommunityFBA = solveAuthorityCommunityFBA as jest.MockedFunction<typeof solveAuthorityCommunityFBA>;

function createFbaRequest(body: Record<string, unknown>, headers?: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/fba', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': `test-${Date.now()}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validSinglePayload = {
  species: 'ecoli',
  objective: 'biomass',
  glucoseUptake: 10,
  oxygenUptake: 12,
};

const validCommunityPayload = {
  mode: 'community',
  objective: 'biomass',
  alpha: 0.5,
  ecoli: { glucoseUptake: 10, oxygenUptake: 12 },
  yeast: { glucoseUptake: 8, oxygenUptake: 6 },
};

const mockFBAResult = {
  biomassFlux: 0.87,
  productFlux: 0,
  atpFlux: 7.6,
  glucoseUptakeFlux: 10,
  oxygenUptakeFlux: 12,
  sensitivityCoefficients: {},
  carbonEfficiency: 0.65,
  fluxDistribution: {},
};

const mockCommunityResult = {
  ecoli: { ...mockFBAResult },
  yeast: { ...mockFBAResult },
  alpha: 0.5,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSolveFBA.mockResolvedValue(mockFBAResult as never);
  mockSolveCommunityFBA.mockResolvedValue(mockCommunityResult as never);
});

// ── Tests ──

describe('POST /api/fba', () => {
  describe('valid single-species FBA', () => {
    it('returns ok:true with FBA result for default ecoli biomass', async () => {
      const req = createFbaRequest(validSinglePayload);
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.mode).toBe('single');
      expect(data.result).toBeDefined();
      expect(data.provenance).toBeDefined();
    });

    it('passes correct parameters to the FBA solver', async () => {
      const req = createFbaRequest({
        species: 'ecoli',
        objective: 'atp',
        glucoseUptake: 15,
        oxygenUptake: 18,
        knockouts: ['PFK'],
      });
      await POST(req);

      expect(mockSolveFBA).toHaveBeenCalledTimes(1);
      const callArg = mockSolveFBA.mock.calls[0][0];
      expect(callArg.species).toBe('ecoli');
      expect(callArg.objective).toBe('atp');
      expect(callArg.glucoseUptake).toBe(15);
      expect(callArg.oxygenUptake).toBe(18);
      expect(callArg.knockouts).toEqual(['PFK']);
    });

    it('defaults missing numeric fields to standard values', async () => {
      const req = createFbaRequest({ species: 'ecoli' });
      await POST(req);

      expect(mockSolveFBA).toHaveBeenCalledTimes(1);
      const callArg = mockSolveFBA.mock.calls[0][0];
      expect(callArg.glucoseUptake).toBe(10);
      expect(callArg.oxygenUptake).toBe(12);
      expect(callArg.objective).toBe('biomass');
    });
  });

  describe('community FBA', () => {
    it('returns ok:true with community results when mode=community', async () => {
      const req = createFbaRequest(validCommunityPayload);
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.mode).toBe('community');
      expect(mockSolveCommunityFBA).toHaveBeenCalledTimes(1);
    });

    it('leaves alpha undefined when not provided (SteadyCom optimizes abundances)', async () => {
      // No alpha in the body → the route must NOT inject a default (e.g. 0.5).
      const req = createFbaRequest({
        mode: 'community',
        objective: 'biomass',
        ecoli: { glucoseUptake: 10, oxygenUptake: 12 },
        yeast: { glucoseUptake: 8, oxygenUptake: 6 },
      });
      await POST(req);

      expect(mockSolveCommunityFBA).toHaveBeenCalledTimes(1);
      const callArg = mockSolveCommunityFBA.mock.calls[0][0];
      expect(callArg.alpha).toBeUndefined();
    });

    it('forwards an explicit alpha to pin the community composition', async () => {
      const req = createFbaRequest({
        mode: 'community',
        objective: 'biomass',
        alpha: 0.7,
        ecoli: { glucoseUptake: 10, oxygenUptake: 12 },
        yeast: { glucoseUptake: 8, oxygenUptake: 6 },
      });
      await POST(req);

      expect(mockSolveCommunityFBA).toHaveBeenCalledTimes(1);
      const callArg = mockSolveCommunityFBA.mock.calls[0][0];
      expect(callArg.alpha).toBe(0.7);
    });

    it('attaches honest partial-tier provenance for the real joint SteadyCom LP', async () => {
      const req = createFbaRequest(validCommunityPayload);
      const res = await POST(req);
      const data = await res.json();

      expect(data.provenance.validityTier).toBe('partial');
      expect(data.provenance.outputAssumptions).toContain('fbasim-community.joint_steadycom_lp');
      expect(data.provenance.outputAssumptions).not.toContain('fbasim-community.community_not_joint_lp');
    });
  });

  describe('invalid input', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = new Request('http://localhost:3000/api/fba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
    });

    it('returns 415 for non-JSON content type', async () => {
      const req = new Request('http://localhost:3000/api/fba', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(415);
      expect(data.ok).toBe(false);
    });

    it('returns 413 for oversized request body', async () => {
      const req = new Request('http://localhost:3000/api/fba', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'content-length': '1000001',
        },
        body: '{}',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(413);
      expect(data.ok).toBe(false);
    });
  });

  describe('error handling', () => {
    it('returns 500 when FBA solver throws', async () => {
      mockSolveFBA.mockRejectedValue(new Error('Solver infeasible'));

      const req = createFbaRequest(validSinglePayload);
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/engine error/i);
    });

    it('returns timeout error when computation exceeds limit', async () => {
      // Simulate a long-running computation that the timeout race will lose
      mockSolveFBA.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('FBA computation timeout')), 50)),
      );

      const req = createFbaRequest(validSinglePayload);
      const res = await POST(req);
      const data = await res.json();

      // The route catches errors and returns 500
      expect(res.status).toBe(500);
      expect(data.ok).toBe(false);
    });
  });
});
