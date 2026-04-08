function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(digits);
}

function joinConcentrations(values: number[]) {
  return values.map((value) => `${formatNumber(value, value >= 1 ? 2 : 3)} mM`).join(', ');
}

export function buildThermodynamicFallbackInterpretation({
  nodeLabel,
  dG0,
  dG,
  keq,
  spontaneous,
  sim,
  temperatureKelvin,
  productConcentrations,
  reactantConcentrations,
  substrateStart,
}: {
  nodeLabel: string;
  dG0: number;
  dG: number;
  keq: number;
  spontaneous: boolean;
  sim: ReturnType<typeof import('./thermodynamics').calcMassBalance>;
  temperatureKelvin: number;
  productConcentrations: number[];
  reactantConcentrations: number[];
  substrateStart: number;
}) {
  const finalSubstrate = sim.S[sim.S.length - 1] ?? substrateStart;
  const finalProduct = sim.P[sim.P.length - 1] ?? 0;
  const regime = Math.abs(dG) >= 20
    ? 'strongly displaced from equilibrium'
    : Math.abs(dG) >= 5
      ? 'meaningfully displaced from equilibrium'
      : 'near thermodynamic equilibrium';
  const recommendedAction = spontaneous
    ? 'Validate the forward-driving concentration window experimentally and pair it with downstream capture or turnover measurements.'
    : 'Increase reactant availability, lower product accumulation, or couple the step to a more favorable reaction before treating it as a forward-driving control point.';

  return [
    'Summary',
    `${nodeLabel} is ${spontaneous ? 'thermodynamically favorable' : 'not thermodynamically favorable'} under the current concentrations, with ΔG = ${formatNumber(dG)} kJ/mol and ΔG° = ${formatNumber(dG0)} kJ/mol at ${(temperatureKelvin - 273.15).toFixed(1)}°C.`,
    '',
    'Key observations',
    `- The equilibrium constant is ${keq.toExponential(2)}, indicating a ${spontaneous ? 'product-favored' : 'reactant-favored'} landscape under standard conditions.`,
    `- The simulated mass-balance trace moves substrate from ${formatNumber(substrateStart)} mM toward ${formatNumber(finalSubstrate, 3)} mM while product approaches ${formatNumber(finalProduct, 3)} mM.`,
    `- The supplied reaction quotient uses products at ${joinConcentrations(productConcentrations)} and reactants at ${joinConcentrations(reactantConcentrations)}.`,
    '',
    'Interpretation',
    `This step is ${regime}, so the current concentration regime should ${spontaneous ? 'support forward flux through the metabolite pool' : 'limit forward flux unless the pathway is actively coupled or rebalanced'}. In practical pathway terms, ${nodeLabel} is ${spontaneous ? 'unlikely to be blocked by thermodynamics alone' : 'a credible thermodynamic bottleneck candidate'} at the tested state.`,
    '',
    'Recommended next steps',
    `- ${recommendedAction}`,
    `- Re-run the thermodynamic check after perturbing the product:reactant ratio to see how sensitive this node is to concentration control.`,
    `- Compare this node against neighboring metabolites so the pathway handoff focuses on the most constraining step rather than a single static condition.`,
  ].join('\n');
}

export function buildKineticFallbackInterpretation({
  nodeLabel,
  vmax,
  km,
  substrate,
  duration,
  finalSubstrate,
  finalProduct,
  peakVelocity,
  steadyVelocity,
  inhibited,
  inhibitorStrength,
  inhibitorConcentration,
}: {
  nodeLabel: string;
  vmax: number;
  km: number;
  substrate: number;
  duration: number;
  finalSubstrate: number;
  finalProduct: number;
  peakVelocity: number;
  steadyVelocity: number;
  maxVelocity: number;
  inhibited: boolean;
  inhibitorStrength: number;
  inhibitorConcentration: number;
}) {
  const saturationRatio = km > 0 ? substrate / km : substrate;
  const saturationTone = saturationRatio >= 2
    ? 'well above Km, so the enzyme begins in a high-saturation regime'
    : saturationRatio >= 0.5
      ? 'near Km, so flux is sensitive to substrate availability'
      : 'below Km, so flux remains strongly substrate-limited';
  const inhibitorLine = inhibited
    ? `Competitive inhibition is active at Ki = ${formatNumber(inhibitorStrength)} mM and [I] = ${formatNumber(inhibitorConcentration)} mM, which suppresses effective flux relative to the uninhibited curve.`
    : 'No inhibitor is applied in this run, so the trajectory reflects the baseline catalytic window only.';
  const nextStep = inhibited
    ? 'Titrate inhibitor concentration against substrate around Km to map how strongly this step can throttle pathway throughput.'
    : 'Perturb substrate around Km and compare the simulated steady-state window against experimental rates to validate whether this node is enzyme-limited.';

  return [
    'Summary',
    `${nodeLabel} reaches a peak velocity of ${formatNumber(peakVelocity, 3)} μmol/min/mg and settles near ${formatNumber(steadyVelocity, 3)} μmol/min/mg over ${duration} minutes, indicating ${steadyVelocity > peakVelocity * 0.7 ? 'a relatively sustained catalytic regime' : 'a transient burst followed by a lower steady-state flux'}.`,
    '',
    'Key observations',
    `- Vmax is ${formatNumber(vmax)} μmol/min/mg and Km is ${formatNumber(km)} mM, with the starting substrate pool at ${formatNumber(substrate)} mM.`,
    `- Substrate declines to ${formatNumber(finalSubstrate, 3)} mM while product accumulates to ${formatNumber(finalProduct, 3)} mM in the simulated interval.`,
    `- The starting substrate level is ${saturationTone}.`,
    '',
    'Interpretation',
    `${inhibitorLine} The separation between peak and steady-state velocity suggests the pathway will ${steadyVelocity > peakVelocity * 0.8 ? 'maintain flux once the reaction starts' : 'lose flux as substrate is depleted or downstream balance changes'}, so this node should be evaluated as a ${steadyVelocity < peakVelocity * 0.5 ? 'potential dynamic control point' : 'reasonably stable catalytic step'} rather than by peak rate alone.`,
    '',
    'Recommended next steps',
    `- ${nextStep}`,
    `- Compare simulated product accumulation against upstream supply assumptions before using this node as the main bottleneck diagnosis.`,
    `- If this enzyme is a pathway handoff candidate, repeat the run with altered formation and degradation terms to test robustness under pathway-scale flux changes.`,
  ].join('\n');
}
