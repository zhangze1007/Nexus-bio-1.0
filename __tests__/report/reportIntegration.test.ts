/**
 * Report Generation Integration Tests
 *
 * Verifies the full pipeline: collect data from mock payloads → render Markdown
 * → verify all sections present. These tests exercise `collectReportData` and
 * `renderMarkdown` together as an integrated unit.
 *
 * @module __tests__/report/reportIntegration
 */

import { collectReportData } from '../../src/services/report/reportCollector';
import { renderMarkdown } from '../../src/services/report/markdownRenderer';
import type {
  FBAWorkbenchPayload,
  CETHXWorkbenchPayload,
  CatalystWorkbenchPayload,
  CellFreeWorkbenchPayload,
  DynConWorkbenchPayload,
  MultiOWorkbenchPayload,
  GenMIMWorkbenchPayload,
  GECAIRWorkbenchPayload,
  ProEvolWorkbenchPayload,
  DBTLWorkbenchPayload,
  NEXAIWorkbenchPayload,
  PathDWorkbenchPayload,
  ScSpatialWorkbenchPayload,
} from '../../src/store/workbenchPayloads';

// ── Fixtures ──────────────────────────────────────────────────

function makeProvenanceEntry(toolId: string, tier: 'real' | 'partial' | 'demo' = 'real') {
  return {
    toolId,
    timestamp: Date.now(),
    inputAssumptions: [`assumption-${toolId}-1`],
    outputAssumptions: [`output-${toolId}-1`],
    evidence: [],
    validityTier: tier,
    upstreamProvenance: [],
  };
}

function makeFBAPayload(): FBAWorkbenchPayload {
  return {
    toolId: 'fbasim',
    targetProduct: 'artemisinin',
    pathwayFocus: 'mevalonate',
    mode: 'single',
    objective: 'biomass',
    glucoseUptake: 10,
    oxygenUptake: 20,
    knockouts: [],
    validity: 'real',
    runProvenance: makeProvenanceEntry('fbasim', 'real'),
    result: {
      growthRate: 0.87,
      atpYield: 30.5,
      nadhProduction: 12.3,
      carbonEfficiency: 0.72,
      feasible: true,
      sensitivityCoefficients: { glc: 0.45, o2: 0.32, atp: 0.23 },
      topFluxes: [
        { reactionId: 'PFK', flux: 8.5 },
        { reactionId: 'CS', flux: 6.2 },
        { reactionId: 'GAPD', flux: 5.1 },
      ],
    },
    updatedAt: Date.now(),
  };
}

function makeCETHXPayload(): CETHXWorkbenchPayload {
  return {
    toolId: 'cethx',
    targetProduct: 'artemisinin',
    pathway: 'glycolysis',
    tempC: 37,
    pH: 7.0,
    validity: 'partial',
    runProvenance: makeProvenanceEntry('cethx', 'partial'),
    result: {
      atpYield: 28,
      nadhYield: 10,
      gibbsFreeEnergy: -34.5,
      entropyProduction: 120.3,
      efficiency: 0.65,
      limitingStep: 'PFK',
    },
    updatedAt: Date.now(),
  };
}

function makeCatDesPayload(): CatalystWorkbenchPayload {
  return {
    toolId: 'catdes',
    targetProduct: 'artemisinin',
    selectedEnzymeId: 'P12345',
    selectedEnzymeName: 'Amorpha-4,11-diene synthase',
    requiredFlux: 5.0,
    designCount: 3,
    validity: 'real',
    runProvenance: makeProvenanceEntry('catdes', 'real'),
    result: {
      bindingKd: 0.45,
      overallBinding: 0.82,
      bestSequenceScore: 0.91,
      bestCAI: 0.78,
      totalMetabolicDrain: 0.15,
      growthPenalty: 0.03,
      isViable: true,
      bestPathway: 'mevalonate',
      topMutationSites: 4,
      recommendation: 'Proceed with directed evolution targeting positions 100, 132, 155, 201',
    },
    updatedAt: Date.now(),
  };
}

function makeCellFreePayload(): CellFreeWorkbenchPayload {
  return {
    toolId: 'cellfree',
    targetProduct: 'artemisinin',
    targetConstruct: 'pET28a-ADS',
    constructCount: 3,
    temperature: 37,
    simulationTime: 120,
    validity: 'partial',
    runProvenance: makeProvenanceEntry('cellfree', 'partial'),
    result: {
      totalProteinYield: 1.2,
      energyDepletionTime: 45,
      isResourceLimited: true,
      invitroMaxProtein: 2.5,
      invivoExpression: 0.8,
      confidence: 0.75,
      brendaOverrides: null,
    },
    updatedAt: Date.now(),
  };
}

function makeDynConPayload(): DynConWorkbenchPayload {
  return {
    toolId: 'dyncon',
    targetProduct: 'artemisinin',
    controller: { kp: 1.5, ki: 0.3, kd: 0.1, setpoint: 0.8 },
    hill: { vmax: 2.0, kd: 0.5, n: 2 },
    validity: 'real',
    runProvenance: makeProvenanceEntry('dyncon', 'real'),
    result: {
      productTiter: 5.2,
      productivity: 0.43,
      doRmse: 0.05,
      stable: true,
      burdenIndex: 0.12,
      currentFPP: 1.1,
      adsExpression: 0.9,
      rbsPart: 'BBa_B0034',
    },
    updatedAt: Date.now(),
  };
}

function makeMultiOPayload(): MultiOWorkbenchPayload {
  return {
    toolId: 'multio',
    targetProduct: 'artemisinin',
    selectedGene: 'ADS',
    activeView: 'pca',
    thresholds: { fc: 1.5, pv: 0.05 },
    validity: 'partial',
    runProvenance: makeProvenanceEntry('multio', 'partial'),
    result: {
      significantCount: 42,
      dominantLayer: 'transcriptomics',
      bottleneckGene: 'HMGR',
      bottleneckConfidence: 0.89,
      mofaVarianceExplained: 0.67,
      topEfficiencyGene: 'ADS',
      topEfficiencyScore: 0.95,
      vaeElbo: -1234.56,
    },
    updatedAt: Date.now(),
  };
}

function makePathDPayload(): PathDWorkbenchPayload {
  return {
    toolId: 'pathd',
    targetProduct: 'artemisinin',
    activeRouteLabel: 'mevalonate pathway',
    nodeCount: 7,
    edgeCount: 6,
    selectedNodeId: null,
    validity: 'real',
    runProvenance: makeProvenanceEntry('pathd', 'real'),
    result: {
      pathwayCandidates: 3,
      bottleneckCount: 1,
      enzymeCandidates: 5,
      thermodynamicConcerns: 0,
      highlightedNode: null,
      recommendedNextTool: 'fbasim',
      evidenceLinked: true,
    },
    updatedAt: Date.now(),
  };
}

function makeGenMIMPayload(): GenMIMWorkbenchPayload {
  return {
    toolId: 'genmim',
    targetProduct: 'artemisinin',
    efficiencyThreshold: 0.8,
    maxTargets: 10,
    protectEssential: true,
    validity: 'partial',
    runProvenance: makeProvenanceEntry('genmim', 'partial'),
    result: {
      selectedTargets: 6,
      growthImpact: 0.15,
      avgEfficiency: 0.85,
      offTargetRisk: 0.03,
      topGenes: ['geneA', 'geneB', 'geneC'],
    },
    updatedAt: Date.now(),
  };
}

function makeGECAIRPayload(): GECAIRWorkbenchPayload {
  return {
    toolId: 'gecair',
    targetProduct: 'artemisinin',
    gateType: 'AND',
    inputA: 1.0,
    inputB: 0.8,
    validity: 'real',
    runProvenance: makeProvenanceEntry('gecair', 'real'),
    result: {
      outputLevel: 0.75,
      nodeAOutput: 0.9,
      nodeBOutput: 0.85,
      noiseScore: 0.12,
      circuitComplexity: 3,
    },
    updatedAt: Date.now(),
  };
}

function makeProEvolPayload(): ProEvolWorkbenchPayload {
  return {
    toolId: 'proevol',
    targetProduct: 'artemisinin',
    campaignName: 'ADS-optimization',
    targetProtein: 'amorpha-4,11-diene synthase',
    wildTypeLabel: 'WT-ADS',
    currentRound: 3,
    totalRounds: 5,
    librarySize: 1000,
    survivorCount: 50,
    selectionStringency: 0.9,
    provenance: 'simulated',
    validity: 'real',
    runProvenance: makeProvenanceEntry('proevol', 'real'),
    result: {
      leadVariantName: 'ADS-v3',
      leadVariantScore: 0.92,
      leadMutationString: 'L100V/D132G',
      selectedThisRound: 12,
      rejectedThisRound: 38,
      diversityIndex: 0.65,
      convergenceState: 'approaching',
      recommendation: 'Continue to round 4',
    },
    updatedAt: Date.now(),
  };
}

function makeDBTLPayload(): DBTLWorkbenchPayload {
  return {
    toolId: 'dbtlflow',
    targetProduct: 'artemisinin',
    proposedPhase: 'test',
    draftHypothesis: 'Optimized ADS variant increases titer',
    measuredResult: 4.8,
    unit: 'g/L',
    passed: true,
    feedbackSource: 'committed',
    feedbackIterationId: 3,
    validity: 'real',
    runProvenance: makeProvenanceEntry('dbtlflow', 'real'),
    result: {
      bestIteration: 3,
      improvementRate: 0.25,
      passRate: 0.75,
      latestPhase: 'test',
    },
    updatedAt: Date.now(),
  };
}

function makeNEXAIPayload(): NEXAIWorkbenchPayload {
  return {
    toolId: 'nexai',
    targetProduct: 'artemisinin',
    query: 'artemisinin biosynthesis pathway optimization',
    validity: 'partial',
    runProvenance: makeProvenanceEntry('nexai', 'partial'),
    result: {
      confidence: 0.88,
      citations: 15,
      answerPreview: 'Recent advances in artemisinin biosynthesis engineering have focused on...',
      mode: 'pathway',
    },
    updatedAt: Date.now(),
  };
}

function makeScSpatialPayload(): ScSpatialWorkbenchPayload {
  return {
    toolId: 'scspatial',
    artifactId: 'test-artifact',
    targetProduct: 'artemisinin',
    source: 'bundled-demo',
    datasetMeta: { cellCount: 500, geneCount: 2000 },
    selectedCluster: null,
    selectedCellId: null,
    highlightGene: 'ADS',
    activeView: 'hexgrid',
    exportableArtifacts: [],
    validity: 'partial',
    runProvenance: makeProvenanceEntry('scspatial', 'partial'),
    result: {
      totalCells: 500,
      passedCells: 480,
      topSpatialGene: 'ADS',
      topMoranI: 0.72,
      highestYieldCluster: 'Cluster-2',
      hotspotCount: 3,
      clusterSummaries: [
        {
          clusterId: 0,
          clusterLabel: 'High expression',
          cellCount: 150,
          meanExpression: 3.5,
          fate: 'productive',
          topGenes: ['ADS', 'HMGR'],
        },
        {
          clusterId: 1,
          clusterLabel: 'Low expression',
          cellCount: 200,
          meanExpression: 1.2,
          fate: 'quiescent',
          topGenes: ['CYP71'],
        },
      ],
    },
    updatedAt: Date.now(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Run the full pipeline: collect data → render Markdown.
 */
function runPipeline(store: { toolPayloads: Record<string, unknown> }): string {
  const report = collectReportData(store);
  return renderMarkdown(report);
}

// ── Tests ────────────────────────────────────────────────────

describe('Report generation integration', () => {
  // 1. Full pipeline with multiple tool payloads → Markdown contains all section headers
  it('full pipeline with multiple tool payloads produces Markdown with all section headers', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
        cethx: makeCETHXPayload(),
        catdes: makeCatDesPayload(),
        cellfree: makeCellFreePayload(),
        dyncon: makeDynConPayload(),
        multio: makeMultiOPayload(),
        genmim: makeGenMIMPayload(),
        gecair: makeGECAIRPayload(),
        proevol: makeProEvolPayload(),
        dbtlflow: makeDBTLPayload(),
        nexai: makeNEXAIPayload(),
        pathd: makePathDPayload(),
        scspatial: makeScSpatialPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify H1 project title is present
    expect(md).toMatch(/^# Artemisinin Biosynthesis Report/m);

    // Verify all 13 tool section headers are present
    const expectedHeaders = [
      '## Flux Balance Analysis',
      '## Cell Thermodynamics',
      '## Catalyst Designer',
      '## Cell-Free Simulation',
      '## Dynamic Control',
      '## Multi-Omics Integration',
      '## Gene Minimization',
      '## Gene Circuit Reasoner',
      '## Protein Evolution',
      '## DBTL Cycle',
      '## NEXAI Research Agent',
      '## Pathway Designer',
      '## Single-Cell Spatial',
    ];

    for (const header of expectedHeaders) {
      expect(md).toContain(header);
    }

    // Verify summary mentions all 13 tools
    expect(md).toContain('13 tool');
  });

  // 2. Markdown contains table data from FBA fluxes
  it('Markdown contains table data from FBA fluxes', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify FBA flux table headers
    expect(md).toContain('Reaction');
    expect(md).toContain('Flux (mmol/gDW/h)');

    // Verify actual flux data rows from the payload
    expect(md).toContain('| PFK |');
    expect(md).toContain('8.50');
    expect(md).toContain('| CS |');
    expect(md).toContain('6.20');
    expect(md).toContain('| GAPD |');
    expect(md).toContain('5.10');

    // Verify sensitivity coefficient table
    expect(md).toContain('Sensitivity coefficients');
    expect(md).toContain('Glucose uptake');
    expect(md).toContain('0.45');
    expect(md).toContain('Oxygen uptake');
    expect(md).toContain('0.32');
    expect(md).toContain('ATP maintenance');
    expect(md).toContain('0.23');

    // Verify FBA content text
    expect(md).toContain('Growth rate');
    expect(md).toContain('0.87');
    expect(md).toContain('Carbon efficiency');
    expect(md).toContain('72');
  });

  // 3. Markdown contains provenance blockquotes
  it('Markdown contains provenance blockquotes for all sections', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
        cethx: makeCETHXPayload(),
        catdes: makeCatDesPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify provenance blockquote format for each tool
    expect(md).toContain('> **Data source:** fbasim');
    expect(md).toContain('> **Validity tier:** real');
    expect(md).toContain('> **Data source:** cethx');
    expect(md).toContain('> **Validity tier:** partial');
    expect(md).toContain('> **Data source:** catdes');

    // Verify assumptions are present in blockquotes
    expect(md).toContain('> **Assumptions:**');
    expect(md).toContain('assumption-fbasim-1');
    expect(md).toContain('output-fbasim-1');
  });

  // 4. Empty payloads → valid Markdown with no sections
  it('empty payloads produce valid Markdown with no sections', () => {
    const store = { toolPayloads: {} };
    const md = runPipeline(store);

    // Should still produce valid Markdown with project title
    expect(md).toContain('# Untitled Project');
    expect(md).toContain('Unknown');

    // No section headings
    expect(md).not.toMatch(/^## /m);

    // No table content
    expect(md).not.toContain('**Table');

    // No provenance blockquotes
    expect(md).not.toContain('> **Data source:**');

    // Should be a valid non-empty string
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(0);
  });

  // 5. Single tool payload → correct section count
  it('single tool payload produces exactly one section', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
      },
    };

    const report = collectReportData(store);

    // Verify exactly one section in the data model
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].toolId).toBe('fbasim');
    expect(report.sections[0].title).toBe('Flux Balance Analysis');

    // Verify metadata
    expect(report.metadata.targetProduct).toBe('artemisinin');
    expect(report.metadata.projectTitle).toBe('Artemisinin Biosynthesis Report');

    // Verify summary mentions 1 tool
    expect(report.summary).toContain('1 tool');

    // Verify rendered Markdown has exactly one H2 heading
    const md = runPipeline(store);
    const h2Matches = md.match(/^## /gm);
    expect(h2Matches).toHaveLength(1);
  });

  // ── Additional integration coverage ────────────────────────

  it('preserves section ordering from toolPayloads keys', () => {
    const store = {
      toolPayloads: {
        catdes: makeCatDesPayload(),
        fbasim: makeFBAPayload(),
        cethx: makeCETHXPayload(),
      },
    };

    const md = runPipeline(store);

    const catdesIdx = md.indexOf('## Catalyst Designer');
    const fbaIdx = md.indexOf('## Flux Balance Analysis');
    const cethxIdx = md.indexOf('## Cell Thermodynamics');

    // Order should match insertion order
    expect(catdesIdx).toBeLessThan(fbaIdx);
    expect(fbaIdx).toBeLessThan(cethxIdx);
  });

  it('renders tables with separator rows for proper Markdown structure', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
        cethx: makeCETHXPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify separator rows exist (Markdown table format)
    expect(md).toMatch(/\| --- \| --- \|/);
    expect(md).toMatch(/\| --- \| --- \| --- \|/);
  });

  it('generates table captions with sequential numbering', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
      },
    };

    const md = runPipeline(store);

    // FBA has 2 tables: top fluxes and sensitivity coefficients
    expect(md).toContain('**Table 1:');
    expect(md).toContain('**Table 2:');
  });

  it('derives targetProduct from first payload and propagates to metadata', () => {
    const store = {
      toolPayloads: {
        cethx: makeCETHXPayload(),
        fbasim: makeFBAPayload(),
      },
    };

    const report = collectReportData(store);

    // cethx comes first, so targetProduct should be derived from it
    expect(report.metadata.targetProduct).toBe('artemisinin');
    expect(report.metadata.projectTitle).toBe('Artemisinin Biosynthesis Report');
  });

  it('handles payloads with missing result gracefully in full pipeline', () => {
    const store = {
      toolPayloads: {
        fbasim: makeFBAPayload(),
        broken: {
          toolId: 'broken',
          targetProduct: 'artemisinin',
          validity: 'demo',
          result: null,
          updatedAt: Date.now(),
        },
        cethx: makeCETHXPayload(),
      },
    };

    const md = runPipeline(store);

    // The broken payload should be skipped
    expect(md).toContain('## Flux Balance Analysis');
    expect(md).toContain('## Cell Thermodynamics');
    // Only 2 sections rendered
    const h2Matches = md.match(/^## /gm);
    expect(h2Matches).toHaveLength(2);
    // Summary should mention 2 tools
    expect(md).toContain('2 tool');
  });

  it('renders CETHX thermodynamic table with correct metric values', () => {
    const store = {
      toolPayloads: {
        cethx: makeCETHXPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify thermodynamic table data
    expect(md).toContain('-34.5');
    expect(md).toContain('kJ/mol');
    expect(md).toContain('28.00');
    expect(md).toContain('mol/mol');
    expect(md).toContain('120.30');
    expect(md).toContain('J/(mol·K)');
    expect(md).toContain('65.0');
    expect(md).toContain('%');
  });

  it('CatDes section includes enzyme design metrics in rendered output', () => {
    const store = {
      toolPayloads: {
        catdes: makeCatDesPayload(),
      },
    };

    const md = runPipeline(store);

    // Verify enzyme design content
    expect(md).toContain('Amorpha-4,11-diene synthase');
    expect(md).toContain('P12345');
    expect(md).toContain('0.82');   // overallBinding
    expect(md).toContain('0.91');   // bestSequenceScore
    expect(md).toContain('Viable'); // isViable
    expect(md).toContain('mevalonate'); // bestPathway
  });
});
