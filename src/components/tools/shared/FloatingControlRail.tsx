"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { THEME } from "../../../theme";

interface FloatingControlRailProps {
  children: React.ReactNode;
  width?: number;
  label?: string;
  defaultCollapsed?: boolean;
}

export default function FloatingControlRail({
  children,
  width = 240,
  label = "Controls",
  defaultCollapsed = false,
}: FloatingControlRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = useId();

  /* Desktop: side rail. Mobile (<768px): bottom sheet. */
  return (
    <>
      {/* ── Desktop side rail ── */}
      <motion.div
        className="nb-floating-rail hidden md:flex"
        data-expanded={!collapsed || undefined}
        animate={{ width: collapsed ? 40 : width }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        style={{
          flexShrink: 0,
          borderRight: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_MUTED,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          willChange: "width",
        }}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "10px 12px",
            borderBottom: collapsed ? "none" : `1px solid ${THEME.BORDER}`,
            cursor: "pointer",
            background: "transparent",
            border: "none",
            width: "100%",
            minHeight: "44px",
            color: "inherit",
            font: "inherit",
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {!collapsed && (
            <span
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: THEME.LABEL,
              }}
            >
              {label}
            </span>
          )}
          {collapsed ? <ChevronRight size={14} color={THEME.LABEL} /> : <ChevronLeft size={14} color={THEME.LABEL} />}
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              id={contentId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Mobile bottom sheet ── */}
      <div className="md:hidden" style={{ width: "100%" }}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            cursor: "pointer",
            background: THEME.PANEL_MUTED,
            border: "none",
            borderTop: `1px solid ${THEME.BORDER}`,
            borderBottom: collapsed ? "none" : `1px solid ${THEME.BORDER}`,
            width: "100%",
            minHeight: "44px",
            color: "inherit",
            font: "inherit",
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: THEME.LABEL,
            }}
          >
            {label}
          </span>
          {collapsed ? <ChevronUp size={14} color={THEME.LABEL} /> : <ChevronDown size={14} color={THEME.LABEL} />}
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              id={contentId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                overflow: "hidden",
                background: THEME.PANEL_MUTED,
                borderTop: `1px solid ${THEME.BORDER}`,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
