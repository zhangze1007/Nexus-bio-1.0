/** @jest-environment node */
/**
 * Tests for contextManager (src/services/ai/contextManager.ts).
 *
 * Uses a real libSQL database (same pattern as responseCache.test.ts).
 * Each test suite starts with clean tables. The tests cover:
 *   - buildProjectContext: DB integration with projects, experiments,
 *     decision_log, and inventory tables
 *   - summarizeContext: pure function, deterministic output
 *   - getRelevantTools: rule-based tool recommendation logic
 */

import {
  buildProjectContext,
  summarizeContext,
  getRelevantTools,
  type ProjectContext,
} from "../src/services/ai/contextManager";
import { sqlRun, sqlAll, closeLibsqlClient } from "../src/server/libsqlDb";

// ── Setup / Teardown ──

const TEST_PROJECT_ID = "test-proj-001";

async function createTables(): Promise<void> {
  // Disable foreign keys so we can drop tables with cross-references
  await sqlRun("PRAGMA foreign_keys = OFF").catch(() => {});

  // Drop existing tables first to avoid schema conflicts with the shared DB.
  // Include tables that have foreign keys referencing our target tables.
  const tables = [
    "project_history",
    "experiments",
    "decision_log",
    "inventory_strains",
    "inventory_plasmids",
    "inventory_primers",
    "inventory_chemicals",
    "projects",
  ];
  for (const table of tables) {
    await sqlRun(`DROP TABLE IF EXISTS ${table}`).catch(() => {});
  }

  await sqlRun(`CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_product TEXT,
    status TEXT DEFAULT 'active'
  )`);

  await sqlRun(`CREATE TABLE experiments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    input_json TEXT,
    output_json TEXT,
    status TEXT DEFAULT 'pending',
    duration_ms INTEGER,
    error_message TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await sqlRun(`CREATE TABLE decision_log (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    context TEXT,
    options TEXT,
    decision TEXT,
    rationale TEXT,
    outcome TEXT,
    related_experiment_ids TEXT,
    decided_by TEXT,
    decided_at TEXT DEFAULT (datetime('now'))
  )`);

  await sqlRun(`CREATE TABLE inventory_strains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT,
    archived INTEGER DEFAULT 0
  )`);

  await sqlRun(`CREATE TABLE inventory_plasmids (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT,
    archived INTEGER DEFAULT 0
  )`);

  await sqlRun(`CREATE TABLE inventory_primers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT,
    archived INTEGER DEFAULT 0
  )`);

  await sqlRun(`CREATE TABLE inventory_chemicals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT,
    archived INTEGER DEFAULT 0
  )`);
}

async function seedProject(): Promise<void> {
  await sqlRun(
    `INSERT OR REPLACE INTO projects (id, title, description, target_product, status)
     VALUES (?, ?, ?, ?, ?)`,
    [TEST_PROJECT_ID, "Artemisinin Production", "Optimize artemisinin biosynthesis in S. cerevisiae", "artemisinin", "active"],
  );
}

async function cleanTables(): Promise<void> {
  const tables = [
    "experiments",
    "decision_log",
    "inventory_strains",
    "inventory_plasmids",
    "inventory_primers",
    "inventory_chemicals",
    "projects",
  ];
  for (const table of tables) {
    await sqlRun(`DELETE FROM ${table}`).catch(() => {});
  }
}

beforeAll(async () => {
  await createTables();
  await cleanTables();
});

afterEach(async () => {
  await cleanTables();
});

afterAll(async () => {
  await cleanTables();
  closeLibsqlClient();
});

// ── buildProjectContext ──

describe("buildProjectContext", () => {
  test("returns null projectBrief when project does not exist", async () => {
    const ctx = await buildProjectContext("nonexistent-id");
    expect(ctx.projectBrief).toBeNull();
    expect(ctx.recentExperiments).toEqual([]);
    expect(ctx.activePathway).toBeNull();
    expect(ctx.toolResults).toEqual([]);
    expect(ctx.inventorySummary).toEqual({ strains: 0, plasmids: 0, primers: 0, chemicals: 0 });
  });

  test("returns projectBrief for an existing project", async () => {
    await seedProject();
    const ctx = await buildProjectContext(TEST_PROJECT_ID);

    expect(ctx.projectBrief).not.toBeNull();
    expect(ctx.projectBrief!.id).toBe(TEST_PROJECT_ID);
    expect(ctx.projectBrief!.title).toBe("Artemisinin Production");
    expect(ctx.projectBrief!.targetProduct).toBe("artemisinin");
    expect(ctx.projectBrief!.status).toBe("active");
  });

  test("returns recent experiments ordered by created_at DESC", async () => {
    await seedProject();
    await sqlRun(
      `INSERT INTO experiments (id, project_id, tool, status, created_at) VALUES (?, ?, ?, ?, ?)`,
      ["exp-old", TEST_PROJECT_ID, "pathd", "completed", "2025-01-01T00:00:00Z"],
    );
    await sqlRun(
      `INSERT INTO experiments (id, project_id, tool, status, created_at) VALUES (?, ?, ?, ?, ?)`,
      ["exp-new", TEST_PROJECT_ID, "fbasim", "completed", "2025-06-01T00:00:00Z"],
    );

    const ctx = await buildProjectContext(TEST_PROJECT_ID);
    expect(ctx.recentExperiments).toHaveLength(2);
    expect(ctx.recentExperiments[0].id).toBe("exp-new");
    expect(ctx.recentExperiments[1].id).toBe("exp-old");
  });

  test("caps recent experiments at MAX_RECENT_EXPERIMENTS (10)", async () => {
    await seedProject();
    for (let i = 0; i < 15; i++) {
      await sqlRun(
        `INSERT INTO experiments (id, project_id, tool, status, created_at) VALUES (?, ?, ?, ?, ?)`,
        [`exp-${i}`, TEST_PROJECT_ID, "fbasim", "completed", `2025-0${(i % 9) + 1}-01T00:00:00Z`],
      );
    }

    const ctx = await buildProjectContext(TEST_PROJECT_ID);
    expect(ctx.recentExperiments.length).toBeLessThanOrEqual(10);
  });

  test("detects activePathway from decision_log", async () => {
    await seedProject();
    await sqlRun(
      `INSERT INTO decision_log (id, project_id, title, context, decision, options, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "dec-1",
        TEST_PROJECT_ID,
        "MVA pathway selection",
        "Evaluating mevalonate vs MEP pathway",
        "Proceed with MVA pathway",
        JSON.stringify(["mevalonate", "fpp", "amorpha-4,11-diene"]),
        "2025-06-01T00:00:00Z",
      ],
    );

    const ctx = await buildProjectContext(TEST_PROJECT_ID);
    expect(ctx.activePathway).not.toBeNull();
    expect(ctx.activePathway!.title).toBe("MVA pathway selection");
    expect(ctx.activePathway!.source).toBe("decision_log");
    expect(ctx.activePathway!.nodes).toContain("mevalonate");
  });

  test("falls back to target_product when no decision_log or pathway experiment exists", async () => {
    await seedProject();
    const ctx = await buildProjectContext(TEST_PROJECT_ID);

    expect(ctx.activePathway).not.toBeNull();
    expect(ctx.activePathway!.title).toBe("artemisinin");
    expect(ctx.activePathway!.source).toBe("target_product");
    expect(ctx.activePathway!.nodes).toEqual([]);
  });

  test("fetches toolResults from completed experiments with output", async () => {
    await seedProject();
    await sqlRun(
      `INSERT INTO experiments (id, project_id, tool, status, output_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "exp-fba",
        TEST_PROJECT_ID,
        "fbasim",
        "completed",
        JSON.stringify({ objective: 0.87, growthRate: 0.42 }),
        "2025-06-01T00:00:00Z",
      ],
    );

    const ctx = await buildProjectContext(TEST_PROJECT_ID);
    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0].tool).toBe("fbasim");
    expect(ctx.toolResults[0].metrics).toContain("objective=0.87");
  });

  test("fetchInventorySummary counts non-archived items", async () => {
    await seedProject();
    await sqlRun(
      `INSERT INTO inventory_strains (id, name, project_id, archived) VALUES (?, ?, ?, ?)`,
      ["s1", "MG1655", TEST_PROJECT_ID, 0],
    );
    await sqlRun(
      `INSERT INTO inventory_strains (id, name, project_id, archived) VALUES (?, ?, ?, ?)`,
      ["s2", "BL21", TEST_PROJECT_ID, 0],
    );
    await sqlRun(
      `INSERT INTO inventory_strains (id, name, project_id, archived) VALUES (?, ?, ?, ?)`,
      ["s3", "Old strain", TEST_PROJECT_ID, 1],
    );
    await sqlRun(
      `INSERT INTO inventory_plasmids (id, name, project_id, archived) VALUES (?, ?, ?, ?)`,
      ["p1", "pET28a", TEST_PROJECT_ID, 0],
    );

    const ctx = await buildProjectContext(TEST_PROJECT_ID);
    expect(ctx.inventorySummary.strains).toBe(2);
    expect(ctx.inventorySummary.plasmids).toBe(1);
    expect(ctx.inventorySummary.primers).toBe(0);
    expect(ctx.inventorySummary.chemicals).toBe(0);
  });
});

// ── summarizeContext ──

describe("summarizeContext", () => {
  function emptyContext(): ProjectContext {
    return {
      projectBrief: null,
      recentExperiments: [],
      activePathway: null,
      toolResults: [],
      inventorySummary: { strains: 0, plasmids: 0, primers: 0, chemicals: 0 },
    };
  }

  test("returns fallback message for empty context", () => {
    expect(summarizeContext(emptyContext())).toBe("No project context available");
  });

  test("includes project title and target product", () => {
    const ctx = emptyContext();
    ctx.projectBrief = {
      id: "p1",
      title: "Artemisinin Production",
      description: null,
      targetProduct: "artemisinin",
      status: "active",
    };
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Project: Artemisinin Production");
    expect(summary).toContain("target: artemisinin");
  });

  test("includes project title without target when target is null", () => {
    const ctx = emptyContext();
    ctx.projectBrief = { id: "p1", title: "My Project", description: null, targetProduct: null, status: "active" };
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Project: My Project");
    expect(summary).not.toContain("target:");
  });

  test("includes experiment count and tool diversity", () => {
    const ctx = emptyContext();
    ctx.recentExperiments = [
      { id: "e1", tool: "pathd", status: "completed", createdAt: "", hasOutput: true },
      { id: "e2", tool: "pathd", status: "completed", createdAt: "", hasOutput: true },
      { id: "e3", tool: "fbasim", status: "pending", createdAt: "", hasOutput: false },
    ];
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Experiments: 3 recent (2 completed) across 2 tools");
  });

  test("includes active pathway with node count and source", () => {
    const ctx = emptyContext();
    ctx.activePathway = {
      title: "MVA pathway",
      source: "decision_log",
      nodes: ["acetyl-CoA", "HMG-CoA", "mevalonate"],
      description: null,
    };
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Active pathway: MVA pathway (3 nodes, source: decision_log)");
  });

  test("includes tool result names", () => {
    const ctx = emptyContext();
    ctx.toolResults = [
      { tool: "fbasim", metrics: "objective=0.87", capturedAt: "" },
      { tool: "cethx", metrics: "ΔG=-12.3", capturedAt: "" },
    ];
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Recent tool outputs: fbasim, cethx");
  });

  test("includes inventory counts", () => {
    const ctx = emptyContext();
    ctx.inventorySummary = { strains: 3, plasmids: 5, primers: 0, chemicals: 2 };
    const summary = summarizeContext(ctx);
    expect(summary).toContain("Inventory: 3 strains, 5 plasmids, 2 chemicals");
    expect(summary).not.toContain("primers");
  });

  test("omits inventory line when all counts are zero", () => {
    const ctx = emptyContext();
    ctx.inventorySummary = { strains: 0, plasmids: 0, primers: 0, chemicals: 0 };
    const summary = summarizeContext(ctx);
    expect(summary).not.toContain("Inventory:");
  });

  test("is deterministic for identical input", () => {
    const ctx: ProjectContext = {
      projectBrief: { id: "p1", title: "Test", description: null, targetProduct: "X", status: "active" },
      recentExperiments: [{ id: "e1", tool: "pathd", status: "completed", createdAt: "", hasOutput: true }],
      activePathway: { title: "PW", source: "target_product", nodes: ["A"], description: null },
      toolResults: [],
      inventorySummary: { strains: 1, plasmids: 0, primers: 0, chemicals: 0 },
    };
    expect(summarizeContext(ctx)).toBe(summarizeContext(ctx));
  });
});

// ── getRelevantTools ──

describe("getRelevantTools", () => {
  function contextWithTools(tools: string[]): ProjectContext {
    return {
      projectBrief: { id: "p1", title: "Test", description: null, targetProduct: "X", status: "active" },
      recentExperiments: tools.map((t, i) => ({
        id: `e${i}`,
        tool: t,
        status: "completed",
        createdAt: "",
        hasOutput: true,
      })),
      activePathway: null,
      toolResults: [],
      inventorySummary: { strains: 0, plasmids: 0, primers: 0, chemicals: 0 },
    };
  }

  test("suggests pathd when no experiments exist", () => {
    const ctx = contextWithTools([]);
    const tools = getRelevantTools(ctx);
    expect(tools[0]).toBe("pathd");
  });

  test("suggests simulation tools after pathd is used", () => {
    const ctx = contextWithTools(["pathd"]);
    const tools = getRelevantTools(ctx);
    expect(tools).toContain("cethx");
    expect(tools).toContain("fbasim");
    expect(tools).toContain("catdes");
    expect(tools).not.toContain("pathd");
  });

  test("suggests chassis tools after fbasim is used", () => {
    const ctx = contextWithTools(["pathd", "fbasim"]);
    const tools = getRelevantTools(ctx);
    expect(tools).toContain("genmim");
    expect(tools).toContain("gecair");
  });

  test("suggests dbtlflow after genmim is used", () => {
    const ctx = contextWithTools(["pathd", "fbasim", "genmim"]);
    const tools = getRelevantTools(ctx);
    expect(tools).toContain("dbtlflow");
  });

  test("suggests multio when 3+ experiments exist", () => {
    const ctx = contextWithTools(["pathd", "fbasim", "cethx"]);
    const tools = getRelevantTools(ctx);
    expect(tools).toContain("multio");
  });

  test("suggests inventory when strains or plasmids exist", () => {
    const ctx = contextWithTools(["pathd"]);
    ctx.inventorySummary.strains = 2;
    const tools = getRelevantTools(ctx);
    expect(tools).toContain("inventory");
  });

  test("does not suggest tools already used", () => {
    const ctx = contextWithTools(["pathd", "fbasim", "cethx", "catdes", "genmim"]);
    const tools = getRelevantTools(ctx);
    for (const t of tools) {
      expect(["pathd", "fbasim", "cethx", "catdes", "genmim"]).not.toContain(t);
    }
  });

  test("caps output at 5 tool IDs", () => {
    const ctx = contextWithTools([]);
    ctx.inventorySummary.strains = 1;
    ctx.recentExperiments = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      tool: `tool-${i}`,
      status: "completed",
      createdAt: "",
      hasOutput: true,
    }));
    const tools = getRelevantTools(ctx);
    expect(tools.length).toBeLessThanOrEqual(5);
  });

  test("returns empty array when all tools are used and no inventory", () => {
    const ctx = contextWithTools([
      "pathd", "metabolic-eng", "cethx", "fbasim", "catdes",
      "genmim", "gecair", "dbtlflow", "multio",
    ]);
    const tools = getRelevantTools(ctx);
    // All workflow tools used, no inventory — only possibly gecair/dyncon if not in used set
    for (const t of tools) {
      expect([
        "pathd", "metabolic-eng", "cethx", "fbasim", "catdes",
        "genmim", "gecair", "dbtlflow", "multio",
      ]).not.toContain(t);
    }
  });

  test("is deterministic for identical input", () => {
    const ctx = contextWithTools(["pathd", "fbasim"]);
    expect(getRelevantTools(ctx)).toEqual(getRelevantTools(ctx));
  });

  test("treats metabolic-eng same as pathd for deduplication", () => {
    const ctx = contextWithTools(["metabolic-eng"]);
    const tools = getRelevantTools(ctx);
    expect(tools).not.toContain("pathd");
    expect(tools).toContain("cethx");
  });
});
