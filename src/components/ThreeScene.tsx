'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

type Vec3 = [number, number, number];
type RendererMode = 'loading' | 'webgpu' | 'webgl2' | 'webgl' | 'error';
type SceneViewMode = 'network' | 'flow' | 'risk';
type OpticalInsetBox = { top: number; right: number; bottom: number; left: number };
type TracePlacement = 'top-right' | 'top-left';
type TraceLayout = { top?: number; right?: number; left?: number; width?: number };
type ControlVarsStyle = React.CSSProperties & Record<`--${string}`, string>;
type ConfigurableRenderer = {
  setSize: (w: number, h: number, updateStyle?: boolean) => void;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  setClearColor: (color: THREE.ColorRepresentation, alpha?: number) => void;
};

const INIT_TIMEOUT_MS = 2000;
const CAMERA_FRAME_PADDING = 1.38;
const CAMERA_ELEVATION_RATIO = 0.04;
const MIN_CAMERA_DISTANCE = 5;
const GRID_ORIGIN = new THREE.Vector3(0, -3.8, 0);

function normalizeOpticalInsets(
  fullscreen: boolean,
  insets?: Partial<OpticalInsetBox>,
): OpticalInsetBox {
  const defaults = fullscreen
    ? { top: 22, right: 22, bottom: 22, left: 22 }
    : { top: 58, right: 22, bottom: 24, left: 22 };
  return {
    top: Math.max(0, insets?.top ?? defaults.top),
    right: Math.max(0, insets?.right ?? defaults.right),
    bottom: Math.max(0, insets?.bottom ?? defaults.bottom),
    left: Math.max(0, insets?.left ?? defaults.left),
  };
}

type RouteGeometry = {
  box: THREE.Box3;
  min: THREE.Vector3;
  max: THREE.Vector3;
  boundsCenter: THREE.Vector3;
  arithmeticCentroid: THREE.Vector3;
  size: THREE.Vector3;
  routeGroupOffset: THREE.Vector3;
  isEmpty: boolean;
};

function computeRouteGeometry(nodes: PathwayNode[]): RouteGeometry {
  const box = new THREE.Box3();
  const arithmeticCentroid = new THREE.Vector3();
  let positionCount = 0;

  nodes.forEach((node) => {
    if (node && Array.isArray(node.position) && node.position.length === 3) {
      const position = new THREE.Vector3(...(node.position as [number, number, number]));
      box.expandByPoint(position);
      arithmeticCentroid.add(position);
      positionCount += 1;
    }
  });

  if (positionCount > 0) {
    arithmeticCentroid.multiplyScalar(1 / positionCount);
  }

  const boundsCenter = new THREE.Vector3();
  const size = new THREE.Vector3();
  const min = new THREE.Vector3();
  const max = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getCenter(boundsCenter);
    box.getSize(size);
    min.copy(box.min);
    max.copy(box.max);
  }

  return {
    box,
    min,
    max,
    boundsCenter,
    arithmeticCentroid,
    size,
    routeGroupOffset: boundsCenter.clone().multiplyScalar(-1),
    isEmpty: box.isEmpty(),
  };
}

function getSafeFrameDimensions(width: number, height: number, insets: OpticalInsetBox) {
  return {
    width: Math.max(width - insets.left - insets.right, 1),
    height: Math.max(height - insets.top - insets.bottom, 1),
  };
}

function getOpticalTargetOffset(args: {
  width: number;
  height: number;
  distance: number;
  cameraFov: number;
  insets: OpticalInsetBox;
}) {
  const { width, height, distance, cameraFov, insets } = args;
  if (width <= 0 || height <= 0 || distance <= 0) return new THREE.Vector3();

  const aspect = width / height;
  const vHalfRad = (cameraFov / 2) * Math.PI / 180;
  const hHalfRad = Math.atan(Math.tan(vHalfRad) * aspect);
  const frustumHalfWidth = Math.tan(hHalfRad) * distance;
  const frustumHalfHeight = Math.tan(vHalfRad) * distance;
  const safeFrame = getSafeFrameDimensions(width, height, insets);
  const safeCenterX = insets.left + safeFrame.width / 2;
  const safeCenterY = insets.top + safeFrame.height / 2;
  const desiredNdcX = (safeCenterX - width / 2) / (width / 2);
  const desiredNdcY = (height / 2 - safeCenterY) / (height / 2);

  // Dampen offset (0.4x) so pathway stays closer to viewport center
  // rather than being pushed to the exact safe-frame center
  return new THREE.Vector3(
    -desiredNdcX * frustumHalfWidth * 0.4,
    -desiredNdcY * frustumHalfHeight * 0.4,
    0,
  );
}

function getLabelAwareSize(size: THREE.Vector3) {
  const labelAwareSize = size.clone();
  labelAwareSize.x += Math.min(2.2, Math.max(1.2, size.x * 0.16));
  labelAwareSize.y += Math.min(1.2, Math.max(0.8, size.y * 0.18));
  return labelAwareSize;
}

function computeCameraFrame(args: {
  routeGeometry: RouteGeometry;
  width: number;
  height: number;
  cameraFov: number;
  insets: OpticalInsetBox;
}) {
  const { routeGeometry, width, height, cameraFov, insets } = args;
  const { size, isEmpty } = routeGeometry;
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const safeFrame = getSafeFrameDimensions(safeWidth, safeHeight, insets);
  const aspect = safeFrame.width / safeFrame.height;
  const labelAwareSize = getLabelAwareSize(size);
  const vHalfRad = (cameraFov / 2) * Math.PI / 180;
  const hHalfRad = Math.atan(Math.tan(vHalfRad) * aspect);
  const distForX = (labelAwareSize.x / 2) / Math.tan(hHalfRad);
  const distForY = (labelAwareSize.y / 2) / Math.tan(vHalfRad);
  const distance = (isEmpty
    ? 11
    : Math.max(distForX, distForY, MIN_CAMERA_DISTANCE) * CAMERA_FRAME_PADDING + (labelAwareSize.z / 2));
  const opticalTargetOffset = getOpticalTargetOffset({
    width: safeWidth,
    height: safeHeight,
    distance,
    cameraFov,
    insets,
  });
  const opticalTarget = opticalTargetOffset.clone();

  return {
    size,
    distance,
    opticalTargetOffset,
    opticalTarget,
    cameraPosition: new THREE.Vector3(
      0,
      size.y * CAMERA_ELEVATION_RATIO,
      distance,
    ),
  };
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out.`)), INIT_TIMEOUT_MS);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function isRenderableNode(node: PathwayNode | null | undefined): node is PathwayNode {
  return !!node &&
    typeof node.id === 'string' &&
    node.id.length > 0 &&
    (typeof node.label === 'string' || typeof node.canonicalLabel === 'string') &&
    isVec3(node.position);
}

function getRendererLabel(mode: RendererMode): string | null {
  switch (mode) {
    case 'loading': return 'INITIALIZING';
    case 'webgl2': return null;   // WebGL2 is the target renderer — no label needed
    case 'webgl': return 'LEGACY WEBGL';
    case 'error': return 'RENDERER ERROR';
    default: return null;
  }
}

function getRendererTone(mode: RendererMode): React.CSSProperties {
  if (mode === 'error') {
    return { color: 'rgba(255,186,186,0.92)', border: '1px solid rgba(255,120,120,0.22)', background: 'rgba(48,12,16,0.55)' };
  }
  if (mode === 'loading') {
    return { color: 'rgba(232,240,248,0.82)', border: '1px solid rgba(200,216,232,0.18)', background: 'rgba(9,12,18,0.55)' };
  }
  return { color: 'rgba(200,216,232,0.78)', border: '1px solid rgba(200,216,232,0.18)', background: 'rgba(9,12,18,0.55)' };
}

class SceneErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── Deterministic GlyphConfig based on Node ID ──────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function hashFloat(str: string, idx: number, min = 0, max = 1) {
  return min + ((hash(str + idx) % 10000) / 10000) * (max - min);
}
function hashInt(str: string, idx: number, min: number, max: number) {
  return min + (hash(str + idx) % (max - min + 1));
}

// ─── Molecular Texture Creation (Procedural Noise Map) ─────────────────
const createProceduralTexture = () => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = (128 + Math.random() * 80) | 0; // Subtle noise
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10); // Fine, subtle tiling
  texture.flipY = true;
  return texture;
};

// ─── Risk thresholds (shared with NodePanel) ──────────────────────────
const HIGH_RISK_THRESHOLD = 0.7;

// ─── BIO_THEME_COLORS — Pastel tones per CLAUDE.md design system ─────────
export const BIO_THEME_COLORS = {
  CYAN:   '#C8E8F0',  // Metabolite — pastel sky blue
  GREEN:  '#C8E0D0',  // Gene / target yield — pastel mint green
  RED:    '#F0C8C8',  // Impurity / risk — pastel rose red
  AMBER:  '#E8DCC8',  // Enzyme — pastel warm amber
  PURPLE: '#DDD0E8',  // Intermediate / complex — pastel lavender
  PINK:   '#F0D0E4',  // Cofactor — pastel pink
} as const;

// Map each nodeType to its semantic BIO_THEME color
const NODE_TYPE_COLORS: Record<string, string> = {
  metabolite:   BIO_THEME_COLORS.CYAN,    // Default metabolite
  enzyme:       BIO_THEME_COLORS.AMBER,   // Catalytic protein
  gene:         BIO_THEME_COLORS.GREEN,   // Genetic elements → synthesis success
  complex:      BIO_THEME_COLORS.PURPLE,  // Multi-subunit assemblies → precursor
  cofactor:     BIO_THEME_COLORS.PINK,    // Auxiliary molecules → alternative pathway
  impurity:     BIO_THEME_COLORS.RED,     // Impurity / toxic risk
  intermediate: BIO_THEME_COLORS.PURPLE,  // Key intermediate / precursor
  unknown:      BIO_THEME_COLORS.CYAN,    // Fallback → standard metabolite
};

/** Semantic color assignment based on node type + risk/yield flags. */
function getNodeColor(nodeType: string, isHighRisk: boolean, isTargetYield: boolean): string {
  if (isHighRisk)    return BIO_THEME_COLORS.RED;
  if (isTargetYield) return BIO_THEME_COLORS.GREEN;
  return NODE_TYPE_COLORS[nodeType] || BIO_THEME_COLORS.CYAN;
}

function getColor(node: PathwayNode): string {
  const isHighRisk    = node.color_mapping === 'Red' || node.nodeType === 'impurity' || (node.risk_score !== undefined && node.risk_score > HIGH_RISK_THRESHOLD);
  const isTargetYield = node.color_mapping === 'Green' && node.nodeType !== 'impurity';
  return getNodeColor(node.nodeType || 'unknown', isHighRisk, isTargetYield);
}

function getConfidenceValue(node: PathwayNode): number {
  if (node.confidenceScore !== undefined) return node.confidenceScore;
  return 0.75; // Default for missing data
}

// ─── Geometry Components — fixed shape per node type ───────────────────
type GeomKind = 'oct'|'dodec'|'tetra'|'icos'|'sph';
const NODE_TYPE_SHAPES: Record<string, GeomKind> = {
  metabolite:   'sph',    // Sphere — organic molecules
  enzyme:       'oct',    // Octahedron — catalytic proteins
  gene:         'tetra',  // Tetrahedron — genetic elements
  complex:      'dodec',  // Dodecahedron — multi-subunit assemblies
  cofactor:     'icos',   // Icosahedron — auxiliary molecules
  impurity:     'tetra',  // Tetrahedron — warning shape (sharp edges)
  intermediate: 'icos',   // Icosahedron — transient forms
  unknown:      'dodec',  // Dodecahedron — default
};

type GCfg = { geom:GeomKind; scale:number; rings:number; rr:number[]; rt:number[]; sats:number; sr:number; ss:number; spin:number; inner:boolean; };
function glyphCfg(id: string, cc: number, nodeType?: string): GCfg {
  const geom = NODE_TYPE_SHAPES[nodeType || 'unknown'] || 'dodec';
  const rc = hashInt(id,1,1,2);
  return { geom, scale: 0.22+cc*0.04+hashFloat(id,2,0,0.04), rings: rc, rr: Array.from({length:rc},(_,i)=>hashFloat(id,10+i,0.5,0.8)), rt: Array.from({length:rc},(_,i)=>hashFloat(id,20+i,0,Math.PI)), sats: hashInt(id,3,2,4), sr: hashFloat(id,4,0.6,0.9), ss: hashFloat(id,5,0.035,0.055), spin: hashFloat(id,6,0.04,0.10), inner: hash(id)%3===0 };
}

function GeoComp({ g, s }: { g: GeomKind; s: number }) {
  switch(g) {
    case 'oct':   return <octahedronGeometry args={[s, 0]} />;
    case 'dodec': return <dodecahedronGeometry args={[s, 0]} />;
    case 'tetra': return <tetrahedronGeometry args={[s, 0]} />;
    case 'icos':  return <icosahedronGeometry args={[s, 1]} />;
    default:      return <sphereGeometry args={[s, 24, 24]} />;
  }
}

// ─── InstancedMesh Ambient Particles (GPU instancing, frustum-culled) ──
// Replaces any per-component approach. frustumCulled=true (default) on InstancedMesh.
const PARTICLE_COUNT = 80;

function AmbientParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const phases  = useMemo(() => Float32Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2), []);

  // Seed positions deterministically
  const initData = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = i * 2.399963; // golden angle
      const r = 2 + Math.sqrt(i + 1) * 1.8;
      positions.push([
        r * Math.cos(theta),
        (Math.sin(i * 0.37) * 6),
        r * Math.sin(theta),
      ]);
    }
    return positions;
  }, []);

  // Monochrome white tiers for ambient particles
  const COLOR_CYCLE = useMemo(() => [
    new THREE.Color('#FFFFFF').multiplyScalar(0.55),
    new THREE.Color('#FFFFFF').multiplyScalar(0.40),
    new THREE.Color('#FFFFFF').multiplyScalar(0.45),
    new THREE.Color('#FFFFFF').multiplyScalar(0.35),
    new THREE.Color('#FFFFFF').multiplyScalar(0.50),
  ], []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [bx, by, bz] = initData[i];
      dummy.position.set(
        bx + Math.sin(t * 0.12 + phases[i]) * 0.35,
        by + Math.sin(t * 0.18 + phases[i] * 1.3) * 0.25,
        bz + Math.cos(t * 0.10 + phases[i] * 0.7) * 0.35,
      );
      const s = 0.028 + Math.sin(t * 0.4 + phases[i]) * 0.01;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, COLOR_CYCLE[i % COLOR_CYCLE.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    // frustumCulled=true is Three.js default — explicitly stated for clarity
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={true}>
      {/* icosahedronGeometry — no gl_PointSize anywhere */}
      <icosahedronGeometry args={[1, 0]} />
      <meshLambertMaterial
        transparent
        opacity={0.55}
        depthWrite={false}
        vertexColors
      />
    </instancedMesh>
  );
}

// ─── Spatial Grid — decorative floor reference, not the pathway layout authority ──
function SpatialReference({ stressIndex = 0 }: { stressIndex?: number }) {
  const grpRef = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!grpRef.current) return;
    if (stressIndex > 0.8) {
      const mag = (stressIndex - 0.8) * 0.03;
      grpRef.current.position.x = GRID_ORIGIN.x + Math.sin(clock.elapsedTime * 40) * mag;
    } else {
      grpRef.current.position.x = GRID_ORIGIN.x;
    }
  });
  return (
    <group ref={grpRef} position={GRID_ORIGIN.toArray() as Vec3}>
      <gridHelper args={[36, 36, '#606060', '#404040']} />
      <Line points={[new THREE.Vector3(-10,0,0), new THREE.Vector3(10,0,0)]} color="#aaaaaa" lineWidth={0.5} transparent opacity={0.35} />
      <Line points={[new THREE.Vector3(0,0,-10), new THREE.Vector3(0,0,10)]} color="#aaaaaa" lineWidth={0.5} transparent opacity={0.35} />
    </group>
  );
}

// ─── Molecular Node with texture and correct commercial coloring ──────
const MolNode = React.memo(function MolNode({ node, hov, sel, cc, onClick, onHov, roughnessTexture, flowSpeed, glowMultiplier = 1, stressIndex = 0, viewMode = 'network' }: {
  node: PathwayNode; hov: boolean; sel: boolean; cc: number;
  onClick: (n: PathwayNode) => void; onHov: (id: string | null) => void;
  roughnessTexture: THREE.Texture | null; flowSpeed?: number; glowMultiplier?: number; stressIndex?: number; viewMode?: SceneViewMode;
}) {
  const _flowSpeed = flowSpeed ?? 1;
  const nodeRadius = 0.32 + cc * 0.05;
  const labelOffsetY = nodeRadius + 0.06;
  // Shrink nodes when pH/temperature deviate from optimal (encoded in glowMultiplier)
  const activityScale = 0.7 + 0.3 * Math.min(1, glowMultiplier / 2.0);
  const grp     = useRef<THREE.Group>(null);
  const glyphGrp = useRef<THREE.Group>(null);
  const ring    = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const ready   = true;

  const conf   = getConfidenceValue(node);
  const finalColor = getColor(node);
  const lbl    = node.canonicalLabel?.trim() || node.label || node.id;
  const cfg    = useMemo(() => glyphCfg(node.id, cc, node.nodeType), [node.id, cc, node.nodeType]);
  const tgt    = sel ? 1.28 : hov ? 1.10 : 1.0;
  const riskScore = typeof node.risk_score === 'number' ? node.risk_score : 0;
  const modeScale = viewMode === 'risk'
    ? 1 + riskScore * 0.55 + (node.nodeType === 'impurity' ? 0.12 : 0)
    : viewMode === 'flow'
      ? 1 + Math.min(cc, 4) * 0.06
      : 1;
  const colVec = useMemo(() => new THREE.Color(finalColor), [finalColor]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const fdt = dt * _flowSpeed;
    if (grp.current) {
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 * _flowSpeed + hash(node.id) * 0.01) * 0.06;
    }
    if (glyphGrp.current) {
      const cs = glyphGrp.current.scale.x;
      glyphGrp.current.scale.setScalar(cs + ((ready ? tgt : 0.001) - cs) * dt * 5);
      glyphGrp.current.rotation.y = Math.sin(t * 0.06 * _flowSpeed + hash(node.id) * 0.001) * 0.05;
    }
    if (ring.current) {
      ring.current.rotation.z += fdt * 0.10;
      const mat = ring.current.material as THREE.MeshPhysicalMaterial;
      const to = hov || sel ? 0.35 : 0.07;
      mat.opacity += (to - mat.opacity) * dt * 3;
    }
    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshPhysicalMaterial;
      const targetEmissive = sel ? 0.40 : hov ? 0.2 : 0.03;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * dt * 6;
    }
  });

  return (
    <group
      ref={grp}
      position={node.position}
      onClick={e => { e.stopPropagation(); onClick(node); }}
      onPointerOver={e => { e.stopPropagation(); onHov(node.id); document.body.style.cursor = 'pointer'; }}
      onPointerOut={e => { e.stopPropagation(); onHov(null); document.body.style.cursor = 'auto'; }}
    >
      <group ref={glyphGrp}>
        <mesh ref={bodyRef}>
          <GeoComp g={cfg.geom} s={nodeRadius * activityScale * modeScale} />
          <meshLambertMaterial
            color={finalColor}
            emissive={finalColor}
            emissiveIntensity={0.12}
            depthWrite={true}
          />
        </mesh>

        {/* Invisible hitbox for reliable click detection */}
        <mesh visible={false}>
          <sphereGeometry args={[0.8 * modeScale, 16, 16]} />
          <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Bottleneck anomaly glow — sharp red wireframe ring when substrate accumulates under stress */}
        {stressIndex > 0.5 && (node.risk_score ?? 0) > 0.5 && (
          <mesh>
            <sphereGeometry args={[nodeRadius * 1.55 * modeScale, 16, 16]} />
            <meshBasicMaterial
              color="#FF2222"
              transparent
              opacity={Math.min(0.45, (stressIndex - 0.5) * (node.risk_score ?? 0) * 0.7)}
              wireframe
              depthWrite={false}
            />
          </mesh>
        )}

        {cfg.rr.map((r, i) => (
          <mesh key={`r${i}`} ref={i === 0 ? ring : undefined} rotation={[cfg.rt[i] || 0, 0, i * 1.1]}>
            <torusGeometry args={[r * modeScale, 0.007, 4, 40]} />
            <meshLambertMaterial color={finalColor} emissive={finalColor} emissiveIntensity={0.08} transparent opacity={0.07} depthWrite={false} />
          </mesh>
        ))}
      </group>

      <Html position={[0, labelOffsetY, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          color: hov || sel ? '#fff' : 'rgba(160,180,200,0.55)',
          fontSize: '8.25px', fontWeight: sel ? 600 : 500,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '0.01em',
          textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7)',
          padding: '2px 4px', background: sel ? 'rgba(200,216,232,0.08)' : 'transparent',
          borderRadius: '4px', border: sel ? '1px solid rgba(200,216,232,0.14)' : '1px solid transparent',
          transition: 'color 0.2s',
        }}>{lbl}</div>
      </Html>

      {hov && !sel && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(6,9,16,0.95)', border: '1px solid rgba(200,216,232,0.12)',
            borderRadius: '16px', padding: '10px 14px', width: '210px',
            backdropFilter: 'blur(20px)', transform: 'translateY(-120%)', fontFamily: "'Public Sans', sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#c8d8e4', fontSize: '12px', fontWeight: 600 }}>{lbl}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFeatureSettings: "'tnum' 1" }}>{Math.round(conf*100)}%</span>
            </div>
            {node.nodeType && node.nodeType !== 'unknown' && (
              <span style={{ color: 'rgba(200,216,232,0.5)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px', fontWeight: 700 }}>{node.nodeType}</span>
            )}
            <p style={{ color: 'rgba(180,200,215,0.42)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 7px' }}>{node.summary?.slice(0, 80)}...</p>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginBottom: '6px' }}>
              <div style={{ width: `${Math.round(conf*100)}%`, height: '100%', background: colVec.getStyle(), borderRadius: '1px', opacity: 0.8 }} />
            </div>
            {node.audit_trail && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>Source: </span> {node.audit_trail}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── Soft path edges ────────────────────────────────────────────────────
const PathEdge = React.memo(function PathEdge({ edge, s, e, active, color, flowSpeed, viewMode = 'network' }: { edge:PathwayEdge; s:Vec3; e:Vec3; active:boolean; color:string; flowSpeed?:number; viewMode?: SceneViewMode }) {
  const _flowSpeed = flowSpeed ?? 1;
  const dot  = useRef<THREE.Mesh>(null);
  const prog = useRef(Math.random());
  const sv   = useMemo(() => new THREE.Vector3(...s), [s]);
  const ev   = useMemo(() => new THREE.Vector3(...e), [e]);
  const mid  = useMemo(() => sv.clone().lerp(ev, 0.5), [sv, ev]);

  const thickness = useMemo(() => {
    const map: Record<string, number> = { "Thick": 1.5, "Medium": 0.8, "Thin": 0.25 };
    return map[edge.thickness_mapping || "Medium"] || 0.25;
  }, [edge.thickness_mapping]);

  // Show flowing dot for spontaneous reactions (negative ΔG) or when edge is active
  const isSpontaneous = edge.predicted_delta_G_kJ_mol !== undefined && edge.predicted_delta_G_kJ_mol < 0;
  const dotSpeed = isSpontaneous ? Math.min(0.4, 0.08 + Math.abs(edge.predicted_delta_G_kJ_mol ?? 0) * 0.002) : 0.18;

  useFrame((_, dt) => {
    prog.current = (prog.current + dt * dotSpeed * _flowSpeed) % 1;
    if (dot.current) {
      dot.current.position.lerpVectors(sv, ev, prog.current);
      dot.current.visible = active || isSpontaneous;
    }
  });

  const lineOpacity = viewMode === 'risk'
    ? (active ? 0.9 : 0.14)
    : viewMode === 'flow'
      ? (active || isSpontaneous ? 0.95 : 0.26)
      : (active ? 0.85 : 0.22);
  const lineWidth = viewMode === 'flow'
    ? (active || isSpontaneous ? thickness * 1.8 : thickness * 1.15)
    : viewMode === 'risk'
      ? (active ? thickness * 1.6 : thickness * 0.85)
      : (active ? thickness * 1.5 : thickness);

  return (
    <group>
      <Line points={[sv, ev]} color={active ? color : '#444444'} lineWidth={lineWidth} transparent opacity={lineOpacity} />
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[viewMode === 'flow' ? 0.055 : active ? 0.05 : 0.035, 6, 6]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={isSpontaneous ? 0.8 : 0.6} transparent opacity={active ? 0.9 : 0.5} />
      </mesh>
      {active && edge.predicted_delta_G_kJ_mol && (
        <Html position={mid.toArray() as Vec3}>
          <div style={{ background: 'rgba(6,9,16,0.9)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
            ΔG: {edge.predicted_delta_G_kJ_mol} kJ/mol
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── Scroll-Sync Camera 【关键修复】：镜头居中算法，绝不跑偏 ──────────────
type OrbitControlsHandle = { target: THREE.Vector3; update(): void };
function ScrollSyncCamera({ nodes, selectedId, interact, controlsRef, baseTarget, routeCenter, opticalOffset }: {
  nodes: PathwayNode[];
  selectedId: string | null;
  interact: boolean;
  controlsRef: React.RefObject<OrbitControlsHandle | null>;
  baseTarget: THREE.Vector3;
  routeCenter: THREE.Vector3;
  opticalOffset: THREE.Vector3;
}) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3().copy(baseTarget));

  useEffect(() => {
    if (selectedId) {
      const node = nodes.find(n => n.id === selectedId);
      if (node && Array.isArray(node.position)) {
        targetLookAt.current.set(...node.position).sub(routeCenter).add(opticalOffset);
      }
    } else {
      targetLookAt.current.copy(baseTarget);
    }
  }, [baseTarget, nodes, opticalOffset, routeCenter, selectedId]);

  useFrame((_, dt) => {
    if (interact || !(camera instanceof THREE.PerspectiveCamera)) return;
    const alpha = 1 - Math.exp(-dt * 2.0);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, alpha);
      controlsRef.current.update();
    }
    const targetFov = selectedId ? 30 : 44;
    camera.fov += (targetFov - camera.fov) * alpha;
    camera.updateProjectionMatrix();
  });
  return null;
}

// ─── Flux Particle System — white dots flow along pathway edges ───────
const FLUX_PER_EDGE = 20;

function FluxParticles({ edges, nodes, flowSpeed, glowMultiplier }: {
  edges: PathwayEdge[]; nodes: PathwayNode[]; flowSpeed: number; glowMultiplier: number;
}) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, PathwayNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const edgeVecs = useMemo(() =>
    edges.map(e => {
      const s = nodeMap.get(e.start);
      const t = nodeMap.get(e.end);
      if (!s?.position || !t?.position || !Array.isArray(s.position) || !Array.isArray(t.position)) return null;
      return { sv: new THREE.Vector3(...(s.position as [number,number,number])), ev: new THREE.Vector3(...(t.position as [number,number,number])) };
    }).filter((x): x is { sv: THREE.Vector3; ev: THREE.Vector3 } => x !== null),
  [edges, nodeMap]);

  const N = edgeVecs.length * FLUX_PER_EDGE;

  const { pts, geo } = useMemo(() => {
    const pos = new Float32Array(Math.max(N, 1) * 3);
    // Stagger initial positions evenly along each edge
    for (let i = 0; i < N; i++) {
      const ei = Math.floor(i / FLUX_PER_EDGE);
      if (ei >= edgeVecs.length) continue;
      const { sv, ev } = edgeVecs[ei];
      const t = (i % FLUX_PER_EDGE) / FLUX_PER_EDGE;
      pos[i * 3]     = sv.x + (ev.x - sv.x) * t;
      pos[i * 3 + 1] = sv.y + (ev.y - sv.y) * t;
      pos[i * 3 + 2] = sv.z + (ev.z - sv.z) * t;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.05, color: 0xffffff, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false });
    return { pts: new THREE.Points(g, m), geo: g };
  }, [N, edgeVecs]);

  // Update opacity reactively with glowMultiplier
  useEffect(() => {
    (pts.material as THREE.PointsMaterial).opacity = Math.min(0.85, 0.3 + glowMultiplier * 0.2);
  }, [pts, glowMultiplier]);

  const progress = useRef(Float32Array.from({ length: N }, (_, i) => (i % FLUX_PER_EDGE) / FLUX_PER_EDGE));

  // Reset progress when pathway changes
  useEffect(() => {
    progress.current = Float32Array.from({ length: N }, (_, i) => (i % FLUX_PER_EDGE) / FLUX_PER_EDGE);
  }, [N]);

  useFrame((_, dt) => {
    if (N === 0 || edgeVecs.length === 0) return;
    const speed = dt * flowSpeed * 0.28;
    const prog = progress.current;
    const positions = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < N; i++) {
      prog[i] = (prog[i] + speed) % 1;
      const ei = Math.floor(i / FLUX_PER_EDGE);
      if (ei >= edgeVecs.length) continue;
      const { sv, ev } = edgeVecs[ei];
      const t = prog[i];
      positions[i * 3]     = sv.x + (ev.x - sv.x) * t;
      positions[i * 3 + 1] = sv.y + (ev.y - sv.y) * t;
      positions[i * 3 + 2] = sv.z + (ev.z - sv.z) * t;
    }
    geo.attributes.position.needsUpdate = true;
  });

  if (N === 0) return null;
  return <primitive object={pts} />;
}

function vectorAudit(value: THREE.Vector3) {
  return [value.x, value.y, value.z].map((entry) => Number(entry.toFixed(3)));
}

// ─── Scene — unified lighting, integrated depth ────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId, roughnessTexture, glowMultiplier, flowSpeed, stressIndex, viewMode, resetSignal, opticalInsets, debugFrameName }: { nodes:PathwayNode[]; edges:PathwayEdge[]; onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null; roughnessTexture:THREE.Texture | null; glowMultiplier:number; flowSpeed:number; stressIndex:number; viewMode: SceneViewMode; resetSignal?: number; opticalInsets: OpticalInsetBox; debugFrameName?: string; }) {
  const [hovId, setHovId]       = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart = useCallback(() => { setInteract(true); if (timer.current) clearTimeout(timer.current); }, []);
  const onEnd   = useCallback(() => { timer.current = setTimeout(() => setInteract(false), 3500); }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // BoundingBox auto-focus — FOV-based distance so the entire pathway fits the viewport
  const { camera, size: viewportSize } = useThree();
  const cameraFov = (camera as THREE.PerspectiveCamera).fov ?? 44;
  const routeGeometry = useMemo(() => computeRouteGeometry(nodes), [nodes]);

  const { opticalTarget, opticalTargetOffset, cameraPosition } = useMemo(() =>
    computeCameraFrame({
      routeGeometry,
      width: viewportSize.width,
      height: viewportSize.height,
      cameraFov,
      insets: opticalInsets,
    }),
  [routeGeometry, cameraFov, opticalInsets, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    camera.position.copy(cameraPosition);
    camera.lookAt(opticalTarget);
    if (controlsRef.current) {
      controlsRef.current.target.copy(opticalTarget);
      controlsRef.current.update();
    }
    if (resetSignal) setInteract(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, cameraPosition, opticalTarget, resetSignal]);

  useEffect(() => {
    if (!debugFrameName || process.env.NODE_ENV === 'production') return;
    console.info(`[${debugFrameName} geometry audit]`, {
      nodeCount: nodes.length,
      bboxMin: vectorAudit(routeGeometry.min),
      bboxMax: vectorAudit(routeGeometry.max),
      bboxCenter: vectorAudit(routeGeometry.boundsCenter),
      arithmeticCentroid: vectorAudit(routeGeometry.arithmeticCentroid),
      routeGroupOffset: vectorAudit(routeGeometry.routeGroupOffset),
      cameraPosition: vectorAudit(cameraPosition),
      cameraTarget: vectorAudit(opticalTarget),
      opticalOffset: vectorAudit(opticalTargetOffset),
      gridOrigin: vectorAudit(GRID_ORIGIN),
      viewport: {
        width: Math.round(viewportSize.width),
        height: Math.round(viewportSize.height),
      },
      safeInsets: opticalInsets,
    });
  }, [
    cameraPosition,
    debugFrameName,
    nodes.length,
    opticalInsets,
    opticalTarget,
    opticalTargetOffset,
    routeGeometry,
    viewportSize.height,
    viewportSize.width,
  ]);

  const cc = useMemo(() => {
    const c: Record<string,number> = {};
    nodes.forEach(n => { c[n.id] = 0; });
    edges.forEach(e => { if (c[e.start] !== undefined) c[e.start]++; if (c[e.end] !== undefined) c[e.end]++; });
    return c;
  }, [nodes, edges]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, PathwayNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const ed = useMemo(() =>
    edges.map(edge => {
      const s = nodeMap.get(edge.start);
      const e = nodeMap.get(edge.end);
      if (!s || !e || !Array.isArray(s.position) || !Array.isArray(e.position)) return null;
      return { key:`${edge.start}-${edge.end}`, edge, s, e, active: hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end, color: getColor(s) };
    }).filter(Boolean) as any[],
  [edges, nodeMap, hovId, selectedNodeId]);

  return (
    <>
      <ambientLight intensity={0.75 * glowMultiplier} color="#FFFFFF" />
      <directionalLight position={[4, 10, 6]} intensity={0.30 * glowMultiplier} color="#FFFFFF" castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-8, -2, -6]} intensity={0.08} color="#111111" />
      <pointLight position={[0, routeGeometry.size.y * 0.5 + 6, 0]} intensity={0.18 * glowMultiplier} color="#FFFFFF" distance={28} decay={2} />
      <fog attach="fog" args={['#000000', 30, 70]} />

      {/* maxDistance 50 accommodates large AI-generated pathway networks without clipping */}
      <OrbitControls ref={controlsRef as React.Ref<never>} makeDefault enableZoom autoRotate={!interact && !hovId && !selectedNodeId} autoRotateSpeed={0.12} zoomSpeed={0.45} minDistance={6} maxDistance={50} enablePan={false} onStart={onStart} onEnd={onEnd} target={opticalTarget} />
      <SpatialReference stressIndex={stressIndex} />

      <AmbientParticles />
      <group position={routeGeometry.routeGroupOffset.toArray() as Vec3}>
        <FluxParticles edges={edges} nodes={nodes} flowSpeed={viewMode === 'flow' ? flowSpeed * 1.25 : flowSpeed} glowMultiplier={glowMultiplier} />
        {ed.map(e => <PathEdge key={e.key} edge={e.edge} s={e.s.position} e={e.e.position} active={e.active} color={e.color} flowSpeed={flowSpeed} viewMode={viewMode} />)}
        {nodes.map(n => <MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId} roughnessTexture={roughnessTexture} flowSpeed={flowSpeed} glowMultiplier={glowMultiplier} stressIndex={stressIndex} viewMode={viewMode} />)}
      </group>

      <ScrollSyncCamera nodes={nodes} selectedId={selectedNodeId} interact={interact} controlsRef={controlsRef} baseTarget={opticalTarget} routeCenter={routeGeometry.boundsCenter} opticalOffset={opticalTargetOffset} />
    </>
  );
}

// ─── Resize handler ──────────────────────────────────────────────────
function ResizeHandler() {
  const { gl, camera } = useThree();
  useEffect(() => {
    const handleResize = () => {
      const parent = gl.domElement.parentElement;
      if (!parent) return;
      gl.setSize(parent.clientWidth, parent.clientHeight, false);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = parent.clientWidth / parent.clientHeight;
        camera.updateProjectionMatrix();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera, gl]);
  return null;
}

// ─── Main Component — loading fallback and scene unified ─────────────
interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; glowMultiplier?:number; flowSpeed?:number; fullscreen?:boolean; stressIndex?:number; opticalInsets?: Partial<OpticalInsetBox>; tracePlacement?: TracePlacement; traceLayout?: TraceLayout; debugFrameName?: string; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId, glowMultiplier = 1, flowSpeed = 1, fullscreen = false, stressIndex = 0, opticalInsets, tracePlacement = 'top-right', traceLayout, debugFrameName }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rendererMode, setRendererMode] = useState<RendererMode>('loading');
  const [viewMode, setViewMode] = useState<SceneViewMode>('network');
  const [resetSignal, setResetSignal] = useState(0);
  const mountedRef = useRef(true);
  const roughnessTexture = useMemo(() => createProceduralTexture(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes.filter(isRenderableNode) : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);
  const resolvedOpticalInsets = useMemo(
    () => normalizeOpticalInsets(fullscreen, opticalInsets),
    [fullscreen, opticalInsets],
  );
  const resolvedTraceLayout = useMemo(
    () => ({
      top: traceLayout?.top ?? resolvedOpticalInsets.top,
      left: tracePlacement === 'top-left'
        ? traceLayout?.left ?? resolvedOpticalInsets.left
        : traceLayout?.left,
      right: tracePlacement === 'top-right'
        ? traceLayout?.right ?? resolvedOpticalInsets.right
        : traceLayout?.right,
      width: traceLayout?.width,
    }),
    [resolvedOpticalInsets.left, resolvedOpticalInsets.right, resolvedOpticalInsets.top, traceLayout, tracePlacement],
  );
  const fallbackLabel = getRendererLabel(rendererMode);
  const riskNodes = useMemo(() => safeNodes.filter(node => (node.risk_score ?? 0) >= HIGH_RISK_THRESHOLD).length, [safeNodes]);
  const spontaneousEdges = useMemo(() => safeEdges.filter(edge => (edge.predicted_delta_G_kJ_mol ?? 0) < 0).length, [safeEdges]);
  const selectedNode = useMemo(
    () => safeNodes.find((node) => node.id === selectedNodeId) ?? null,
    [safeNodes, selectedNodeId],
  );
  const connectedEdges = useMemo(
    () => (selectedNodeId
      ? safeEdges.filter((edge) => edge.start === selectedNodeId || edge.end === selectedNodeId)
      : []),
    [safeEdges, selectedNodeId],
  );
  const modeTrace = useMemo(() => {
    if (viewMode === 'risk') {
      return {
        label: 'Risk trace',
        summary: selectedNode
          ? selectedNode.audit_trail || selectedNode.toxicity_impact || selectedNode.dsp_bottleneck || 'Risk view emphasizes audit trail, toxicity, and downstream bottlenecks.'
          : 'Risk view scales flagged nodes and keeps hazard mapping visible before downstream validation.',
        metric: selectedNode ? `risk ${(selectedNode.risk_score ?? 0).toFixed(2)}` : `${riskNodes} flagged nodes`,
      };
    }
    if (viewMode === 'flow') {
      const edgeEvidence = connectedEdges.find((edge) => edge.evidence || edge.audit_trail);
      return {
        label: 'Flux trace',
        summary: edgeEvidence?.evidence || edgeEvidence?.audit_trail || 'Flux view highlights mapped reaction flow and spontaneity-linked edges.',
        metric: selectedNode ? `${connectedEdges.length} linked edges` : `${spontaneousEdges} spontaneous steps`,
      };
    }
    return {
      label: 'Evidence trace',
      summary: selectedNode
        ? selectedNode.evidenceSnippet || selectedNode.audit_trail || selectedNode.summary
        : 'Network view preserves node confidence, citation-backed summary, and topology context.',
      metric: selectedNode ? `confidence ${getConfidenceValue(selectedNode).toFixed(2)}` : `${safeNodes.length} mapped entities`,
    };
  }, [connectedEdges, riskNodes, safeNodes.length, selectedNode, spontaneousEdges, viewMode]);

  const initialCamPos = useMemo(() => ({ position: [0, 0.2, 11] as [number, number, number], fov: 44 }), []);

  return (
    <div style={{
      width: '100%',
      height: fullscreen ? '100%' : 'clamp(500px, 65vh, 760px)',
      background: fullscreen ? 'transparent' : '#000000',
      borderRadius: '0', overflow: 'hidden',
      border: fullscreen ? 'none' : '0.5px solid rgba(255,255,255,0.07)', position: 'relative',
      boxShadow: 'none',
    }}>
      {/* Inner header — hidden when fullscreen (parent page has its own TopBar) */}
      <div style={{ pointerEvents: 'none', position:'absolute', top:0, left:0, right:0, zIndex:10, display: fullscreen ? 'none' : 'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', background:'linear-gradient(to bottom, rgba(16,16,16,0.92), transparent)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            {[BIO_THEME_COLORS.CYAN, BIO_THEME_COLORS.GREEN, BIO_THEME_COLORS.PURPLE].map(c => (
              <div key={c} style={{ width:'4px', height:'4px', borderRadius:'50%', background:c, opacity:0.35 }} />
            ))}
          </div>
          <span style={{ color:'rgba(255,255,255,0.20)', fontSize:'10px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            METABOLIC · {safeNodes.length} ENTITIES
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {!fullscreen && (
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {([
                { key: 'network', label: 'Network', active: '#5151CD' },
                { key: 'flow', label: 'Flux', active: '#93CB52' },
                { key: 'risk', label: 'Risk', active: '#FA8072' },
              ] as const).map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setViewMode(mode.key)}
                  className="nb-ui-control"
                  style={{
                    pointerEvents: 'auto',
                    minHeight: '24px',
                    padding: '0 9px',
                    borderRadius: '999px',
                    border: '1px solid var(--nb-control-border)',
                    background: 'var(--nb-control-bg)',
                    color: 'var(--nb-control-color)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    ['--nb-control-bg' as const]: viewMode === mode.key ? mode.active : 'transparent',
                    ['--nb-control-border' as const]: viewMode === mode.key ? mode.active : 'transparent',
                    ['--nb-control-color' as const]: viewMode === mode.key ? '#000000' : 'rgba(255,255,255,0.45)',
                    ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.10)',
                    ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.18)',
                    ['--nb-control-hover-color' as const]: '#e2e8f0',
                    ['--nb-control-active-bg' as const]: 'rgba(255,255,255,0.14)',
                    ['--nb-control-active-border' as const]: 'rgba(255,255,255,0.22)',
                    ['--nb-control-active-color' as const]: '#e2e8f0',
                  } as ControlVarsStyle}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setResetSignal(s => s + 1)}
            title="Reset camera to default view"
            className="nb-ui-control"
            style={{
              pointerEvents: 'auto',
              minHeight: '24px',
              padding: '0 9px',
              borderRadius: '999px',
              border: '1px solid var(--nb-control-border)',
              background: 'var(--nb-control-bg)',
              color: 'var(--nb-control-color)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              ['--nb-control-bg' as const]: 'rgba(255,255,255,0.04)',
              ['--nb-control-border' as const]: 'rgba(255,255,255,0.10)',
              ['--nb-control-color' as const]: 'rgba(255,255,255,0.45)',
              ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.10)',
              ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.18)',
              ['--nb-control-hover-color' as const]: '#e2e8f0',
              ['--nb-control-active-bg' as const]: 'rgba(255,255,255,0.14)',
              ['--nb-control-active-border' as const]: 'rgba(255,255,255,0.22)',
              ['--nb-control-active-color' as const]: '#e2e8f0',
            } as ControlVarsStyle}
          >
            ↺ Reset
          </button>
          {fallbackLabel && (
            <span style={{ ...getRendererTone(rendererMode), fontSize:'9px', fontFamily:"'Public Sans',sans-serif", padding:'2px 8px', borderRadius:'99px', letterSpacing:'0.04em', fontWeight:700 }}>
              {fallbackLabel}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.10)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif" }}>drag · scroll · click</span>
        </div>
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:`${resolvedOpticalInsets.bottom}px`, left:`${resolvedOpticalInsets.left}px`, zIndex:10 }}>
        <p style={{ color:'rgba(255,255,255,0.12)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, margin:'0 0 4px', letterSpacing:'0.07em', textTransform:'uppercase' }}>
          {viewMode === 'risk' ? 'RISK NODES' : viewMode === 'flow' ? 'FLUX EDGES' : 'CONFIDENCE'}
        </p>
        {(viewMode === 'risk'
          ? [
              { c:'#FA8072', l:`${riskNodes} flagged` },
              { c:'#5151CD', l:`${safeNodes.length - riskNodes} stable` },
            ]
          : viewMode === 'flow'
            ? [
                { c:'#93CB52', l:`${spontaneousEdges} spontaneous` },
                { c:'#5151CD', l:`${safeEdges.length} mapped` },
              ]
            : [{ c:'#C8D8E8',l:'>90' },{ c:'#C8E0D0',l:'70–90' },{ c:'#E8DCC8',l:'50–70' },{ c:'#E8C8D4',l:'<50' }]).map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'2px' }}>
            <div style={{ width:'12px', height:'2px', background:x.c, borderRadius:'1px', opacity:0.65 }} />
            <span style={{ color:'rgba(255,255,255,0.14)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontFeatureSettings:"'tnum' 1" }}>{x.l}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          top: `${resolvedTraceLayout.top}px`,
          right: tracePlacement === 'top-right' && resolvedTraceLayout.right !== undefined ? `${resolvedTraceLayout.right}px` : 'auto',
          left: tracePlacement === 'top-left' && resolvedTraceLayout.left !== undefined ? `${resolvedTraceLayout.left}px` : 'auto',
          zIndex: 10,
          width: resolvedTraceLayout.width
            ? `min(${resolvedTraceLayout.width}px, calc(100% - 32px))`
            : 'min(208px, calc(100% - 32px))',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.09)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(242,247,252,0.06) 22%, rgba(8,10,14,0.48) 100%)',
          padding: '8px 10px',
          backdropFilter: 'blur(14px) saturate(125%)',
          WebkitBackdropFilter: 'blur(14px) saturate(125%)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
        <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.22)', fontSize: '8px', fontFamily: "'Public Sans',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {modeTrace.label}
        </p>
        <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.68)', fontSize: '9.5px', lineHeight: 1.5, fontFamily: "'Public Sans',sans-serif" }}>
          {modeTrace.summary}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
            {selectedNode ? `${selectedNode.label}` : 'No node selected'}
          </span>
          <span style={{ minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
            {modeTrace.metric}
          </span>
          {selectedNode?.citation && (
            <span style={{ minHeight: '22px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
              {selectedNode.citation}
            </span>
          )}
        </div>
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:`${resolvedOpticalInsets.bottom}px`, right:`${resolvedOpticalInsets.right}px`, zIndex:10, background:'rgba(0,0,0,0.42)', padding:'8px 12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, margin:'0 0 6px', letterSpacing:'0.07em', textTransform:'uppercase' }}>Node Types</p>
        {[
          { c: BIO_THEME_COLORS.CYAN,   l:'Metabolite', s:'●' },
          { c: BIO_THEME_COLORS.AMBER,  l:'Enzyme', s:'◆' },
          { c: BIO_THEME_COLORS.GREEN,  l:'Gene', s:'▲' },
          { c: BIO_THEME_COLORS.PURPLE, l:'Intermediate', s:'⬟' },
          { c: BIO_THEME_COLORS.RED,    l:'Impurity', s:'▲' },
          { c: BIO_THEME_COLORS.PINK,   l:'Cofactor', s:'⬟' },
        ].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
            <span style={{ color:x.c, fontSize:'10px', lineHeight:1, width:'10px', textAlign:'center' }}>{x.s}</span>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif" }}>{x.l}</span>
          </div>
        ))}
      </div>

      <SceneErrorBoundary onError={() => { setRendererMode('error'); setStatus('error'); }}>
        <Canvas
          camera={initialCamPos}
          gl={async (props) => {
            const canvas = props.canvas as HTMLCanvasElement;
            const parent = canvas.parentElement;
            const width = parent?.clientWidth ?? canvas.width;
            const height = parent?.clientHeight ?? canvas.height;

            const applyRendererDefaults = <Renderer extends ConfigurableRenderer>(renderer: Renderer) => {
              renderer.setSize(width, height, false);
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1.15;
              renderer.setClearColor(0x000000, 0); // transparent — FluidSim shows through
              return renderer;
            };

            const webgl2 = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: true });
            if (webgl2) {
              setRendererMode('webgl2'); setStatus('ready');
              return applyRendererDefaults(new THREE.WebGLRenderer({ canvas, context: webgl2, antialias: true, powerPreference: 'high-performance', alpha: true }));
            }

            const webgl = canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance', alpha: true });
            if (webgl) {
              setRendererMode('webgl'); setStatus('ready');
              return applyRendererDefaults(new THREE.WebGLRenderer({ canvas, context: webgl, antialias: true, powerPreference: 'high-performance', alpha: true }));
            }
            setRendererMode('error');
            setStatus('error');
            throw new Error('WebGL unavailable');
          }}
          dpr={[1, 1.5]} performance={{ min: 0.5 }} style={{ background: 'transparent', pointerEvents: 'auto' }}
        >
          <ResizeHandler />
          <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} roughnessTexture={roughnessTexture} glowMultiplier={glowMultiplier} flowSpeed={flowSpeed} stressIndex={stressIndex} viewMode={viewMode} resetSignal={resetSignal} opticalInsets={resolvedOpticalInsets} debugFrameName={debugFrameName} />
        </Canvas>
      </SceneErrorBoundary>
      {status !== 'ready' && (
        <div
          aria-live="polite"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: status === 'error'
              ? 'rgba(5,7,10,0.72)'
              : 'linear-gradient(180deg, rgba(5,7,10,0.36), rgba(5,7,10,0.08))',
          }}
        >
          <div style={{
            maxWidth: 'min(320px, calc(100% - 40px))',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(8,10,14,0.74)',
            padding: '12px 14px',
            color: 'rgba(255,255,255,0.70)',
            fontFamily: "'Public Sans',sans-serif",
            fontSize: '11px',
            lineHeight: 1.45,
            textAlign: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
          }}>
            <strong style={{ display: 'block', color: 'rgba(255,255,255,0.88)', fontSize: '11px', marginBottom: '3px' }}>
              {status === 'error' ? '3D pathway renderer unavailable' : 'Preparing 3D pathway view'}
            </strong>
            {status === 'error'
              ? 'Try reloading the page or enabling WebGL in the browser.'
              : 'Loading the PATHD molecular graph and renderer.'}
          </div>
        </div>
      )}
    </div>
  );
}
