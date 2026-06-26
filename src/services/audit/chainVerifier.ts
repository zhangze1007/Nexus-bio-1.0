/**
 * Audit Chain Verifier — Validates the SHA-256 hash chain integrity.
 *
 * Walks every entry in the audit_log table (ordered by sequence_number)
 * and verifies:
 *   1. Each entry's previousHash matches the prior entry's hash.
 *   2. Each entry's hash is a valid SHA-256 of its deterministic fields.
 *
 * Returns detailed verification results for GxP compliance reporting.
 */

import { createHash } from "crypto";
import { sqlAll } from "../../server/libsqlDb";

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt: number | null; // sequence number where chain breaks
  error?: string;
}

/**
 * Recompute the expected hash for a single audit entry row.
 */
function recomputeHash(entry: Record<string, unknown>): string {
  const hashInput = JSON.stringify({
    timestamp: entry.timestamp,
    actorId: entry.actor_id,
    action: entry.action,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    previousHash: entry.previous_hash,
  });
  return createHash("sha256").update(hashInput).digest("hex");
}

const GENESIS_HASH = "0".repeat(64);

/**
 * Verify the entire audit chain from genesis to the latest entry.
 *
 * Returns `{ valid: true }` when every link is intact, or details
 * about where the chain broke.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const entries = await sqlAll("SELECT * FROM audit_log ORDER BY sequence_number ASC");

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0, verifiedEntries: 0, brokenAt: null };
  }

  let previousHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const seqNum = Number(entry.sequence_number);

    // 1. Verify previous hash link
    if (String(entry.previous_hash) !== previousHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedEntries: i,
        brokenAt: seqNum,
        error: `Previous hash mismatch at sequence ${seqNum}`,
      };
    }

    // 2. Recompute and verify this entry's hash
    const expectedHash = recomputeHash(entry);
    if (String(entry.hash) !== expectedHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedEntries: i,
        brokenAt: seqNum,
        error: `Hash mismatch at sequence ${seqNum}`,
      };
    }

    previousHash = String(entry.hash);
  }

  return {
    valid: true,
    totalEntries: entries.length,
    verifiedEntries: entries.length,
    brokenAt: null,
  };
}
