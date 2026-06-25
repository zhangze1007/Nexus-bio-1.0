"use client";
import { THEME } from "../../theme";

interface DataPreviewProps {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
}

export default function DataPreview({ headers, rows, maxRows = 5 }: DataPreviewProps) {
  const shown = rows.slice(0, maxRows);

  return (
    <div style={{ overflow: "auto", borderRadius: THEME.R_MD, border: `1px solid ${THEME.BORDER}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: THEME.MONO, fontSize: THEME.FS_XS }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 8px",
                  textAlign: "left",
                  color: THEME.LABEL,
                  background: THEME.PANEL_INSET,
                  borderBottom: `1px solid ${THEME.BORDER}`,
                  position: "sticky",
                  top: 0,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} style={{ background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {headers.map((h) => (
                <td
                  key={h}
                  style={{
                    padding: "4px 8px",
                    color: THEME.VALUE,
                    borderBottom: `1px solid ${THEME.BORDER}`,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "200px",
                  }}
                >
                  {row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div
          style={{
            padding: "6px 8px",
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.DIM,
            textAlign: "center",
          }}
        >
          + {rows.length - maxRows} more rows
        </div>
      )}
    </div>
  );
}
