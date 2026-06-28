"use client";

import { useCallback, useRef } from "react";
import { THEME } from "../../theme";
import {
  type InventoryItemType,
  generateBarcodeData,
  deriveLocationCode,
} from "../../services/inventory/barcodeService";

/* ─── Label data contract ────────────────────────────────────────── */

export interface LabelItem {
  /** Display name shown on the label. */
  name: string;
  /** Inventory item type (used for barcode prefix). */
  itemType: InventoryItemType;
  /** Unique item id (used for barcode suffix). */
  itemId: string;
  /** Optional override for the location code; derived from barcode if omitted. */
  locationCode?: string;
}

/* ─── Code-128 style barcode renderer (SVG, no deps) ───────────── */

/**
 * Render a Code-128B-compatible barcode as an inline SVG.
 *
 * Each character maps to a pattern of bars and spaces.  We use a
 * simplified fixed-width encoding so that scanning apps can read
 * the resulting image without needing a full parity engine.
 */
const CODE128_PATTERNS: Record<string, number[]> = {
  // Start Code B
  Ê: [2, 1, 1, 2, 3, 2],
};

// Code 128B encoding table -- value = ASCII - 32 (space = 0)
const CODE128_B: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0  (space)
  [2, 2, 2, 1, 2, 2], // 1  !
  [2, 2, 2, 2, 2, 1], // 2  "
  [1, 2, 1, 2, 2, 3], // 3  #
  [1, 2, 1, 3, 2, 2], // 4  $
  [1, 3, 1, 2, 2, 2], // 5  %
  [1, 2, 2, 2, 1, 3], // 6  &
  [1, 2, 2, 3, 1, 2], // 7  '
  [1, 3, 2, 2, 1, 2], // 8  (
  [2, 2, 1, 2, 1, 3], // 9  )
  [2, 2, 1, 3, 1, 2], // 10 *
  [2, 3, 1, 2, 1, 2], // 11 +
  [1, 1, 2, 2, 3, 2], // 12 ,
  [1, 2, 2, 1, 3, 2], // 13 -
  [1, 2, 2, 2, 3, 1], // 14 .
  [1, 1, 3, 2, 2, 2], // 15 /
  [1, 2, 3, 1, 2, 2], // 16 0
  [1, 2, 3, 2, 2, 1], // 17 1
  [2, 2, 3, 2, 1, 1], // 18 2
  [2, 2, 1, 1, 3, 2], // 19 3
  [2, 2, 1, 2, 3, 1], // 20 4
  [2, 1, 3, 2, 1, 2], // 21 5
  [2, 2, 3, 1, 1, 2], // 22 6
  [3, 1, 2, 1, 3, 1], // 23 7
  [3, 1, 1, 2, 2, 2], // 24 8
  [3, 2, 1, 1, 2, 2], // 25 9
  [3, 2, 1, 2, 2, 1], // 26 :
  [3, 1, 2, 2, 1, 2], // 27 ;
  [3, 2, 2, 1, 1, 2], // 28 <
  [3, 2, 2, 2, 1, 1], // 29 =
  [2, 1, 2, 1, 2, 3], // 30 >
  [2, 1, 2, 3, 2, 1], // 31 ?
  [2, 3, 2, 1, 2, 1], // 32 @
  [1, 1, 1, 3, 2, 3], // 33 A
  [1, 3, 1, 1, 2, 3], // 34 B
  [1, 3, 1, 3, 2, 1], // 35 C
  [1, 1, 2, 3, 1, 3], // 36 D
  [1, 3, 2, 1, 1, 3], // 37 E
  [1, 3, 2, 3, 1, 1], // 38 F
  [2, 1, 1, 3, 1, 3], // 39 G
  [2, 3, 1, 1, 1, 3], // 40 H
  [2, 3, 1, 3, 1, 1], // 41 I
  [1, 1, 2, 1, 3, 3], // 42 J
  [1, 1, 2, 3, 3, 1], // 43 K
  [1, 3, 2, 1, 3, 1], // 44 L
  [1, 1, 3, 1, 2, 3], // 45 M
  [1, 1, 3, 3, 2, 1], // 46 N
  [1, 3, 3, 1, 2, 1], // 47 O
  [3, 1, 3, 1, 2, 1], // 48 P
  [2, 1, 1, 3, 3, 1], // 49 Q
  [2, 3, 1, 1, 3, 1], // 50 R
  [2, 1, 3, 1, 1, 3], // 51 S
  [2, 1, 3, 3, 1, 1], // 52 T
  [2, 1, 3, 1, 3, 1], // 53 U
  [3, 1, 1, 1, 2, 3], // 54 V
  [3, 1, 1, 3, 2, 1], // 55 W
  [3, 3, 1, 1, 2, 1], // 56 X
  [3, 1, 2, 1, 1, 3], // 57 Y
  [3, 1, 2, 3, 1, 1], // 58 Z
  [3, 3, 2, 1, 1, 1], // 59 [
  [3, 1, 4, 1, 1, 1], // 60 backslash
  [2, 2, 1, 4, 1, 1], // 61 ]
  [4, 3, 1, 1, 1, 1], // 62 ^
  [1, 1, 1, 2, 2, 4], // 63 _
  [1, 1, 1, 4, 2, 2], // 64 `
  [1, 2, 1, 1, 2, 4], // 65 a
  [1, 2, 1, 4, 2, 1], // 66 b
  [1, 4, 1, 1, 2, 2], // 67 c
  [1, 4, 1, 2, 2, 1], // 68 d
  [1, 1, 2, 2, 1, 4], // 69 e
  [1, 1, 2, 4, 1, 2], // 70 f
  [1, 2, 2, 1, 1, 4], // 71 g
  [1, 2, 2, 4, 1, 1], // 72 h
  [1, 4, 2, 1, 1, 2], // 73 i
  [1, 4, 2, 2, 1, 1], // 74 j
  [2, 4, 1, 2, 1, 1], // 75 k
  [2, 2, 1, 1, 1, 4], // 76 l
  [4, 1, 3, 1, 1, 1], // 77 m
  [2, 4, 1, 1, 1, 2], // 78 n
  [1, 3, 4, 1, 1, 1], // 79 o
  [1, 1, 1, 2, 4, 2], // 80 p
  [1, 2, 1, 1, 4, 2], // 81 q
  [1, 2, 1, 2, 4, 1], // 82 r
  [1, 1, 4, 2, 1, 2], // 83 s
  [1, 2, 4, 1, 1, 2], // 84 t
  [1, 2, 4, 2, 1, 1], // 85 u
  [4, 1, 1, 2, 1, 2], // 86 v
  [4, 2, 1, 1, 1, 2], // 87 w
  [4, 2, 1, 2, 1, 1], // 88 x
  [2, 1, 2, 1, 4, 1], // 89 y
  [2, 1, 4, 1, 2, 1], // 90 z
  [4, 1, 2, 1, 2, 1], // 91 {
  [1, 1, 1, 1, 4, 3], // 92 |
  [1, 1, 1, 3, 4, 1], // 93 }
  [1, 3, 1, 1, 4, 1], // 94 ~
];

function code128Checksum(text: string): number {
  let sum = 104; // Start Code B value
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i) - 32;
    sum += value * (i + 1);
  }
  return sum % 103;
}

function renderBarcodeSvg(text: string, barWidth: number = 1.5): string {
  // Build pattern sequence: Start B + data + checksum + stop
  const startPattern = [2, 1, 1, 2, 3, 2]; // Start B
  const dataPatterns: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 32;
    if (code >= 0 && code < CODE128_B.length) {
      dataPatterns.push(...CODE128_B[code]);
    }
  }
  const checksum = code128Checksum(text);
  dataPatterns.push(...CODE128_B[checksum]);
  const stopPattern = [2, 3, 3, 1, 1, 1, 2]; // Stop

  const allModules = [...startPattern, ...dataPatterns, ...stopPattern];

  // Convert modules to bar positions
  const bars: { x: number; w: number }[] = [];
  let pos = 0;
  let isBar = true;
  for (const m of allModules) {
    if (isBar) {
      bars.push({ x: pos * barWidth, w: m * barWidth });
    }
    pos += m;
    isBar = !isBar;
  }

  const totalWidth = pos * barWidth;
  const barHeight = 40;

  const rects = bars.map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="${barHeight}" fill="#000"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${barHeight}" viewBox="0 0 ${totalWidth} ${barHeight}">${rects}</svg>`;
}

/* ─── LabelGenerator component ──────────────────────────────────── */

interface LabelGeneratorProps {
  /** Items to render labels for. */
  items: LabelItem[];
  /** Whether to show the print button. Defaults to true. */
  showPrintButton?: boolean;
}

export default function LabelGenerator({ items, showPrintButton = true }: LabelGeneratorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      {/* Print stylesheet -- Avery 5160 (1" x 2-5/8", 3 cols, 10 rows) */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in 0.1875in;
          }

          /* Hide everything except the label grid */
          body * {
            visibility: hidden;
          }
          .label-grid, .label-grid * {
            visibility: visible;
          }
          .label-grid {
            position: absolute;
            left: 0;
            top: 0;
          }
          .no-print {
            display: none !important;
          }

          /* Avery 5160 grid: 3 columns, 10 rows, 1" tall x 2.625" wide */
          .label-grid {
            display: grid;
            grid-template-columns: repeat(3, 2.625in);
            grid-template-rows: repeat(10, 1in);
            gap: 0;
            width: 8.5in;
            margin: 0 auto;
          }

          .label-card {
            width: 2.625in;
            height: 1in;
            padding: 0.1in 0.15in;
            box-sizing: border-box;
            border: 1px solid #ccc;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-family: 'IBM Plex Mono', 'Courier New', monospace;
          }

          .label-card .label-name {
            font-size: 10pt;
            font-weight: 700;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #000;
            font-family: 'Public Sans', 'Helvetica Neue', Arial, sans-serif;
          }

          .label-card .label-barcode-svg {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          .label-card .label-barcode-svg svg {
            max-width: 100%;
            height: auto;
          }

          .label-card .label-barcode-text {
            font-size: 7pt;
            text-align: center;
            letter-spacing: 0.08em;
            color: #000;
          }

          .label-card .label-location {
            font-size: 8pt;
            font-weight: 600;
            text-align: right;
            color: #333;
            letter-spacing: 0.05em;
          }
        }
      `}</style>

      {/* Print button (screen only) */}
      {showPrintButton && items.length > 0 && (
        <button
          type="button"
          onClick={handlePrint}
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.SKY}33`,
            background: `${THEME.SKY}15`,
            color: THEME.SKY,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: THEME.SP_SM,
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${THEME.SKY}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${THEME.SKY}15`;
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Labels (Avery 5160)
        </button>
      )}

      {/* Label grid */}
      <div
        ref={containerRef}
        className="label-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 2.625in)",
          gap: THEME.SP_SM,
        }}
      >
        {items.map((item, index) => {
          const barcode = generateBarcodeData(item.itemType, item.itemId);
          const locationCode = item.locationCode ?? deriveLocationCode(barcode);
          const barcodeSvg = renderBarcodeSvg(barcode);

          return (
            <div
              key={`${item.itemType}-${item.itemId}-${index}`}
              className="label-card"
              style={{
                width: "2.625in",
                height: "1in",
                padding: "8px 12px",
                boxSizing: "border-box",
                border: `1px solid ${THEME.BORDER}`,
                borderRadius: THEME.R_SM,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: THEME.BG_CANVAS,
              }}
            >
              {/* Item name */}
              <div
                className="label-name"
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "11px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: THEME.INK,
                }}
              >
                {item.name}
              </div>

              {/* Barcode */}
              <div
                className="label-barcode-svg"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />

              {/* Barcode text */}
              <div
                className="label-barcode-text"
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "9px",
                  textAlign: "center",
                  letterSpacing: "0.08em",
                  color: THEME.INK_SOFT,
                  marginBottom: "2px",
                }}
              >
                {barcode}
              </div>

              {/* Location code */}
              <div
                className="label-location"
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "10px",
                  fontWeight: 600,
                  textAlign: "right",
                  color: THEME.APRICOT,
                  letterSpacing: "0.05em",
                }}
              >
                {locationCode}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
