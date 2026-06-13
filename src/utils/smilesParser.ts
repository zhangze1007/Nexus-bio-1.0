/**
 * SMILES Parser
 *
 * Parses Simplified Molecular Input Line Entry System (SMILES) strings
 * into a graph of atoms and bonds. Handles:
 *   - Organic subset atoms: B, C, N, O, P, S, F, Cl, Br, I
 *   - Aromatic atoms: b, c, n, o, p, s
 *   - Bond types: single (-), double (=), triple (#), aromatic (:)
 *   - Branching: (...)
 *   - Ring closures: digits 0-9, %XX for two-digit rings
 *   - Bracket atoms: [NH2], [O-], [Fe+2], [se]
 */

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                 */
/* ------------------------------------------------------------------ */

export interface SMILESAtom {
  element: string;
  isAromatic: boolean;
  charge: number;
  index: number;
}

export interface SMILESBond {
  from: number;
  to: number;
  order: number; // 1, 2, 3
  isAromatic: boolean;
}

export interface SMILESGraph {
  atoms: SMILESAtom[];
  bonds: SMILESBond[];
}

/* ------------------------------------------------------------------ */
/*  Organic subset — lowercase = aromatic                              */
/* ------------------------------------------------------------------ */

const ORGANIC_UPPER = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I']);
const ORGANIC_AROMATIC = new Set(['b', 'c', 'n', 'o', 'p', 's']);

function aromaticToElement(ch: string): string {
  return ch.toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Ring-closure registry                                             */
/* ------------------------------------------------------------------ */

interface RingOpen {
  atomIdx: number;
  bondOrder: number;
  isAromatic: boolean;
}

/* ------------------------------------------------------------------ */
/*  Parser state                                                      */
/* ------------------------------------------------------------------ */

interface ParseState {
  pos: number;
  smiles: string;
  atoms: SMILESAtom[];
  bonds: SMILESBond[];
  /** Index of the "current" atom — the one that new atoms bond to by default. */
  currentAtom: number;
  /** Stack of parent atom indices saved when entering a branch '('. */
  stack: number[];
  /** Currently parsed bond order (consumed on next atom or ring closure). */
  pendingBond: { order: number; isAromatic: boolean } | null;
  /** Open ring closures keyed by digit / %XX token. */
  rings: Map<string, RingOpen>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function peek(s: ParseState): string {
  return s.smiles[s.pos] ?? '';
}

function advance(s: ParseState): string {
  const ch = s.smiles[s.pos];
  s.pos++;
  return ch;
}

/**
 * Add a bond between two atom indices, consuming any pending bond override.
 */
function addBond(s: ParseState, from: number, to: number, defaultAromatic: boolean) {
  let order = 1;
  let aromatic = defaultAromatic;
  if (s.pendingBond) {
    order = s.pendingBond.order;
    aromatic = s.pendingBond.isAromatic;
    s.pendingBond = null;
  }
  s.bonds.push({ from, to, order, isAromatic: aromatic });
}

/**
 * Record a newly added atom: push it, bond it to the current atom, update current.
 */
function recordAtom(s: ParseState, atom: SMILESAtom): void {
  s.atoms.push(atom);

  if (s.currentAtom >= 0) {
    const prev = s.atoms[s.currentAtom];
    const defaultAromatic = prev.isAromatic && atom.isAromatic;
    addBond(s, s.currentAtom, atom.index, defaultAromatic);
  }

  s.currentAtom = atom.index;
}

/* ------------------------------------------------------------------ */
/*  Atom parsing                                                      */
/* ------------------------------------------------------------------ */

function parseBracketAtom(s: ParseState): SMILESAtom {
  let isAromatic = false;
  let element = '';
  let charge = 0;

  const ch = peek(s);

  // Aromatic element (lowercase start)
  if (ch >= 'a' && ch <= 'z') {
    isAromatic = true;
    element = advance(s).toUpperCase();
    const next = peek(s);
    if (next >= 'a' && next <= 'z') {
      const two = element + next;
      if (['Se', 'As', 'Te', 'Si', 'Ge', 'Sn', 'Pb', 'Bi', 'Sb'].includes(two)) {
        element = two;
        advance(s);
      }
    }
  } else if (ch >= 'A' && ch <= 'Z') {
    element = advance(s);
    const next = peek(s);
    if (next >= 'a' && next <= 'z') {
      element += advance(s);
    }
  }

  // Optional hydrogen count: H, H2, H3 ...
  if (peek(s) === 'H') {
    advance(s);
    const d = peek(s);
    if (d >= '0' && d <= '9') {
      advance(s); // consume digit
    }
  }

  // Optional charge: +, ++, +2, -, --, -2
  while (peek(s) === '+' || peek(s) === '-') {
    const sign = peek(s) === '+' ? 1 : -1;
    advance(s);
    const d = peek(s);
    if (d >= '0' && d <= '9') {
      charge += sign * parseInt(advance(s), 10);
    } else {
      let count = 1;
      while (peek(s) === (sign === 1 ? '+' : '-')) {
        count++;
        advance(s);
      }
      charge += sign * count;
    }
  }

  // Consume ']'
  if (peek(s) === ']') {
    advance(s);
  }

  return { element, isAromatic, charge, index: s.atoms.length };
}

function parseOrganicAtom(s: ParseState): SMILESAtom | null {
  const ch = peek(s);

  // Two-character organic subset
  if (ch === 'C' && s.smiles[s.pos + 1] === 'l') {
    advance(s); advance(s);
    return { element: 'Cl', isAromatic: false, charge: 0, index: s.atoms.length };
  }
  if (ch === 'B' && s.smiles[s.pos + 1] === 'r') {
    advance(s); advance(s);
    return { element: 'Br', isAromatic: false, charge: 0, index: s.atoms.length };
  }

  // Single-character organic subset (uppercase)
  if (ORGANIC_UPPER.has(ch)) {
    advance(s);
    return { element: ch, isAromatic: false, charge: 0, index: s.atoms.length };
  }

  // Aromatic lowercase
  if (ORGANIC_AROMATIC.has(ch)) {
    advance(s);
    return { element: aromaticToElement(ch), isAromatic: true, charge: 0, index: s.atoms.length };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Ring closure                                                      */
/* ------------------------------------------------------------------ */

function parseRingClosure(s: ParseState): void {
  let key: string;
  if (peek(s) === '%') {
    advance(s);
    key = '%' + advance(s) + advance(s);
  } else {
    key = advance(s);
  }

  const existing = s.rings.get(key);
  if (existing) {
    // Closing the ring
    let order = existing.bondOrder;
    let aromatic = existing.isAromatic;
    if (s.pendingBond) {
      order = s.pendingBond.order;
      aromatic = s.pendingBond.isAromatic;
      s.pendingBond = null;
    }
    s.bonds.push({ from: existing.atomIdx, to: s.currentAtom, order, isAromatic: aromatic });
    s.rings.delete(key);
  } else {
    // Opening a ring
    let order = 1;
    let aromatic = false;
    if (s.pendingBond) {
      order = s.pendingBond.order;
      aromatic = s.pendingBond.isAromatic;
      s.pendingBond = null;
    }
    s.rings.set(key, { atomIdx: s.currentAtom, bondOrder: order, isAromatic: aromatic });
  }
}

/* ------------------------------------------------------------------ */
/*  Bond symbol                                                       */
/* ------------------------------------------------------------------ */

function parseBondSymbol(s: ParseState): boolean {
  const ch = peek(s);
  switch (ch) {
    case '-':
      advance(s);
      s.pendingBond = { order: 1, isAromatic: false };
      return true;
    case '=':
      advance(s);
      s.pendingBond = { order: 2, isAromatic: false };
      return true;
    case '#':
      advance(s);
      s.pendingBond = { order: 3, isAromatic: false };
      return true;
    case ':':
      advance(s);
      s.pendingBond = { order: 1, isAromatic: true };
      return true;
    case '/':
    case '\\':
      advance(s);
      s.pendingBond = { order: 1, isAromatic: false };
      return true;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Main parse loop                                                   */
/* ------------------------------------------------------------------ */

export function parseSMILES(smiles: string): SMILESGraph {
  const s: ParseState = {
    pos: 0,
    smiles,
    atoms: [],
    bonds: [],
    currentAtom: -1,
    stack: [],
    pendingBond: null,
    rings: new Map(),
  };

  while (s.pos < s.smiles.length) {
    const ch = peek(s);

    // ---- Branch open ----
    if (ch === '(') {
      advance(s);
      // Save current atom so we can restore it after the branch
      s.stack.push(s.currentAtom);
      continue;
    }

    // ---- Branch close ----
    if (ch === ')') {
      advance(s);
      // Restore current atom to what it was before the branch
      s.currentAtom = s.stack.pop()!;
      continue;
    }

    // ---- Bracket atom ----
    if (ch === '[') {
      advance(s);
      const atom = parseBracketAtom(s);
      recordAtom(s, atom);
      continue;
    }

    // ---- Ring closure (digit or %) ----
    if ((ch >= '0' && ch <= '9') || ch === '%') {
      parseRingClosure(s);
      continue;
    }

    // ---- Bond symbol ----
    if (parseBondSymbol(s)) {
      continue;
    }

    // ---- Dot (disconnected fragments) ----
    if (ch === '.') {
      advance(s);
      // Next atom starts a new fragment — no implicit bond
      s.currentAtom = -1;
      continue;
    }

    // ---- Organic subset atom ----
    const atom = parseOrganicAtom(s);
    if (atom) {
      recordAtom(s, atom);
      continue;
    }

    // ---- Unknown character — skip ----
    advance(s);
  }

  return { atoms: s.atoms, bonds: s.bonds };
}
