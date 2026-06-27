"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { THEME } from "../../theme";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: THEME.PANEL_STRONG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              borderRadius: THEME.R_LG,
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: THEME.SHADOW_HIGH,
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: "8px",
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_LG,
                color: THEME.VALUE,
                fontWeight: 600,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: 0,
                marginBottom: "20px",
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: THEME.LABEL,
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={onCancel}
                style={{
                  height: "36px",
                  padding: "0 16px",
                  borderRadius: THEME.R_MD,
                  border: `1px solid ${THEME.BORDER}`,
                  background: "transparent",
                  color: THEME.LABEL,
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  cursor: "pointer",
                }}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                style={{
                  height: "36px",
                  padding: "0 16px",
                  borderRadius: THEME.R_MD,
                  border: "none",
                  background: variant === "destructive" ? THEME.CORAL : THEME.MINT,
                  color: "#0a0a0a",
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
