'use client';

/**
 * Skeleton loading placeholder — shimmer animation.
 * Use for async content while data is loading.
 */
export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', style }: {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

/**
 * Skeleton group for sim loading states.
 * Shows 3 shimmer bars mimicking metric cards.
 */
export function SimSkeleton() {
  return (
    <div style={{ display: 'grid', gap: '8px', padding: '12px 16px' }}>
      <Skeleton height="14px" width="60%" />
      <Skeleton height="32px" />
      <Skeleton height="14px" width="80%" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
        <Skeleton height="48px" borderRadius="12px" />
        <Skeleton height="48px" borderRadius="12px" />
        <Skeleton height="48px" borderRadius="12px" />
      </div>
    </div>
  );
}
