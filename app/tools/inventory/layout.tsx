"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { THEME } from "../../../src/theme";

const NAV_ITEMS = [
  { label: "Strains", href: "/tools/inventory/strains", icon: "S" },
  { label: "Plasmids", href: "/tools/inventory/plasmids", icon: "P" },
  { label: "Primers", href: "/tools/inventory/primers", icon: "R" },
  { label: "Chemicals", href: "/tools/inventory/chemicals", icon: "C" },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown[]>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults({});
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || {});
        setShowResults(true);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }

  const totalResults = Object.values(searchResults).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        background: THEME.BG_SHELL,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          minWidth: "220px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: THEME.BG_SIDEBAR,
          borderRight: `1px solid ${THEME.BORDER}`,
          overflow: "hidden",
        }}
      >
        {/* Title */}
        <div
          style={{
            padding: `${THEME.SP_MD}px ${THEME.SP_MD}px ${THEME.SP_SM}px`,
            borderBottom: `1px solid ${THEME.BORDER}`,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: THEME.BRAND,
              fontSize: THEME.FS_MD,
              fontWeight: 700,
              color: THEME.INK,
              letterSpacing: "-0.01em",
            }}
          >
            Inventory
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontFamily: THEME.SANS,
              fontSize: "10px",
              color: THEME.INK_SOFT,
            }}
          >
            Biological materials tracker
          </p>
        </div>

        {/* Cross-type search */}
        <div
          style={{
            padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
            position: "relative",
          }}
        >
          <div style={{ position: "relative" }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={THEME.INK_SOFT}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="Search all..."
              style={{
                width: "100%",
                padding: "6px 10px 6px 28px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.BORDER}`,
                background: THEME.INPUT_BG,
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.SANS,
                fontSize: "11px",
                outline: "none",
              }}
            />
          </div>

          {/* Search results dropdown */}
          {showResults && totalResults > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: THEME.SP_MD,
                right: THEME.SP_MD,
                zIndex: 50,
                background: THEME.BG_SIDEBAR,
                border: `1px solid ${THEME.BORDER_ACTIVE}`,
                borderRadius: THEME.R_SM,
                boxShadow: THEME.SHADOW_HIGH,
                maxHeight: "300px",
                overflow: "auto",
              }}
            >
              <div
                style={{
                  padding: "6px 10px",
                  fontFamily: THEME.MONO,
                  fontSize: "9px",
                  color: THEME.INK_SOFT,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderBottom: `1px solid ${THEME.BORDER}`,
                }}
              >
                {totalResults} results
              </div>
              {Object.entries(searchResults).map(([type, items]) =>
                (items as Record<string, unknown>[]).map((item, idx) => (
                  <Link
                    key={`${type}-${idx}`}
                    href={`/tools/inventory/${type}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 10px",
                      textDecoration: "none",
                      borderBottom: `1px solid ${THEME.BORDER}`,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "9px",
                        color: THEME.MINT,
                        textTransform: "uppercase",
                        minWidth: "52px",
                      }}
                    >
                      {type}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.SANS,
                        fontSize: "11px",
                        color: THEME.INK,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {String(item.name || "")}
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}

          {showResults && searchQuery.trim().length >= 2 && totalResults === 0 && !isSearching && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: THEME.SP_MD,
                right: THEME.SP_MD,
                zIndex: 50,
                background: THEME.BG_SIDEBAR,
                border: `1px solid ${THEME.BORDER_ACTIVE}`,
                borderRadius: THEME.R_SM,
                boxShadow: THEME.SHADOW_HIGH,
                padding: "12px 10px",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "11px",
                  color: THEME.INK_SOFT,
                }}
              >
                No results found
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: `${THEME.SP_XS}px 0`, overflow: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 16px",
                  margin: "2px 8px",
                  borderRadius: THEME.R_SM,
                  textDecoration: "none",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  color: isActive ? THEME.INK : THEME.INK_SOFT,
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.12s ease",
                  borderLeft: isActive ? `2px solid ${THEME.MINT}` : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: isActive ? `${THEME.MINT}18` : "rgba(255,255,255,0.04)",
                    fontFamily: THEME.MONO,
                    fontSize: "10px",
                    fontWeight: 700,
                    color: isActive ? THEME.MINT : THEME.INK_SOFT,
                  }}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
            borderTop: `1px solid ${THEME.BORDER}`,
            fontFamily: THEME.MONO,
            fontSize: "9px",
            color: THEME.INK_SOFT,
            textAlign: "center",
          }}
        >
          Nexus-Bio Inventory
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          overflow: "auto",
          padding: THEME.SP_LG,
        }}
      >
        {children}
      </main>
    </div>
  );
}
