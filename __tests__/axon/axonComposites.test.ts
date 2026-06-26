/** @jest-environment node */
/**
 * axonComposites.test.ts — composite workflow definitions.
 *
 * Covers:
 *   - All composites have valid tool references
 *   - All dependencies reference tools within the composite
 *   - Composite matching by trigger phrase
 *   - Composite listing
 *   - Tool validation
 *   - Dependency validation
 */
import {
  COMPOSITES,
  matchComposite,
  listCompositeNames,
  validateCompositeTools,
  validateCompositeDependencies,
} from "../../src/services/axon/axonComposites";

describe("COMPOSITES definitions", () => {
  const compositeEntries = Object.entries(COMPOSITES);

  it("has at least 3 composites", () => {
    expect(compositeEntries.length).toBeGreaterThanOrEqual(3);
  });

  it.each(compositeEntries)(
    "%s has a name, description, tools, and triggers",
    (_key, composite) => {
      expect(composite.name).toBeTruthy();
      expect(composite.description).toBeTruthy();
      expect(composite.tools.length).toBeGreaterThan(0);
      expect(composite.triggers.length).toBeGreaterThan(0);
    },
  );

  it.each(compositeEntries)(
    "%s has no invalid tool references",
    (_key, composite) => {
      const invalid = validateCompositeTools(composite);
      expect(invalid).toEqual([]);
    },
  );

  it.each(compositeEntries)(
    "%s has valid dependency references",
    (_key, composite) => {
      const errors = validateCompositeDependencies(composite);
      expect(errors).toEqual([]);
    },
  );

  it.each(compositeEntries)(
    "%s dependency entries only reference tools in the composite",
    (_key, composite) => {
      const toolSet = new Set(composite.tools);
      for (const [tool, deps] of Object.entries(composite.dependencies)) {
        expect(toolSet.has(tool as never)).toBe(true);
        for (const dep of deps ?? []) {
          expect(toolSet.has(dep as never)).toBe(true);
        }
      }
    },
  );
});

describe("designAndSimulate composite", () => {
  it("includes pathd, fbasim, cethx", () => {
    const c = COMPOSITES.designAndSimulate;
    expect(c.tools).toContain("pathd");
    expect(c.tools).toContain("fbasim");
    expect(c.tools).toContain("cethx");
  });

  it("fbasim depends on pathd", () => {
    expect(COMPOSITES.designAndSimulate.dependencies.fbasim).toEqual(["pathd"]);
  });

  it("cethx depends on pathd (parallel with fbasim)", () => {
    expect(COMPOSITES.designAndSimulate.dependencies.cethx).toEqual(["pathd"]);
  });
});

describe("fullDBTL composite", () => {
  it("includes the full golden path sequence", () => {
    const c = COMPOSITES.fullDBTL;
    expect(c.tools).toContain("pathd");
    expect(c.tools).toContain("fbasim");
    expect(c.tools).toContain("catdes");
    expect(c.tools).toContain("cellfree");
    expect(c.tools).toContain("dbtlflow");
  });

  it("has proper dependency chain", () => {
    const deps = COMPOSITES.fullDBTL.dependencies;
    expect(deps.pathd).toEqual([]);
    expect(deps.fbasim).toEqual(["pathd"]);
    expect(deps.catdes).toEqual(["fbasim"]);
  });
});

describe("matchComposite", () => {
  it("matches design & simulate trigger", () => {
    expect(matchComposite("Design and simulate a pathway")).toBe(
      COMPOSITES.designAndSimulate,
    );
  });

  it("matches full DBTL trigger", () => {
    expect(matchComposite("Run the full DBTL cycle")).toBe(
      COMPOSITES.fullDBTL,
    );
  });

  it("matches design & evolve trigger", () => {
    expect(matchComposite("I want to design and evolve an enzyme")).toBe(
      COMPOSITES.designAndEvolve,
    );
  });

  it("matches chassis engineering trigger", () => {
    expect(matchComposite("Set up chassis engineering")).toBe(
      COMPOSITES.chassisEngineering,
    );
  });

  it("returns null for unmatched goals", () => {
    expect(matchComposite("Hello, how are you?")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(matchComposite("DESIGN AND SIMULATE")).toBe(
      COMPOSITES.designAndSimulate,
    );
  });
});

describe("listCompositeNames", () => {
  it("returns all composite names", () => {
    const names = listCompositeNames();
    expect(names).toContain("Design & Simulate");
    expect(names).toContain("Full DBTL Cycle");
    expect(names).toContain("Design & Evolve");
  });

  it("returns the correct count", () => {
    expect(listCompositeNames().length).toBe(Object.keys(COMPOSITES).length);
  });
});

describe("validateCompositeTools", () => {
  it("returns empty for valid composites", () => {
    for (const composite of Object.values(COMPOSITES)) {
      expect(validateCompositeTools(composite)).toEqual([]);
    }
  });

  it("detects invalid tool ids", () => {
    const invalidComposite = {
      name: "Test",
      description: "Test composite",
      tools: ["pathd", "nonexistent_tool"],
      dependencies: {},
      triggers: ["test"],
    } as unknown as import("../../src/services/axon/axonComposites").CompositeWorkflow;
    const errors = validateCompositeTools(invalidComposite);
    expect(errors).toContain("nonexistent_tool");
  });
});

describe("validateCompositeDependencies", () => {
  it("returns empty for valid composites", () => {
    for (const composite of Object.values(COMPOSITES)) {
      expect(validateCompositeDependencies(composite)).toEqual([]);
    }
  });

  it("detects dependency referencing tool not in composite", () => {
    const invalidComposite = {
      name: "Test",
      description: "Test composite",
      tools: ["pathd"],
      dependencies: { pathd: ["fbasim"] },
      triggers: ["test"],
    } as unknown as import("../../src/services/axon/axonComposites").CompositeWorkflow;
    const errors = validateCompositeDependencies(invalidComposite);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("fbasim");
  });
});
