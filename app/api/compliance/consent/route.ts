/**
 * GDPR Consent Management API
 *
 * GET    /api/compliance/consent?userId=X          — Get consent status for a user.
 * POST   /api/compliance/consent                    — Record a consent grant/denial.
 * DELETE /api/compliance/consent?userId=X&type=Y    — Revoke a specific consent.
 *
 * Implements GDPR Article 7 (conditions for consent) and Article 17 (right to erasure
 * via consent withdrawal).
 */

import { NextResponse } from "next/server";
import {
  recordConsent,
  getConsentStatus,
  revokeConsent,
  getConsentHistory,
  VALID_CONSENT_TYPES,
  type ConsentType,
} from "../../../../src/services/compliance/consentManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/consent?userId=X[&history=true]
 *
 * Returns the current consent status for a user. Pass ?history=true to get
 * the full audit trail (GDPR Art. 15 right of access).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const includeHistory = url.searchParams.get("history") === "true";

    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required 'userId' query parameter." },
        { status: 400 },
      );
    }

    if (includeHistory) {
      const history = await getConsentHistory(userId.trim());
      return NextResponse.json({ userId: userId.trim(), history }, { status: 200 });
    }

    const status = await getConsentStatus(userId.trim());
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    console.error("[compliance/consent GET]", err);
    return NextResponse.json(
      { error: "Internal server error fetching consent status." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/compliance/consent
 *
 * Record a consent grant or denial. Body: { userId, consentType, granted, ipAddress? }
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

    const { userId, consentType, granted, ipAddress } = body;

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'userId' in request body." },
        { status: 400 },
      );
    }

    if (!consentType || typeof consentType !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'consentType' in request body." },
        { status: 400 },
      );
    }

    if (!VALID_CONSENT_TYPES.includes(consentType as ConsentType)) {
      return NextResponse.json(
        {
          error: `Invalid consent type '${consentType}'. Must be one of: ${VALID_CONSENT_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json(
        { error: "'granted' must be a boolean." },
        { status: 400 },
      );
    }

    await recordConsent(
      userId.trim(),
      consentType as ConsentType,
      granted,
      typeof ipAddress === "string" ? ipAddress : undefined,
    );

    return NextResponse.json(
      { success: true, message: `Consent ${granted ? "granted" : "denied"} for ${consentType}.` },
      { status: 201 },
    );
  } catch (err) {
    console.error("[compliance/consent POST]", err);
    return NextResponse.json(
      { error: "Internal server error recording consent." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/compliance/consent?userId=X&type=Y
 *
 * Revoke a specific consent type for a user. Sets revoked_at timestamp
 * on the latest active consent record (GDPR Art. 7(3) right to withdraw).
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const consentType = url.searchParams.get("type");

    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required 'userId' query parameter." },
        { status: 400 },
      );
    }

    if (!consentType || typeof consentType !== "string") {
      return NextResponse.json(
        { error: "Missing required 'type' query parameter." },
        { status: 400 },
      );
    }

    if (!VALID_CONSENT_TYPES.includes(consentType as ConsentType)) {
      return NextResponse.json(
        {
          error: `Invalid consent type '${consentType}'. Must be one of: ${VALID_CONSENT_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const revoked = await revokeConsent(userId.trim(), consentType as ConsentType);

    if (!revoked) {
      return NextResponse.json(
        { success: false, message: `No active consent found for type '${consentType}'.` },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: `Consent revoked for ${consentType}.` },
      { status: 200 },
    );
  } catch (err) {
    console.error("[compliance/consent DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error revoking consent." },
      { status: 500 },
    );
  }
}
