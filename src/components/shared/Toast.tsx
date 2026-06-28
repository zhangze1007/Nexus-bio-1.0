"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { THEME } from "../../theme";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const TYPE_CONFIG: Record<ToastType, { bg: string; border: string; icon: string; accent: string }> = {
  success: {
    bg: "rgba(191, 220, 205, 0.12)",
    border: "rgba(191, 220, 205, 0.35)",
    icon: "✓",
    accent: THEME.MINT,
  },
  error: {
    bg: "rgba(232, 163, 161, 0.12)",
    border: "rgba(232, 163, 161, 0.35)",
    icon: "✗",
    accent: THEME.CORAL,
  },
  info: {
    bg: "rgba(175, 195, 214, 0.12)",
    border: "rgba(175, 195, 214, 0.35)",
    icon: "ℹ",
    accent: THEME.SKY,
  },
  warning: {
    bg: "rgba(231, 199, 169, 0.12)",
    border: "rgba(231, 199, 169, 0.35)",
    icon: "⚠",
    accent: THEME.APRICOT,
  },
};

/** Single toast notification with auto-dismiss and framer-motion animation. */
export function ToastNotification({ toast, onRemove }: ToastProps) {
  const config = TYPE_CONFIG[toast.type];

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        minWidth: "280px",
        maxWidth: "420px",
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: THEME.R_MD,
        backdropFilter: "blur(12px)",
        boxShadow: THEME.SHADOW_MEDIUM,
        fontFamily: THEME.SANS,
        fontSize: THEME.FS_SM,
        color: THEME.VALUE,
        pointerEvents: "auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: config.accent,
          color: "#0a0a0a",
          fontSize: "12px",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {config.icon}
      </span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          color: THEME.LABEL,
          cursor: "pointer",
          padding: "2px",
          fontSize: "14px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {"✕"}
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

/** Renders a stack of toast notifications in the top-right corner. */
export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastNotification key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}
