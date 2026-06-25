"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { THEME } from "../../../theme";

/**
 * DetailDrawer — Slide-out detail view for drill-downs.
 *
 * Right-side drawer (400px wide) with backdrop, close button, scroll content.
 * AnimatePresence for enter/exit.
 */

interface DetailDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const DRAWER_WIDTH = 400;

export default function DetailDrawer({ open, title, onClose, children }: DetailDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 9990,
            }}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: DRAWER_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: DRAWER_WIDTH }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: `${DRAWER_WIDTH}px`,
              maxWidth: "90vw",
              background: THEME.BG_PANEL,
              borderLeft: `1px solid ${THEME.BORDER}`,
              zIndex: 9991,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: `1px solid ${THEME.BORDER}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_MD,
                  fontWeight: 600,
                  color: THEME.VALUE,
                  letterSpacing: "0.02em",
                }}
              >
                {title}
              </span>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: THEME.R_SM,
                  border: `1px solid ${THEME.BORDER}`,
                  background: "rgba(255,255,255,0.04)",
                  color: THEME.LABEL,
                  cursor: "pointer",
                  fontSize: THEME.FS_MD,
                  fontFamily: THEME.MONO,
                  fontWeight: 400,
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
                &#10005;
              </button>
            </div>

            {/* Scrollable content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
