/**
 * FBA single-gene-deletion essentiality on top of cobraModelAdapter (CC-2, T2).
 *
 * For each gene it parses every reaction's `gene_reaction_rule` (GPR), disables
 * the reactions whose GPR becomes unsatisfiable when that gene is absent, then
 * re-solves the repo's LP (reusing `cobraToLPModel` + `solveLP`) to get the
 * knockout growth. A gene is essential when its knockout growth < threshold.
 * This reproduces COBRApy `single_gene_deletion`.
 */
import { solveLP } from "../../server/highsSolver";
import { type CobraModel, cobraToLPModel } from "./cobraModelAdapter";

/** A gene entry in a COBRA JSON model. */
export interface CobraGene {
  id: string;
  name?: string;
}

/** A COBRA JSON model that also carries its gene list (needed for deletions). */
export interface CobraModelWithGenes extends CobraModel {
  genes: CobraGene[];
}

/**
 * Evaluate a `gene_reaction_rule` boolean expression given a gene-presence
 * predicate. Grammar (COBRA convention, lowercase operators):
 *   expr   := term ("or" term)*
 *   term   := factor ("and" factor)*
 *   factor := GENE | "(" expr ")"
 * An empty rule means the reaction is not gene-associated → always active (true).
 */
export function evaluateGPR(rule: string, isPresent: (gene: string) => boolean): boolean {
  const trimmed = rule.trim();
  if (trimmed === "") return true;

  const tokens = trimmed
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let pos = 0;
  const peek = (): string | undefined => tokens[pos];
  const isOp = (t: string | undefined, op: string): boolean => t !== undefined && t.toLowerCase() === op;

  function parseFactor(): boolean {
    const t = tokens[pos++];
    if (t === "(") {
      const v = parseExpr();
      if (peek() === ")") pos++;
      return v;
    }
    // A bare token is a gene identifier.
    return isPresent(t);
  }
  function parseTerm(): boolean {
    let v = parseFactor();
    while (isOp(peek(), "and")) {
      pos++;
      const r = parseFactor();
      v = v && r;
    }
    return v;
  }
  function parseExpr(): boolean {
    let v = parseTerm();
    while (isOp(peek(), "or")) {
      pos++;
      const r = parseTerm();
      v = v || r;
    }
    return v;
  }

  return parseExpr();
}

/** Reaction ids that go dead (GPR ⇒ false) when `deletedGenes` are removed. */
export function disabledReactionsForDeletion(model: CobraModel, deletedGenes: Set<string>): Set<string> {
  const disabled = new Set<string>();
  const isPresent = (gene: string): boolean => !deletedGenes.has(gene);
  for (const r of model.reactions) {
    const rule = r.gene_reaction_rule ?? "";
    if (rule.trim() === "") continue; // not gene-associated → never disabled
    if (!evaluateGPR(rule, isPresent)) disabled.add(r.id);
  }
  return disabled;
}

export interface GeneDeletionResult {
  wildTypeGrowth: number;
  /** Knockout growth keyed by gene id. */
  perGeneGrowth: Record<string, number>;
  /** Genes whose knockout growth < threshold, sorted ascending. */
  essentialGenes: string[];
}

/**
 * Run single-gene deletion over every gene in the model. Growth < `threshold`
 * (default 1e-6) marks a gene essential. The base LP is built once and only the
 * disabled reactions' bounds are zeroed per knockout.
 */
export async function runSingleGeneDeletion(
  model: CobraModelWithGenes,
  threshold = 1e-6,
): Promise<GeneDeletionResult> {
  const baseLP = cobraToLPModel(model);
  const baseBounds = baseLP.bounds ?? [];

  const growthWithDisabled = async (disabled: Set<string>): Promise<number> => {
    const bounds =
      disabled.size === 0
        ? baseBounds
        : baseBounds.map((b) => (disabled.has(b.name) ? { name: b.name, lb: 0, ub: 0 } : b));
    const sol = await solveLP({ ...baseLP, bounds });
    return sol.status === "optimal" ? sol.objectiveValue : 0;
  };

  const wildTypeGrowth = await growthWithDisabled(new Set());

  const perGeneGrowth: Record<string, number> = {};
  const essentialGenes: string[] = [];
  for (const g of model.genes) {
    const disabled = disabledReactionsForDeletion(model, new Set([g.id]));
    // Deleting a gene that disables no reaction cannot change the optimum.
    const growth = disabled.size === 0 ? wildTypeGrowth : await growthWithDisabled(disabled);
    perGeneGrowth[g.id] = growth;
    if (growth < threshold) essentialGenes.push(g.id);
  }
  essentialGenes.sort();

  return { wildTypeGrowth, perGeneGrowth, essentialGenes };
}
