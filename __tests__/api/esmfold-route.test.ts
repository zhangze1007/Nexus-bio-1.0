/** @jest-environment node */

/**
 * Tests for /api/esmfold — ESMFold2 (Biohub) preferred, EBI ESMFold fallback,
 * fail-closed when neither is reachable. The load-bearing guarantees: it never
 * returns a fabricated structure, it labels the real source/model, it fixes the
 * old `model: 'ESM-2 (8M)'` honesty bug, and it never leaks the API key.
 */
import { NextRequest } from "next/server";
import { POST } from "../../app/api/esmfold/route";

const SEQ = "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEK"; // valid, >10 aa

const OLD_ENV = process.env;
const realFetch = global.fetch;
beforeEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.BIOHUB_API_KEY;
});
afterAll(() => {
  process.env = OLD_ENV;
  global.fetch = realFetch;
});

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/esmfold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Reply = { status: number; json?: unknown; text?: string };
function mockFetch(handler: (url: string, init: RequestInit) => Reply) {
  global.fetch = jest.fn(async (url: unknown, init: unknown) => {
    const r = handler(String(url), (init ?? {}) as RequestInit);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json ?? {},
      text: async () => r.text ?? "",
    } as Response;
  }) as unknown as typeof fetch;
}

describe("POST /api/esmfold", () => {
  it("no BIOHUB key → EBI ESMFold (PDB); fixes the 'ESM-2 (8M)' honesty bug", async () => {
    mockFetch((u) =>
      u.includes("ebi.ac.uk") ? { status: 200, json: { pdb: "HEADER\nATOM      1  N   MET A   1\n", plddt: 0.87 } } : { status: 500 },
    );
    const res = await POST(postReq({ sequence: SEQ }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.source).toBe("esmfold-ebi");
    expect(d.model).toBe("ESMFold (ESM-2 650M, EBI)");
    expect(d.model).not.toBe("ESM-2 (8M)");
    expect(d.format).toBe("pdb");
    expect(typeof d.pdb).toBe("string");
    expect(d.pdb.length).toBeGreaterThan(0);
  });

  it("with BIOHUB key → prefers ESMFold2 (coordinates); sends Bearer, never leaks the key", async () => {
    process.env.BIOHUB_API_KEY = "secret-token-123";
    let sentAuth = "";
    mockFetch((u, init) => {
      if (u.includes("biohub.ai/api/v1/fold")) {
        sentAuth = String((init.headers as Record<string, string>).Authorization);
        return { status: 200, json: { coordinates: [[1, 2, 3]], plddt: [80.1], ptm: 0.9 } };
      }
      return { status: 500 };
    });
    const res = await POST(postReq({ sequence: SEQ }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.source).toBe("esmfold2");
    expect(d.model).toBe("esmfold2-fast-2026-05");
    expect(d.format).toBe("coordinates");
    expect(d.coordinates).toBeDefined();
    expect(sentAuth).toBe("Bearer secret-token-123");
    expect(JSON.stringify(d)).not.toContain("secret-token-123"); // key never in the response
  });

  it("ESMFold2 fails → falls back to EBI", async () => {
    process.env.BIOHUB_API_KEY = "k";
    mockFetch((u) =>
      u.includes("biohub.ai") ? { status: 500, text: "server error" } : { status: 200, json: { pdb: "ATOM  1\n", plddt: 0.8 } },
    );
    const res = await POST(postReq({ sequence: SEQ }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.source).toBe("esmfold-ebi");
    expect(d.pdb).toBeDefined();
  });

  it("both backends fail (with key) → fail-closed, NO fabricated structure", async () => {
    process.env.BIOHUB_API_KEY = "k";
    mockFetch(() => ({ status: 503, text: "down" }));
    const res = await POST(postReq({ sequence: SEQ }));
    expect(res.status).toBe(503);
    const d = await res.json();
    expect(d.ok).toBe(false);
    expect(d.source).toBe("unavailable");
    expect(d.pdb).toBeUndefined();
    expect(d.coordinates).toBeUndefined();
    expect(d.structure).toBeUndefined();
  });

  it("no key + EBI fails → fail-closed, NO fabricated structure", async () => {
    mockFetch(() => ({ status: 500, text: "down" }));
    const res = await POST(postReq({ sequence: SEQ }));
    expect(res.status).toBe(503);
    const d = await res.json();
    expect(d.ok).toBe(false);
    expect(d.source).toBe("unavailable");
    expect(d.pdb).toBeUndefined();
    expect(d.coordinates).toBeUndefined();
  });

  it("validates sequence (too short / missing → 400)", async () => {
    mockFetch(() => ({ status: 200, json: {} }));
    expect((await POST(postReq({ sequence: "MKT" }))).status).toBe(400);
    expect((await POST(postReq({}))).status).toBe(400);
  });
});
