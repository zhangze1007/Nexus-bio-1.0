"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { locales, localeLabels, localeShortLabels, defaultLocale, type Locale } from "../../i18n/routing";
import { THEME } from "../../theme";

/**
 * Language switcher dropdown.
 *
 * Reads the current locale from the `NEXT_LOCALE` cookie.
 * On selection, sets the cookie and reloads the page so
 * server components pick up the new locale.
 */

function getStoredLocale(): Locale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  if (match && locales.includes(match[1] as Locale)) {
    return match[1] as Locale;
  }
  return defaultLocale;
}

interface LanguageSwitcherProps {
  /** Compact mode for tight spaces (e.g., IDETopBar). */
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>(defaultLocale);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentLocale(getStoredLocale());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectLocale = useCallback((locale: Locale) => {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    setCurrentLocale(locale);
    setOpen(false);
    // Reload so server components pick up the new locale
    window.location.reload();
  }, []);

  const SANS = THEME.SANS;
  const MONO = THEME.MONO;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: compact ? "4px" : "6px",
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: "8px",
          border: `1px solid ${open ? THEME.BORDER_ACTIVE : THEME.BORDER}`,
          background: THEME.PANEL_GLASS_STRONG,
          color: THEME.VALUE,
          fontFamily: MONO,
          fontSize: compact ? "10px" : "11px",
          cursor: "pointer",
          transition: "border-color 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        <Globe size={compact ? 12 : 14} style={{ color: THEME.LABEL, flexShrink: 0 }} />
        <span>{localeShortLabels[currentLocale]}</span>
        <ChevronDown
          size={10}
          style={{
            color: THEME.LABEL,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Language options"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            minWidth: "140px",
            padding: "4px",
            borderRadius: "10px",
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_GRADIENT_STRONG,
            boxShadow: THEME.SHADOW_HIGH,
            zIndex: 1000,
          }}
        >
          {locales.map((loc) => {
            const isActive = loc === currentLocale;
            return (
              <button
                key={loc}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => selectLocale(loc)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: isActive ? "rgba(175, 195, 214, 0.12)" : "transparent",
                  color: isActive ? THEME.VALUE : THEME.LABEL,
                  fontFamily: SANS,
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(175, 195, 214, 0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "10px",
                    color: isActive ? THEME.MINT : THEME.DIM,
                    fontWeight: isActive ? 600 : 400,
                    minWidth: "20px",
                  }}
                >
                  {localeShortLabels[loc]}
                </span>
                <span>{localeLabels[loc]}</span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: THEME.MINT,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
