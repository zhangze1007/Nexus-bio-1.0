'use client';
import type { CSSProperties } from 'react';
import { Download } from 'lucide-react';
import { T } from '../tokens';

const SANS = T.SANS;
type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

interface ExportButtonProps {
  label: string;
  data: unknown;
  filename: string;
  format?: 'json' | 'csv' | 'svg' | 'png';
  svgRef?: React.RefObject<SVGSVGElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
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

export default function ExportButton({ label, data, filename, format = 'json', svgRef, canvasRef, disabled }: ExportButtonProps) {
  async function handleClick() {
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

    if (format === 'png') {
      const canvasEl = canvasRef?.current;
      if (canvasEl) {
        const a = document.createElement('a');
        a.href = canvasEl.toDataURL('image/png');
        a.download = `${filename}.png`;
        a.click();
        return;
      }

      const svgEl = svgRef?.current;
      if (!svgEl) return;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const bbox = svgEl.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(bbox.width || 1200));
        canvas.height = Math.max(1, Math.round(bbox.height || 900));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${filename}.png`;
        a.click();
        URL.revokeObjectURL(url);
      };
      image.src = url;
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
      className="nb-ui-control"
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px',
        background: 'var(--nb-control-bg)',
        border: '1px solid var(--nb-control-border)',
        borderRadius: '8px',
        color: 'var(--nb-control-color)',
        fontFamily: SANS,
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
        ['--nb-control-bg' as const]: 'rgba(255,255,255,0.04)',
        ['--nb-control-border' as const]: 'rgba(255,255,255,0.10)',
        ['--nb-control-color' as const]: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.58)',
        ['--nb-control-hover-bg' as const]: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.94)',
        ['--nb-control-hover-border' as const]: disabled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.94)',
        ['--nb-control-hover-color' as const]: disabled ? 'rgba(255,255,255,0.2)' : '#111318',
        ['--nb-control-active-bg' as const]: disabled ? 'rgba(255,255,255,0.04)' : '#ffffff',
        ['--nb-control-active-border' as const]: disabled ? 'rgba(255,255,255,0.10)' : '#ffffff',
        ['--nb-control-active-color' as const]: disabled ? 'rgba(255,255,255,0.2)' : '#111318',
      } as ControlVarsStyle}
    >
      <Download size={11} />
      {label}
    </button>
  );
}
