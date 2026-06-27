import {
  generateOpentronsProtocol,
  generateManualProtocol,
  validateProtocol,
  type ProtocolStep,
} from '../src/services/instruments/protocolGenerator';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function step(overrides: Partial<ProtocolStep> = {}): ProtocolStep {
  return {
    type: 'transfer',
    description: 'Transfer reagent A to plate',
    reagent: 'LB broth',
    volume: 50,
    duration: 0,
    temperature: 0,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  generateOpentronsProtocol                                                 */
/* -------------------------------------------------------------------------- */

describe('generateOpentronsProtocol', () => {
  it('returns an empty-protocol stub when given zero steps', () => {
    const out = generateOpentronsProtocol([]);
    expect(out).toContain('Empty protocol');
    expect(out).toContain("apiLevel': '2.15'");
    expect(out).toContain('def run(');
  });

  it('emits correct metadata header and labware declarations', () => {
    const out = generateOpentronsProtocol([step()]);
    expect(out).toContain("protocolName': 'Nexus-Bio Generated Protocol'");
    expect(out).toContain("corning_96_wellplate_360ul_flat");
    expect(out).toContain("opentrons_96_tiprack_20ul");
    expect(out).toContain("p20_single_gen2");
  });

  it('translates a transfer step into a pipette.transfer call', () => {
    const out = generateOpentronsProtocol([
      step({ volume: 25, description: 'Move DNA template' }),
    ]);
    expect(out).toContain('pipette.transfer(25');
    expect(out).toContain('Step 1: Move DNA template');
  });

  it('translates a mix step into a pipette.mix call with cycle count', () => {
    const out = generateOpentronsProtocol([
      step({ type: 'mix', volume: 100, duration: 15, description: 'Vortex mix' }),
    ]);
    // 15 sec / 5 = 3 cycles, but min is 3
    expect(out).toContain('pipette.mix(3, 100');
  });

  it('translates an incubate step into a temperature module block', () => {
    const out = generateOpentronsProtocol([
      step({ type: 'incubate', temperature: 37, duration: 300, description: 'Incubate at 37C' }),
    ]);
    expect(out).toContain("load_module('temperature module gen2'");
    expect(out).toContain('temp_mod.set_temperature(37)');
    expect(out).toContain('protocol.delay(minutes=5)');
    expect(out).toContain('temp_mod.deactivate()');
  });

  it('translates a wait step into a protocol.delay call', () => {
    const out = generateOpentronsProtocol([
      step({ type: 'wait', duration: 120, description: 'Rest period' }),
    ]);
    expect(out).toContain('protocol.delay(minutes=2)');
    expect(out).toContain('Step 1: Rest period');
  });

  it('uses a generic transfer fallback for unknown step types', () => {
    const out = generateOpentronsProtocol([
      step({ type: 'custom_step', description: 'Unknown action' }),
    ]);
    expect(out).toContain('pipette.transfer(');
    expect(out).toContain('Step 1: Unknown action');
  });

  it('assigns sequential well positions across multiple steps', () => {
    const steps: ProtocolStep[] = [
      step({ description: 'Step A' }),
      step({ description: 'Step B' }),
      step({ description: 'Step C' }),
    ];
    const out = generateOpentronsProtocol(steps);
    // First transfer goes from A1 -> B1, second from B1 -> C1, etc.
    expect(out).toContain("source_plate['A1']");
    expect(out).toContain("dest_plate['B1']");
    expect(out).toContain("source_plate['B1']");
    expect(out).toContain("dest_plate['C1']");
  });
});

/* -------------------------------------------------------------------------- */
/*  generateManualProtocol                                                    */
/* -------------------------------------------------------------------------- */

describe('generateManualProtocol', () => {
  it('returns a placeholder message when given zero steps', () => {
    const out = generateManualProtocol([]);
    expect(out).toContain('No steps defined');
  });

  it('includes the header with date and step count', () => {
    const out = generateManualProtocol([step(), step()]);
    expect(out).toMatch(/Manual Protocol/);
    expect(out).toMatch(/Total steps: 2/);
  });

  it('formats each step with type, description, reagent, and volume', () => {
    const out = generateManualProtocol([
      step({ type: 'pipette', description: 'Add antibiotic', reagent: 'Ampicillin', volume: 10 }),
    ]);
    expect(out).toContain('Step 1  [PIPETTE]');
    expect(out).toContain('Add antibiotic');
    expect(out).toContain('Ampicillin');
    expect(out).toContain('10 uL');
  });

  it('formats duration in human-readable units', () => {
    const out = generateManualProtocol([
      step({ type: 'incubate', description: 'Shake flask', duration: 150 }),
    ]);
    // 150 sec = 2 min 30 sec
    expect(out).toContain('2 min 30 sec');
  });

  it('formats temperature when provided', () => {
    const out = generateManualProtocol([
      step({ type: 'heat', description: 'Heat shock', temperature: 42 }),
    ]);
    expect(out).toContain('42 °C');
  });

  it('omits volume, duration, and temperature lines when zero or not applicable', () => {
    const out = generateManualProtocol([
      step({ volume: 0, duration: 0, temperature: 0 }),
    ]);
    expect(out).not.toMatch(/Volume/);
    expect(out).not.toMatch(/Duration/);
    expect(out).not.toMatch(/Temperature/);
  });
});

/* -------------------------------------------------------------------------- */
/*  validateProtocol                                                          */
/* -------------------------------------------------------------------------- */

describe('validateProtocol', () => {
  it('rejects an empty steps array', () => {
    const result = validateProtocol([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/at least one step/);
  });

  it('accepts a single well-formed step', () => {
    const result = validateProtocol([step()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a step with empty type', () => {
    const result = validateProtocol([step({ type: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/type.*required/);
  });

  it('rejects a step with an unrecognised type', () => {
    const result = validateProtocol([step({ type: 'laser_blast' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Unrecognised type/);
  });

  it('rejects a step with empty description', () => {
    const result = validateProtocol([step({ description: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/description.*required/);
  });

  it('rejects a step with empty reagent', () => {
    const result = validateProtocol([step({ reagent: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/reagent.*required/);
  });

  it('rejects negative volume', () => {
    const result = validateProtocol([step({ volume: -5 })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-negative/);
  });

  it('rejects volume exceeding 1000 uL', () => {
    const result = validateProtocol([step({ volume: 1500 })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/exceeds maximum/);
  });

  it('rejects negative duration', () => {
    const result = validateProtocol([step({ duration: -10 })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/duration.*non-negative/);
  });

  it('rejects temperature outside -20 to 150 range (excluding 0)', () => {
    const tooHot = validateProtocol([step({ temperature: 200 })]);
    expect(tooHot.valid).toBe(false);
    expect(tooHot.errors[0]).toMatch(/between -20 and 150/);

    const tooCold = validateProtocol([step({ temperature: -50 })]);
    expect(tooCold.valid).toBe(false);
    expect(tooCold.errors[0]).toMatch(/between -20 and 150/);
  });

  it('allows temperature of 0 (room temperature / not set)', () => {
    const result = validateProtocol([step({ temperature: 0 })]);
    expect(result.valid).toBe(true);
  });

  it('detects consecutive duplicate steps', () => {
    const dupes = validateProtocol([
      step({ reagent: 'Buffer', volume: 100, type: 'transfer' }),
      step({ reagent: 'Buffer', volume: 100, type: 'transfer' }),
    ]);
    expect(dupes.valid).toBe(false);
    expect(dupes.errors[0]).toMatch(/Consecutive duplicate/);
  });

  it('reports multiple errors at once across different steps', () => {
    const result = validateProtocol([
      step({ type: '', description: '', reagent: '' }),
      step({ volume: -1, duration: -1, temperature: 999 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
