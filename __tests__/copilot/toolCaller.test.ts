/** @jest-environment node */
/**
 * toolCaller — extractToolCall parsing and tool routing.
 */

import { extractToolCall } from "../../src/services/copilot/toolCaller";

describe("extractToolCall", () => {
  it("extracts a valid tool call from response text", () => {
    const text = `Here's the analysis:

\`\`\`tool_call
{
  "tool": "fbasim",
  "inputs": { "reactions": ["R1", "R2"], "objective": "maximize" }
}
\`\`\`

The FBA will compute optimal flux.`;

    const result = extractToolCall(text);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe("fbasim");
    expect(result!.inputs).toEqual({
      reactions: ["R1", "R2"],
      objective: "maximize",
    });
  });

  it("returns null when no tool call block is present", () => {
    const text = "This is a plain text response without any tool call.";
    expect(extractToolCall(text)).toBeNull();
  });

  it("returns null for malformed JSON in tool call block", () => {
    const text = `\`\`\`tool_call
{ broken json
\`\`\``;
    expect(extractToolCall(text)).toBeNull();
  });

  it("returns null when tool field is missing", () => {
    const text = `\`\`\`tool_call
{ "inputs": { "x": 1 } }
\`\`\``;
    expect(extractToolCall(text)).toBeNull();
  });

  it("returns null when inputs field is missing", () => {
    const text = `\`\`\`tool_call
{ "tool": "fbasim" }
\`\`\``;
    expect(extractToolCall(text)).toBeNull();
  });

  it("returns null when inputs is not an object", () => {
    const text = `\`\`\`tool_call
{ "tool": "fbasim", "inputs": "not an object" }
\`\`\``;
    expect(extractToolCall(text)).toBeNull();
  });

  it("extracts tool call with empty inputs", () => {
    const text = `\`\`\`tool_call
{ "tool": "cethx", "inputs": {} }
\`\`\``;
    const result = extractToolCall(text);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe("cethx");
    expect(result!.inputs).toEqual({});
  });

  it("handles multiple tool call blocks by returning the first", () => {
    const text = `\`\`\`tool_call
{ "tool": "fbasim", "inputs": { "a": 1 } }
\`\`\`

Some text.

\`\`\`tool_call
{ "tool": "cethx", "inputs": { "b": 2 } }
\`\`\``;

    const result = extractToolCall(text);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe("fbasim");
  });

  it("handles nested objects in inputs", () => {
    const text = `\`\`\`tool_call
{
  "tool": "catdes",
  "inputs": {
    "enzyme": "amorpha_diene_synthase",
    "mutations": [
      { "position": 42, "replacement": "ALA" }
    ],
    "params": {
      "temperature": 310,
      "pH": 7.4
    }
  }
}
\`\`\``;

    const result = extractToolCall(text);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe("catdes");
    expect(result!.inputs.params).toEqual({ temperature: 310, pH: 7.4 });
    expect(result!.inputs.mutations).toHaveLength(1);
  });
});
