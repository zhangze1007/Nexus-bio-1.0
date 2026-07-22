/**
 * Shared unit-normalization table — the single source for cross-tool unit
 * conversion used by P0-2 pairing (`matchRecords`) and P1-3 record QC.
 *
 * Linear families convert by a multiplicative factor; incompatible units return
 * null (never a silent wrong conversion). The families deliberately exclude
 * instrument-relative units (e.g. RFU) so that P0-2's "un-normalizable →
 * inconclusive" behavior is preserved. A small set of NONLINEAR optical
 * conversions (OD ↔ %transmittance) is handled by {@link normalizeUnit}.
 */

/** Mass-concentration family, base mg/L (identical to the original matchRecords table). */
const MASS_CONC: Record<string, number> = {
  "g/l": 1000,
  "mg/l": 1,
  "ug/l": 0.001,
  "ng/l": 1e-6,
};

/** Molar family, base mmol/L. */
const MOLAR: Record<string, number> = {
  "mol/l": 1000,
  "mmol/l": 1,
  "umol/l": 0.001,
  "nmol/l": 1e-6,
};

/** Volume family, base µL. */
const VOLUME: Record<string, number> = {
  l: 1e6,
  ml: 1000,
  ul: 1,
  nl: 1e-3,
};

const LINEAR_FAMILIES: Array<Record<string, number>> = [MASS_CONC, MOLAR, VOLUME];

/** Normalize a unit string: trim, lowercase, micro sign (μ/µ) → u, drop whitespace. */
export function canonicalUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/μ|µ/g, "u")
    .replace(/\s+/g, "");
}

/**
 * Multiplicative factor to convert `from`→`to` within a linear family; null if
 * the units are the same-canonical (returns 1) is handled first, and null when
 * they belong to different families or are unknown.
 */
export function normalizeFactor(from: string, to: string): number | null {
  const f = canonicalUnit(from);
  const t = canonicalUnit(to);
  if (f === t) return 1;
  for (const family of LINEAR_FAMILIES) {
    if (f in family && t in family) return family[f] / family[t];
  }
  return null;
}

/** Convert `value` from `from`→`to`, or null when the units cannot be normalized. */
export function convertOrNull(value: number, from: string, to: string): number | null {
  const factor = normalizeFactor(from, to);
  return factor === null ? null : value * factor;
}

const OD_UNITS = new Set(["od", "au", "abs", "absorbance"]);
const T_UNITS = new Set(["%t", "pct", "%transmittance", "percenttransmittance", "transmittance"]);

/** Nonlinear optical conversion OD ↔ %transmittance (A = -log10(T/100)); null if N/A. */
function opticalConvert(value: number, from: string, to: string): number | null {
  if (OD_UNITS.has(from) && T_UNITS.has(to)) return 100 * 10 ** -value;
  if (T_UNITS.has(from) && OD_UNITS.has(to)) return -Math.log10(Math.max(value, 1e-9) / 100);
  return null;
}

/**
 * Public normalization used before pairing/QC. Converts via a linear factor when
 * possible, then the nonlinear optical relation; if the units are incompatible
 * it returns the value unchanged (callers are expected to canonicalize via
 * {@link canonicalUnitFor} first). Use {@link convertOrNull} when you need to
 * detect incompatibility.
 */
export function normalizeUnit(value: number, from: string, to: string): number {
  const f = canonicalUnit(from);
  const t = canonicalUnit(to);
  if (f === t) return value;
  const factor = normalizeFactor(from, to);
  if (factor !== null) return value * factor;
  const optical = opticalConvert(value, f, t);
  if (optical !== null) return optical;
  return value;
}

/** Canonical reporting unit for an assay type (empty string = no canonical unit). */
export function canonicalUnitFor(assayType: string): string {
  switch (assayType) {
    case "product-titer":
    case "cell-free-expression":
    case "protein-expression":
      return "mg/L";
    case "absorbance":
      return "OD";
    case "fluorescence":
      return "RFU";
    case "growth-rate":
      return "1/h";
    case "enzyme-activity":
      return "U/mL";
    default:
      return "";
  }
}
