"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME } from "../../theme";
import { TOOL_DEFINITIONS } from "../tools/shared/toolRegistry";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface CommandItem {
  id: string;
  label: string;
  description: string;
  section: "Tools" | "Projects" | "Actions";
  icon: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  /* ---- Build items from tool registry + static actions ---- */
  const items = useMemo<CommandItem[]>(() => {
    const tools: CommandItem[] = TOOL_DEFINITIONS.filter(
      (t) => !t.id.startsWith("metabolic-eng"), // skip internal alias
    ).map((t) => ({
      id: `tool-${t.id}`,
      label: t.name,
      description: t.summary,
      section: "Tools" as const,
      icon: t.shortLabel,
      action: () => router.push(t.href),
    }));

    const projects: CommandItem[] = [
      {
        id: "project-artemisinin",
        label: "Artemisinin Pathway",
        description: "Ro et al., Nature 2006 — acetyl-CoA to artemisinin",
        section: "Projects" as const,
        icon: "PRJ",
        action: () => router.push("/tools/pathd"),
      },
      {
        id: "project-new",
        label: "Open Project...",
        description: "Browse saved projects in the workbench",
        section: "Projects" as const,
        icon: "PRJ",
        action: () => router.push("/tools/pathd"),
      },
    ];

    const actions: CommandItem[] = [
      {
        id: "action-new-project",
        label: "New Project",
        description: "Create a blank project in the workbench",
        section: "Actions" as const,
        icon: "+",
        action: () => router.push("/tools/pathd"),
      },
      {
        id: "action-analyze",
        label: "Analyze (AI)",
        description: "Open the AI analysis page",
        section: "Actions" as const,
        icon: "AI",
        action: () => router.push("/analyze"),
      },
      {
        id: "action-research",
        label: "Research Hub",
        description: "Browse research tools and papers",
        section: "Actions" as const,
        icon: "R",
        action: () => router.push("/research"),
      },
    ];

    return [...tools, ...projects, ...actions];
  }, [router]);

  /* ---- Filter by query ---- */
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q),
    );
  }, [items, query]);

  /* ---- Group by section ---- */
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return map;
  }, [filtered]);

  /* ---- Flat list for keyboard navigation ---- */
  const flatItems = useMemo(() => {
    const result: CommandItem[] = [];
    for (const [, sectionItems] of grouped) {
      result.push(...sectionItems);
    }
    return result;
  }, [grouped]);

  /* ---- Reset on open ---- */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /* ---- Clamp active index when filtered list changes ---- */
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  /* ---- Keyboard navigation ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[activeIndex]) {
            flatItems[activeIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, activeIndex, onClose],
  );

  /* ---- Scroll active item into view ---- */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector(`[data-testid="command-palette-item-${flatItems[activeIndex]?.id}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, flatItems]);

  /* ---- Render ---- */
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          data-testid="command-palette-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "15vh",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            data-testid="command-palette"
            role="dialog"
            aria-label="Command palette"
            style={{
              width: "100%",
              maxWidth: "560px",
              borderRadius: THEME.R_LG,
              border: `1px solid ${THEME.BORDER_ACTIVE}`,
              background: THEME.PANEL_STRONG,
              boxShadow: THEME.SHADOW_HIGH,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: `1px solid ${THEME.BORDER}`,
                gap: "10px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={THEME.DIM}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <title>Search</title>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search tools, projects, actions..."
                data-testid="command-palette-input"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: THEME.VALUE,
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_MD,
                  lineHeight: "1.5",
                }}
              />
              <kbd
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  color: THEME.DIM,
                  background: THEME.PANEL_INSET,
                  border: `1px solid ${THEME.BORDER}`,
                  borderRadius: "4px",
                  padding: "1px 6px",
                  lineHeight: "18px",
                  flexShrink: 0,
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div
              ref={listRef}
              data-testid="command-palette-list"
              style={{
                maxHeight: "340px",
                overflowY: "auto",
                padding: "6px 0",
              }}
            >
              {flatItems.length === 0 && (
                <div
                  data-testid="command-palette-empty"
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: THEME.DIM,
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                  }}
                >
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}

              {[...grouped.entries()].map(([section, sectionItems]) => {
                let globalIdx = flatItems.indexOf(sectionItems[0]);
                return (
                  <div key={section} data-testid={`command-palette-section-${section.toLowerCase()}`}>
                    <div
                      style={{
                        padding: "8px 16px 4px",
                        fontFamily: THEME.SANS,
                        fontSize: THEME.FS_XS,
                        fontWeight: 600,
                        color: THEME.DIM,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {section}
                    </div>
                    {sectionItems.map((item) => {
                      const idx = globalIdx++;
                      const isActive = idx === activeIndex;
                      return (
                        <div
                          key={item.id}
                          data-active={isActive}
                          data-testid={`command-palette-item-${item.id}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => {
                            item.action();
                            onClose();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              item.action();
                              onClose();
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "8px 16px",
                            cursor: "pointer",
                            background: isActive ? THEME.PANEL_INSET : "transparent",
                            borderLeft: isActive ? `2px solid ${THEME.MINT}` : "2px solid transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          {/* Icon badge */}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: THEME.R_SM,
                              background: isActive ? THEME.CHIP_MINT : THEME.PANEL_INSET,
                              color: isActive ? "#0a0a0a" : THEME.LABEL,
                              fontFamily: THEME.MONO,
                              fontSize: THEME.FS_XS,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {item.icon.slice(0, 3)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: THEME.SANS,
                                fontSize: THEME.FS_MD,
                                color: isActive ? THEME.VALUE : THEME.LABEL,
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.label}
                            </div>
                            <div
                              style={{
                                fontFamily: THEME.SANS,
                                fontSize: THEME.FS_XS,
                                color: THEME.DIM,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: "1px",
                              }}
                            >
                              {item.description}
                            </div>
                          </div>
                          {item.section === "Tools" && (
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: THEME.FS_XS,
                                color: THEME.INK_SOFT,
                                flexShrink: 0,
                              }}
                            >
                              tool
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                padding: "8px 16px",
                borderTop: `1px solid ${THEME.BORDER}`,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: THEME.DIM,
              }}
            >
              <span>
                <kbd style={kbdStyle}>&uarr;</kbd> <kbd style={kbdStyle}>&darr;</kbd> navigate
              </span>
              <span>
                <kbd style={kbdStyle}>&crarr;</kbd> select
              </span>
              <span>
                <kbd style={kbdStyle}>esc</kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared kbd style                                                          */
/* -------------------------------------------------------------------------- */

const kbdStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace",
  fontSize: "10px",
  color: "rgba(217, 225, 235, 0.45)",
  background: "rgba(31, 37, 44, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "3px",
  padding: "0 4px",
  lineHeight: "16px",
};
