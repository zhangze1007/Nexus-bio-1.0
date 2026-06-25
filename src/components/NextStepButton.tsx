"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { advanceToStep, clearGoalContext, findStepIndex, type GoalContext, loadGoalContext } from "../lib/goal-context";
import { THEME } from "../theme";

interface Props {
  currentStepId: string;
}

export default function NextStepButton({ currentStepId }: Props) {
  const [ctx, setCtx] = useState<GoalContext | null>(null);
  const router = useRouter();

  useEffect(() => {
    setCtx(loadGoalContext());
  }, []);

  if (!ctx) return null;

  const currentIndex = findStepIndex(ctx, currentStepId);
  if (currentIndex === -1) return null;

  const nextStep = ctx.chain[currentIndex + 1] ?? null;
  const isLastStep = !nextStep;

  function handleNext() {
    if (!ctx) return;
    if (isLastStep) {
      clearGoalContext();
      return;
    }
    advanceToStep(currentIndex + 1);
    router.push(nextStep!.route);
  }

  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        onClick={handleNext}
        style={{
          padding: "10px 24px",
          background: isLastStep ? "rgba(147,203,82,0.9)" : "rgba(195,215,232,0.15)",
          border: isLastStep ? "none" : "1px solid rgba(195,215,232,0.3)",
          borderRadius: "8px",
          color: isLastStep ? "#000" : THEME.SKY,
          fontSize: "var(--nb-fs-sm)",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: THEME.SANS,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isLastStep ? "工作流完成 ✓" : `下一步：${nextStep!.label} →`}
      </button>
    </div>
  );
}
