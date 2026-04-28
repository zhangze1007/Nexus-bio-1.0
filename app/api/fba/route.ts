import { NextResponse } from 'next/server';
import { solveAuthorityCommunityFBA, solveAuthorityFBA, type CommunityFBARequest, type FBAObjective, type FBASpecies } from '../../../src/server/fbaEngine';
import { createProvenanceEntry } from '../../../src/utils/provenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid FBA request payload' }, { status: 400 });
  }
  const input = body as Record<string, any>;

  try {
    if (input.mode === 'community') {
      const payload: CommunityFBARequest = {
        objective: asObjective(input.objective),
        alpha: asNumber(input.alpha, 0.5),
        ecoli: {
          glucoseUptake: asNumber(input.ecoli?.glucoseUptake, 10),
          oxygenUptake: asNumber(input.ecoli?.oxygenUptake, 12),
          knockouts: asKnockouts(input.ecoli?.knockouts),
        },
        yeast: {
          glucoseUptake: asNumber(input.yeast?.glucoseUptake, 8),
          oxygenUptake: asNumber(input.yeast?.oxygenUptake, 6),
          knockouts: asKnockouts(input.yeast?.knockouts),
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
      return NextResponse.json({ ok: true, mode: 'community', result, provenance: provenanceEntry });
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

    return NextResponse.json({ ok: true, mode: 'single', result, provenance: provenanceEntry });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('FBA route failed', error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Authoritative FBA solve failed',
      },
      { status: 500 },
    );
  }
}
