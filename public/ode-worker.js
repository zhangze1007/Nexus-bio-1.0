/**
 * ODE Worker — lightweight Michaelis-Menten ODE solver
 * Runs stoichiometric simulation off-main-thread to keep UI responsive.
 *
 * Input message:
 *   { edges: Array<{ id, Vmax, Km, deltaG }>, duration, steps }
 *
 * Output message:
 *   { fluxMap: Record<edgeId, flux> }
 */

/* eslint-disable no-restricted-globals */
self.onmessage = function handleMessage(e) {
  var data = e.data;
  var edges = data.edges || [];
  var duration = data.duration || 20;
  var steps = data.steps || 200;
  var dt = duration / steps;

  var fluxMap = {};

  for (var i = 0; i < edges.length; i++) {
    var edge = edges[i];
    var Vmax = edge.Vmax || 1.0;
    var Km = edge.Km || 0.5;
    var S0 = edge.S0 || 2.0;
    var deltaG = edge.deltaG || -20;

    // Thermodynamic driving factor: reactions with more negative ΔG have higher flux
    var thermoFactor = deltaG < 0 ? Math.min(Math.abs(deltaG) / 30, 2.0) : 0.1;

    // RK4 integration for substrate → product via Michaelis-Menten
    var S = S0;
    for (var step = 0; step < steps; step++) {
      var v = function(s) { return (Vmax * Math.max(0, s)) / (Km + Math.max(0, s)); };

      var k1 = -v(S);
      var k2 = -v(S + dt * k1 / 2);
      var k3 = -v(S + dt * k2 / 2);
      var k4 = -v(S + dt * k3);
      S = Math.max(0, S + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    }

    // Steady-state flux estimate: v at final substrate concentration, scaled by thermo factor
    var steadyV = (Vmax * Math.max(0, S)) / (Km + Math.max(0, S));
    fluxMap[edge.id] = parseFloat((steadyV * thermoFactor).toFixed(4));
  }

  self.postMessage({ fluxMap: fluxMap });
};
