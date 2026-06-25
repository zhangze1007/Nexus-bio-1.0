"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { THEME } from "../../theme";

const STORAGE_KEY = "nexus-bio-onboarding-done";

const STEPS = [
  {
    eyebrow: "Welcome",
    title: "Nexus-Bio is a 4-stage research workbench",
    body: "Design pathways, simulate metabolism, engineer chassis, and test iteratively — all in one platform with built-in scientific rigor. Every tool implements real algorithms — FBA, ODE kinetics, ΔG thermodynamics.",
    accent: THEME.SKY,
    icon: "🧬",
  },
  {
    eyebrow: "Start here",
    title: "Browse the tool directory",
    body: "The Tools page groups 14 instruments into 4 stages: Design → Simulate → Engineer → Test. Start with Pathway Designer (Stage 1) to explore your first metabolic route.",
    accent: THEME.MINT,
    icon: "🔬",
  },
  {
    eyebrow: "Anytime",
    title: "Ask Axon for help",
    body: "The floating AI copilot is available on every page. Press Ctrl+K or click the floating button. Ask it to analyze papers, explain bottlenecks, or suggest next steps.",
    accent: THEME.APRICOT,
    icon: "🤖",
  },
  {
    eyebrow: "Track progress",
    title: "Your work is saved automatically",
    body: 'The Workbench tracks experiments, evidence, and decisions across tools. Every tool page has glossary explanations — click "What does this tool do?" to learn more.',
    accent: THEME.LILAC,
    icon: "📊",
  },
];

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      setVisible(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(12px)",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleSkip();
        }}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: "min(440px, 100%)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            boxShadow: "0 28px 64px rgba(0,0,0,0.34)",
            padding: "32px",
            display: "grid",
            gap: "16px",
          }}
        >
          {/* Step indicator */}
          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? "24px" : "6px",
                  height: "6px",
                  borderRadius: "3px",
                  background: i === step ? current.accent : "rgba(255,255,255,0.15)",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div style={{ textAlign: "center", fontSize: "32px", lineHeight: 1 }}>{current.icon}</div>

          {/* Content */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: current.accent,
                marginBottom: "8px",
              }}
            >
              {current.eyebrow}
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: THEME.SANS,
                fontSize: "22px",
                fontWeight: 700,
                color: THEME.VALUE,
                lineHeight: 1.2,
              }}
            >
              {current.title}
            </h2>
            <p
              style={{
                marginTop: "10px",
                fontFamily: THEME.SANS,
                fontSize: "13px",
                color: THEME.LABEL,
                lineHeight: 1.6,
              }}
            >
              {current.body}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <button
              onClick={handleSkip}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: THEME.SANS,
                fontSize: "12px",
                color: THEME.LABEL,
                opacity: 0.6,
                padding: "4px 0",
              }}
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              style={{
                background: current.accent,
                border: "none",
                cursor: "pointer",
                fontFamily: THEME.SANS,
                fontSize: "12px",
                fontWeight: 600,
                color: "#050505",
                borderRadius: "100px",
                padding: "8px 24px",
                boxShadow: `0 8px 24px ${current.accent}33`,
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {step < STEPS.length - 1 ? "Next" : "Get started"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
