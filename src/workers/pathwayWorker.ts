/**
 * Nexus-Bio 2.0 — Pathway Web Worker
 *
 * All O(n²) computations offloaded here so the main thread INP stays ≤ 50ms.
 * - Force-directed Fruchterman–Reingold layout
 * - Pathway statistical aggregation
 */

export type WorkerInMessage =
  | {
      type: 'COMPUTE_LAYOUT';
      nodes: Array<{ id: string; position?: [number, number, number] }>;
      edges: Array<{ start: string; end: string }>;
      iterations?: number;
    }
  | {
      type: 'COMPUTE_STATS';
      nodes: Array<{
        confidenceScore?: number;
        risk_score?: number;
        separation_cost_index?: number;
        carbon_efficiency?: number;
        nodeType?: string;
      }>;
    };

export type WorkerOutMessage =
  | { type: 'LAYOUT_DONE'; positions: Record<string, [number, number, number]> }
  | {
      type: 'STATS_DONE';
      avgConfidence: number;
      highRiskCount: number;
      avgRisk: number;
      avgCarbonEfficiency: number;
      avgSeparationCost: number;
      nodeTypeCounts: Record<string, number>;
    };

function computeLayout(
  nodes: Array<{ id: string; position?: [number, number, number] }>,
  edges: Array<{ start: string; end: string }>,
  iterations: number,
): Record<string, [number, number, number]> {
  const n = nodes.length;
  if (n === 0) return {};

  const pos = new Map<string, [number, number, number]>();
  nodes.forEach((node, i) => {
    if (node.position && node.position.some((v) => v !== 0)) {
      pos.set(node.id, [...node.position] as [number, number, number]);
    } else {
      const phi = i * 2.399963;
      const r = 3.8 * Math.sqrt(i + 1);
      pos.set(node.id, [r * Math.cos(phi), (((i * 1.618) % 5) - 2.5) * 1.5, r * Math.sin(phi)]);
    }
  });

  const ids = nodes.map((nd) => nd.id);
  const k = Math.sqrt((80 * 80) / Math.max(n, 1));
  const vel = new Map<string, [number, number, number]>();
  ids.forEach((id) => vel.set(id, [0, 0, 0]));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 4 * (1 - iter / iterations);

    for (let a = 0; a < n - 1; a++) {
      for (let b = a + 1; b < n; b++) {
        const pa = pos.get(ids[a])!;
        const pb = pos.get(ids[b])!;
        const dx = pa[0] - pb[0], dy = pa[1] - pb[1], dz = pa[2] - pb[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const force = (k * k) / (dist * dist);
        const fa = vel.get(ids[a])!, fb = vel.get(ids[b])!;
        fa[0] += (dx / dist) * force; fa[1] += (dy / dist) * force; fa[2] += (dz / dist) * force;
        fb[0] -= (dx / dist) * force; fb[1] -= (dy / dist) * force; fb[2] -= (dz / dist) * force;
      }
    }

    for (const edge of edges) {
      const pa = pos.get(edge.start), pb = pos.get(edge.end);
      if (!pa || !pb) continue;
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const force = (dist * dist) / k;
      const fa = vel.get(edge.start)!, fb = vel.get(edge.end)!;
      fa[0] += (dx / dist) * force; fa[1] += (dy / dist) * force; fa[2] += (dz / dist) * force;
      fb[0] -= (dx / dist) * force; fb[1] -= (dy / dist) * force; fb[2] -= (dz / dist) * force;
    }

    for (const id of ids) {
      const p = pos.get(id)!, v = vel.get(id)!;
      const speed = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) + 0.001;
      const clamped = Math.min(speed, temp);
      p[0] += (v[0] / speed) * clamped;
      p[1] += (v[1] / speed) * clamped * 0.4;
      p[2] += (v[2] / speed) * clamped;
      v[0] = 0; v[1] = 0; v[2] = 0;
    }
  }

  const result: Record<string, [number, number, number]> = {};
  pos.forEach((p, id) => { result[id] = p; });
  return result;
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'COMPUTE_LAYOUT') {
    const positions = computeLayout(msg.nodes, msg.edges, msg.iterations ?? 60);
    self.postMessage({ type: 'LAYOUT_DONE', positions });
    return;
  }

  if (msg.type === 'COMPUTE_STATS') {
    const nodes = msg.nodes;
    const n = nodes.length;
    if (n === 0) {
      self.postMessage({ type: 'STATS_DONE', avgConfidence: 0, highRiskCount: 0, avgRisk: 0, avgCarbonEfficiency: 0, avgSeparationCost: 0, nodeTypeCounts: {} });
      return;
    }
    let sumConf = 0, sumRisk = 0, sumCarbon = 0, sumSep = 0, highRiskCount = 0;
    const typeCounts: Record<string, number> = {};
    for (const nd of nodes) {
      sumConf   += nd.confidenceScore ?? 0.78;
      sumRisk   += nd.risk_score ?? 0;
      sumCarbon += nd.carbon_efficiency ?? 0;
      sumSep    += nd.separation_cost_index ?? 0;
      if ((nd.risk_score ?? 0) > 0.7) highRiskCount++;
      const t = nd.nodeType ?? 'unknown';
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    self.postMessage({ type: 'STATS_DONE', avgConfidence: sumConf / n, highRiskCount, avgRisk: sumRisk / n, avgCarbonEfficiency: sumCarbon / n, avgSeparationCost: sumSep / n, nodeTypeCounts: typeCounts });
    return;
  }
};
