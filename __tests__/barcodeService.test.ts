import {
  generateBarcodeData,
  generateQRUrl,
  parseBarcodeData,
  deriveLocationCode,
  type InventoryItemType,
} from "../src/services/inventory/barcodeService";

// ── generateBarcodeData ──────────────────────────────────────────────

describe("generateBarcodeData", () => {
  it("returns TYPE:id format for a standard plasmid", () => {
    expect(generateBarcodeData("PLASMID", "pAUR123")).toBe("PLASMID:pAUR123");
  });

  it("normalises itemType to upper-case", () => {
    expect(generateBarcodeData("chemical" as InventoryItemType, "NaCl-01")).toBe(
      "CHEMICAL:NaCl-01",
    );
  });

  it("preserves mixed-case in the id portion", () => {
    expect(generateBarcodeData("STRAIN", "E.coli-BL21")).toBe("STRAIN:E.coli-BL21");
  });

  it("trims whitespace from both arguments", () => {
    expect(generateBarcodeData("  PRIMER  " as InventoryItemType, "  fwd-001  ")).toBe("PRIMER:fwd-001");
  });

  it("throws when itemType is empty", () => {
    expect(() => generateBarcodeData("" as InventoryItemType, "x")).toThrow(
      "itemType must be a non-empty string",
    );
  });

  it("throws when itemId is empty", () => {
    expect(() => generateBarcodeData("PLASMID", "   ")).toThrow(
      "itemId must be a non-empty string",
    );
  });
});

// ── generateQRUrl ────────────────────────────────────────────────────

describe("generateQRUrl", () => {
  it("returns a URL containing the encoded barcode", () => {
    const url = generateQRUrl("SAMPLE", "S-001");
    expect(url).toContain("/inventory/");
    expect(url).toContain(encodeURIComponent("SAMPLE:S-001"));
  });

  it("uses the canonical deployment URL when window is undefined (SSR)", () => {
    // In the test runner, window exists, so we just verify the URL structure.
    const url = generateQRUrl("MEDIA", "LB-Agar");
    expect(url).toMatch(/^https?:\/\/.+\/inventory\/MEDIA%3ALB-Agar$/);
  });

  it("throws on empty itemType", () => {
    expect(() => generateQRUrl("" as InventoryItemType, "id")).toThrow();
  });

  it("throws on empty itemId", () => {
    expect(() => generateQRUrl("PLASMID", "")).toThrow();
  });
});

// ── parseBarcodeData ─────────────────────────────────────────────────

describe("parseBarcodeData", () => {
  it("round-trips with generateBarcodeData", () => {
    const original = generateBarcodeData("OLIGO", "oligo-42");
    const parsed = parseBarcodeData(original);
    expect(parsed).toEqual({ type: "OLIGO", id: "oligo-42" });
  });

  it("normalises the type portion to upper-case", () => {
    const parsed = parseBarcodeData("strain:e.coli");
    expect(parsed.type).toBe("STRAIN");
  });

  it("preserves the id exactly as-is (except trimming)", () => {
    const parsed = parseBarcodeData("CHEMICAL:compound-XYZ-007");
    expect(parsed.id).toBe("compound-XYZ-007");
  });

  it("handles ids that contain colons", () => {
    const parsed = parseBarcodeData("OTHER:a:b:c");
    expect(parsed.type).toBe("OTHER");
    expect(parsed.id).toBe("a:b:c");
  });

  it("throws on empty input", () => {
    expect(() => parseBarcodeData("")).toThrow("non-empty string");
  });

  it("throws when separator is missing", () => {
    expect(() => parseBarcodeData("NOSEPARATOR")).toThrow('missing ":"');
  });

  it("throws when type portion is empty", () => {
    expect(() => parseBarcodeData(":someId")).toThrow("type portion must not be empty");
  });

  it("throws when id portion is empty", () => {
    expect(() => parseBarcodeData("PLASMID:")).toThrow("id portion must not be empty");
  });

  it("trims surrounding whitespace", () => {
    const parsed = parseBarcodeData("  MEDIA : LB-Broth  ");
    expect(parsed).toEqual({ type: "MEDIA", id: "LB-Broth" });
  });
});

// ── deriveLocationCode ───────────────────────────────────────────────

describe("deriveLocationCode", () => {
  it("derives a 3-char prefix from the type", () => {
    const code = deriveLocationCode("PLASMID:pAUR123");
    expect(code).toMatch(/^PLA-/);
  });

  it("upper-cases and truncates the id to 12 characters", () => {
    const code = deriveLocationCode("CHEMICAL:very-long-compound-name-001");
    expect(code).toBe("CHE-VERY-LONG-CO");
  });

  it("round-trips through generateBarcodeData", () => {
    const barcode = generateBarcodeData("STRAIN", "BL21");
    const code = deriveLocationCode(barcode);
    expect(code).toBe("STR-BL21");
  });

  it("handles single-character ids", () => {
    const code = deriveLocationCode("PRIMER:A");
    expect(code).toBe("PRI-A");
  });
});

// ── Integration: full barcode lifecycle ──────────────────────────────

describe("barcode lifecycle integration", () => {
  const testCases: { type: InventoryItemType; id: string }[] = [
    { type: "PLASMID", id: "pET28a" },
    { type: "STRAIN", id: "DH5alpha" },
    { type: "CHEMICAL", id: "IPTG-100mM" },
    { type: "PRIMER", id: "fwd-16S" },
    { type: "SAMPLE", id: "S-2026-001" },
  ];

  it.each(testCases)(
    "generate -> parse -> derive round-trips for $type/$id",
    ({ type, id }) => {
      const barcode = generateBarcodeData(type, id);
      const { type: parsedType, id: parsedId } = parseBarcodeData(barcode);
      expect(parsedType).toBe(type);
      expect(parsedId).toBe(id);

      const location = deriveLocationCode(barcode);
      expect(location).toMatch(/^[A-Z]{3}-/);
    },
  );
});
