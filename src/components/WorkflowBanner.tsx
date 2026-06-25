"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearGoalContext, findStepIndex, type GoalContext, loadGoalContext } from "../lib/goal-context";
import { THEME } from "../theme";

export default function WorkflowBanner() {
  const [ctx, setCtx] = useState<GoalContext | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setCtx(loadGoalContext());
  }, [pathname]);

  if (!ctx) return null;

  const activeIndex = findStepIndex(ctx, getStepIdFromPath(pathname));

  function handleDismiss() {
    clearGoalContext();
    setCtx(null);
  }

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "var(--nb-fs-xs)",
        fontFamily: THEME.SANS,
        zIndex: 50,
      }}
    >
      <span style={{ color: THEME.LABEL, flexShrink: 0 }}>目标：</span>
      <span
        style={{
          color: THEME.INK,
          fontWeight: 600,
          flexShrink: 0,
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {ctx.goal}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, overflowX: "auto" }}>
        {ctx.chain.map((step, index) => {
          const isDone = index < activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "var(--nb-fs-xxs)",
                  fontWeight: 600,
                  background: isDone
                    ? "rgba(147,203,82,0.15)"
                    : isCurrent
                      ? "rgba(195,215,232,0.2)"
                      : "rgba(255,255,255,0.05)",
                  color: isDone ? "#93CB52" : isCurrent ? THEME.SKY : THEME.LABEL,
                  textDecoration: isDone ? "line-through" : "none",
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                {isDone ? "✓ " : ""}
                {step.label}
              </span>
              {index < ctx.chain.length - 1 && (
                <span style={{ color: THEME.LABEL, fontSize: "var(--nb-fs-xxs)" }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleDismiss}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          color: THEME.LABEL,
          cursor: "pointer",
          fontSize: "14px",
          padding: "2px 6px",
        }}
        aria-label="退出工作流"
      >
        ✕
      </button>
    </div>
  );
}

function getStepIdFromPath(pathname: string): string {
  if (pathname.includes("/pathd")) return "pathd";
  if (pathname.includes("/fbasim")) return "fbasim";
  if (pathname.includes("/catdes")) return "catdes";
  if (pathname.includes("/genmim")) return "genmim";
  if (pathname.includes("/gecair")) return "gecair";
  if (pathname.includes("/dyncon")) return "dyncon";
  if (pathname.includes("/analyze")) return "analyze";
  return "";
}
