import type {
  ScSpatialErrorResponse,
  ScSpatialIngestConfig,
  ScSpatialIngestResponse,
  ScSpatialQueryRequest,
  ScSpatialQueryResponse,
} from "../types/scspatial";

async function parsePayload<T>(response: Response) {
  return response.json().catch(() => {
    console.warn(`[ScSpatial] Failed to parse JSON response (status ${response.status})`);
    return {};
  }) as Promise<T>;
}

export async function ingestScSpatialFile(file: File, config: ScSpatialIngestConfig = {}, signal?: AbortSignal) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("config", JSON.stringify(config));

  const response = await fetch("/api/scspatial/ingest", {
    method: "POST",
    body: formData,
    cache: "no-store",
    signal,
  });
  const payload = await parsePayload<ScSpatialIngestResponse | ScSpatialErrorResponse>(response);
  if (!response.ok || !("ok" in payload) || payload.ok !== true) {
    throw new Error(("error" in payload ? payload.error : null) ?? "SCSPATIAL ingest failed");
  }
  return payload;
}

export async function ingestScSpatialDemo(signal?: AbortSignal, config?: ScSpatialIngestConfig) {
  const response = await fetch("/api/scspatial/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal,
    body: JSON.stringify({ mode: "demo", config }),
  });
  const payload = await parsePayload<ScSpatialIngestResponse | ScSpatialErrorResponse>(response);
  if (!response.ok || !("ok" in payload) || payload.ok !== true) {
    throw new Error(("error" in payload ? payload.error : null) ?? "SCSPATIAL demo ingest failed");
  }
  return payload;
}

export async function queryScSpatial(request: ScSpatialQueryRequest, signal?: AbortSignal) {
  const response = await fetch("/api/scspatial/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal,
    body: JSON.stringify(request),
  });
  const payload = await parsePayload<(ScSpatialQueryResponse & { ok: true }) | ScSpatialErrorResponse>(response);
  if (!response.ok || !("ok" in payload) || payload.ok !== true) {
    throw new Error(("error" in payload ? payload.error : null) ?? "SCSPATIAL query failed");
  }
  const { ok: _ok, ...query } = payload;
  return query as ScSpatialQueryResponse;
}
