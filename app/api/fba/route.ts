import { NextResponse } from 'next/server';
import { solveAuthorityCommunityFBA, solveAuthorityFBA, buildAuthorityFBAModel, solveExpandedFBA, solveDynamicFBA, type CommunityFBARequest, type FBAObjective, type FBASpecies, type DynamicReaction } from '../../../src/server/fbaEngine';
import { FBARequestSchema, validateSchema } from '../../../src/schemas';
import { solveLP } from '../../../src/server/highsSolver';
import { runFVA } from '../../../src/server/fbaFVA';
import { runPFBA } from '../../../src/server/fbaPFBA';
import { getKnockoutReactions } from '../../../src/server/fbaGPR';
import { IJO1366_REACTIONS } from '../../../src/data/iJO1366Subset';
import { steadyCom, type SteadyComSpecies } from '../../../src/server/fbaSteadyCom';
import { createProvenanceEntry } from '../../../src/utils/provenance';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';
import { createLogger } from '../../../src/utils/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
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

const FBA_TIMEOUT_MS = 30_000;

function withFbaTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('FBA computation timeout')), FBA_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || `fba_${Date.now().toString(36)}`;
  const log = createLogger('fba-route');

  // ── Body size limit (1MB) ──
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 1_000_000) {
    return errorResponse('Request too large', 413, { requestId }, getCorsHeaders(request));
  }

  // CSRF protection: validate Content-Type
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return errorResponse('Invalid Content-Type. Expected application/json', 415, { requestId }, getCorsHeaders(request));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    log.warn('FBA: invalid JSON body', { requestId, error: err instanceof Error ? err.message : String(err) });
    return errorResponse('Invalid FBA request payload', 400, { requestId }, getCorsHeaders(request));
  }
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid FBA request payload', 400, { requestId }, getCorsHeaders(request));
  }

  // ── Zod envelope validation ──
  const envelopeCheck = validateSchema(FBARequestSchema, body);
  if (!envelopeCheck.ok) {
    return NextResponse.json(
      { ok: false, error: 'Invalid FBA request', details: envelopeCheck.errors, requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const input = body as Record<string, unknown>;

  try {
    if (input.mode === 'community') {
      const ecoli = input.ecoli as Record<string, unknown> | undefined;
      const yeast = input.yeast as Record<string, unknown> | undefined;
      // alpha is only set when the caller explicitly requests a fixed community
      // composition. When omitted, alpha stays undefined so SteadyCom OPTIMIZES the
      // relative abundances (the distinctive abundance-optimizing path) rather than
      // pinning them to a default split.
      const explicitAlpha =
        typeof input.alpha === 'number' && Number.isFinite(input.alpha) ? (input.alpha as number) : undefined;
      const payload: CommunityFBARequest = {
        objective: asObjective(input.objective),
        ...(explicitAlpha !== undefined ? { alpha: explicitAlpha } : {}),
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

      const result = await withFbaTimeout(solveAuthorityCommunityFBA(payload));
      // Provenance tags describe the REAL solve: one joint SteadyCom LP with a closed
      // shared extracellular pool. validityTier is 'partial' — the method is real, but
      // the curated 2-species model makes absolute numbers illustrative at this scale.
      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-community',
        validityTier: 'partial',
        outputAssumptions: [
          'fbasim-community.joint_steadycom_lp',
          'fbasim-community.stoichiometric_cross_feeding',
          'fbasim-community.abundance_composition',
          'fbasim-community.curated_model_scale',
          'fbasim-community.inherits_single_assumptions',
        ],
        evidence: [{
          id: `fba-community-${Date.now()}`,
          source: 'computation',
          reference:
            `Joint SteadyCom community LP (Chan SHJ, Simons MN, Maranas CD 2017, PLOS Comput Biol 13(5):e1005539, DOI 10.1371/journal.pcbi.1005539): shared extracellular pool coupling + biomass-abundance coupling, bisection on community growth rate; cross-feeding exchange fluxes are LP decision variables. Curated 2-species model (E. coli acetate overflow, yeast ethanol fermentation)${explicitAlpha !== undefined ? `; composition pinned at alpha=${explicitAlpha}` : '; abundances optimized by SteadyCom'}.`,
          confidence: 'medium',
        }],
      });
      return NextResponse.json({ ok: true, mode: 'community', result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
    }

    // ── SteadyCom Community FBA ──────────────────────────────────────
    if (input.mode === 'steadycom') {
      const rawSpecies = input.species as Record<string, unknown>[] | undefined;
      if (!Array.isArray(rawSpecies) || rawSpecies.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'steadycom mode requires a non-empty "species" array', requestId },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }

      const parsedSpecies: SteadyComSpecies[] = rawSpecies.map((sp) => {
        const spObj = sp as Record<string, unknown>;
        const rawRxns = spObj.reactions as Record<string, unknown>[] | undefined;
        return {
          id: String(spObj.id ?? 'unknown'),
          name: String(spObj.name ?? spObj.id ?? 'unknown'),
          reactions: Array.isArray(rawRxns) ? rawRxns.map((r) => {
            const rObj = r as Record<string, unknown>;
            return {
              id: String(rObj.id ?? ''),
              stoichiometry: (rObj.stoichiometry as Record<string, number>) ?? {},
              lowerBound: asNumber(rObj.lowerBound, 0),
              upperBound: asNumber(rObj.upperBound, 1000),
            };
          }) : [],
          metabolites: asStringArray(spObj.metabolites),
          biomassReaction: String(spObj.biomassReaction ?? ''),
        };
      });

      const sharedMetabolites = asStringArray(input.sharedMetabolites);
      const maxIterations = asNumber(input.maxIterations, 100);
      const tolerance = asNumber(input.tolerance, 1e-6);

      const result = await withFbaTimeout(steadyCom(parsedSpecies, sharedMetabolites, maxIterations, tolerance));

      const provenanceEntry = createProvenanceEntry({
        toolId: 'fbasim-steadycom',
        outputAssumptions: [
          'fbasim-steadycom.steady_state',
          'fbasim-steadycom.community_growth_rate',
          'fbasim-steadycom.binary_search_lp',
          'fbasim-steadycom.no_regulation',
          'fbasim-steadycom.highs_lp_solver',
        ],
        evidence: [{
          id: `steadycom-${Date.now()}`,
          source: 'computation',
          reference: `SteadyCom (Chan SHJ, Simons MN, Maranas CD 2017, PLOS Comput Biol 13(5):e1005539, DOI 10.1371/journal.pcbi.1005539) — joint community LP with bisection on community growth rate, ${parsedSpecies.length} species, tolerance=${tolerance}`,
          confidence: 'high',
        }],
      });

      return NextResponse.json({ ok: true, mode: 'steadycom', result, provenance: provenanceEntry }, { headers: getCorsHeaders(request) });
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
      const result = await withFbaTimeout(solveDynamicFBA(
        reactions,
        objectiveId,
        {
          glucoseUptake: asNumber(input.glucoseUptake, 10),
          oxygenUptake: asNumber(input.oxygenUptake, 12),
          knockouts: asKnockouts(input.knockouts),
        },
      ));
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
      const baseResult = await withFbaTimeout(solveLP(model));
      if (baseResult.status !== 'optimal') {
        return NextResponse.json(
          { ok: false, error: 'Base FBA solve failed — model infeasible for FVA', requestId },
          { status: 422, headers: getCorsHeaders(request) },
        );
      }
      const reactionIds = asStringArray(input.reactionIds);
      const fvaResult = await withFbaTimeout(runFVA(model, baseResult.objectiveValue, reactionIds.length > 0 ? reactionIds : undefined));
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
      const pfbaResult = await withFbaTimeout(runPFBA(model));
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
      const result = await withFbaTimeout(solveExpandedFBA({
        objective: objective === 'atp' ? 'biomass' : objective,
        glucoseUptake,
        oxygenUptake,
        knockouts: allKnockouts,
      }));
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
      const optknockResult = await withFbaTimeout(runOptKnock({
        reactions: (input.reactions as import('../../../src/server/fbaOptKnock').OptKnockReaction[]) ?? [],
        objectiveId: (input.objectiveId as string) ?? 'BIOMASS',
        productReactionId: (input.productReactionId as string) ?? 'PRODUCT',
      }, {
        maxKnockouts: asNumber(input.maxKnockouts, 3),
        growthFraction: asNumber(input.growthFraction, 0.01),
      }));
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
    const result = await withFbaTimeout(solveAuthorityFBA(baseRequest));
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
    log.error('FBA route failed', { requestId, error: errorMsg });
    return errorResponse('FBA engine error', 500, { requestId }, getCorsHeaders(request));
  }
}
