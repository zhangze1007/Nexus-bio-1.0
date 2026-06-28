"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Beaker, CircuitBoard, GitBranch, Microscope, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Tour step definition                                               */
/* ------------------------------------------------------------------ */

export interface TourStep {
  id: string;
  title: string;
  text: string;
  target: string; // CSS selector for the highlight target
  position: "top" | "bottom" | "left" | "right";
  icon: React.ElementType;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Nexus-Bio",
    text: "A synthetic biology AI platform for pathway design, metabolic simulation, and protein engineering. Let's walk through the interface.",
    target: "body",
    position: "bottom",
    icon: Sparkles,
  },
  {
    id: "sidebar",
    title: "Tool Sidebar",
    text: "Access all 14 computational tools from the sidebar -- FBA, thermodynamics, protein evolution, gene circuits, and more.",
    target: '[data-tour="sidebar"]',
    position: "right",
    icon: GitBranch,
  },
  {
    id: "first-tool",
    title: "Run Your First Tool",
    text: "Each tool provides real scientific simulations. Start with Pathway Designer to map metabolic routes, or jump straight into FBA for flux analysis.",
    target: '[data-tour="tool-canvas"]',
    position: "left",
    icon: Beaker,
  },
  {
    id: "workbench",
    title: "Experiment Workbench",
    text: "Track experiments, decisions, and evidence across iterations. Every run is logged with full provenance for reproducibility.",
    target: '[data-tour="workbench"]',
    position: "top",
    icon: Microscope,
  },
  {
    id: "nexai",
    title: "NEXAI Research Agent",
    text: "Ask questions in natural language. NEXAI searches literature, designs pathways, and reasons across all modules using the Axon orchestration engine.",
    target: '[data-tour="nexai"]',
    position: "left",
    icon: CircuitBoard,
  },
];

/* ------------------------------------------------------------------ */
/*  Framer Motion variants                                             */
/* ------------------------------------------------------------------ */

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

const tooltipVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 380, damping: 28 } },
  exit: { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } },
} as const;

const highlightVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.12 } },
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTooltipPosition(targetRect: DOMRect, position: TourStep["position"]) {
  const gap = 16;
  switch (position) {
    case "top":
      return {
        top: targetRect.top - gap,
        left: targetRect.left + targetRect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left + targetRect.width / 2,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.left - gap,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.right + gap,
        transform: "translate(0, -50%)",
      };
    default:
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left + targetRect.width / 2,
        transform: "translate(-50%, 0)",
      };
  }
}

function getHighlightStyle(rect: DOMRect) {
  const pad = 8;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface OnboardingTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function OnboardingTour({ steps = TOUR_STEPS, isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const current = useMemo(() => steps[stepIndex], [steps, stepIndex]);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const Icon = current.icon as React.ComponentType<{ size?: number; color?: string }>;

  /* -- measure target element -- */
  const measure = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [current]);

  useEffect(() => {
    if (!isOpen) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, measure]);

  /* -- keyboard navigation -- */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) {
          onComplete?.();
          onClose();
        } else setStepIndex((i) => i + 1);
      }
      if (e.key === "ArrowLeft" && !isFirst) {
        setStepIndex((i) => i - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isFirst, isLast, onClose, onComplete]);

  /* -- reset on reopen -- */
  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const highlight = targetRect
    ? getHighlightStyle(targetRect)
    : { top: "50%", left: "50%", width: 0, height: 0, transform: "translate(-50%,-50%)" };

  const tooltip = targetRect
    ? getTooltipPosition(targetRect, current.position)
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="onboarding-overlay"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "auto",
          }}
          data-testid="onboarding-overlay"
        >
          {/* Dimmed backdrop */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
            }}
            onClick={onClose}
            data-testid="onboarding-backdrop"
          />

          {/* Highlight cutout */}
          {targetRect && (
            <motion.div
              variants={highlightVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: "absolute",
                ...highlight,
                borderRadius: THEME.R_MD,
                boxShadow: `0 0 0 4000px rgba(0,0,0,0.55)`,
                pointerEvents: "none",
              }}
              data-testid="tour-highlight"
            />
          )}

          {/* Tooltip card */}
          <motion.div
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: "absolute",
              ...tooltip,
              width: 360,
              maxWidth: "90vw",
              background: THEME.PANEL_GRADIENT_STRONG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              borderRadius: THEME.R_MD,
              padding: `${THEME.SP_LG}px`,
              boxShadow: THEME.SHADOW_HIGH,
              pointerEvents: "auto",
            }}
            data-testid="tour-tooltip"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close tour"
              data-testid="tour-close"
              style={{
                position: "absolute",
                top: THEME.SP_SM,
                right: THEME.SP_SM,
                background: "transparent",
                border: "none",
                color: THEME.DIM,
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>

            {/* Icon + step counter */}
            <div style={{ display: "flex", alignItems: "center", gap: THEME.SP_SM, marginBottom: THEME.SP_SM }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: THEME.R_SM,
                  background: "rgba(175,195,214,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={18} color={THEME.SKY} />
              </div>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  color: THEME.DIM,
                  marginLeft: "auto",
                }}
              >
                {stepIndex + 1} / {steps.length}
              </span>
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: THEME.BRAND,
                fontSize: THEME.FS_LG,
                color: THEME.INK,
                margin: 0,
                marginBottom: THEME.SP_XS,
              }}
            >
              {current.title}
            </h3>

            {/* Body */}
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_MD,
                color: THEME.LABEL,
                margin: 0,
                lineHeight: 1.6,
                marginBottom: THEME.SP_LG,
              }}
            >
              {current.text}
            </p>

            {/* Progress dots */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: THEME.SP_MD,
              }}
            >
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  data-testid={`progress-dot-${i}`}
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background:
                      i === stepIndex
                        ? THEME.PROGRESS_GRADIENT
                        : i < stepIndex
                          ? "rgba(191,220,205,0.45)"
                          : "rgba(255,255,255,0.12)",
                    transition: "width 0.25s ease, background 0.25s ease",
                  }}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: THEME.SP_SM }}>
              <button
                onClick={() => setStepIndex((i) => i - 1)}
                disabled={isFirst}
                data-testid="tour-prev"
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  padding: `${THEME.SP_XS + 2}px ${THEME.SP_MD}px`,
                  borderRadius: THEME.R_SM,
                  border: `1px solid ${THEME.BORDER}`,
                  background: "transparent",
                  color: isFirst ? THEME.INK_SOFT : THEME.INK,
                  cursor: isFirst ? "default" : "pointer",
                  opacity: isFirst ? 0.35 : 1,
                }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (isLast) {
                    onComplete?.();
                    onClose();
                  } else setStepIndex((i) => i + 1);
                }}
                data-testid="tour-next"
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  fontWeight: 600,
                  padding: `${THEME.SP_XS + 2}px ${THEME.SP_MD}px`,
                  borderRadius: THEME.R_SM,
                  border: "none",
                  background: THEME.PROGRESS_GRADIENT,
                  color: "#050505",
                  cursor: "pointer",
                }}
              >
                {isLast ? "Get Started" : "Next"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
