'use client';
/**
 * ResultPanel — Primary reading surface for Axon answers.
 *
 * The audit mandates a text-first reading flow: summary → observations →
 * interpretation → next steps. We delegate that layout to the existing
 * `ResearchAnswerRenderer`, but gate the input into three disjoint modes:
 *
 *   1. `malformed`  — backend returned `meta.parseError` with a code that
 *                     indicates the model tried and failed to produce the
 *                     structured envelope we asked for. We show a clear
 *                     banner and dump the raw model text; we do NOT pass
 *                     malformed content into the structured renderer,
 *                     because the formatter would silently coerce it into
 *                     a plausible-looking brief and hide the failure.
 *
 *   2. `structured` — backend returned a pathway / Axon JSON object which
 *                     the page has already summarised into a
 *                     NEXAIResult.answer. Render chips + structured brief.
 *
 *   3. `plaintext`  — model returned prose (e.g. when the user asks an
 *                     explanatory question). parseError?.code === 'no-object'
 *                     is expected and benign here.
 *
 * `meta.parseError.code === 'no-object'` is NEVER shown as an error — it
 * is the normal signal that the model answered in prose rather than JSON.
 */
import type { NEXAIResult } from '../../../types';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import ResearchAnswerRenderer from '../shared/ResearchAnswerRenderer';

export type ParseErrorCode = 'EMPTY' | 'NO_OBJECT' | 'INVALID_SYNTAX';

export interface ParseErrorInfo {
  code: ParseErrorCode;
  message: string;
}

export interface ResultPanelProps {
  result: NEXAIResult | null;
  /** The un-enriched model text, used when `parseError` says the
   *  structured envelope is malformed. */
  rawText?: string | null;
  parseError?: ParseErrorInfo | null;
  loading?: boolean;
  apiError?: string | null;
}

function isMalformed(parseError?: ParseErrorInfo | null): boolean {
  // 'NO_OBJECT' is benign — model answered in prose. Only 'EMPTY' and
  // 'INVALID_SYNTAX' represent a real failure of the structured contract.
  if (!parseError) return false;
  return parseError.code === 'EMPTY' || parseError.code === 'INVALID_SYNTAX';
}

export default function ResultPanel({
  result,
  rawText,
  parseError,
  loading,
  apiError,
}: ResultPanelProps) {
  if (apiError) {
    return (
      <div
        data-testid="nexai-result-api-error"
        role="alert"
        style={{
          borderRadius: '14px',
          border: '1px solid rgba(250,128,114,0.42)',
          background: 'rgba(250,128,114,0.12)',
          padding: '14px 16px',
          display: 'grid',
          gap: '6px',
        }}
      >
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            fontWeight: 700,
            color: '#FA8072',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Axon unavailable
        </span>
        <p
          style={{
            fontFamily: T.SANS,
            fontSize: '12px',
            color: PATHD_THEME.value,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {apiError}
        </p>
      </div>
    );
  }

  if (!result && !loading) {
    return (
      <div
        data-testid="nexai-result-idle"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '220px',
          borderRadius: '18px',
          border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.panelSurface,
          padding: '28px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '26px', color: 'rgba(36,29,24,0.08)' }}>⬡</span>
          <span style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value }}>
            Ask Axon a research question in plain language
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>
            Press <kbd>/</kbd> to focus the prompt · Axon will summarise, cite, and recommend the next move
          </span>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const malformed = isMalformed(parseError);
  const ungrounded = result.citations.length === 0;

  return (
    <div
      data-testid="nexai-result-panel"
      style={{
        borderRadius: '18px',
        background: PATHD_THEME.panelGlassStrong,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        padding: '16px 18px',
        boxShadow: '0 16px 36px rgba(0,0,0,0.24)',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>AXON</span>
        <Chip
          tone="neutral"
          label={`${(result.confidence * 100).toFixed(0)}%`}
          title="Model-estimated answer confidence"
        />
        <Chip
          tone="neutral"
          label={`${result.citations.length} citation${result.citations.length === 1 ? '' : 's'}`}
        />
        {ungrounded && (
          <Chip
            tone="warn"
            label="ungrounded"
            title="No visible citation support attached to this answer yet"
          />
        )}
        {malformed && (
          <Chip
            tone="alert"
            label="raw fallback"
            title="Model returned malformed structured output — showing raw text"
          />
        )}
      </div>

      {malformed && (
        <MalformedBanner parseError={parseError!} />
      )}

      {ungrounded && !malformed && (
        <p
          data-testid="nexai-result-ungrounded-note"
          style={{
            fontFamily: T.SANS,
            fontSize: '11px',
            color: PATHD_THEME.label,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          This answer does not yet have visible citation support. Treat it as contextual synthesis until Research evidence is attached or a citation-backed rerun is completed.
        </p>
      )}

      {malformed ? (
        <pre
          data-testid="nexai-result-raw-fallback"
          style={{
            margin: 0,
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(10,14,22,0.65)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontFamily: T.MONO,
            fontSize: '11px',
            lineHeight: 1.55,
            color: PATHD_THEME.value,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '420px',
            overflow: 'auto',
          }}
        >
          {rawText ?? result.answer}
        </pre>
      ) : (
        // In pathway mode the page stores a one-sentence synopsis in
        // result.answer for previews (workbench payload, posture card).
        // For the reading surface we prefer the full enriched rawText so
        // formatResearchAnswer's structured path can build real Summary /
        // Observations / Next-steps sections instead of a single-line brief.
        <ResearchAnswerRenderer answer={rawText ?? result.answer} />
      )}
    </div>
  );
}

function Chip({
  tone,
  label,
  title,
}: {
  tone: 'neutral' | 'warn' | 'alert';
  label: string;
  title?: string;
}) {
  const palette = {
    neutral: {
      bg: 'rgba(175,195,214,0.14)',
      border: 'rgba(175,195,214,0.26)',
    },
    warn: {
      bg: 'rgba(232,163,161,0.18)',
      border: 'rgba(232,163,161,0.34)',
    },
    alert: {
      bg: 'rgba(250,128,114,0.18)',
      border: 'rgba(250,128,114,0.42)',
    },
  }[tone];
  return (
    <span
      title={title}
      style={{
        fontFamily: T.MONO,
        fontSize: '8px',
        padding: '2px 6px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: '6px',
        color: PATHD_THEME.value,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}

function MalformedBanner({ parseError }: { parseError: ParseErrorInfo }) {
  return (
    <div
      data-testid="nexai-parse-error-banner"
      role="status"
      style={{
        borderRadius: '12px',
        border: '1px solid rgba(250,128,114,0.42)',
        background: 'rgba(250,128,114,0.10)',
        padding: '10px 12px',
        display: 'grid',
        gap: '4px',
      }}
    >
      <span
        style={{
          fontFamily: T.MONO,
          fontSize: '9px',
          fontWeight: 700,
          color: '#FA8072',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Malformed structured output
      </span>
      <p
        style={{
          fontFamily: T.SANS,
          fontSize: '11px',
          color: PATHD_THEME.value,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        Model returned malformed structured output; showing raw answer. Re-run the query or open the raw output drawer to inspect the full response.
        <span style={{ display: 'block', color: PATHD_THEME.label, marginTop: '4px', fontFamily: T.MONO, fontSize: '10px' }}>
          {parseError.code}: {parseError.message}
        </span>
      </p>
    </div>
  );
}
