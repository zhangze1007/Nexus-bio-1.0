import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { borderRadius, colors, shadows, spacing, transitions, typography, zIndex } from "../../tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Label text shown above the select */
  label?: string;
  /** Array of options to render */
  options: SelectOption[];
  /** Currently selected value (controlled) */
  value?: string;
  /** Change handler -- receives the selected option's value */
  onChange?: (value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Error message -- triggers error styling when truthy */
  error?: string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Additional class names for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Chevron SVG icon
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transition: `transform ${transitions.duration.normal} ${transitions.easing.apple}`,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Select component
// ---------------------------------------------------------------------------

export function Select({
  label,
  options,
  value,
  onChange,
  disabled = false,
  error,
  placeholder = "Select an option",
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find the currently selected option for display
  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

  // ---- Helpers ---------------------------------------------------------------

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    // Pre-select the current value or the first non-disabled option
    const idx = options.findIndex((opt) => opt.value === value);
    setFocusedIndex(idx >= 0 ? idx : options.findIndex((opt) => !opt.disabled));
  }, [disabled, options, value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      if (opt.disabled) return;
      onChange?.(opt.value);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  // ---- Click-outside to close ------------------------------------------------

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closeDropdown]);

  // ---- Scroll focused option into view ---------------------------------------

  useEffect(() => {
    if (!open || focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, focusedIndex]);

  // ---- Keyboard navigation ---------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ": {
          e.preventDefault();
          if (!open) {
            openDropdown();
          } else if (focusedIndex >= 0) {
            selectOption(options[focusedIndex]);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (!open) {
            openDropdown();
            return;
          }
          setFocusedIndex((prev) => {
            let next = prev + 1;
            while (next < options.length && options[next].disabled) next++;
            return next < options.length ? next : prev;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (!open) {
            openDropdown();
            return;
          }
          setFocusedIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && options[next].disabled) next--;
            return next >= 0 ? next : prev;
          });
          break;
        }
        case "Home": {
          if (!open) return;
          e.preventDefault();
          const first = options.findIndex((opt) => !opt.disabled);
          if (first >= 0) setFocusedIndex(first);
          break;
        }
        case "End": {
          if (!open) return;
          e.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) {
              setFocusedIndex(i);
              break;
            }
          }
          break;
        }
        case "Escape": {
          if (open) {
            e.preventDefault();
            closeDropdown();
          }
          break;
        }
        case "Tab": {
          if (open) closeDropdown();
          break;
        }
        default:
          break;
      }
    },
    [disabled, open, focusedIndex, options, openDropdown, closeDropdown, selectOption],
  );

  // ---- Inline style objects (all derived from tokens) ------------------------

  const wrapperStyle: React.CSSProperties = useMemo(
    () => ({
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: spacing.xs,
      width: "100%",
    }),
    [],
  );

  const labelStyle: React.CSSProperties = useMemo(
    () => ({
      color: error ? colors.state.error : colors.text.secondary,
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.sans,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.wide,
    }),
    [error],
  );

  const triggerStyle: React.CSSProperties = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      width: "100%",
      minHeight: "40px",
      padding: `${spacing.sm} ${spacing.md}`,
      backgroundColor: error ? colors.state.errorMuted : "rgba(255, 255, 255, 0.04)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${error ? colors.state.error : open ? colors.border.accent : colors.border.default}`,
      borderRadius: borderRadius.md,
      boxShadow: open ? (error ? shadows.glowError : shadows.glowPrimary) : shadows.inner,
      color: selectedOption ? colors.text.primary : colors.text.tertiary,
      fontFamily: typography.fontFamily.sans,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      outline: "none",
      transition: [transitions.preset.border, transitions.preset.shadow].join(", "),
    }),
    [error, open, selectedOption, disabled],
  );

  const valueStyle: React.CSSProperties = useMemo(
    () => ({
      flex: 1,
      textAlign: "left" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    [],
  );

  const chevronStyle: React.CSSProperties = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: open ? colors.accent.primary : colors.text.tertiary,
      transition: transitions.preset.color,
    }),
    [open],
  );

  const dropdownStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: spacing.xs,
      maxHeight: "240px",
      overflowY: "auto",
      padding: spacing.xs,
      backgroundColor: colors.bg.elevated,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: `1px solid ${colors.border.default}`,
      borderRadius: borderRadius.md,
      boxShadow: shadows.lg,
      zIndex: zIndex.dropdown,
      listStyle: "none",
      margin: `${spacing.xs} 0 0 0`,
      outline: "none",
    }),
    [],
  );

  const errorStyle: React.CSSProperties = useMemo(
    () => ({
      color: colors.state.error,
      fontSize: typography.fontSize.xs,
      fontFamily: typography.fontFamily.sans,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      paddingLeft: spacing.xs,
      letterSpacing: typography.letterSpacing.wide,
    }),
    [],
  );

  // ---- Render ----------------------------------------------------------------

  const optionCount = options.length;

  return (
    <div ref={wrapperRef} style={wrapperStyle} className={className}>
      {label && <span style={labelStyle}>{label}</span>}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={!!error}
        aria-label={label}
        aria-controls={open ? `${label}-listbox` : undefined}
        aria-activedescendant={open && focusedIndex >= 0 ? `${label}-option-${focusedIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleKeyDown}
        style={triggerStyle}
      >
        <span style={valueStyle}>{selectedOption ? selectedOption.label : placeholder}</span>
        <span style={chevronStyle}>
          <ChevronIcon open={open} />
        </span>
      </button>

      {/* Dropdown list */}
      {open && (
        <ul ref={listRef} id={`${label}-listbox`} role="listbox" aria-label={label} style={dropdownStyle}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            const isDisabled = !!opt.disabled;

            const optionStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.md,
              fontFamily: typography.fontFamily.sans,
              fontWeight: isSelected ? typography.fontWeight.medium : typography.fontWeight.regular,
              color: isDisabled ? colors.text.disabled : isSelected ? colors.text.primary : colors.text.secondary,
              backgroundColor: isFocused
                ? "rgba(255, 255, 255, 0.08)"
                : isSelected
                  ? "rgba(81, 81, 205, 0.12)"
                  : "transparent",
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: isDisabled ? 0.4 : 1,
              transition: transitions.preset.bg,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              userSelect: "none",
              lineHeight: typography.lineHeight.normal,
            };

            return (
              <li
                key={opt.value}
                id={`${label}-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                style={optionStyle}
                onMouseEnter={() => {
                  if (!isDisabled) setFocusedIndex(idx);
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent trigger blur
                  selectOption(opt);
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}

      {/* Error message */}
      {error && (
        <span style={errorStyle} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
