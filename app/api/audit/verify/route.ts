/**
 * Audit Chain Verification API — POST to verify the hash chain integrity.
 *
 * POST /api/audit/verify
 *
 * Returns the full chain verification result for GxP compliance.
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyAuditChain } from "../../../../src/services/audit/chainVerifier";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    const result = await verifyAuditChain();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[audit/verify] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify audit chain" },
      { status: 500 },
    );
  }
}
