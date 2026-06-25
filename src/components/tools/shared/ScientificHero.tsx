"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useState } from "react";
import { THEME } from "../../../theme";
export type ScientificSignalTone = "neutral" | "cool" | "warm" | "alert";

export interface ScientificSignal {
  label: string;
  value: string;
  detail?: string;
  tone?: ScientificSignalTone;
}

interface ScientificHeroProps {
  eyebrow: string;
  title: string;
  summary: string;
  signals: ScientificSignal[];
  actions?: ReactNode;
  aside?: ReactNode;
  /** Render as a dismissible floating card with a close button. */
  dismissible?: boolean;
  onDismiss?: () => void;
}

function toneStyle(tone: ScientificSignalTone = "neutral") {
  if (tone === "cool") {
    return {
      border: `${THEME.SUCCESS_MEDIUM}55`,
      background: `${THEME.SUCCESS_LOW}18`,
      color: THEME.SUCCESS_HIGH,
      detailColor: "rgba(210, 238, 220, 0.82)",
    };
  }
  if (tone === "warm") {
    return {
      border: `${THEME.RISK_MEDIUM}52`,
      background: `${THEME.RISK_LOW}18`,
      color: THEME.RISK_MEDIUM,
      detailColor: "rgba(241, 220, 184, 0.84)",
    };
  }
  if (tone === "alert") {
    return {
      border: `${THEME.RISK_HIGH}60`,
      background: `${THEME.RISK_HIGH}1f`,
      color: "#FFB1AC",
      detailColor: "rgba(255, 204, 198, 0.86)",
    };
  }
  return {
    border: "rgba(200,200,216,0.28)",
    background: "rgba(200,200,216,0.10)",
    color: THEME.VALUE,
    detailColor: "rgba(234,240,248,0.7)",
  };
}

export default function ScientificHero({
  eyebrow,
  title,
  summary,
  signals,
  actions,
  aside,
  dismissible = false,
  onDismiss,
}: ScientificHeroProps) {
  // P2.1: default collapsed to a compact 28px lineage bar; expand on click
  const [collapsed, setCollapsed] = useState(true);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {collapsed ? (
        <motion.section
          key="collapsed"
          className="nb-scientific-hero nb-scientific-hero--collapsed"
          role="button"
          tabIndex={0}
          aria-label={`${title} — click to expand`}
          onClick={() => setCollapsed(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setCollapsed(false);
            }
          }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 28 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: "var(--nb-radius-md)",
            border: "1px solid var(--nb-border)",
            background: "var(--nb-surface-glass)",
            padding: "6px var(--nb-space-md)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: "var(--nb-text-label)",
              textTransform: "uppercase",
              letterSpacing: "0.10em",
              flexShrink: 0,
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              fontWeight: 600,
              color: "var(--nb-text-value)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: "var(--nb-text-label)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            ▸ expand
          </span>
        </motion.section>
      ) : (
        <motion.section
          key="expanded"
          className="nb-scientific-hero"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: "var(--nb-radius-xl)",
            border: "1px solid var(--nb-border-active)",
            background: "rgba(10,12,16,0.52)",
            boxShadow: "var(--nb-shadow-high)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            padding: "18px 20px",
            display: "grid",
            gap: "var(--nb-space-md)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "var(--nb-radius-xl)",
              background:
                "linear-gradient(135deg, rgba(191,220,205,0.06) 0%, rgba(175,195,214,0.04) 48%, rgba(207,196,227,0.06) 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Collapse button (always visible in expanded state) */}
          <button
            type="button"
            aria-label="Collapse hero panel"
            onClick={() => setCollapsed(true)}
            style={{
              position: "absolute",
              top: "12px",
              right: dismissible ? "42px" : "12px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: THEME.LABEL,
              cursor: "pointer",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
            title="Collapse"
          >
            ▴
          </button>
          {dismissible && onDismiss ? (
            <button
              type="button"
              aria-label="Dismiss hero panel"
              onClick={onDismiss}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: THEME.LABEL,
                cursor: "pointer",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3,
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.16)";
                (e.currentTarget as HTMLElement).style.color = THEME.VALUE;
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color = THEME.LABEL;
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
              }}
            >
              ×
            </button>
          ) : null}
          <div
            className="nb-scientific-hero__top"
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: aside ? "minmax(0, 1.3fr) minmax(260px, 0.7fr)" : "minmax(0, 1fr)",
              alignItems: "start",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <div
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: THEME.LABEL,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {eyebrow}
                </div>
                <div
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xl)",
                    fontWeight: 700,
                    color: THEME.VALUE,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.08,
                    paddingRight: dismissible ? "32px" : 0,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-sm)",
                    color: "rgba(234,240,248,0.78)",
                    lineHeight: 1.62,
                    maxWidth: "76ch",
                  }}
                >
                  {summary}
                </div>
              </div>

              {actions ? (
                <div
                  className="nb-scientific-hero__actions"
                  style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                >
                  {actions}
                </div>
              ) : null}
            </div>

            {aside ? (
              <div
                className="nb-scientific-hero__aside"
                style={{
                  borderRadius: "var(--nb-radius-lg)",
                  border: "1px solid rgba(175,195,214,0.22)",
                  background: "rgba(175,195,214,0.08)",
                  padding: "14px 16px",
                  display: "grid",
                  gap: "8px",
                  minWidth: 0,
                }}
              >
                {aside}
              </div>
            ) : null}
          </div>

          <div
            className="nb-scientific-hero__signals"
            style={{
              display: "grid",
              gap: "10px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              position: "relative",
              zIndex: 1,
            }}
          >
            {signals.map((signal) => {
              const style = toneStyle(signal.tone);
              return (
                <div
                  key={`${signal.label}-${signal.value}`}
                  className="nb-scientific-hero__signal"
                  style={{
                    borderRadius: "var(--nb-radius-lg)",
                    border: `1px solid ${style.border}`,
                    background: style.background,
                    padding: "12px 14px",
                    display: "grid",
                    gap: "5px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: THEME.LABEL,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {signal.label}
                  </div>
                  <div
                    style={{
                      fontFamily: THEME.SANS,
                      fontSize: "var(--nb-fs-md)",
                      fontWeight: 700,
                      color: style.color,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {signal.value}
                  </div>
                  {signal.detail ? (
                    <div
                      style={{
                        fontFamily: THEME.SANS,
                        fontSize: "var(--nb-fs-xs)",
                        color: style.detailColor,
                        lineHeight: 1.5,
                      }}
                    >
                      {signal.detail}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
