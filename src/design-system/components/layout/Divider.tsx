import { tokens } from "../../tokens";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  label?: string;
}

export function Divider({ orientation = "horizontal", className, label }: DividerProps) {
  const borderColor = tokens.colors.border.default;

  if (orientation === "vertical") {
    return (
      <div
        className={className}
        style={{
          width: "1px",
          height: "100%",
          backgroundColor: borderColor,
        }}
      />
    );
  }

  if (label) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing.md,
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: borderColor,
          }}
        />
        <span
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.text.tertiary,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: borderColor,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "1px",
        backgroundColor: borderColor,
      }}
    />
  );
}
