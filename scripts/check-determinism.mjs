#!/usr/bin/env node
// P0-3 determinism guard.
//
// Fails (exit 1) if any bare `Math.random(` appears on a COMPUTE PATH under
// src/server | src/modules | src/services. Exemptions:
//   - test files (__tests__/ dirs, *.test.*, *.spec.*) — not shipped compute
//   - occurrences inside line or block comments — not executable
//   - any line carrying an explicit `// rng-ok` whitelist marker
//
// Compute paths must route randomness through src/utils/rng.ts (makeRng) so
// that a fixed seed yields a byte-identical result.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["src/server", "src/modules", "src/services"].map((r) => join(PROJECT_ROOT, r));
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function isTestPath(p) {
  return p.includes(`${sep}__tests__${sep}`) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(full, out);
    } else if (EXTENSIONS.has(name.slice(name.lastIndexOf("."))) && !isTestPath(full)) {
      out.push(full);
    }
  }
}

/**
 * Blank out `//` and block comments (replacing their chars with spaces while
 * preserving newlines and length) so line numbers stay exact and a
 * `Math.random(` that lives only inside a comment is not counted. String
 * contents are preserved: real calls inside template literals still count.
 */
function stripComments(src) {
  const a = src.split("");
  const n = a.length;
  let mode = "code";
  let strCh = "";
  for (let i = 0; i < n; i++) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : "";
    if (mode === "code") {
      if (c === "/" && d === "/") {
        mode = "line";
        a[i] = " ";
        a[i + 1] = " ";
        i++;
      } else if (c === "/" && d === "*") {
        mode = "block";
        a[i] = " ";
        a[i + 1] = " ";
        i++;
      } else if (c === '"' || c === "'" || c === "`") {
        mode = "str";
        strCh = c;
      }
    } else if (mode === "str") {
      if (c === "\\") {
        i++;
      } else if (c === strCh) {
        mode = "code";
      }
    } else if (mode === "line") {
      if (c === "\n") mode = "code";
      else a[i] = " ";
    } else if (mode === "block") {
      if (c === "*" && d === "/") {
        a[i] = " ";
        a[i + 1] = " ";
        i++;
        mode = "code";
      } else if (c !== "\n") {
        a[i] = " ";
      }
    }
  }
  return a.join("");
}

const RNG_OK = /\/[/*]\s*rng-ok/;
const violations = [];

for (const root of ROOTS) {
  const files = [];
  walk(root, files);
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const rawLines = raw.split(/\r?\n/);
    const strippedLines = stripComments(raw).split(/\r?\n/);
    for (let ln = 0; ln < strippedLines.length; ln++) {
      if (!strippedLines[ln].includes("Math.random(")) continue;
      if (RNG_OK.test(rawLines[ln])) continue;
      violations.push(`${file.slice(PROJECT_ROOT.length + 1)}:${ln + 1}: ${rawLines[ln].trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ determinism guard: ${violations.length} bare Math.random( on compute path(s).`);
  console.error("  Route through src/utils/rng.ts (makeRng), or annotate the line with // rng-ok if intentional:\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}

console.log("✓ determinism guard: no bare Math.random( on compute paths in src/server, src/modules, src/services.");
process.exit(0);
