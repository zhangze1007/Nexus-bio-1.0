import type {
  DBTLLearnedFeedback,
  DBTLLearnedMetrics,
  DBTLMetricSource,
} from '../types/dbtlFeedback';

const DBTL_FEEDBACK_SCHEMA_VERSION = 'dbtl-feedback-v1' as const;

const METRIC_KEYS: Array<keyof DBTLLearnedMetrics> = [
  'drainPercent',
  'doRmse',
  'cfpsConfidence',
  'bindingKdUM',
  'yieldChangePercent',
  'growthPenaltyPercent',
  'confidenceScore',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === 'undefined' || typeof value === 'string';
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return typeof value === 'undefined' || (typeof value === 'number' && Number.isFinite(value));
}

function isDBTLLearnedMetrics(value: unknown): value is DBTLLearnedMetrics {
  if (!isRecord(value)) return false;
  return METRIC_KEYS.every((key) => isOptionalFiniteNumber(value[key]));
}

function isDBTLMetricSource(value: unknown): value is DBTLMetricSource {
  if (!isRecord(value)) return false;
  return (
    typeof value.derivedFromToolId === 'string'
    && value.derivedFromToolId.length > 0
    && typeof value.derivedAt === 'string'
    && value.derivedAt.length > 0
    && isOptionalString(value.experimentRecordId)
    && isOptionalString(value.provenanceEntryId)
    && isOptionalString(value.notes)
  );
}

export function isDBTLLearnedFeedback(value: unknown): value is DBTLLearnedFeedback {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === DBTL_FEEDBACK_SCHEMA_VERSION
    && isDBTLLearnedMetrics(value.learnedMetrics)
    && Array.isArray(value.sources)
    && value.sources.every(isDBTLMetricSource)
    && (typeof value.legacyText === 'undefined' || isStringArray(value.legacyText))
  );
}

function buildSource(input: {
  derivedFromToolId?: string;
  provenanceEntryId?: string;
  now: string;
}): DBTLMetricSource | null {
  if (!input.derivedFromToolId) return null;
  return {
    derivedFromToolId: input.derivedFromToolId,
    derivedAt: input.now,
    ...(input.provenanceEntryId ? { provenanceEntryId: input.provenanceEntryId } : {}),
    notes: 'Legacy DBTL feedback normalized without numeric text parsing.',
  };
}

export function normalizeDBTLLearnedFeedback(input: {
  feedback?: unknown;
  legacyLearnedParameters?: unknown;
  derivedFromToolId?: string;
  provenanceEntryId?: string;
  now?: string;
}): DBTLLearnedFeedback {
  if (isDBTLLearnedFeedback(input.feedback)) {
    return input.feedback;
  }

  const now = input.now ?? new Date().toISOString();
  const legacyText = isStringArray(input.legacyLearnedParameters)
    ? [...input.legacyLearnedParameters]
    : undefined;
  const source = buildSource({
    derivedFromToolId: input.derivedFromToolId,
    provenanceEntryId: input.provenanceEntryId,
    now,
  });

  // Legacy strings are intentionally preserved as audit text only. Numeric
  // values must come from typed metrics, never from regex-parsed prose.
  return {
    learnedMetrics: {},
    sources: source ? [source] : [],
    ...(legacyText ? { legacyText } : {}),
    schemaVersion: DBTL_FEEDBACK_SCHEMA_VERSION,
  };
}
