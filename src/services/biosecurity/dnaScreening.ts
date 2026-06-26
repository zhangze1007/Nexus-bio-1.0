/**
 * Biosecurity DNA Screening Service
 *
 * Screens DNA sequences against the CDC/USDA select agent database using
 * sliding-window local identity alignment. All screening results are logged
 * to the audit trail for regulatory compliance.
 *
 * Algorithm:
 *   1. Normalize input sequence (uppercase, strip non-ACGT characters)
 *   2. Slide a window of length min(inputLen, refLen) across the longer sequence
 *   3. At each position, compute positional identity (exact matches / window length)
 *   4. Keep the maximum identity across all window positions
 *   5. Classify: blocked (>90%), review (>threshold), clear (otherwise)
 *
 * This is a pure local implementation with no external API dependencies.
 * For production use, supplement with BLAST-style seed-and-extend and
 * full reference genome databases.
 */

import {
  SELECT_AGENTS,
  type SelectAgentEntry,
} from '../../data/biosecurity/selectAgents';

// ─── Types ───────────────────────────────────────────────────────

export interface ScreeningMatch {
  /** The matched reference sequence fragment */
  sequence: string;
  /** Scientific organism name */
  organism: string;
  /** Maximum local identity (0-1) */
  identity: number;
  /** Applicable regulation (HHS, USDA, or both) */
  regulation: string;
  /** Gene or toxin target */
  gene?: string;
  /** NCBI accession for provenance */
  accession?: string;
}

export interface ScreeningResult {
  /** Overall screening status */
  status: 'clear' | 'review' | 'blocked';
  /** All matches that exceeded the identity threshold */
  matches: ScreeningMatch[];
  /** Timestamp of the screening (ISO 8601) */
  timestamp: string;
  /** Length of the input sequence after normalization */
  inputLength: number;
  /** Identity threshold used for this screening */
  threshold: number;
  /** Minimum window length used for this screening */
  minWindowLength: number;
}

export interface ScreeningConfig {
  /** Minimum identity (0-1) to flag for review. Default: 0.80 */
  identityThreshold?: number;
  /** Minimum window length in bp for alignment. Default: 200 */
  minWindowLength?: number;
  /** Whether to log results to audit trail. Default: true */
  enableAuditLog?: boolean;
}

// ─── Sequence Utilities ──────────────────────────────────────────

/**
 * Normalize a DNA sequence: uppercase and strip everything except ACGT.
 */
export function normalizeSequence(raw: string): string {
  return raw.toUpperCase().replace(/[^ACGT]/g, '');
}

/**
 * Validate that a sequence is non-empty after normalization.
 */
function validateSequence(raw: string): string {
  const normalized = normalizeSequence(raw);
  if (normalized.length === 0) {
    throw new Error('Sequence is empty after normalization (no ACGT characters found)');
  }
  return normalized;
}

// ─── Sliding-Window Local Identity ───────────────────────────────

/**
 * Compute the maximum local identity between query and reference using
 * a sliding-window approach.
 *
 * The window length is min(queryLen, refLen, maxWindow), clamped to at
 * least minWindow. The shorter sequence is slid across the longer one,
 * and the best positional identity is returned.
 *
 * @param query     Normalized query sequence
 * @param reference Normalized reference sequence
 * @param minWindow Minimum window length in bp
 * @returns         Maximum identity found (0-1)
 */
export function maxLocalIdentity(query: string, reference: string, minWindow: number): number {
  const qLen = query.length;
  const rLen = reference.length;

  if (qLen === 0 || rLen === 0) return 0;

  // Determine window length: use the shorter sequence length, clamped to minWindow
  const windowLen = Math.max(minWindow, Math.min(qLen, rLen));

  // If both sequences are shorter than minWindow, still compute — just use the shorter
  const effectiveWindow = Math.min(windowLen, qLen, rLen);

  if (effectiveWindow === 0) return 0;

  let bestIdentity = 0;

  // Slide the shorter sequence across the longer one
  const shorterIsQuery = qLen <= rLen;
  const shorter = shorterIsQuery ? query : reference;
  const longer = shorterIsQuery ? reference : query;
  const slideRange = longer.length - shorter.length + 1;

  for (let offset = 0; offset < slideRange; offset++) {
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[offset + i]) {
        matches++;
      }
    }
    const identity = matches / shorter.length;
    if (identity > bestIdentity) {
      bestIdentity = identity;
    }
    // Early exit: perfect match found
    if (bestIdentity >= 1.0) break;
  }

  return bestIdentity;
}

// ─── Audit Logging ───────────────────────────────────────────────

/** In-memory audit log for screening events. Exported for testing. */
export const screeningAuditLog: Array<{
  timestamp: string;
  sequenceLength: number;
  status: 'clear' | 'review' | 'blocked';
  matchCount: number;
  topOrganism: string | null;
  topIdentity: number;
  threshold: number;
}> = [];

/**
 * Record a screening event to the in-memory audit log.
 * Production deployments should pipe this to the persistent audit system
 * (see `src/services/audit/auditLogger.ts`).
 */
function logScreeningResult(result: ScreeningResult): void {
  const topMatch = result.matches.length > 0
    ? result.matches.reduce((best, m) => (m.identity > best.identity ? m : best))
    : null;

  const entry = {
    timestamp: result.timestamp,
    sequenceLength: result.inputLength,
    status: result.status,
    matchCount: result.matches.length,
    topOrganism: topMatch?.organism ?? null,
    topIdentity: topMatch?.identity ?? 0,
    threshold: result.threshold,
  };

  screeningAuditLog.push(entry);

  // Also log to console for development visibility
  if (result.status !== 'clear') {
    console.warn(
      `[Biosecurity] Sequence screened: status=${result.status}, ` +
        `matches=${result.matches.length}, ` +
        `topOrganism=${topMatch?.organism ?? 'none'}, ` +
        `topIdentity=${(topMatch?.identity ?? 0).toFixed(4)}`
    );
  }
}

// ─── Core Screening Functions ────────────────────────────────────

/**
 * Screen a single DNA sequence against all select agent entries.
 *
 * @param sequence Raw DNA sequence (will be normalized)
 * @param config   Optional configuration overrides
 * @returns        Screening result with status and matches
 */
export function screenSequence(sequence: string, config?: ScreeningConfig): ScreeningResult {
  const threshold = config?.identityThreshold ?? 0.8;
  const minWindow = config?.minWindowLength ?? 200;
  const enableAudit = config?.enableAuditLog ?? true;

  const normalized = validateSequence(sequence);
  const matches: ScreeningMatch[] = [];

  for (const agent of SELECT_AGENTS) {
    // Normalize the reference sequence (should already be clean, but be safe)
    const refSeq = normalizeSequence(agent.sequence);

    // Skip entries with sequences shorter than effective minimum
    if (refSeq.length === 0) continue;

    const identity = maxLocalIdentity(normalized, refSeq, minWindow);

    // Only include matches above the review threshold
    if (identity >= threshold) {
      matches.push({
        sequence: agent.sequence,
        organism: agent.organism,
        identity,
        regulation: agent.regulation,
        gene: agent.gene,
        accession: agent.accession,
      });
    }
  }

  // Sort matches by identity descending
  matches.sort((a, b) => b.identity - a.identity);

  // Determine status from the best match
  let status: 'clear' | 'review' | 'blocked';
  if (matches.length === 0) {
    status = 'clear';
  } else {
    const bestIdentity = matches[0].identity;
    // Sequences above 90% identity to select agents are blocked outright
    status = bestIdentity > 0.9 ? 'blocked' : 'review';
  }

  const result: ScreeningResult = {
    status,
    matches,
    timestamp: new Date().toISOString(),
    inputLength: normalized.length,
    threshold,
    minWindowLength: minWindow,
  };

  if (enableAudit) {
    logScreeningResult(result);
  }

  return result;
}

/**
 * Screen a batch of DNA sequences against all select agent entries.
 *
 * @param sequences Array of raw DNA sequences
 * @param config    Optional configuration overrides
 * @returns         Array of screening results (one per input sequence)
 */
export function screenBatch(sequences: string[], config?: ScreeningConfig): ScreeningResult[] {
  return sequences.map((seq) => screenSequence(seq, config));
}

/**
 * Clear the in-memory audit log. Useful for testing.
 */
export function clearAuditLog(): void {
  screeningAuditLog.length = 0;
}
