/**
 * Tests for plugin manifest and input validation.
 */

import type { PluginManifest } from "../../src/services/plugins/types";
import {
  validateManifest,
  validateInputs,
} from "../../src/services/plugins/pluginValidator";

// ---------------------------------------------------------------------------
// Fixture: a fully valid manifest
// ---------------------------------------------------------------------------
function validManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    name: "test-plugin",
    version: "1.0.0",
    description: "A test plugin",
    author: "tester",
    inputs: [
      {
        name: "sequence",
        type: "string",
        required: true,
        description: "DNA sequence",
      },
    ],
    outputs: [
      {
        name: "result",
        type: "string",
        description: "Output value",
      },
    ],
    engine: {
      runtime: "javascript",
      entrypoint: "index.js",
    },
    ...overrides,
  };
}

// ===========================================================================
// validateManifest
// ===========================================================================
describe("validateManifest", () => {
  it("accepts a valid manifest", () => {
    const result = validateManifest(validManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a manifest with optional fields", () => {
    const result = validateManifest(
      validManifest({
        license: "MIT",
        ui: { icon: "flask", color: "#93CB52", category: "analysis" },
        engine: {
          runtime: "python",
          entrypoint: "main.py",
          timeoutMs: 30000,
          memoryLimitMb: 512,
        },
      }),
    );
    expect(result.valid).toBe(true);
  });

  // -- Required field checks --
  it("rejects missing name", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).name;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /name/i.test(e))).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateManifest(validManifest({ name: "" }));
    expect(result.valid).toBe(false);
  });

  it("rejects missing version", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).version;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /version/i.test(e))).toBe(true);
  });

  it("rejects missing description", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).description;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
  });

  it("rejects missing author", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).author;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
  });

  it("rejects missing inputs array", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).inputs;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
  });

  it("rejects missing outputs array", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).outputs;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
  });

  it("rejects missing engine", () => {
    const m = validManifest();
    delete (m as unknown as Record<string, unknown>).engine;
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
  });

  // -- Engine validation --
  it("rejects invalid engine runtime", () => {
    const result = validateManifest(
      validManifest({
        engine: { runtime: "ruby" as unknown as "javascript", entrypoint: "main.rb" },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /runtime/i.test(e))).toBe(true);
  });

  it("rejects missing engine entrypoint", () => {
    const result = validateManifest(
      validManifest({
        engine: { runtime: "javascript", entrypoint: "" },
      }),
    );
    expect(result.valid).toBe(false);
  });

  // -- Input descriptor validation --
  it("rejects input with invalid type", () => {
    const result = validateManifest(
      validManifest({
        inputs: [
          { name: "x", type: "bigint" as unknown as "string", required: true, description: "bad" },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /input.*type/i.test(e))).toBe(true);
  });

  it("rejects input with missing name", () => {
    const result = validateManifest(
      validManifest({
        inputs: [
          { name: "", type: "string", required: true, description: "bad" },
        ],
      }),
    );
    expect(result.valid).toBe(false);
  });

  // -- Output descriptor validation --
  it("rejects output with invalid type", () => {
    const result = validateManifest(
      validManifest({
        outputs: [
          { name: "x", type: "boolean" as unknown as "string", description: "bad" },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /output.*type/i.test(e))).toBe(true);
  });

  // -- Type guards --
  it("rejects non-object input", () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest(undefined).valid).toBe(false);
    expect(validateManifest("string").valid).toBe(false);
    expect(validateManifest(42).valid).toBe(false);
  });
});

// ===========================================================================
// validateInputs
// ===========================================================================
describe("validateInputs", () => {
  const manifest = validManifest();

  it("accepts valid inputs matching manifest", () => {
    const result = validateInputs(manifest, { sequence: "ATCG" });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing required input", () => {
    const result = validateInputs(manifest, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /sequence/i.test(e))).toBe(true);
  });

  it("rejects input with wrong type (expected string, got number)", () => {
    const result = validateInputs(manifest, { sequence: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /sequence/i.test(e))).toBe(true);
  });

  it("accepts optional inputs omitted", () => {
    const m = validManifest({
      inputs: [
        { name: "seq", type: "string", required: true, description: "seq" },
        { name: "opt", type: "number", required: false, description: "optional" },
      ],
    });
    const result = validateInputs(m, { seq: "ATCG" });
    expect(result.valid).toBe(true);
  });

  it("rejects extra unknown inputs", () => {
    const result = validateInputs(manifest, { sequence: "ATCG", unknownField: true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /unknown/i.test(e))).toBe(true);
  });

  it("validates number type", () => {
    const m = validManifest({
      inputs: [
        { name: "count", type: "number", required: true, description: "count" },
      ],
    });
    expect(validateInputs(m, { count: 42 }).valid).toBe(true);
    expect(validateInputs(m, { count: "42" }).valid).toBe(false);
  });

  it("validates boolean type", () => {
    const m = validManifest({
      inputs: [
        { name: "flag", type: "boolean", required: true, description: "flag" },
      ],
    });
    expect(validateInputs(m, { flag: true }).valid).toBe(true);
    expect(validateInputs(m, { flag: "true" }).valid).toBe(false);
  });

  it("validates json type accepts objects", () => {
    const m = validManifest({
      inputs: [
        { name: "data", type: "json", required: true, description: "data" },
      ],
    });
    expect(validateInputs(m, { data: { key: "val" } }).valid).toBe(true);
  });

  it("validates file type accepts strings", () => {
    const m = validManifest({
      inputs: [
        { name: "f", type: "file", required: true, description: "file" },
      ],
    });
    expect(validateInputs(m, { f: "/path/to/file" }).valid).toBe(true);
    expect(validateInputs(m, { f: 123 }).valid).toBe(false);
  });
});
