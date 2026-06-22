import { NextResponse } from 'next/server';
import { solveAuthorityCommunityFBA, solveAuthorityFBA, buildAuthorityFBAModel, solveExpandedFBA, solveDynamicFBA, type CommunityFBARequest, type FBAObjective, type FBASpecies, type DynamicReaction } from '../../../src/server/fbaEngine';
import { solveLP } from '../../../src/server/highsSolver';
import { runFVA } from '../../../src/server/fbaFVA';
import { runPFBA } from '../../../src/server/fbaPFBA';
import { getKnockoutReactions } from '../../../src/server/fbaGPR';
import { IJO1366_REACTIONS } from '../../../src/data/iJO1366Subset';
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

function asAction(value: unknown): 'fba' | 'fva' | 'pfba' | 'knockout' | 'fseof' | 'optknock' {
  if (value === 'fva' || value === 'pfba' || value === 'knockout' || value === 'fseof' || value === 'optknock') return value;
  return 'fba';
}

function asStringArray(value: unknown): string[] {
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

    // ── Custom (BiGG model) FBA ─────────────────────────────────────
    if (input.mode === 'custom') {
      const reactions = input.reactions as DynamicReaction[] | undefined;
      const objectiveId = (input.objectiveId as string) || 'BIOMASS';
      if (!Array.isArray(reactions) || reactions.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Custom mode requires a non-empty "reactions" array', requestId },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }
      const result = await solveDynamicFBA(
        reactions,
        objectiveId,
        {
          glucoseUptake: asNumber(input.glucoseUptake, 10),
          oxygenUptake: asNumber(input.oxygenUptake, 12),
          knockouts: asKnockouts(input.knockouts),
        },
      );
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-custom',
        outputAssumptions: [
          'fbasim-custom.steady_state',
          'fbasim-custom.biomass_objective',
          'fbasim-custom.no_regulation',
          'fbasim-custom.simplex_real',
          'fbasim-custom.bigg_model_stoichiometry',
        ],
        evidence: [{
          id: `fba-custom-${Date.now()}`,
          source: 'computation',
          reference: `Dynamic FBA on BiGG model: ${reactions.length} reactions, objective=${objectiveId}`,
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, mode: 'custom', result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    const species = asSpecies(input.species);
    const objective = asObjective(input.objective);
    const glucoseUptake = asNumber(input.glucoseUptake, 10);
    const oxygenUptake = asNumber(input.oxygenUptake, 12);
    const knockouts = asKnockouts(input.knockouts);
    const action = asAction(input.action);

    const baseRequest = { species, objective, glucoseUptake, oxygenUptake, knockouts };

    // ── FVA ─────────────────────────────────────────────────────────
    if (action === 'fva') {
      const model = buildAuthorityFBAModel(baseRequest);
      const baseResult = await solveLP(model);
      if (baseResult.status !== 'optimal') {
        return NextResponse.json(
          { ok: false, error: 'Base FBA solve failed — model infeasible for FVA', requestId },
          { status: 422, headers: getCorsHeaders(request) },
        );
      }
      const reactionIds = asStringArray(input.reactionIds);
      const fvaResult = await runFVA(model, baseResult.objectiveValue, reactionIds.length > 0 ? reactionIds : undefined);
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-fva',
        outputAssumptions: [
          'fbasim-fva.steady_state',
          'fbasim-fva.objective_toleranced',
          'fbasim-fva.no_regulation',
          'fbasim-fva.simplex_real',
        ],
        evidence: [{
          id: `fva-${Date.now()}`,
          source: 'computation',
          reference: 'Flux Variability Analysis (Mahadevan & Schilling 2003) via HiGHS LP',
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, action: 'fva', result: fvaResult, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── pFBA ────────────────────────────────────────────────────────
    if (action === 'pfba') {
      const model = buildAuthorityFBAModel(baseRequest);
      const pfbaResult = await runPFBA(model);
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-pfba',
        outputAssumptions: [
          'fbasim-pfba.steady_state',
          'fbasim-pfba.min_total_flux',
          'fbasim-pfba.no_regulation',
          'fbasim-pfba.simplex_real',
        ],
        evidence: [{
          id: `pfba-${Date.now()}`,
          source: 'computation',
          reference: 'Parsimonious FBA (Lewis et al. 2010) via HiGHS LP',
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, action: 'pfba', result: pfbaResult, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── GPR Knockout ────────────────────────────────────────────────
    if (action === 'knockout') {
      const genes = asStringArray(input.genes);
      if (genes.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'knockout action requires a non-empty "genes" array', requestId },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }
      // Build GPR rules map from iJO1366 reactions
      const gprRules: Record<string, string> = {};
      for (const rxn of IJO1366_REACTIONS) {
        if (rxn.gpr) gprRules[rxn.id] = rxn.gpr;
      }
      const geneKnockouts = getKnockoutReactions(genes, gprRules);
      const allKnockouts = Array.from(new Set([...knockouts, ...geneKnockouts]));
      const result = await solveExpandedFBA({
        objective: objective === 'atp' ? 'biomass' : objective,
        glucoseUptake,
        oxygenUptake,
        knockouts: allKnockouts,
      });
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-knockout',
        outputAssumptions: [
          'fbasim-knockout.steady_state',
          'fbasim-knockout.gpr_boolean',
          'fbasim-knockout.no_regulation',
          'fbasim-knockout.simplex_real',
          'fbasim-knockout.iJO1366_subset',
        ],
        evidence: [{
          id: `knockout-${Date.now()}`,
          source: 'computation',
          reference: `Gene knockout via GPR rules on iJO1366 subset: genes=[${genes.join(',')}] → ${geneKnockouts.length} reactions disabled`,
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, action: 'knockout', genes, knockedOutReactions: geneKnockouts, result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── FSEOF (Flux Scanning based on Enforced Objective Flux) ─────
    if (action === 'fseof') {
      const { runFSEOF } = await import('../../../src/server/fbaFSEOF');
      const fseofResult = runFSEOF({
        reactions: (input.reactions as import('../../../src/server/fbaFSEOF').FSEOFReaction[]) ?? [],
        objectiveId: (input.objectiveId as string) ?? 'BIOMASS',
        productReactionId: (input.productReactionId as string) ?? 'PRODUCT',
      }, {
        numSteps: asNumber(input.numSteps, 10),
        reductionFactor: asNumber(input.reductionFactor, 0.5),
      });
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-fseof',
        outputAssumptions: [
          'fbasim-fseof.steady_state',
          'fbasim-fseof.enforced_objective_flux',
          'fbasim-fseof.no_regulation',
          'fbasim-fseof.simplex_real',
        ],
        evidence: [{
          id: `fseof-${Date.now()}`,
          source: 'computation',
          reference: 'FSEOF (Choi et al. 2010, BMC Bioinformatics 11:616) — Flux Scanning based on Enforced Objective Flux',
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, action: 'fseof', result: fseofResult, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── OptKnock (bilevel knockout strategy) ────────────────────────
    if (action === 'optknock') {
      const { runOptKnock } = await import('../../../src/server/fbaOptKnock');
      const optknockResult = await runOptKnock({
        reactions: (input.reactions as import('../../../src/server/fbaOptKnock').OptKnockReaction[]) ?? [],
        objectiveId: (input.objectiveId as string) ?? 'BIOMASS',
        productReactionId: (input.productReactionId as string) ?? 'PRODUCT',
      }, {
        maxKnockouts: asNumber(input.maxKnockouts, 3),
        growthFraction: asNumber(input.growthFraction, 0.01),
      });
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-optknock',
        outputAssumptions: [
          'fbasim-optknock.steady_state',
          'fbasim-optknock.bilevel_lp_approximation',
          'fbasim-optknock.no_regulation',
          'fbasim-optknock.simplex_real',
        ],
        evidence: [{
          id: `optknock-${Date.now()}`,
          source: 'computation',
          reference: 'OptKnock (Burgard et al. 2003, Biotechnol Bioeng 84(6):647-657) — Bilevel knockout strategy via iterative LP',
          confidence: 'high',
        }],
      });
      return NextResponse.json({ ok: true, action: 'optknock', result: optknockResult, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── Standard FBA (default) ──────────────────────────────────────
    const result = await solveAuthorityFBA(baseRequest);
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      level: 'error',
      message: 'FBA route failed',
      requestId,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }));
    // Expose the error type to the client (solver errors are safe to share;
    // stack traces and internal paths are not).
    const clientMessage = errorMsg.includes('solve') || errorMsg.includes('infeasible') || errorMsg.includes('unbounded')
      ? `FBA solve failed: ${errorMsg}`
      : `FBA engine error: ${errorMsg}`;
    return NextResponse.json(
      {
        ok: false,
        error: clientMessage,
        requestId,
      },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
