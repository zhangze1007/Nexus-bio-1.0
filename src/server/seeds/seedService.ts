/**
 * Data seeding service for Nexus-Bio reference data.
 *
 * Seeds four reference tables:
 *   1. seed_ijor1366_reactions  — E. coli K-12 central metabolism (iJO1366 subset)
 *   2. seed_precomputed_dg     — Pre-computed delta-G values (Glycolysis, TCA, PPP)
 *   3. seed_codon_usage        — Codon usage tables (E. coli, S. cerevisiae)
 *   4. seed_protocol_templates — Protocol templates (Golden Gate, Gibson, etc.)
 *
 * Also supports seeding demo Artemisinin projects via the workbench DB.
 *
 * Uses @libsql/client via the shared libsqlDb helpers.
 */

import type { InStatement } from "@libsql/client";
import { sqlBatch, sqlGet, sqlRun } from "../libsqlDb";
import { IJO1366_REACTIONS } from "../../data/iJO1366Subset";
import { PRECOMPUTED_DG } from "../../data/precomputedDG";
import codonUsageJson from "../../data/codonUsageTables.json";
import { PROTOCOL_TEMPLATES } from "../../data/protocols/templates";
import { writeProjectState, getWorkbenchDb, projectStateExists } from "../workbenchDb";
import type { WorkbenchCanonicalState } from "../../store/workbenchTypes";

// ── Types ──────────────────────────────────────────────────────────────

export interface SeedResult {
  tablesSeeded: string[];
  rowsInserted: number;
}

export interface SeedStatus {
  seeded: boolean;
  tables: Array<{
    name: string;
    rowCount: number;
    seededAt: string | null;
  }>;
}

// ── Constants ──────────────────────────────────────────────────────────

const SEED_META_TABLE = "seed_meta";
const DEMO_ARTEMISININ_PROJECT_ID = "demo-artemisinin";

// ── Schema ─────────────────────────────────────────────────────────────

const SCHEMA_STATEMENTS = [
  // iJO1366 reactions
  `CREATE TABLE IF NOT EXISTS seed_ijor1366_reactions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subsystem TEXT NOT NULL,
    lb REAL NOT NULL,
    ub REAL NOT NULL,
    stoichiometry_json TEXT NOT NULL,
    gpr TEXT
  )`,

  // Pre-computed delta-G values
  `CREATE TABLE IF NOT EXISTS seed_precomputed_dg (
    id TEXT PRIMARY KEY,
    pathway TEXT NOT NULL,
    step_name TEXT NOT NULL,
    dG0 REAL NOT NULL,
    dG_prime_physiological REAL NOT NULL,
    dG_prime_standard REAL NOT NULL,
    uncertainty REAL NOT NULL,
    nH REAL NOT NULL,
    dz2 REAL NOT NULL,
    kegg_formula TEXT NOT NULL,
    source TEXT NOT NULL
  )`,

  // Codon usage tables
  `CREATE TABLE IF NOT EXISTS seed_codon_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organism TEXT NOT NULL,
    amino_acid TEXT NOT NULL,
    codon TEXT NOT NULL,
    frequency REAL NOT NULL,
    UNIQUE(organism, codon)
  )`,

  // Protocol templates
  `CREATE TABLE IF NOT EXISTS seed_protocol_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    estimated_duration_min INTEGER NOT NULL,
    steps_json TEXT NOT NULL,
    equipment_json TEXT NOT NULL,
    reagents_json TEXT NOT NULL,
    qc_criteria_json TEXT NOT NULL
  )`,

  // Seed metadata tracking
  `CREATE TABLE IF NOT EXISTS ${SEED_META_TABLE} (
    table_name TEXT PRIMARY KEY,
    row_count INTEGER NOT NULL,
    seeded_at TEXT NOT NULL
  )`,
];

// ── Ensure schema ──────────────────────────────────────────────────────

async function ensureSchema(): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    await sqlRun(sql);
  }
}

// ── Seed Reference Data ────────────────────────────────────────────────

export async function seedReferenceData(): Promise<SeedResult> {
  await ensureSchema();

  const tablesSeeded: string[] = [];
  let totalRows = 0;

  // 1. Seed iJO1366 reactions
  const reactionRows = await seedIJOR1366Reactions();
  tablesSeeded.push("seed_ijor1366_reactions");
  totalRows += reactionRows;

  // 2. Seed precomputed delta-G values
  const dgRows = await seedPrecomputedDG();
  tablesSeeded.push("seed_precomputed_dg");
  totalRows += dgRows;

  // 3. Seed codon usage tables
  const codonRows = await seedCodonUsage();
  tablesSeeded.push("seed_codon_usage");
  totalRows += codonRows;

  // 4. Seed protocol templates
  const protocolRows = await seedProtocolTemplates();
  tablesSeeded.push("seed_protocol_templates");
  totalRows += protocolRows;

  return { tablesSeeded, rowsInserted: totalRows };
}

async function seedIJOR1366Reactions(): Promise<number> {
  await sqlRun("DELETE FROM seed_ijor1366_reactions");

  const statements: InStatement[] = IJO1366_REACTIONS.map((rxn) => ({
    sql: `INSERT INTO seed_ijor1366_reactions (id, name, subsystem, lb, ub, stoichiometry_json, gpr)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [rxn.id, rxn.name, rxn.subsystem, rxn.lb, rxn.ub, JSON.stringify(rxn.stoichiometry), rxn.gpr ?? null] as (
      | string
      | number
      | null
    )[],
  }));

  await sqlBatch(statements);
  await updateSeedMeta("seed_ijor1366_reactions", IJO1366_REACTIONS.length);
  return IJO1366_REACTIONS.length;
}

async function seedPrecomputedDG(): Promise<number> {
  await sqlRun("DELETE FROM seed_precomputed_dg");

  const statements: InStatement[] = [];
  let count = 0;

  for (const [pathway, data] of Object.entries(PRECOMPUTED_DG)) {
    for (const step of data.steps) {
      statements.push({
        sql: `INSERT INTO seed_precomputed_dg
              (id, pathway, step_name, dG0, dG_prime_physiological, dG_prime_standard, uncertainty, nH, dz2, kegg_formula, source)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `${pathway}:${step.stepName}`,
          pathway,
          step.stepName,
          step.dG0,
          step.dG_prime_physiological,
          step.dG_prime_standard,
          step.uncertainty,
          step.nH,
          step.dz2,
          step.keggFormula,
          step.source,
        ] as (string | number | null)[],
      });
      count++;
    }
  }

  await sqlBatch(statements);
  await updateSeedMeta("seed_precomputed_dg", count);
  return count;
}

async function seedCodonUsage(): Promise<number> {
  await sqlRun("DELETE FROM seed_codon_usage");

  const statements: InStatement[] = [];
  let count = 0;

  const codonData = codonUsageJson as unknown as Record<string, Record<string, [string, number][]>>;

  for (const [organism, aminoAcids] of Object.entries(codonData)) {
    for (const [aminoAcid, codons] of Object.entries(aminoAcids)) {
      for (const [codon, frequency] of codons) {
        statements.push({
          sql: `INSERT INTO seed_codon_usage (organism, amino_acid, codon, frequency)
                VALUES (?, ?, ?, ?)`,
          args: [organism, aminoAcid, codon, frequency] as (string | number | null)[],
        });
        count++;
      }
    }
  }

  await sqlBatch(statements);
  await updateSeedMeta("seed_codon_usage", count);
  return count;
}

async function seedProtocolTemplates(): Promise<number> {
  await sqlRun("DELETE FROM seed_protocol_templates");

  const statements: InStatement[] = PROTOCOL_TEMPLATES.map((tpl) => ({
    sql: `INSERT INTO seed_protocol_templates
          (id, name, category, difficulty, estimated_duration_min, steps_json, equipment_json, reagents_json, qc_criteria_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      tpl.id,
      tpl.name,
      tpl.category,
      tpl.difficulty,
      tpl.estimatedDurationMin,
      JSON.stringify(tpl.steps),
      JSON.stringify(tpl.equipment),
      JSON.stringify(tpl.reagents),
      JSON.stringify(tpl.qcCriteria),
    ] as (string | number | null)[],
  }));

  await sqlBatch(statements);
  await updateSeedMeta("seed_protocol_templates", PROTOCOL_TEMPLATES.length);
  return PROTOCOL_TEMPLATES.length;
}

async function updateSeedMeta(tableName: string, rowCount: number): Promise<void> {
  await sqlRun(
    `INSERT INTO ${SEED_META_TABLE} (table_name, row_count, seeded_at)
     VALUES (?, ?, ?)
     ON CONFLICT(table_name) DO UPDATE SET
       row_count = excluded.row_count,
       seeded_at = excluded.seeded_at`,
    [tableName, rowCount, new Date().toISOString()],
  );
}

// ── Seed Demo Project ──────────────────────────────────────────────────

export async function seedDemoProject(userId: string): Promise<string> {
  // Ensure workbench schema exists
  await getWorkbenchDb();

  const projectId = `${DEMO_ARTEMISININ_PROJECT_ID}-${userId}`;
  const timestamp = Date.now();

  // Check if demo project already exists
  const exists = await projectStateExists(projectId);
  if (exists) {
    return projectId;
  }

  // Build a minimal artemisinin demo state
  const demoState: WorkbenchCanonicalState = {
    schemaVersion: 1,
    revision: 1,
    lastMutationAt: timestamp,
    activeArtifactId: null,
    project: {
      id: projectId,
      title: "Artemisinin Biosynthesis Demo",
      summary:
        "Demo project: artemisinin biosynthesis in S. cerevisiae via engineered mevalonate pathway (Ro et al., Nature 2006).",
      targetProduct: "artemisinin",
      status: "active",
      isDemo: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    evidenceItems: [],
    selectedEvidenceIds: [],
    draftAnalyzeInput: "",
    workflowArtifact: null,
    analyzeArtifact: null,
    toolRuns: [],
    toolPayloads: {},
    payloadAdmissionDecisionsByToolId: {},
    runArtifacts: [],
    checkpoints: [
      { id: "stage-1", status: "complete", summary: "Pathway designed", updatedAt: timestamp },
      { id: "stage-2", status: "active", summary: "Simulation running", updatedAt: timestamp },
      { id: "stage-3", status: "pending", summary: "Awaiting chassis", updatedAt: timestamp },
      { id: "stage-4", status: "pending", summary: "Awaiting build", updatedAt: timestamp },
    ],
    nextRecommendations: [],
    workflowControl: {
      machineState: "targetSet",
      status: "ready",
      currentToolId: "fbasim",
      nextRecommendedNode: "fbasim",
      missingEvidence: { minRequired: 2, have: 1, kinds: ["fba", "thermodynamics"] },
      confidence: 0.65,
      uncertainty: 0.2,
      validity: "demo",
      humanGateRequired: false,
      nextNodeIsContractOnly: false,
      isDemoOnly: true,
      latestRunStatus: "ok",
      latestRunToolId: "pathd",
      reasonCodes: ["DEMO_PROJECT"],
      explanation: "Demo project with artemisinin biosynthesis pathway from Ro et al. Nature 2006.",
      iteration: 1,
      updatedAt: timestamp,
    },
  };

  await writeProjectState(projectId, userId, demoState);
  return projectId;
}

// ── Get Seed Status ────────────────────────────────────────────────────

export async function getSeedStatus(): Promise<SeedStatus> {
  await ensureSchema();

  const seedTables = ["seed_ijor1366_reactions", "seed_precomputed_dg", "seed_codon_usage", "seed_protocol_templates"];

  const tables: SeedStatus["tables"] = [];

  for (const tableName of seedTables) {
    const countRow = await sqlGet(`SELECT COUNT(*) as cnt FROM ${tableName}`);
    const rowCount = Number(countRow?.cnt ?? 0);

    const metaRow = (await sqlGet(`SELECT seeded_at FROM ${SEED_META_TABLE} WHERE table_name = ?`, [tableName])) as
      | { seeded_at: string }
      | undefined;

    tables.push({
      name: tableName,
      rowCount,
      seededAt: metaRow?.seeded_at ?? null,
    });
  }

  const seeded = tables.every((t) => t.rowCount > 0);

  return { seeded, tables };
}
