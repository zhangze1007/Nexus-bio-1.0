"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { THEME } from "../../../theme";

/**
 * ParameterPanel — Collapsible parameter input drawer.
 *
 * Glass-panel with collapse toggle (chevron), reset button, consistent padding.
 * Default expanded. Animated collapse with framer-motion.
 */

interface ParameterPanelProps {
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  onReset?: () => void;
}

export default function ParameterPanel({ title, children, defaultCollapsed = false, onReset }: ParameterPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <div
      className="nb-parameter-panel"
      style={{
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_SURFACE,
        overflow: "hidden",
        minHeight: "44px",
        /* Responsive: full-width on mobile */
        width: "100%",
      }}
    >
      {/* Header bar */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          borderBottom: collapsed ? "none" : `1px solid ${THEME.BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Chevron */}
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              color: THEME.LABEL,
              fontSize: "10px",
              fontFamily: THEME.MONO,
              fontWeight: 700,
            }}
          >
            &#9660;
          </motion.span>

          {/* Title */}
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: THEME.VALUE,
            }}
          >
            {title}
          </span>
        </div>

        {/* Reset button */}
        {onReset && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: THEME.R_SM,
              border: `1px solid ${THEME.BORDER}`,
              background: "rgba(255,255,255,0.04)",
              color: THEME.LABEL,
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_XS,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 80ms, color 80ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = THEME.VALUE;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = THEME.LABEL;
            }}
          >
            <span style={{ fontSize: "10px", lineHeight: 1 }}>&#8634;</span>
            Reset
          </button>
        )}
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "14px" }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
