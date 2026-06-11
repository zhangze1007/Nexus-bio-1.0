'use client';
import { useRef, useState, useEffect, type ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: (width: number, height: number) => ReactNode;
  style?: React.CSSProperties;
  minHeight?: number;
}

export default function ResponsiveContainer({
  children,
  style,
  minHeight = 200,
}: ResponsiveContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 520, height: minHeight });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.max(minHeight, Math.floor(entry.contentRect.height)),
        });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [minHeight]);

  return (
    <div ref={ref} style={{ width: '100%', minHeight, ...style }}>
      {children(size.width, size.height)}
    </div>
  );
}
