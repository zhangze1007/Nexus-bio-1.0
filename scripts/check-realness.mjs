#!/usr/bin/env node
// Realness static hint (CC-1, optional). Scans src/server | src/modules |
// src/services for EXPORTED functions that declare a parameter but never
// reference it in the body — suspected decoy/canned "ignored input" functions.
//
// SOFT by design: prints a candidate list for human confirmation and ALWAYS
// exits 0 (the heuristic has false positives; the real gate is the input-
// sensitivity property tests under __tests__/realness).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["src/server", "src/modules", "src/services"].map((r) => join(PROJECT_ROOT, r));

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
    } else if (/\.tsx?$/.test(name) && !isTestPath(full)) {
      out.push(full);
    }
  }
}

/** Extract the balanced `{...}` body starting at the first `{` at or after `from`. */
function extractBody(src, from) {
  const start = src.indexOf("{", from);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return src.slice(start + 1);
}

/** Simple, forgiving param-name extraction (skips destructured / rest params). */
function paramNames(paramStr) {
  return paramStr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("{") || p.startsWith("[") || p.startsWith("...")) return null;
      const m = /^([A-Za-z_$][\w$]*)/.exec(p);
      return m ? m[1] : null;
    })
    .filter((n) => n && n !== "_");
}

const FN_RE = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
const candidates = [];

for (const root of ROOTS) {
  const files = [];
  walk(root, files);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    FN_RE.lastIndex = 0;
    let m = FN_RE.exec(src);
    while (m) {
      const [, fnName, paramStr] = m;
      const body = extractBody(src, m.index + m[0].length);
      for (const param of paramNames(paramStr)) {
        const used = new RegExp(`\\b${param}\\b`).test(body);
        if (!used) candidates.push(`${file.slice(PROJECT_ROOT.length + 1)}: ${fnName}() never references param "${param}"`);
      }
      m = FN_RE.exec(src);
    }
  }
}

if (candidates.length > 0) {
  console.log(`ℹ realness hint: ${candidates.length} exported function param(s) look unused (confirm manually — heuristic, not a failure):`);
  for (const c of candidates) console.log("  " + c);
} else {
  console.log("✓ realness hint: no obviously-unused exported function params found.");
}
process.exit(0);
