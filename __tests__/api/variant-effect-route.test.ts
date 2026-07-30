/** @jest-environment node */

/**
 * Tests for /api/variant-effect (ML-1 prediction proxy).
 *
 * The point of these tests is the HONEST-DEGRADATION contract: when the real
 * ESM-2 Python backend is not connected, the route must return no prediction
 * and say so — it must never fabricate a predicted_fitness. When the backend
 * IS configured, the route proxies and passes the real numbers straight through.
 */

const OLD_ENV = process.env;
const realFetch = global.fetch;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.VARIANT_EFFECT_BACKEND;
});
afterAll(() => {
  process.env = OLD_ENV;
  global.fetch = realFetch;
});

function postReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/variant-effect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/variant-effect — honest degradation", () => {
  it("returns 503 and NO fabricated prediction when the backend is not configured", async () => {
    const { POST } = await import("../../app/api/variant-effect/route");
    const res = await POST(postReq({ mutation: "E210I" }));
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.backend_connected).toBe(false);
    expect(data.source).toBe("unavailable");
    expect(data.validity).toBe("partial");
    // The critical guarantee: no fabricated numbers are ever substituted.
    expect(data.predicted_fitness).toBeUndefined();
    expect(data.zeroshot_score).toBeUndefined();
    expect(String(data.error)).toMatch(/backend not connected/i);
  });

  it("returns 400 when neither mutation nor variant_seq is provided", async () => {
    const { POST } = await import("../../app/api/variant-effect/route");
    const res = await POST(postReq({ wt_seq: "MSIQHFRVALIPFFAAFCLPVFA" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});

describe("POST /api/variant-effect — real backend connected", () => {
  it("proxies to the backend and passes the real prediction through unchanged", async () => {
    process.env.VARIANT_EFFECT_BACKEND = "http://127.0.0.1:8077";
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ predicted_fitness: -3.42, zeroshot_score: -7.1, variant_seq_len: 286 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { POST } = await import("../../app/api/variant-effect/route");
    const res = await POST(postReq({ mutation: "W227P" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.backend_connected).toBe(true);
    expect(data.source).toBe("engine");
    expect(data.validity).toBe("partial");
    expect(data.predicted_fitness).toBe(-3.42);
    expect(data.zeroshot_score).toBe(-7.1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8077/predict",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
