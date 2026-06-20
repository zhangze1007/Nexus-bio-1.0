/**
 * Bioprocess Optimization Engine
 *
 * Optimizes fermentation parameters for scale-up from lab to bioreactor.
 * Models fed-batch dynamics, oxygen transfer, and nutrient feeding strategies.
 *
 * Reference: Garcia-Ochoa & Gomez (2009) Biotechnol Adv 27:153-176
 *
 * @scientific_provenance
 *   ALGORITHM: Monod kinetics + mass transfer + optimization
 *   KNOWN_LIMITATIONS:
 *     - No CFD modeling of bioreactor hydrodynamics
 *     - No real-time process control integration
 *     - Simplified heat transfer model
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BioprocessParameters {
  // Reactor geometry
  volume: number;              // L
  impellerDiameter: number;    // m
  agitationSpeed: number;      // rpm
  aerationRate: number;        // vvm (volume of gas per volume of liquid per minute)

  // Kinetic parameters
  muMax: number;               // max specific growth rate (h⁻¹)
  ks: number;                  // Monod constant (g/L)
  yieldCoeff: number;          // biomass yield on substrate (g/g)
  maintenanceCoeff: number;    // maintenance coefficient (g/g/h)

  // Environmental
  temperature: number;         // °C
  pH: number;
  dissolvedO2: number;         // % saturation

  // Feeding strategy
  feedConcentration: number;   // g/L
  feedRate: number;            // L/h
}

export interface BioprocessResult {
  finalBiomass: number;        // g/L
  finalProduct: number;        // g/L
  productivity: number;        // g/L/h
  yield: number;               // g/g substrate
  oxygenTransferRate: number;  // mmol/L/h
  agitationPower: number;      // W/L
  recommendations: string[];
  timeSeries: Array<{
    time: number;
    biomass: number;
    substrate: number;
    product: number;
    dissolvedO2: number;
  }>;
}

// ── Oxygen Transfer Model ───────────────────────────────────────────────────

/**
 * Compute oxygen transfer rate (OTR) using kLa correlation.
 *
 * kLa = a * (P/V)^b * (vvm)^c
 *
 * Reference: Garcia-Ochoa & Gomez (2009)
 */
function computeKLa(
  agitationSpeed: number,
  aerationRate: number,
  impellerDiameter: number,
  volume: number,
): number {
  // Power consumption (simplified)
  const powerInput = Math.pow(agitationSpeed, 3) * Math.pow(impellerDiameter, 5) / volume;

  // kLa correlation (simplified)
  const kla = 0.02 * Math.pow(powerInput, 0.4) * Math.pow(aerationRate, 0.5);

  return Math.round(kla * 100) / 100;
}

// ── Fed-Batch Simulation ────────────────────────────────────────────────────

/**
 * Simulate fed-batch fermentation.
 */
export function simulateFedBatch(params: BioprocessParameters, duration = 48): BioprocessResult {
  const dt = 0.1; // h
  const steps = Math.floor(duration / dt);

  let biomass = 0.5;     // g/L initial
  let substrate = 20;     // g/L initial glucose
  let product = 0;        // g/L
  let dissolvedO2 = 100;  // % saturation
  let volume = params.volume;

  const timeSeries: Array<{
    time: number;
    biomass: number;
    substrate: number;
    product: number;
    dissolvedO2: number;
  }> = [];

  const kla = computeKLa(params.agitationSpeed, params.aerationRate, params.impellerDiameter, params.volume);

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;

    // Monod growth rate
    const mu = params.muMax * substrate / (params.ks + substrate);

    // Oxygen limitation
    const o2Limit = dissolvedO2 / (dissolvedO2 + 0.5); // simplified

    // Growth
    const growthRate = mu * biomass * o2Limit;

    // Substrate consumption
    const substrateConsumption = (growthRate / params.yieldCoeff) + params.maintenanceCoeff * biomass;

    // Fed-batch feeding
    const feedSubstrate = params.feedRate * params.feedConcentration / volume;

    // Oxygen dynamics
    const oxygenConsumption = growthRate * 0.5; // simplified
    const oxygenTransfer = kla * (100 - dissolvedO2) * 0.01;

    // Product formation (simplified Luedeking-Piret)
    const productFormation = 0.1 * growthRate + 0.01 * biomass;

    // Update states
    biomass += (growthRate - 0.01 * biomass) * dt; // 0.01 = death rate
    substrate += (feedSubstrate - substrateConsumption) * dt;
    product += productFormation * dt;
    dissolvedO2 += (oxygenTransfer - oxygenConsumption) * dt;
    volume += params.feedRate * dt;

    // Clamp
    biomass = Math.max(0, biomass);
    substrate = Math.max(0, substrate);
    product = Math.max(0, product);
    dissolvedO2 = Math.max(0, Math.min(100, dissolvedO2));

    if (step % Math.floor(1 / dt) === 0) { // record every hour
      timeSeries.push({
        time: Math.round(t * 10) / 10,
        biomass: Math.round(biomass * 100) / 100,
        substrate: Math.round(substrate * 100) / 100,
        product: Math.round(product * 100) / 100,
        dissolvedO2: Math.round(dissolvedO2 * 10) / 10,
      });
    }
  }

  // Compute metrics
  const finalBiomass = timeSeries[timeSeries.length - 1]?.biomass ?? 0;
  const finalProduct = timeSeries[timeSeries.length - 1]?.product ?? 0;
  const productivity = finalProduct / duration;
  const totalSubstrateConsumed = 20 + params.feedRate * params.feedConcentration * duration / params.volume - (timeSeries[timeSeries.length - 1]?.substrate ?? 0);
  const yieldVal = totalSubstrateConsumed > 0 ? finalProduct / totalSubstrateConsumed : 0;

  // Recommendations
  const recommendations: string[] = [];
  if (dissolvedO2 < 20) recommendations.push('Increase agitation or aeration — O2 is limiting');
  if (substrate > 10) recommendations.push('Reduce feed rate — substrate accumulation detected');
  if (productivity < 0.1) recommendations.push('Consider higher muMax strain or optimized feeding strategy');

  return {
    finalBiomass: Math.round(finalBiomass * 100) / 100,
    finalProduct: Math.round(finalProduct * 100) / 100,
    productivity: Math.round(productivity * 1000) / 1000,
    yield: Math.round(yieldVal * 1000) / 1000,
    oxygenTransferRate: Math.round(kla * 100) / 100,
    agitationPower: Math.round(Math.pow(params.agitationSpeed, 3) * Math.pow(params.impellerDiameter, 5) / params.volume * 100) / 100,
    recommendations,
    timeSeries,
  };
}
