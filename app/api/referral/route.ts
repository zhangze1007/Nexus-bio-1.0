/**
 * Referral Program API
 *
 * POST /api/referral — Generate a referral code for the authenticated user.
 *   Body: { userId: string }
 *   Response: { code: string, isNew: boolean }
 *
 * GET /api/referral?userId=<id> — Get referral stats for a user.
 *   Response: ReferralStats
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateReferralCode,
  getReferralStats,
  recordReferral,
  validateReferralCode,
} from "../../../src/services/referral/referralService";

export const runtime = 'nodejs';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/referral
 *
 * Generates (or returns existing) referral code for the given user.
 * Alternatively, if `action: "record"` is provided, records a referral.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action, code, newUserId } = body as {
      userId?: string;
      action?: string;
      code?: string;
      newUserId?: string;
    };

    // Record a referral
    if (action === "record") {
      if (!code || !newUserId) {
        return json({ error: "code and newUserId are required for record action" }, 400);
      }
      const result = await recordReferral(code, newUserId);
      if (!result) {
        return json({ error: "Invalid referral code" }, 404);
      }
      return json(result, 201);
    }

    // Default action: generate code
    if (!userId) {
      return json({ error: "userId is required" }, 400);
    }

    const result = await generateReferralCode(userId);
    return json(result, result.isNew ? 201 : 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("cannot refer themselves") || message.includes("already been referred")
      ? 409
      : 500;
    return json({ error: message }, status);
  }
}

/**
 * GET /api/referral?userId=<id>&validateCode=<code>
 *
 * If `validateCode` is provided, validates that code and returns referrer info.
 * Otherwise returns referral stats for the given userId.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const validateCode = searchParams.get("validateCode");

    // Validate a referral code
    if (validateCode) {
      const result = await validateReferralCode(validateCode);
      return json(result);
    }

    // Get stats
    if (!userId) {
      return json({ error: "userId query parameter is required" }, 400);
    }

    const stats = await getReferralStats(userId);
    return json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ error: message }, 500);
  }
}
