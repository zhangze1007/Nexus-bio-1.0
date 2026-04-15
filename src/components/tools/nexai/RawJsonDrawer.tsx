'use client';
/**
 * RawJsonDrawer — Power-user escape hatch for the raw model response.
 *
 * Not a cosmetic toggle. The audit repositions NEXAI around plain-language
 * research prompts, which means the structured JSON envelope must stay
 * available but out of sight by default. This drawer:
 *
 *   • is closed by default (no JSON leaks into the reading flow)
 *   • pretty-prints the raw response when it parses as JSON
 *   • falls back to verbatim text when it doesn't
 *   • surfaces provider, parse strategy, and `parseError` (from PR-1)
 *     so the user can see *why* the structured contract was skipped
 *   • exposes copy-to-clipboard so the response is debuggable without
 *     round-tripping through devtools
 *
 * The drawer is intentionally persistent across queries — users should
 * be able to open it, run a new query, and keep inspecting without it
 * collapsing on them.
 */
import { useState } from 'react';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import type { ParseErrorInfo } from './ResultPanel';

export interface RawJsonDrawerProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  rawText: string | null;
  provider?: string | null;
  parseError?: ParseErrorInfo | null;
  /** When true, the model answered in prose — the drawer still opens but
   *  labels the content as "raw text response" instead of "raw JSON". */
  isProse?: boolean;
}

function prettyPrint(raw: string | null): { body: string; isJson: boolean } {
  if (!raw) return { body: '', isJson: false };
  try {
    const parsed = JSON.parse(raw);
    return { body: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { body: raw, isJson: false };
  }
}

export default function RawJsonDrawer({
  open,
  onToggle,
  rawText,
  provider,
  parseError,
  isProse,
}: RawJsonDrawerProps) {
  const [copied, setCopied] = useState(false);
  const { body, isJson } = prettyPrint(rawText);

  async function handleCopy() {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard denied — swallow; the user can still select the text
    }
  }

  const label = isJson ? 'Raw structured response' : isProse ? 'Raw text response' : 'Raw model response';

  return (
    <div
      data-testid="nexai-raw-json-drawer"
      style={{
        borderRadius: '14px',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelInset,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls="nexai-raw-json-body"
        data-testid="nexai-raw-json-toggle"
        style={{
          width: '100%',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: T.MONO,
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: PATHD_THEME.label,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              fontFamily: T.MONO,
              fontSize: '10px',
              color: PATHD_THEME.label,
            }}
          >
            ▸
          </span>
          <span>{label}</span>
        </span>
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          {provider && (
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(175,195,214,0.12)',
                border: '1px solid rgba(175,195,214,0.24)',
                color: PATHD_THEME.value,
                letterSpacing: '0.04em',
                textTransform: 'none',
              }}
            >
              {provider}
            </span>
          )}
          {parseError && parseError.code !== 'NO_OBJECT' && (
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(250,128,114,0.16)',
                border: '1px solid rgba(250,128,114,0.34)',
                color: '#FA8072',
                letterSpacing: '0.04em',
                textTransform: 'none',
              }}
            >
              {parseError.code}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          id="nexai-raw-json-body"
          data-testid="nexai-raw-json-body"
          style={{
            borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            padding: '10px 14px 14px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: '9px',
                color: PATHD_THEME.label,
                letterSpacing: '0.06em',
              }}
            >
              {rawText ? `${rawText.length.toLocaleString()} chars · ${isJson ? 'parsed as JSON' : 'plain text'}` : 'no response captured yet'}
            </span>
            {rawText && (
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: PATHD_THEME.value,
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {parseError && parseError.code !== 'NO_OBJECT' && (
            <p
              style={{
                margin: 0,
                fontFamily: T.SANS,
                fontSize: '11px',
                color: PATHD_THEME.label,
                lineHeight: 1.55,
              }}
            >
              Backend reported <code style={{ fontFamily: T.MONO }}>{parseError.code}</code>: {parseError.message}
            </p>
          )}
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(10,14,22,0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: T.MONO,
              fontSize: '11px',
              lineHeight: 1.5,
              color: PATHD_THEME.value,
              maxHeight: '340px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {body || 'No raw response captured yet. Run a query to populate this drawer.'}
          </pre>
        </div>
      )}
    </div>
  );
}
