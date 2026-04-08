'use client';

import type { CSSProperties } from 'react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface WorkbenchRangeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  className?: string;
}

function getDecimals(step: number) {
  const stepText = `${step}`;
  const decimalIndex = stepText.indexOf('.');
  return decimalIndex === -1 ? 0 : stepText.length - decimalIndex - 1;
}

export default function WorkbenchRangeSlider({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  onChange,
  formatValue,
  ariaLabel,
  className,
}: WorkbenchRangeSliderProps) {
  const span = max - min;
  const pct = span <= 0 ? 0 : Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const displayValue = formatValue ? formatValue(value) : value.toFixed(getDecimals(step));

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label }}>
          {label}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', fontWeight: 600, color: PATHD_THEME.value }}>
          {displayValue}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        aria-label={ariaLabel ?? label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className={className ? `nb-pathd-slider ${className}` : 'nb-pathd-slider'}
        style={{ '--val': `${pct}%` } as CSSProperties}
        onChange={(event) => onChange(parseFloat(event.target.value))}
      />
    </div>
  );
}
