/**
 * GDPR Article 30 Data Processing Records API
 *
 * GET    /api/compliance/processing-records?orgId=X    — List all processing records for an org.
 * POST   /api/compliance/processing-records            — Create a new processing record.
 *
 * Implements GDPR Article 30 (records of processing activities).
 */

import { NextResponse } from "next/server";
import {
  createRecord,
  listRecords,
  VALID_PROCESSING_CATEGORIES,
  type ProcessingCategory,
} from "../../../../src/services/compliance/dataProcessingRecord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/processing-records?orgId=X
 *
 * Returns all data processing records for the specified organisation,
 * ordered by creation date descending.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    if (!orgId || orgId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required 'orgId' query parameter." },
        { status: 400 },
      );
    }

    const records = await listRecords(orgId.trim());
    return NextResponse.json({ records }, { status: 200 });
  } catch (err) {
    console.error("[compliance/processing-records GET]", err);
    return NextResponse.json(
      { error: "Internal server error fetching processing records." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/compliance/processing-records
 *
 * Create a new data processing record. Body: {
 *   orgId, category, purpose, legalBasis, dataTypes, recipients, retentionPeriod?
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 },
      );
    }

    const { orgId, category, purpose, legalBasis, dataTypes, recipients, retentionPeriod } = body;

    // Validate required fields
    if (!orgId || typeof orgId !== "string" || orgId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'orgId' in request body." },
        { status: 400 },
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'category' in request body." },
        { status: 400 },
      );
    }

    if (!VALID_PROCESSING_CATEGORIES.includes(category as ProcessingCategory)) {
      return NextResponse.json(
        {
          error: `Invalid processing category '${category}'. Must be one of: ${VALID_PROCESSING_CATEGORIES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (!purpose || typeof purpose !== "string" || purpose.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'purpose' in request body." },
        { status: 400 },
      );
    }

    if (!legalBasis || typeof legalBasis !== "string" || legalBasis.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'legalBasis' in request body." },
        { status: 400 },
      );
    }

    if (!Array.isArray(dataTypes)) {
      return NextResponse.json(
        { error: "'dataTypes' must be an array of strings." },
        { status: 400 },
      );
    }

    if (!Array.isArray(recipients)) {
      return NextResponse.json(
        { error: "'recipients' must be an array of strings." },
        { status: 400 },
      );
    }

    const record = await createRecord(
      orgId.trim(),
      category as ProcessingCategory,
      purpose.trim(),
      legalBasis.trim(),
      dataTypes,
      recipients,
      typeof retentionPeriod === "string" ? retentionPeriod : undefined,
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[compliance/processing-records POST]", err);

    // Validation errors from the service layer
    if (message.includes("must be")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error creating processing record." },
      { status: 500 },
    );
  }
}
