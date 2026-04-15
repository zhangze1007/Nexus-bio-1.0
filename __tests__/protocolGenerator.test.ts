import { ProtocolGenerator } from '../src/utils/protocol-generator';
import type {
  DBTLIteration,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../src/types';

function makeIteration(overrides: Partial<DBTLIteration> = {}): DBTLIteration {
  return {
    id: 1,
    phase: 'Design',
    hypothesis: 'Test increased mevalonate loading',
    result: 120,
    unit: 'mg/L',
    passed: true,
    ...overrides,
  };
}

function makeGibsonPlan(fragmentCount: number): GibsonAssemblyPlan {
  return {
    targetName: 'pTest-construct',
    targetLength: 3000,
    fragments: Array.from({ length: fragmentCount }, (_, i) => ({
      id: `frag_${i + 1}`,
      index: i,
      sequence: 'ATCG'.repeat(100),
      length: 400,
      overlapFwd: 'ATCG'.repeat(8),
      overlapRev: 'CGAT'.repeat(8),
      gcContent: 0.5,
    })),
    primers: [],
    overlapLength: 30,
    expectedTmRange: [60, 62],
    tmSpread: 2,
    warnings: [],
    provenanceId: 'plan-uuid-0000',
  };
}

const provenance: ProvenanceRecord[] = [
  {
    uuid: 'uuid-aaa',
    designId: 'plan-uuid-0000',
    sampleType: 'fragment',
    label: 'frag_1 (400 bp)',
    well: 'A1',
    slot: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    uuid: 'uuid-bbb',
    designId: 'plan-uuid-0000',
    sampleType: 'fragment',
    label: 'frag_2 (400 bp)',
    well: 'B1',
    slot: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('ProtocolGenerator — Design phase', () => {
  const gen = new ProtocolGenerator();
  const protocol = gen.generate(makeIteration());

  it('sets metadata with phase and iteration id', () => {
    expect(protocol.api_version).toBe('2.15');
    expect(protocol.metadata.protocolName).toMatch(/^DBTL-Design-1_/);
  });

  it('emits Python using pipette keys as variable names', () => {
    // Validation would have thrown on generation if the emitter still used the
    // full 'p20_single_gen2' instrument string as a Python variable name.
    expect(protocol.python_code).toMatch(/^\s+p20 = protocol\.load_instrument\('p20_single_gen2',/m);
    expect(protocol.python_code).toMatch(/^\s+p300 = protocol\.load_instrument\('p300_single_gen2',/m);
  });

  it('assigns each pipette its own tip rack', () => {
    // p20 must receive the tiprack20 variable, p300 must receive tiprack300
    const p20Line = protocol.python_code.match(/p20 = protocol\.load_instrument\('p20_single_gen2'.*tip_racks=\[(\w+)\]/);
    const p300Line = protocol.python_code.match(/p300 = protocol\.load_instrument\('p300_single_gen2'.*tip_racks=\[(\w+)\]/);
    expect(p20Line?.[1]).toBe('tiprack20');
    expect(p300Line?.[1]).toBe('tiprack300');
  });

  it('resolves each aspirate/dispense to the declared source/destination well', () => {
    // Prior implementation sent every aspirate to the first labware's well A1.
    // We expect each source to resolve via wells_by_name with the true well id.
    expect(protocol.python_code).toContain("tuberack_1.wells_by_name()['A1']");
    expect(protocol.python_code).toContain("tuberack_1.wells_by_name()['A2']");
    expect(protocol.python_code).toContain("tuberack_1.wells_by_name()['B1']");
  });

  it('is deterministic — identical inputs produce byte-identical Python', () => {
    const again = gen.generate(makeIteration());
    expect(again.python_code).toBe(protocol.python_code);
  });

  it('initialises source wells with finite volume trackers', () => {
    expect(protocol.python_code).toContain("'reservoir_1:A1': 22000,");
    expect(protocol.python_code).toContain("'tuberack_1:A1': 15000,");
  });
});

describe('ProtocolGenerator — validation throws', () => {
  const gen = new ProtocolGenerator();

  it('rejects plate-scale requests beyond labware capacity', () => {
    expect(() => gen.generatePlateScale(makeIteration(), 200)).toThrow(/exceeds/);
  });

  it('rejects non-positive wellCount', () => {
    expect(() => gen.generatePlateScale(makeIteration(), 0)).toThrow(/positive integer/);
  });
});

describe('ProtocolGenerator — Gibson Assembly', () => {
  const gen = new ProtocolGenerator();

  it('caps the fragment count at the 15-tube rack', () => {
    expect(() => gen.generateGibsonAssembly(makeGibsonPlan(16), provenance)).toThrow(/tube rack capacity/);
  });

  it('lays fragments out row-major respecting the 3-row tube rack geometry', () => {
    const protocol = gen.generateGibsonAssembly(makeGibsonPlan(10), provenance);
    const aspirateSources = protocol.pipetting_logic
      .filter((s) => s.action === 'aspirate')
      .map((s) => s.source);
    // 15-tube rack is 3 rows × 5 cols. Row-major layout:
    // frag 0 → A1, 1 → B1, 2 → C1, 3 → A2, …, 8 → C3, 9 → A4
    expect(aspirateSources[0]).toBe('tuberack_1:A1');
    expect(aspirateSources[3]).toBe('tuberack_1:A2');
    expect(aspirateSources[8]).toBe('tuberack_1:C3');
    expect(aspirateSources[9]).toBe('tuberack_1:A4');
  });

  it('emits a deterministic provenance block sorted by createdAt then uuid', () => {
    const shuffled = [provenance[1], provenance[0]];
    const a = gen.generateGibsonAssembly(makeGibsonPlan(2), provenance);
    const b = gen.generateGibsonAssembly(makeGibsonPlan(2), shuffled);
    expect(a.python_code).toBe(b.python_code);
  });

  it('loads the temperature module when a tempplate role is declared', () => {
    const protocol = gen.generateGibsonAssembly(makeGibsonPlan(3), provenance);
    expect(protocol.python_code).toMatch(/temp_mod = protocol\.load_module\('temperature module gen2', 10\)/);
    expect(protocol.python_code).toContain('temp_mod.set_temperature(50)');
  });
});

describe('ProtocolGenerator — plate scale', () => {
  const gen = new ProtocolGenerator();

  it('fans destinations out across the plate row-major', () => {
    const protocol = gen.generatePlateScale(makeIteration(), 8);
    const destinations = protocol.pipetting_logic.map((s) => s.destination);
    // Each original step is replicated 8 times across A1..H1
    expect(destinations.slice(0, 8)).toEqual([
      'plate_1:A1', 'plate_1:B1', 'plate_1:C1', 'plate_1:D1',
      'plate_1:E1', 'plate_1:F1', 'plate_1:G1', 'plate_1:H1',
    ]);
  });
});
