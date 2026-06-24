/**
 * HiGHS LP Solver Wrapper
 *
 * Wraps the highs-js WASM solver (MIT license, University of Edinburgh)
 * behind a clean typed interface for FBA and metabolic engineering.
 *
 * Converts a structured LPModel into CPLEX .lp format, solves via HiGHS,
 * and extracts primals (variable values) and duals (shadow prices).
 */

import highsLoader from 'highs';
import type { HighsSolution } from 'highs';

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

export interface LPVariable {
  name: string;
  coef: number;
}

export interface LPConstraint {
  name: string;
  vars: LPVariable[];
  lb: number;
  ub: number;
}

export interface LPBound {
  name: string;
  lb: number;
  ub: number;
}

/**
 * Quadratic objective term for QP support.
 * Represents `coef * var1 * var2` in the quadratic part of the objective.
 * For diagonal terms (squared), set var1 === var2.
 */
export interface QPTerm {
  var1: string;
  var2: string;
  coef: number;
}

export interface LPModel {
  name?: string;
  sense: 'minimize' | 'maximize';
  objective: LPVariable[];
  constraints: LPConstraint[];
  bounds?: LPBound[];
  binaries?: string[];   // variable names that must be binary (0 or 1)
  integers?: string[];   // variable names that must be integer
  /**
   * Quadratic objective terms. When present, the objective becomes:
   *   linear (from `objective`) + quadratic (from `quadratic`)
   * HiGHS supports QP natively via CPLEX LP `[ Quadratic ]` section.
   */
  quadratic?: QPTerm[];
}

export interface LPSolution {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  objectiveValue: number;
  primals: Record<string, number>;
  duals: Record<string, number>;
  solveTime: number;
}

/* ------------------------------------------------------------------ */
/*  HiGHS singleton (lazy init — WASM loads once)                      */
/* ------------------------------------------------------------------ */

let highsInstance: Awaited<ReturnType<typeof highsLoader>> | null = null;

async function getHighs() {
  if (!highsInstance) {
    highsInstance = await highsLoader();
  }
  return highsInstance;
}

/* ------------------------------------------------------------------ */
/*  CPLEX LP format builder                                           */
/* ------------------------------------------------------------------ */

/**
 * Escape a variable or constraint name for CPLEX LP format.
 * Names containing special characters must be quoted.
 */
function escapeName(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return name;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Format a single term: coefficient * variable name.
 * Handles sign, 0-coefficient omission, and 1/-1 coefficient display.
 */
function formatTerm(coef: number, name: string): string {
  const escaped = escapeName(name);
  if (coef === 0) return '';
  if (coef === 1) return `+ ${escaped}`;
  if (coef === -1) return `- ${escaped}`;
  if (coef > 0) return `+ ${coef} ${escaped}`;
  return `- ${Math.abs(coef)} ${escaped}`;
}

function formatObjectiveTerm(coef: number, name: string): string {
  const escaped = escapeName(name);
  if (coef === 0) return '';
  if (coef === 1) return escaped;
  if (coef === -1) return `- ${escaped}`;
  if (coef > 0) return `${coef} ${escaped}`;
  return `- ${Math.abs(coef)} ${escaped}`;
}

/**
 * Build a CPLEX .lp format string from an LPModel.
 *
 * Format reference: http://web.mit.edu/lpsolve/doc/CPLEX-format.htm
 */
function buildLPString(model: LPModel): string {
  const lines: string[] = [];

  // Objective section
  const senseStr = model.sense === 'maximize' ? 'Maximize' : 'Minimize';
  const objName = model.name ? escapeName(model.name) : 'obj';
  lines.push(senseStr);
  lines.push(` ${objName}:`);

  // Build objective line, handling first term sign
  const objTerms = model.objective
    .filter((v) => v.coef !== 0)
    .map((v) => formatObjectiveTerm(v.coef, v.name));

  if (objTerms.length > 0) {
    // First term: don't add '+' prefix
    let firstLine = `    ${objTerms[0]}`;
    for (let i = 1; i < objTerms.length; i++) {
      const term = objTerms[i];
      if (term.startsWith('-')) {
        firstLine += ` ${term}`;
      } else {
        firstLine += ` + ${term}`;
      }
    }
    lines.push(firstLine);
  } else {
    lines.push('    0');
  }

  // Subject To section
  lines.push('Subject To');
  for (const con of model.constraints) {
    const conName = escapeName(con.name);
    const terms = con.vars
      .filter((v) => v.coef !== 0)
      .map((v) => formatTerm(v.coef, v.name));

    let expr: string;
    if (terms.length === 0) {
      expr = '0';
    } else {
      // Join terms, handling spacing
      expr = terms.join(' ');
      // Remove leading '+ ' if present
      expr = expr.replace(/^\+\s*/, '');
    }

    // Handle bounds: equality or range constraint
    const hasRange = con.lb !== con.ub;

    if (!hasRange) {
      // Equality: c1: expr = value
      lines.push(` ${conName}: ${expr} = ${con.lb}`);
    } else if (con.ub === Infinity && con.lb > -Infinity) {
      // Single lower bound: c1: expr >= lb
      lines.push(` ${conName}: ${expr} >= ${con.lb}`);
    } else if (con.lb === -Infinity && con.ub < Infinity) {
      // Single upper bound: c1: expr <= ub
      lines.push(` ${conName}: ${expr} <= ${con.ub}`);
    } else {
      // Range: use two constraints
      if (con.lb > -Infinity) {
        lines.push(` ${conName}_lb: ${expr} >= ${con.lb}`);
      }
      if (con.ub < Infinity) {
        lines.push(` ${conName}_ub: ${expr} <= ${con.ub}`);
      }
    }
  }

  // Quadratic section — for QP support (HiGHS CPLEX LP format)
  if (model.quadratic && model.quadratic.length > 0) {
    const objName = model.name ? escapeName(model.name) : 'obj';
    const qTerms = model.quadratic
      .filter((t) => t.coef !== 0)
      .map((t) => {
        const v1 = escapeName(t.var1);
        const v2 = escapeName(t.var2);
        if (t.var1 === t.var2) {
          // Diagonal: [ coef var ^ 2 ] or [ var ^ 2 ] when coef=1
          if (t.coef === 1) return `[ ${v1} ^ 2 ]`;
          return `[ ${t.coef} ${v1} ^ 2 ]`;
        }
        // Cross term: [ coef var1 * var2 ]
        if (t.coef === 1) return `[ ${v1} * ${v2} ]`;
        return `[ ${t.coef} ${v1} * ${v2} ]`;
      });
    if (qTerms.length > 0) {
      lines.push('Quadratic');
      lines.push(` ${objName}: ${qTerms.join(' + ')}`);
    }
  }

  // Bounds section
  const boundedVars = new Set<string>();
  if (model.bounds) {
    for (const b of model.bounds) {
      boundedVars.add(b.name);
    }
  }

  // Also collect all variable names from objective and constraints
  const allVarNames = new Set<string>();
  for (const v of model.objective) {
    allVarNames.add(v.name);
  }
  for (const c of model.constraints) {
    for (const v of c.vars) {
      allVarNames.add(v.name);
    }
  }

  // Emit bounds for all variables
  // Default in CPLEX LP is 0 <= x <= +inf, so we only need to emit non-default bounds
  const boundsNeeded =
    (model.bounds && model.bounds.length > 0) ||
    [...allVarNames].some((name) => {
      const b = model.bounds?.find((bb) => bb.name === name);
      return b && (b.lb !== 0 || b.ub !== Infinity);
    });

  if (boundsNeeded || [...allVarNames].some((name) => {
    const b = model.bounds?.find((bb) => bb.name === name);
    return b && b.lb < 0;
  })) {
    lines.push('Bounds');
    for (const name of allVarNames) {
      const b = model.bounds?.find((bb) => bb.name === name);
      if (b) {
        const lbStr = b.lb === -Infinity ? '-inf' : String(b.lb);
        const ubStr = b.ub === Infinity ? '+inf' : String(b.ub);
        if (b.lb !== 0 || b.ub !== Infinity) {
          lines.push(` ${lbStr} <= ${escapeName(name)} <= ${ubStr}`);
        }
      }
    }
  }

  // Binary section — variables restricted to {0, 1}
  if (model.binaries && model.binaries.length > 0) {
    lines.push('Binary');
    for (const varName of model.binaries) {
      lines.push(`  ${escapeName(varName)}`);
    }
  }

  // General section — variables restricted to integer values
  if (model.integers && model.integers.length > 0) {
    lines.push('General');
    for (const varName of model.integers) {
      lines.push(`  ${escapeName(varName)}`);
    }
  }

  lines.push('End');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
/* ------------------------------------------------------------------ */

function mapStatus(
  highsStatus: string,
): 'optimal' | 'infeasible' | 'unbounded' | 'error' {
  switch (highsStatus) {
    case 'Optimal':
      return 'optimal';
    case 'Infeasible':
    case 'Primal infeasible or unbounded':
      return 'infeasible';
    case 'Unbounded':
      return 'unbounded';
    case 'Time limit reached':
    case 'Iteration limit reached':
    case 'Bound on objective reached':
    case 'Target for objective reached':
      return 'infeasible'; // treat as non-optimal
    default:
      return 'error'; // Load error, Model error, Presolve error, etc.
  }
}

/* ------------------------------------------------------------------ */
/*  Public solver                                                      */
/* ------------------------------------------------------------------ */

/**
 * Solve a linear program using the HiGHS WASM solver.
 *
 * @param model - Structured LP model definition
 * @returns Typed solution with primals (variable values) and duals (shadow prices)
 */
export async function solveLP(model: LPModel): Promise<LPSolution> {
  const startTime = performance.now();

  const highs = await getHighs();
  const lpString = buildLPString(model);

  let solution: HighsSolution;
  try {
    solution = highs.solve(lpString, {
      output_flag: false,
      log_to_console: false,
    });
  } catch (err) {
    const solveTime = performance.now() - startTime;
    console.error('[HiGHS] solve() threw:', err instanceof Error ? err.message : err);
    return {
      status: 'error',
      objectiveValue: 0,
      primals: {},
      duals: {},
      solveTime,
    };
  }

  const solveTime = performance.now() - startTime;

  // Extract primals and duals from columns
  const primals: Record<string, number> = {};
  const duals: Record<string, number> = {};

  if (solution.Columns) {
    for (const [name, col] of Object.entries(solution.Columns)) {
      primals[name] = col.Primal ?? 0;
      // Dual is available on linear solutions
      if ('Dual' in col) {
        duals[name] = (col as { Dual: number }).Dual ?? 0;
      }
    }
  }

  // Extract constraint duals from rows
  if (solution.Rows && Array.isArray(solution.Rows)) {
    for (const row of solution.Rows) {
      if ('Dual' in row && row.Name) {
        duals[row.Name] = (row as { Dual: number }).Dual ?? 0;
      }
    }
  }

  return {
    status: mapStatus(solution.Status),
    objectiveValue: solution.ObjectiveValue ?? 0,
    primals,
    duals,
    solveTime,
  };
}
