import { NextResponse } from 'next/server';
import { solveAuthorityCommunityFBA, solveAuthorityFBA, type CommunityFBARequest, type FBAObjective, type FBASpecies } from '../../../src/server/fbaEngine';
import { createProvenanceEntry } from '../../../src/utils/provenance';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asObjective(value: unknown): FBAObjective {
  return value === 'product' || value === 'atp' ? value : 'biomass';
}

function asSpecies(value: unknown): FBASpecies {
  return value === 'yeast' ? 'yeast' : 'ecoli';
}

function asKnockouts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || `fba_${Date.now().toString(36)}`;

  // CSRF protection: validate Content-Type
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ ok: false, error: 'Invalid Content-Type. Expected application/json', requestId }, { status: 415, headers: getCorsHeaders(request) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    console.warn(JSON.stringify({ level: 'warn', message: 'FBA: invalid JSON body', requestId, error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    return NextResponse.json({ ok: false, error: 'Invalid FBA request payload', requestId }, { status: 400, headers: getCorsHeaders(request) });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid FBA request payload', requestId }, { status: 400, headers: getCorsHeaders(request) });
  }
  const input = body as Record<string, unknown>;

  try {
    if (input.mode === 'community') {
      const ecoli = input.ecoli as Record<string, unknown> | undefined;
      const yeast = input.yeast as Record<string, unknown> | undefined;
      const payload: CommunityFBARequest = {
        objective: asObjective(input.objective),
        alpha: asNumber(input.alpha, 0.5),
        ecoli: {
          glucoseUptake: asNumber(ecoli?.glucoseUptake, 10),
          oxygenUptake: asNumber(ecoli?.oxygenUptake, 12),
          knockouts: asKnockouts(ecoli?.knockouts),
        },
        yeast: {
          glucoseUptake: asNumber(yeast?.glucoseUptake, 8),
          oxygenUptake: asNumber(yeast?.oxygenUptake, 6),
          knockouts: asKnockouts(yeast?.knockouts),
        },
      };

      const result = await solveAuthorityCommunityFBA(payload);
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-community',
        validityTier: 'demo',
        outputAssumptions: [
          'fbasim-community.community_not_joint_lp',
          'fbasim-community.no_cross_feeding_stoich',
          'fbasim-community.alpha_linear_blend',
          'fbasim-community.exchange_flux_no_meaning',
          'fbasim-community.inherits_single_assumptions',
        ],
        evidence: [{
          id: `fba-community-${Date.now()}`,
          source: 'computation',
          reference: 'Two independent single-species LP solves with post-hoc exchange scaling; not a joint community LP.',
          confidence: 'demo',
        }],
      });
      return NextResponse.json({ ok: true, mode: 'community', result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    const result = await solveAuthorityFBA({
      species: asSpecies(input.species),
      objective: asObjective(input.objective),
      glucoseUptake: asNumber(input.glucoseUptake, 10),
      oxygenUptake: asNumber(input.oxygenUptake, 12),
      knockouts: asKnockouts(input.knockouts),
    });
    const provenanceEntry = createProvenanceEntry({
      toolId: 'fbasim-single',
      outputAssumptions: [
        'fbasim-single.steady_state',
        'fbasim-single.biomass_objective',
        'fbasim-single.no_regulation',
        'fbasim-single.simplex_real',
      ],
      evidence: [{
        id: `fba-${Date.now()}`,
        source: 'computation',
        reference: 'two-phase simplex LP on iJO1366Subset',
        confidence: 'high',
      }],
    });

    return NextResponse.json({ ok: true, mode: 'single', result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'FBA route failed',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    // Don't expose internal error details to client
    return NextResponse.json(
      {
        ok: false,
        error: 'Authoritative FBA solve failed',
        requestId,
      },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
