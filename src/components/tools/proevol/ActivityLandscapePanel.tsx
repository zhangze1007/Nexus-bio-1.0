'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  LandscapeHotspot,
  LandscapeMode,
  LandscapePoint,
  ProteinEvolutionCampaign,
} from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import { ProEvolCard, PROEVOL_THEME, StatusPill } from './shared';

const MODE_OPTIONS: Array<{ key: LandscapeMode; label: string }> = [
  { key: 'activity', label: 'Activity' },
  { key: 'diversity', label: 'Diversity' },
  { key: 'convergence', label: 'Convergence' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'selection-density', label: 'Selection density' },
];

const MAX_HOTSPOTS = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function metricForHotspot(hotspot: LandscapeHotspot, mode: LandscapeMode) {
  if (mode === 'diversity') return hotspot.diversity;
  if (mode === 'convergence') return hotspot.convergence;
  if (mode === 'confidence') return hotspot.confidence;
  if (mode === 'selection-density') return hotspot.selectionDensity;
  return hotspot.activity;
}

function metricForPoint(point: LandscapePoint, mode: LandscapeMode) {
  if (mode === 'diversity') return point.diversity;
  if (mode === 'convergence') return point.convergence;
  if (mode === 'confidence') return point.confidence;
  if (mode === 'selection-density') return point.selectionDensity;
  return point.activity;
}

function modeIndex(mode: LandscapeMode) {
  return MODE_OPTIONS.findIndex((option) => option.key === mode);
}

function hotspotStatusColor(status: LandscapeHotspot['status']) {
  if (status === 'selected') return PROEVOL_THEME.mint;
  if (status === 'rejected') return PROEVOL_THEME.coral;
  return PROEVOL_THEME.sky;
}

function detectRendererSupport() {
  if (typeof window === 'undefined') return 'error' as const;
  const canvas = document.createElement('canvas');
  const webgl2 = canvas.getContext('webgl2', { alpha: true });
  if (webgl2) return 'webgl2' as const;
  const webgl = canvas.getContext('webgl', { alpha: true });
  if (webgl) return 'webgl' as const;
  return 'error' as const;
}

function LandscapeField({
  hotspots,
  mode,
}: {
  hotspots: LandscapeHotspot[];
  mode: LandscapeMode;
}) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMode: { value: 0 },
    uCount: { value: 0 },
    uHotspots: {
      value: Array.from({ length: MAX_HOTSPOTS }, () => new THREE.Vector3(-2, -2, 0)),
    },
  }), []);

  useEffect(() => {
    uniforms.uMode.value = modeIndex(mode);
    uniforms.uCount.value = Math.min(hotspots.length, MAX_HOTSPOTS);
    for (let index = 0; index < MAX_HOTSPOTS; index += 1) {
      const hotspot = hotspots[index];
      if (hotspot) {
        uniforms.uHotspots.value[index].set(hotspot.x, hotspot.y, metricForHotspot(hotspot, mode));
      } else {
        uniforms.uHotspots.value[index].set(-2, -2, 0);
      }
    }
  }, [hotspots, mode, uniforms]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * 0.22;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision highp float;
          uniform float uTime;
          uniform float uMode;
          uniform int uCount;
          uniform vec3 uHotspots[${MAX_HOTSPOTS}];
          varying vec2 vUv;

          float gaussianField(vec2 uv, vec2 center, float weight) {
            float dist = distance(uv, center);
            return exp(-pow(dist / (0.13 + weight * 0.11), 2.0)) * (0.4 + weight * 0.9);
          }

          vec3 palette(float mode, float field) {
            vec3 darkA = vec3(0.03, 0.05, 0.08);
            vec3 darkB = vec3(0.07, 0.10, 0.14);
            vec3 activity = mix(vec3(0.11, 0.24, 0.24), vec3(0.74, 0.87, 0.80), field);
            vec3 diversity = mix(vec3(0.10, 0.12, 0.18), vec3(0.70, 0.77, 0.89), field);
            vec3 convergence = mix(vec3(0.16, 0.10, 0.09), vec3(0.90, 0.79, 0.60), field);
            vec3 confidence = mix(vec3(0.11, 0.09, 0.17), vec3(0.82, 0.76, 0.89), field);
            vec3 density = mix(vec3(0.13, 0.07, 0.07), vec3(0.88, 0.64, 0.61), field);
            if (mode < 0.5) return mix(darkA, activity, 0.75);
            if (mode < 1.5) return mix(darkB, diversity, 0.75);
            if (mode < 2.5) return mix(darkA, convergence, 0.75);
            if (mode < 3.5) return mix(darkA, confidence, 0.75);
            return mix(darkA, density, 0.78);
          }

          void main() {
            float field = 0.0;
            for (int index = 0; index < ${MAX_HOTSPOTS}; index++) {
              if (index >= uCount) break;
              field += gaussianField(vUv, uHotspots[index].xy, uHotspots[index].z);
            }
            field = clamp(field * 0.52, 0.0, 1.0);

            float drift = sin((vUv.x * 8.0) + uTime * 0.7) * 0.012 + cos((vUv.y * 10.0) - uTime * 0.55) * 0.01;
            field = clamp(field + drift, 0.0, 1.0);

            float contour = smoothstep(0.08, 0.0, abs(fract(field * 8.0 + uTime * 0.05) - 0.5));
            vec3 color = palette(uMode, field);
            color += contour * 0.06;

            float vignette = smoothstep(1.05, 0.2, distance(vUv, vec2(0.5)));
            float glow = smoothstep(0.65, 1.0, field) * 0.12;
            gl_FragColor = vec4(color * vignette + glow, 0.96);
          }
        `}
        transparent
      />
    </mesh>
  );
}

function LandscapeShaderSurface({
  hotspots,
  mode,
}: {
  hotspots: LandscapeHotspot[];
  mode: LandscapeMode;
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 2], zoom: 145 }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, background: 'transparent', pointerEvents: 'none' }}
    >
      <LandscapeField hotspots={hotspots} mode={mode} />
    </Canvas>
  );
}

function LandscapeFallbackSurface({
  hotspots,
  mode,
}: {
  hotspots: LandscapeHotspot[];
  mode: LandscapeMode;
}) {
  const gradients = hotspots.map((hotspot) => {
    const metric = metricForHotspot(hotspot, mode);
    const color = hotspotStatusColor(hotspot.status);
    return `radial-gradient(circle at ${hotspot.x * 100}% ${hotspot.y * 100}%, ${color}${Math.round(clamp(metric * 255, 40, 160)).toString(16).padStart(2, '0')} 0%, transparent 42%)`;
  });

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: [
          'linear-gradient(180deg, rgba(6,9,12,0.92) 0%, rgba(10,13,18,0.96) 100%)',
          ...gradients,
        ].join(', '),
      }}
    />
  );
}

function LandscapeOverlay({
  campaign,
  mode,
  selectedVariantId,
  onSelectVariant,
  hoveredHotspotId,
  onHoverHotspot,
}: {
  campaign: ProteinEvolutionCampaign;
  mode: LandscapeMode;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
  hoveredHotspotId: string | null;
  onHoverHotspot: (hotspotId: string | null) => void;
}) {
  const pointMap = useMemo(
    () => new Map(campaign.landscape.points.map((point) => [point.variantId, point])),
    [campaign.landscape.points],
  );

  return (
    <svg
      role="img"
      aria-label="Activity landscape overlay"
      viewBox="0 0 100 100"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {campaign.landscape.edges.map((edge) => {
        const from = pointMap.get(edge.fromId);
        const to = pointMap.get(edge.toId);
        if (!from || !to) return null;
        return (
          <path
            key={`${edge.fromId}-${edge.toId}`}
            d={`M ${from.x * 100} ${from.y * 100} C ${from.x * 100 + 6} ${from.y * 100}, ${to.x * 100 - 6} ${to.y * 100}, ${to.x * 100} ${to.y * 100}`}
            fill="none"
            stroke={edge.active ? 'rgba(191,220,205,0.42)' : 'rgba(255,255,255,0.09)'}
            strokeWidth={edge.active ? 0.6 : 0.28}
          />
        );
      })}

      {campaign.landscape.points.map((point) => {
        const selected = selectedVariantId === point.variantId;
        const fill =
          point.lead
            ? PROEVOL_THEME.mint
            : point.selectionStatus === 'selected'
              ? PROEVOL_THEME.sky
              : 'rgba(255,255,255,0.38)';
        return (
          <g key={point.variantId} onClick={() => onSelectVariant(point.variantId)} style={{ cursor: 'pointer' }}>
            <circle
              cx={point.x * 100}
              cy={point.y * 100}
              r={point.lead ? 1.75 : selected ? 1.5 : point.selectionStatus === 'selected' ? 1.2 : 0.9}
              fill={fill}
              stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.22)'}
              strokeWidth={selected ? 0.45 : 0.18}
              opacity={0.56 + metricForPoint(point, mode) * 0.44}
            />
          </g>
        );
      })}

      {campaign.landscape.hotspots.map((hotspot) => {
        const highlighted = hoveredHotspotId === hotspot.id;
        return (
          <g
            key={hotspot.id}
            onMouseEnter={() => onHoverHotspot(hotspot.id)}
            onMouseLeave={() => onHoverHotspot(null)}
          >
            <circle
              cx={hotspot.x * 100}
              cy={hotspot.y * 100}
              r={highlighted ? 4.8 : 3.6}
              fill="transparent"
              stroke={hotspotStatusColor(hotspot.status)}
              strokeWidth={highlighted ? 0.5 : 0.26}
              strokeDasharray="0.6 0.5"
            />
          </g>
        );
      })}
    </svg>
  );
}

function LandscapeContent({
  campaign,
  selectedVariantId,
  onSelectVariant,
  expanded,
}: {
  campaign: ProteinEvolutionCampaign;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
  expanded: boolean;
}) {
  const [mode, setMode] = useState<LandscapeMode>('activity');
  const [renderer, setRenderer] = useState<'loading' | 'webgl2' | 'webgl' | 'error'>('loading');
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  useEffect(() => {
    setRenderer(detectRendererSupport());
  }, []);

  const hoveredHotspot = campaign.landscape.hotspots.find((hotspot) => hotspot.id === hoveredHotspotId) ?? null;

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              style={{
                minHeight: '28px',
                padding: '0 12px',
                borderRadius: '999px',
                border: `1px solid ${mode === option.key ? `${PROEVOL_THEME.mint}55` : PROEVOL_THEME.border}`,
                background: mode === option.key ? 'rgba(191,220,205,0.12)' : 'rgba(255,255,255,0.03)',
                color: mode === option.key ? PROEVOL_THEME.value : PROEVOL_THEME.label,
                fontFamily: T.MONO,
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <StatusPill tone={renderer === 'error' ? 'warm' : 'cool'}>
          {renderer === 'error' ? 'SVG fallback' : renderer.toUpperCase()}
        </StatusPill>
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: expanded ? '460px' : '320px',
          borderRadius: '18px',
          overflow: 'hidden',
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: 'linear-gradient(180deg, rgba(4,6,10,0.94) 0%, rgba(7,10,14,0.98) 100%)',
        }}
      >
        {(renderer === 'error' || renderer === 'loading')
          ? <LandscapeFallbackSurface hotspots={campaign.landscape.hotspots} mode={mode} />
          : <LandscapeShaderSurface hotspots={campaign.landscape.hotspots} mode={mode} />}

        <LandscapeOverlay
          campaign={campaign}
          mode={mode}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
          hoveredHotspotId={hoveredHotspotId}
          onHoverHotspot={setHoveredHotspotId}
        />

        <div
          style={{
            position: 'absolute',
            left: '12px',
            bottom: '12px',
            display: 'grid',
            gap: '4px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PROEVOL_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Landscape interpretation
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.value, lineHeight: 1.5, maxWidth: expanded ? '320px' : '240px' }}>
            X/Y represents variant-family embedding space, surface intensity follows the selected overlay, and points track selected survivors, rejected branches, and the current lead.
          </div>
        </div>

        {hoveredHotspot ? (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '12px',
              maxWidth: expanded ? '260px' : '220px',
              padding: '12px',
              borderRadius: '12px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(14px)',
              display: 'grid',
              gap: '4px',
            }}
          >
            <div style={{ fontFamily: T.SANS, fontSize: '12px', fontWeight: 600, color: PROEVOL_THEME.value }}>
              {hoveredHotspot.label}
            </div>
            <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label }}>
              round {hoveredHotspot.round} · lead score {hoveredHotspot.leadScore.toFixed(1)} · {hoveredHotspot.status}
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.muted, lineHeight: 1.55 }}>
              Activity {(hoveredHotspot.activity * 100).toFixed(0)} · Diversity {(hoveredHotspot.diversity * 100).toFixed(0)} · Confidence {(hoveredHotspot.confidence * 100).toFixed(0)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ActivityLandscapePanel({
  campaign,
  selectedVariantId,
  onSelectVariant,
}: {
  campaign: ProteinEvolutionCampaign;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <ProEvolCard
        eyebrow="Activity Landscape"
        title="Adaptive surface for variant families"
        subtitle="This landscape remains secondary to the campaign workflow. It helps locate active families, convergence density, and rejected basins without replacing the library, lineage, or recommendation panels."
        actions={
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              minHeight: '30px',
              padding: '0 12px',
              borderRadius: '999px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(255,255,255,0.04)',
              color: PROEVOL_THEME.value,
              fontFamily: T.MONO,
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Expand explorer
          </button>
        }
      >
        <LandscapeContent
          campaign={campaign}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
          expanded={false}
        />
      </ProEvolCard>

      {expanded ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.76)',
            backdropFilter: 'blur(12px)',
            padding: '24px',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 'min(1120px, 96vw)',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '18px',
              borderRadius: '22px',
              border: `1px solid ${PROEVOL_THEME.borderStrong}`,
              background: '#06090d',
              boxShadow: '0 28px 72px rgba(0,0,0,0.45)',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PROEVOL_THEME.label, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Landscape Explorer
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '18px', fontWeight: 700, color: PROEVOL_THEME.value }}>
                  Expanded activity landscape
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: `1px solid ${PROEVOL_THEME.border}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: PROEVOL_THEME.value,
                  fontFamily: T.MONO,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <LandscapeContent
              campaign={campaign}
              selectedVariantId={selectedVariantId}
              onSelectVariant={onSelectVariant}
              expanded
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
