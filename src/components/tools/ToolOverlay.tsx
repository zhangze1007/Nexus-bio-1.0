"use client";

/**
 * Nexus-Bio — ToolOverlay (Left Panel)
 *
 * Design language:
 *   - B&W silicon aesthetic: #000 base, white text at opacity tiers
 *   - JetBrains Mono for ALL numeric values (right-aligned)
 *   - Framer Motion non-linear displacement on state change
 *
 * Parameter changes inject a velocity force into the fluid background
 * proportional to delta magnitude (Raycaster-equivalent via forceRef)
 */

import { motion } from "framer-motion";
import { Activity, type LucideIcon, Pause, Play, RotateCcw } from "lucide-react";
import { type CSSProperties, useCallback, useRef } from "react";
import type { MachineState, SimParams } from "../../machines/metabolicMachine";
import { STATE_LABELS } from "../../machines/metabolicMachine";
import { THEME } from "../../theme";
import type { FluidForce } from "./FluidSimCanvas";
import { PATHD_FLOATING_PANEL_SHEEN, PATHD_FLOATING_PANEL_SURFACE } from "./shared/pathdFloatingPanelStyles";
import { usePathdFloatingPanelScroll } from "./shared/usePathdFloatingPanelScroll";

type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

// ── Parameter definitions ──────────────────────────────────────────────

interface ParamDef {
  key: keyof SimParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Force inject color when this slider moves */
  fluidColor: [number, number, number];
}

const PARAM_DEFS: ParamDef[] = [
  { key: "substrate", label: "[S] Substrate", unit: "mM", min: 0, max: 200, step: 1, fluidColor: [0, 0.55, 0.65] },
  { key: "enzyme", label: "[E] Enzyme", unit: "nM", min: 0, max: 20, step: 0.1, fluidColor: [0.55, 0.03, 0.7] },
  { key: "temperature", label: "Temperature", unit: "°C", min: 20, max: 50, step: 0.5, fluidColor: [0.72, 0.42, 0.02] },
  { key: "pH", label: "pH", unit: "", min: 5.5, max: 9.0, step: 0.1, fluidColor: [0.02, 0.6, 0.38] },
  { key: "vmax", label: "Vmax", unit: "μmol/min", min: 0.5, max: 20, step: 0.1, fluidColor: [0.45, 0.15, 0.7] },
  { key: "km", label: "Km", unit: "mM", min: 0.5, max: 50, step: 0.5, fluidColor: [0.65, 0.35, 0] },
];

// ── Panel variant animations ───────────────────────────────────────────

const panelVariants = {
  idle: { x: 0, opacity: 1, scale: 1 },
  simulating: { x: 0, opacity: 1, scale: 1 },
  stress_test: { x: [-4, 4, -2, 2, 0], opacity: 1, scale: 1.01 },
  equilibrium: { x: 0, opacity: 0.92, scale: 0.995 },
};

// ── Props ──────────────────────────────────────────────────────────────

interface ToolOverlayProps {
  params: SimParams;
  state: MachineState;
  onParam: (key: keyof SimParams, value: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStress: () => void;
  onResume: () => void;
  forceRef: React.MutableRefObject<FluidForce | null>;
  width?: number;
  bottomOffset?: number;
}

// ── Slider component ───────────────────────────────────────────────────

interface SliderProps {
  def: ParamDef;
  value: number;
  onChange: (v: number) => void;
  forceRef: React.MutableRefObject<FluidForce | null>;
}

function ParamSlider({ def, value, onChange, forceRef }: SliderProps) {
  const prevRef = useRef(value);
  const pct = ((value - def.min) / (def.max - def.min)) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = parseFloat(e.target.value);
      const delta = next - prevRef.current;
      const norm = Math.abs(delta) / (def.max - def.min);

      if (norm > 0.002) {
        forceRef.current = {
          x: 0.3 + Math.random() * 0.4,
          y: 0.3 + Math.random() * 0.4,
          dx: delta > 0 ? norm * 0.3 : -norm * 0.3,
          dy: (Math.random() - 0.5) * norm * 0.15,
          strength: 0.4 + norm * 2,
          color: def.fluidColor,
        };
      }
      prevRef.current = next;
      onChange(next);
    },
    [def, onChange, forceRef],
  );

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: THEME.LABEL,
          }}
        >
          {def.label}
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-sm)",
            fontWeight: 600,
            color: THEME.VALUE,
            textAlign: "right",
            minWidth: "72px",
          }}
        >
          {value.toFixed(def.step < 1 ? 1 : 0)}
          <span style={{ fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginLeft: "2px" }}>{def.unit}</span>
        </span>
      </div>

      {/* Track */}
      <div style={{ position: "relative", height: "20px", display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: `${THEME.PROGRESS_HEIGHT}px`,
            borderRadius: `${THEME.PROGRESS_RADIUS}px`,
            background: THEME.PROGRESS_TRACK,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: `${THEME.PROGRESS_RADIUS}px`,
              background: THEME.PROGRESS_GRADIENT,
              boxShadow: THEME.PROGRESS_GLOW,
              transition: "width 0.08s",
            }}
          />
        </div>
        <input
          className="nb-tool-overlay-slider"
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={handleChange}
          style={{
            position: "relative",
            width: "100%",
            height: "20px",
            appearance: "none",
            WebkitAppearance: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 1,
          }}
        />
      </div>

      <style>{`
        .nb-tool-overlay-slider::-webkit-slider-thumb{
          -webkit-appearance:none; width:12px; height:12px;
          border-radius:50%; background:${THEME.PAPER_ELEVATED};
          box-shadow:0 0 0 1px rgba(34,40,48,0.12), 0 0 8px rgba(175,195,214,0.24);
          border:none; cursor:pointer;
        }
        .nb-tool-overlay-slider::-moz-range-thumb{
          width:12px; height:12px; border-radius:50%;
          background:${THEME.PAPER_ELEVATED}; border:none; cursor:pointer;
          box-shadow:0 0 0 1px rgba(34,40,48,0.12), 0 0 8px rgba(175,195,214,0.24);
        }
      `}</style>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────

function ActionBtn({
  label,
  icon: Icon,
  tone = "neutral",
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  icon: LucideIcon;
  tone?: "neutral" | "primary" | "stress";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const toneStyles = disabled
    ? {
        background: "rgba(255,255,255,0.10)",
        border: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.55)",
      }
    : tone === "primary"
      ? {
          background: "rgba(255,255,255,0.08)",
          border: "rgba(255,255,255,0.08)",
          color: THEME.PANEL_STRONG,
        }
      : tone === "stress"
        ? {
            background: "rgba(232,163,161,0.18)",
            border: "rgba(232,163,161,0.34)",
            color: "rgba(255,238,238,0.88)",
          }
        : {
            background: "rgba(255,255,255,0.12)",
            border: "rgba(255,255,255,0.16)",
            color: "rgba(255,255,255,0.84)",
          };
  return (
    <button
      className={["nb-ui-control", className].filter(Boolean).join(" ")}
      onClick={onClick}
      disabled={disabled}
      style={
        {
          flex: 1,
          minHeight: "34px",
          padding: "0 10px",
          borderRadius: "var(--nb-radius-md)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: THEME.MONO,
          fontSize: "var(--nb-fs-xs)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          transition:
            "background 80ms ease, border-color 80ms ease, color 80ms ease, box-shadow 80ms ease, transform 80ms ease",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          border: "0.5px solid var(--nb-control-border)",
          background: "var(--nb-control-bg)",
          color: "var(--nb-control-color)",
          ["--nb-control-bg" as const]: toneStyles.background,
          ["--nb-control-border" as const]: toneStyles.border,
          ["--nb-control-color" as const]: toneStyles.color,
          ["--nb-control-hover-bg" as const]: disabled ? toneStyles.background : "#ffffff",
          ["--nb-control-hover-border" as const]: disabled ? toneStyles.border : "#ffffff",
          ["--nb-control-hover-color" as const]: disabled ? toneStyles.color : THEME.PANEL_STRONG,
          ["--nb-control-active-bg" as const]: disabled ? toneStyles.background : "#ffffff",
          ["--nb-control-active-border" as const]: disabled ? toneStyles.border : "#ffffff",
          ["--nb-control-active-color" as const]: disabled ? toneStyles.color : THEME.PANEL_STRONG,
        } as ControlVarsStyle
      }
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}

// ── Main export ────────────────────────────────────────────────────────

export default function ToolOverlay({
  params,
  state,
  onParam,
  onStart,
  onPause,
  onReset,
  onStress,
  onResume,
  forceRef,
  width = 240,
  bottomOffset = 18,
}: ToolOverlayProps) {
  const stateLabel = STATE_LABELS[state];
  const {
    containPanelInteraction,
    handlePanelWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetTouchState,
  } = usePathdFloatingPanelScroll();

  return (
    <motion.div
      className="nb-pathd-floating-panel nb-pathd-floating-panel--left"
      animate={panelVariants[state]}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: "20px",
        top: "auto",
        bottom: `${bottomOffset}px`,
        transform: "none",
        width: `${width}px`,
        zIndex: 10,
        maxHeight: "min(41vh, 372px)",
        padding: "18px 16px",
        userSelect: "none",
        overflowX: "hidden",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
        ...PATHD_FLOATING_PANEL_SURFACE,
      }}
      onWheelCapture={handlePanelWheel}
      onPointerDownCapture={containPanelInteraction}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={resetTouchState}
    >
      <div
        aria-hidden
        style={{
          ...PATHD_FLOATING_PANEL_SHEEN,
        }}
      />
      {/* Header */}
      <div style={{ marginBottom: "16px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: THEME.LABEL,
            }}
          >
            Method Rail
          </span>
          {/* FSM state indicator */}
          <motion.div
            key={state}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "2px 8px",
              borderRadius: "100px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: THEME.CORAL,
                boxShadow: "0 0 6px rgba(232,163,161,0.48)",
              }}
            />
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                fontWeight: 600,
                color: THEME.VALUE,
                letterSpacing: "0.1em",
              }}
            >
              {stateLabel}
            </span>
          </motion.div>
        </div>
        <div style={{ marginTop: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "12px", fontWeight: 600, color: THEME.VALUE }}>
            Metabolic Parameters
          </span>
        </div>
      </div>

      {/* Parameter sliders */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {PARAM_DEFS.map((def) => (
          <ParamSlider
            key={def.key}
            def={def}
            value={params[def.key]}
            onChange={(v) => onParam(def.key, v)}
            forceRef={forceRef}
          />
        ))}
      </div>

      {/* Divider */}
      <div
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 0", position: "relative", zIndex: 1 }}
      />

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", position: "relative", zIndex: 1 }}>
        {state === "idle" && (
          <ActionBtn
            label="Start"
            icon={Play}
            tone="primary"
            onClick={onStart}
            className="nb-pathd-overlay-idle-start"
          />
        )}
        {state === "simulating" && (
          <>
            <ActionBtn label="Pause" icon={Pause} onClick={onPause} />
            <ActionBtn label="Parameter Oscillation" icon={Activity} tone="stress" onClick={onStress} />
          </>
        )}
        {state === "stress_test" && <ActionBtn label="Resume" icon={Play} onClick={onResume} />}
        {state === "equilibrium" && <ActionBtn label="Restart" icon={RotateCcw} onClick={onStart} />}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <ActionBtn label="Reset" icon={RotateCcw} onClick={onReset} disabled={state === "idle"} />
      </div>

      {/* Michaelis-Menten preview formula */}
      <div
        style={{
          marginTop: "14px",
          padding: "10px",
          borderRadius: "var(--nb-radius-md)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            display: "block",
            marginBottom: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Kinetics Preview
        </span>
        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE }}>
          v = Vmax·[S] / (Km+[S])
        </span>
        <br />
        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
          = {params.vmax.toFixed(1)} · {params.substrate} / ({params.km.toFixed(1)} + {params.substrate})
        </span>
      </div>
    </motion.div>
  );
}
