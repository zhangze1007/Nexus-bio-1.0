/**
 * Pipeline API Route — Runs multi-agent pipelines server-side
 *
 * POST /api/pipeline/:tool
 *
 * Dispatches to the correct pipeline based on the tool parameter.
 * All pipeline code runs server-side (Node.js runtime) so it can
 * use HiGHS WASM, file system, and other Node.js APIs.
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

const PIPELINE_MAP: Record<string, () => Promise<(input: unknown) => unknown | Promise<unknown>>> = {
  consortium: async () => {
    const { optimizeConsortium } = await import('../../../../src/server/consortiumDesignEngine');
    return (input: unknown) => {
      const p = input as Record<string, unknown> ?? {};
      return optimizeConsortium(
        (p.strains as Parameters<typeof optimizeConsortium>[0]) ?? [],
        (p.objective as Parameters<typeof optimizeConsortium>[1]) ?? 'max_biomass',
        (p.maxStrains as number) ?? 3,
      );
    };
  },
  fbasim: async () => {
    const { runStrainDesignPipeline } = await import('../../../../src/server/fbaStrainPipeline');
    return (input: unknown) => {
      const p = input as Record<string, unknown> ?? {};
      return runStrainDesignPipeline({
        species: (p.species as 'ecoli' | 'yeast') ?? 'ecoli',
        objective: (p.objective as 'biomass' | 'atp' | 'product') ?? 'biomass',
        glucoseUptake: (p.glucoseUptake as number) ?? 10,
        oxygenUptake: (p.oxygenUptake as number) ?? 20,
        targetProduct: (p.targetProduct as string) ?? 'PRODUCT',
        maxKnockouts: (p.maxKnockouts as number) ?? 3,
        growthFractionConstraint: (p.growthFractionConstraint as number) ?? 0.1,
      });
    };
  },
  catdes: async () => {
    const { identifyBottlenecks } = await import('../../../../src/services/CatalystDesignerEngine');
    return (input: unknown) => identifyBottlenecks(input as Parameters<typeof identifyBottlenecks>[0]);
  },
  proevol: async () => {
    const { runProteinDesignPipeline } = await import('../../../../src/server/proevolPipeline');
    return (input: unknown) => runProteinDesignPipeline(input as Parameters<typeof runProteinDesignPipeline>[0]);
  },
  dyncon: async () => {
    const { runControlDesignPipeline } = await import('../../../../src/server/dynconPipeline');
    return (input: unknown) => runControlDesignPipeline(input as Parameters<typeof runControlDesignPipeline>[0]);
  },
  cethx: async () => {
    const { runThermodynamicPipeline } = await import('../../../../src/server/cethxPipeline');
    return (input: unknown) => runThermodynamicPipeline(input as Parameters<typeof runThermodynamicPipeline>[0]);
  },
  gecair: async () => {
    const { runCircuitReasoner } = await import('../../../../src/server/circuitReasonerPipeline');
    return (input: unknown) => runCircuitReasoner(input as Parameters<typeof runCircuitReasoner>[0]);
  },
  cellfree: async () => {
    const { runRobustnessPredictor } = await import('../../../../src/server/robustnessPipeline');
    return (input: unknown) => {
      const p = input as Record<string, unknown> ?? {};
      return runRobustnessPredictor(
        (p.singleCellData as Parameters<typeof runRobustnessPredictor>[0]) ?? [],
        undefined,
        (p.nTrials as number) ?? 200,
      );
    };
  },
  genmim: async () => {
    const { runMinimizationPipeline } = await import('../../../../src/server/genmimPipeline');
    return (input: unknown) => runMinimizationPipeline(input as Parameters<typeof runMinimizationPipeline>[0]);
  },
  multio: async () => {
    const { runMultiOmicsPipeline } = await import('../../../../src/server/multioPipeline');
    return (input: unknown) => runMultiOmicsPipeline(input as Parameters<typeof runMultiOmicsPipeline>[0]);
  },
  scspatial: async () => {
    const { runScSpatialPipeline } = await import('../../../../src/server/scspatialPipeline');
    return (input: unknown) => runScSpatialPipeline(input as Parameters<typeof runScSpatialPipeline>[0]);
  },
  nexai: async () => {
    const { runResearchPipeline } = await import('../../../../src/server/nexaiPipeline');
    return (input: unknown) => {
      const p = input as Record<string, unknown> ?? {};
      return runResearchPipeline(
        (p.question as Parameters<typeof runResearchPipeline>[0]) ?? { topic: '', subtopics: [] },
        (p.papers as Parameters<typeof runResearchPipeline>[1]) ?? [],
      );
    };
  },
  inversefolding: async () => {
    const { runInverseFolding } = await import('../../../../src/server/inverseFoldingEngine');
    return (input: unknown) => runInverseFolding(input as Parameters<typeof runInverseFolding>[0]);
  },
  multiplexcrispr: async () => {
    const { runMultiplexCRISPR } = await import('../../../../src/server/multiplexCRISPREngine');
    return (input: unknown) => runMultiplexCRISPR(input as Parameters<typeof runMultiplexCRISPR>[0]);
  },
  pathwaydiscovery: async () => {
    const { runPathwayDiscovery } = await import('../../../../src/server/pathwayDiscoveryEngine');
    return (input: unknown) => runPathwayDiscovery(input as Parameters<typeof runPathwayDiscovery>[0]);
  },
  digitaltwin: async () => {
    const { runDigitalTwin } = await import('../../../../src/server/digitalTwinEngine');
    return (input: unknown) => {
      const p = input as Record<string, unknown> ?? {};
      return runDigitalTwin(
        p.config as Parameters<typeof runDigitalTwin>[0],
        (p.sensorReadings as Parameters<typeof runDigitalTwin>[1]) ?? [],
        (p.forecastHorizon as number) ?? 24,
      );
    };
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  const requestId = `pipeline_${tool}_${Date.now().toString(36)}`;

  // Validate tool
  const loader = PIPELINE_MAP[tool];
  if (!loader) {
    return NextResponse.json(
      { ok: false, error: `Unknown pipeline: ${tool}. Available: ${Object.keys(PIPELINE_MAP).join(', ')}`, requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  // Parse input
  let input: unknown = {};
  try {
    input = await request.json();
  } catch {
    // Empty body is fine — pipelines have defaults
  }

  // Run pipeline
  try {
    const startTime = Date.now();
    const pipelineFn = await loader();
    const result = await pipelineFn(input);
    const durationMs = Date.now() - startTime;

    return NextResponse.json(
      { ok: true, tool, result, requestId, durationMs },
      { headers: getCorsHeaders(request) },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      level: 'error',
      message: `Pipeline ${tool} failed`,
      requestId,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json(
      { ok: false, error: `Pipeline ${tool} failed: ${errorMsg}`, requestId },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
