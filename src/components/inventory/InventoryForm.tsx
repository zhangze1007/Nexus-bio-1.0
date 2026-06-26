"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { THEME } from "../../theme";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "chips";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For chips type: comma-separated values stored as JSON array */
  isArray?: boolean;
  /** Helper text shown below the field */
  helperText?: string;
  /** Auto-calculate callback (for primers: Tm, GC%) */
  onAutoCalc?: (formState: Record<string, string>) => Record<string, string> | null;
}

interface InventoryFormProps {
  title: string;
  fields: FormField[];
  initialValues?: Record<string, string>;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export default function InventoryForm({
  title,
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isLoading = false,
}: InventoryFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const setValue = useCallback(
    (name: string, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // Run auto-calc callbacks
        for (const field of fields) {
          if (field.onAutoCalc) {
            const updates = field.onAutoCalc(next);
            if (updates) {
              Object.assign(next, updates);
            }
          }
        }
        return next;
      });
      // Clear error on change
      setErrors((prev) => {
        if (prev[name]) {
          const next = { ...prev };
          delete next[name];
          return next;
        }
        return prev;
      });
    },
    [fields],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Validate required fields
      const newErrors: Record<string, string> = {};
      for (const field of fields) {
        if (field.required && (!values[field.name] || values[field.name].trim() === "")) {
          newErrors[field.name] = `${field.label} is required`;
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Convert values to proper types
      const result: Record<string, unknown> = {};
      for (const field of fields) {
        const val = values[field.name];
        if (val === undefined || val === "") continue;

        if (field.type === "number") {
          result[field.name] = parseFloat(val);
        } else if (field.isArray) {
          // Parse comma-separated into JSON array
          result[field.name] = JSON.stringify(
            val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );
        } else {
          result[field.name] = val;
        }
      }

      onSubmit(result);
    },
    [fields, values, onSubmit],
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onCancel();
    },
    [onCancel],
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflow: "auto",
          background: THEME.BG_SIDEBAR,
          border: `1px solid ${THEME.BORDER}`,
          borderRadius: THEME.R_LG,
          boxShadow: THEME.SHADOW_HIGH,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${THEME.SP_MD}px ${THEME.SP_LG}px`,
            borderBottom: `1px solid ${THEME.BORDER}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: THEME.BRAND,
              fontSize: THEME.FS_LG,
              color: THEME.INK,
              fontWeight: 600,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: THEME.R_SM,
              border: "none",
              background: "transparent",
              color: THEME.INK_SOFT,
              cursor: "pointer",
              fontSize: "18px",
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: THEME.SP_MD,
            padding: `${THEME.SP_MD}px ${THEME.SP_LG}px ${THEME.SP_LG}px`,
          }}
        >
          {fields.map((field) => (
            <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                htmlFor={`field-${field.name}`}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_XS,
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                {field.label}
                {field.required && <span style={{ color: THEME.CORAL, marginLeft: "4px" }}>*</span>}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  id={`field-${field.name}`}
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{
                    padding: "8px 12px",
                    borderRadius: THEME.R_SM,
                    border: `1px solid ${errors[field.name] ? THEME.CORAL : THEME.BORDER}`,
                    background: THEME.INPUT_BG,
                    color: THEME.INPUT_TEXT,
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              ) : field.type === "select" ? (
                <select
                  id={`field-${field.name}`}
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: THEME.R_SM,
                    border: `1px solid ${errors[field.name] ? THEME.CORAL : THEME.BORDER}`,
                    background: THEME.INPUT_BG,
                    color: THEME.INPUT_TEXT,
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    outline: "none",
                  }}
                >
                  <option value="">{field.placeholder || "Select..."}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${field.name}`}
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.name] || ""}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  step={field.type === "number" ? "any" : undefined}
                  style={{
                    padding: "8px 12px",
                    borderRadius: THEME.R_SM,
                    border: `1px solid ${errors[field.name] ? THEME.CORAL : THEME.BORDER}`,
                    background: THEME.INPUT_BG,
                    color: THEME.INPUT_TEXT,
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    outline: "none",
                  }}
                />
              )}

              {field.helperText && !errors[field.name] && (
                <span
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "10px",
                    color: THEME.INK_SOFT,
                  }}
                >
                  {field.helperText}
                </span>
              )}

              {errors[field.name] && (
                <span
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "10px",
                    color: THEME.CORAL,
                  }}
                >
                  {errors[field.name]}
                </span>
              )}
            </div>
          ))}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: THEME.SP_SM,
              paddingTop: THEME.SP_SM,
              borderTop: `1px solid ${THEME.BORDER}`,
              marginTop: THEME.SP_SM,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 20px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.BORDER}`,
                background: "transparent",
                color: THEME.INK_SOFT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "8px 20px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.MINT}55`,
                background: `${THEME.MINT}20`,
                color: THEME.MINT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
