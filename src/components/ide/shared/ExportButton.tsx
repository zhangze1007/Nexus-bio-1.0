'use client';
import { Download } from 'lucide-react';

const MONO = "'JetBrains Mono','Fira Code',monospace";

interface ExportButtonProps {
  label: string;
  data: unknown;
  filename: string;
  format?: 'json' | 'csv';
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

export default function ExportButton({ label, data, filename, format = 'json', disabled }: ExportButtonProps) {
  function handleClick() {
    if (disabled) return;
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
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '3px',
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
        fontFamily: MONO,
        fontSize: '10px',
        letterSpacing: '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
    >
      <Download size={10} />
      {label}
    </button>
  );
}
