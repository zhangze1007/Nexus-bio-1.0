'use client';
import { Download } from 'lucide-react';
import { T } from '../tokens';

const SANS = T.SANS;

interface ExportButtonProps {
  label: string;
  data: unknown;
  filename: string;
  format?: 'json' | 'csv' | 'svg';
  svgRef?: React.RefObject<SVGSVGElement | null>;
  disabled?: boolean;
}

function toCSV(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  const headers = Object.keys(data[0] as Record<string, unknown>);
  const rows = data.map((row: Record<string, unknown>) =>
    headers.map(h => {
      const val = String(row[h] ?? '');
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export default function ExportButton({ label, data, filename, format = 'json', svgRef, disabled }: ExportButtonProps) {
  function handleClick() {
    if (disabled) return;

    // SVG export: serialize the referenced SVG element
    if (format === 'svg') {
      const svgEl = svgRef?.current;
      if (!svgEl) return;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const content = format === 'csv' ? toCSV(data) : JSON.stringify(data, null, 2);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px',
        background: 'rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: '8px',
        color: disabled ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.55)',
        fontFamily: SANS,
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
    >
      <Download size={11} />
      {label}
    </button>
  );
}
