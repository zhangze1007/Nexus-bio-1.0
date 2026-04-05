import { NextResponse } from 'next/server';
import { solveAuthorityCommunityFBA, solveAuthorityFBA, type CommunityFBARequest, type FBAObjective, type FBASpecies } from '../../../src/server/fbaEngine';

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
      return NextResponse.json({ ok: true, mode: 'community', result });
    }

    const result = await solveAuthorityFBA({
      species: asSpecies(input.species),
      objective: asObjective(input.objective),
      glucoseUptake: asNumber(input.glucoseUptake, 10),
      oxygenUptake: asNumber(input.oxygenUptake, 12),
      knockouts: asKnockouts(input.knockouts),
    });

    return NextResponse.json({ ok: true, mode: 'single', result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Authoritative FBA solve failed',
      },
      { status: 500 },
    );
  }
}
