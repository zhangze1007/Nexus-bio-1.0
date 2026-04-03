'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

type Vec3 = [number, number, number];
type RendererMode = 'loading' | 'webgpu' | 'webgl2' | 'webgl' | 'error';
type SceneViewMode = 'network' | 'flow' | 'risk';
type ConfigurableRenderer = {
  setSize: (w: number, h: number, updateStyle?: boolean) => void;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  setClearColor: (color: THREE.ColorRepresentation, alpha?: number) => void;
};

const INIT_TIMEOUT_MS = 2000;

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

// ─── BIO_THEME_COLORS — aligned with Design System 2.0 (Dark Mode 2.0) ─
export const BIO_THEME_COLORS = {
  CYAN:   '#FFFFFF',  // Metabolite — bright white
  GREEN:  '#D0D0D0',  // Gene / target yield — light gray
  RED:    '#787878',  // Impurity / risk — dark gray
  AMBER:  '#A8A8A8',  // Enzyme — medium gray
  PURPLE: '#909090',  // Intermediate / complex — gray
  PINK:   '#B8B8B8',  // Cofactor — light-medium gray
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
const PARTICLE_COUNT = 160;

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
      <meshPhysicalMaterial
        transparent
        opacity={0.55}
        roughness={0.7}
        metalness={0.05}
        depthWrite={false}
        vertexColors
      />
    </instancedMesh>
  );
}

// ─── Spatial Grid — darker theme requested ─────────────────────────────
function SpatialReference({ stressIndex = 0, centroid }: { stressIndex?: number; centroid?: THREE.Vector3 }) {
  const cx = centroid?.x ?? 0;
  const cz = centroid?.z ?? 0;
  const grpRef = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!grpRef.current) return;
    if (stressIndex > 0.8) {
      const mag = (stressIndex - 0.8) * 0.03;
      grpRef.current.position.x = cx + Math.sin(clock.elapsedTime * 40) * mag;
    } else {
      grpRef.current.position.x = cx;
    }
  });
  return (
    <group ref={grpRef} position={[cx, -3.8, cz]}>
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
  // Shrink nodes when pH/temperature deviate from optimal (encoded in glowMultiplier)
  const activityScale = 0.7 + 0.3 * Math.min(1, glowMultiplier / 2.0);
  const grp     = useRef<THREE.Group>(null);
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
      const cs = grp.current.scale.x;
      grp.current.scale.setScalar(cs + ((ready ? tgt : 0.001) - cs) * dt * 5);
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 * _flowSpeed + hash(node.id) * 0.01) * 0.06;
      grp.current.rotation.y = Math.sin(t * 0.06 * _flowSpeed + hash(node.id) * 0.001) * 0.05;
      // NOTE: intentionally no rotation.z — label is inside this group and must stay anchored below node
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
      <mesh ref={bodyRef}>
        <GeoComp g={cfg.geom} s={nodeRadius * activityScale * modeScale} />
        <meshPhysicalMaterial
          color={finalColor}
          emissive={finalColor}
          emissiveIntensity={0.12}
          roughnessMap={roughnessTexture} 
          roughness={0.55} 
          metalness={0.08}
          transmission={0.05}
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
          <meshPhysicalMaterial color={finalColor} emissive={finalColor} emissiveIntensity={0.08} transparent opacity={0.07} roughness={0.6} metalness={0} depthWrite={false} />
        </mesh>
      ))}

      <Html position={[0, -(nodeRadius * 1.2), 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          color: hov || sel ? '#fff' : 'rgba(160,180,200,0.55)',
          fontSize: '10px', fontWeight: sel ? 600 : 400,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '0.02em',
          textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7)',
          padding: '2px 7px', background: sel ? 'rgba(200,216,232,0.07)' : 'transparent',
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
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={isSpontaneous ? 0.8 : 0.6} transparent opacity={active ? 0.9 : 0.5} />
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
function ScrollSyncCamera({ nodes, selectedId, interact, controlsRef, centroid }: { nodes: PathwayNode[]; selectedId: string | null; interact: boolean; controlsRef: React.RefObject<OrbitControlsHandle | null>; centroid: THREE.Vector3 }) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3().copy(centroid));

  useEffect(() => {
    if (selectedId) {
      const node = nodes.find(n => n.id === selectedId);
      if (node && Array.isArray(node.position)) targetLookAt.current.set(...node.position);
    } else {
      // 默认看向计算好的分子质心
      targetLookAt.current.copy(centroid);
    }
  }, [selectedId, nodes, centroid]);

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
const FLUX_PER_EDGE = 60;

function FluxParticles({ edges, nodes, flowSpeed, glowMultiplier }: {
  edges: PathwayEdge[]; nodes: PathwayNode[]; flowSpeed: number; glowMultiplier: number;
}) {
  const edgeVecs = useMemo(() =>
    edges.map(e => {
      const s = nodes.find(n => n.id === e.start);
      const t = nodes.find(n => n.id === e.end);
      if (!s?.position || !t?.position || !Array.isArray(s.position) || !Array.isArray(t.position)) return null;
      return { sv: new THREE.Vector3(...(s.position as [number,number,number])), ev: new THREE.Vector3(...(t.position as [number,number,number])) };
    }).filter((x): x is { sv: THREE.Vector3; ev: THREE.Vector3 } => x !== null),
  [edges, nodes]);

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

// ─── Scene — unified lighting, integrated depth ────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId, roughnessTexture, glowMultiplier, flowSpeed, stressIndex, viewMode }: { nodes:PathwayNode[]; edges:PathwayEdge[]; onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null; roughnessTexture:THREE.Texture | null; glowMultiplier:number; flowSpeed:number; stressIndex:number; viewMode: SceneViewMode; }) {
  const [hovId, setHovId]       = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart = useCallback(() => { setInteract(true); if (timer.current) clearTimeout(timer.current); }, []);
  const onEnd   = useCallback(() => { timer.current = setTimeout(() => setInteract(false), 3500); }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // BoundingBox auto-focus — FOV-based distance so the entire pathway fits the viewport
  const { camera, size: viewportSize } = useThree();
  const aspect = viewportSize.width / (viewportSize.height || 1);
  const cameraFov = (camera as THREE.PerspectiveCamera).fov ?? 44;

  const { centroid, camOffset } = useMemo(() => {
    const box = new THREE.Box3();
    nodes.forEach(n => {
      if (n && Array.isArray(n.position) && n.position.length === 3) {
        box.expandByPoint(new THREE.Vector3(...(n.position as [number,number,number])));
      }
    });
    const center = new THREE.Vector3();
    const sz     = new THREE.Vector3();
    if (!box.isEmpty()) { box.getCenter(center); box.getSize(sz); }
    // Derive actual half-FOV from the camera's vertical FOV and viewport aspect ratio
    const vHalfRad = (cameraFov / 2) * Math.PI / 180;
    const hHalfRad = Math.atan(Math.tan(vHalfRad) * aspect); // horizontal half-FOV from aspect
    const MIN_DISTANCE = 5;
    const VIEWPORT_PADDING = 1.55; // Ensures full pathway network fits viewport without manual zoom-out
    const distForX = (sz.x / 2) / Math.tan(hHalfRad);
    const distForY = (sz.y / 2) / Math.tan(vHalfRad);
    const dist = Math.max(distForX, distForY, MIN_DISTANCE) * VIEWPORT_PADDING + (sz.z / 2);
    return { centroid: center, camOffset: { y: sz.y * 0.08, z: dist } };
  }, [nodes, aspect, cameraFov]);
  useEffect(() => {
    camera.position.set(centroid.x, centroid.y + camOffset.y, centroid.z + camOffset.z);
    camera.lookAt(centroid);
    if (controlsRef.current) {
      controlsRef.current.target.copy(centroid);
      controlsRef.current.update();
    }
  }, [centroid, camOffset, camera]);

  const cc = useMemo(() => {
    const c: Record<string,number> = {};
    nodes.forEach(n => { c[n.id] = 0; });
    edges.forEach(e => { if (c[e.start] !== undefined) c[e.start]++; if (c[e.end] !== undefined) c[e.end]++; });
    return c;
  }, [nodes, edges]);

  const ed = useMemo(() =>
    edges.map(edge => {
      const s = nodes.find(n => n.id === edge.start);
      const e = nodes.find(n => n.id === edge.end);
      if (!s || !e || !Array.isArray(s.position) || !Array.isArray(e.position)) return null;
      return { key:`${edge.start}-${edge.end}`, edge, s, e, active: hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end, color: getColor(s) };
    }).filter(Boolean) as any[],
  [edges, nodes, hovId, selectedNodeId]);

  return (
    <>
      <ambientLight intensity={0.75 * glowMultiplier} color="#FFFFFF" />
      <directionalLight position={[4, 10, 6]}  intensity={0.30 * glowMultiplier} color="#FFFFFF" />
      <directionalLight position={[-8, -2, -6]} intensity={0.08} color="#111111" />
      <pointLight position={[centroid.x, centroid.y + 6, centroid.z]} intensity={0.18 * glowMultiplier} color="#FFFFFF" distance={28} decay={2} />
      <fog attach="fog" args={['#000000', 30, 70]} />

      {/* maxDistance 50 accommodates large AI-generated pathway networks without clipping */}
      <OrbitControls ref={controlsRef as React.Ref<never>} makeDefault enableZoom autoRotate={!interact && !hovId && !selectedNodeId} autoRotateSpeed={0.12} zoomSpeed={0.45} minDistance={6} maxDistance={50} enablePan={false} onStart={onStart} onEnd={onEnd} target={centroid} />
      <SpatialReference stressIndex={stressIndex} centroid={centroid} />

      <AmbientParticles />
      <FluxParticles edges={edges} nodes={nodes} flowSpeed={viewMode === 'flow' ? flowSpeed * 1.25 : flowSpeed} glowMultiplier={glowMultiplier} />
      {ed.map(e => <PathEdge key={e.key} edge={e.edge} s={e.s.position} e={e.e.position} active={e.active} color={e.color} flowSpeed={flowSpeed} viewMode={viewMode} />)}
      {nodes.map(n => <MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId} roughnessTexture={roughnessTexture} flowSpeed={flowSpeed} glowMultiplier={glowMultiplier} stressIndex={stressIndex} viewMode={viewMode} />)}

      <ScrollSyncCamera nodes={nodes} selectedId={selectedNodeId} interact={interact} controlsRef={controlsRef} centroid={centroid} />
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
interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; glowMultiplier?:number; flowSpeed?:number; fullscreen?:boolean; stressIndex?:number; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId, glowMultiplier = 1, flowSpeed = 1, fullscreen = false, stressIndex = 0 }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [rendererMode, setRendererMode] = useState<RendererMode>('loading');
  const [viewMode, setViewMode] = useState<SceneViewMode>('network');
  const mountedRef = useRef(true);
  const roughnessTexture = useMemo(() => createProceduralTexture(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes.filter(isRenderableNode) : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);
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

  // Compute initial camera position from node bounding box so Canvas starts centered on the cluster
  const initialCamPos = useMemo(() => {
    const box = new THREE.Box3();
    safeNodes.forEach(n => {
      if (Array.isArray(n.position) && n.position.length === 3)
        box.expandByPoint(new THREE.Vector3(...(n.position as [number, number, number])));
    });
    if (box.isEmpty()) return { position: [0, 0.3, 12] as [number, number, number], fov: 44 };
    const center = new THREE.Vector3();
    const sz = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(sz);
    const vHalfRad = (44 / 2) * Math.PI / 180;
    const dist = Math.max(sz.x / 2 / Math.tan(vHalfRad), sz.y / 2 / Math.tan(vHalfRad), 5) * 1.55 + sz.z / 2;
    return { position: [center.x, center.y + sz.y * 0.08, center.z + dist] as [number, number, number], fov: 44 };
  }, [safeNodes]);

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
                  style={{
                    pointerEvents: 'auto',
                    minHeight: '24px',
                    padding: '0 9px',
                    borderRadius: '999px',
                    border: 'none',
                    background: viewMode === mode.key ? mode.active : 'transparent',
                    color: viewMode === mode.key ? '#000000' : 'rgba(255,255,255,0.45)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
          {fallbackLabel && (
            <span style={{ ...getRendererTone(rendererMode), fontSize:'9px', fontFamily:"'Public Sans',sans-serif", padding:'2px 8px', borderRadius:'99px', letterSpacing:'0.04em', fontWeight:700 }}>
              {fallbackLabel}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.10)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif" }}>drag · scroll · click</span>
        </div>
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:'13px', left:'13px', zIndex:10 }}>
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
          top: fullscreen ? '14px' : '56px',
          left: '13px',
          zIndex: 10,
          width: 'min(320px, calc(100% - 26px))',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.58)',
          padding: '12px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.22)', fontSize: '8px', fontFamily: "'Public Sans',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {modeTrace.label}
        </p>
        <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.78)', fontSize: '11px', lineHeight: 1.55, fontFamily: "'Public Sans',sans-serif" }}>
          {modeTrace.summary}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ minHeight: '24px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
            {selectedNode ? `${selectedNode.label}` : 'No node selected'}
          </span>
          <span style={{ minHeight: '24px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
            {modeTrace.metric}
          </span>
          {selectedNode?.citation && (
            <span style={{ minHeight: '24px', padding: '0 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
              {selectedNode.citation}
            </span>
          )}
        </div>
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:'13px', right:'13px', zIndex:10, background:'rgba(0,0,0,0.5)', padding:'8px 12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)' }}>
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

      <SceneErrorBoundary onError={(e) => setStatus('error')}>
        <Canvas
          camera={initialCamPos}
          gl={async (props) => {
            const canvas = props.canvas as HTMLCanvasElement;
            const parent = canvas.parentElement;
            const width = parent?.clientWidth ?? canvas.width;
            const height = parent?.clientHeight ?? canvas.height;

            const applyRendererDefaults = <Renderer extends ConfigurableRenderer>(renderer: Renderer) => {
              renderer.setSize(width, height, false);
              renderer.toneMapping = THREE.LinearToneMapping;
              renderer.toneMappingExposure = 1.0;
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
            throw new Error('WebGL unavailable');
          }}
          dpr={[1, 1.5]} performance={{ min: 0.5 }} style={{ background: 'transparent', pointerEvents: 'auto' }}
        >
          <ResizeHandler />
          <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} roughnessTexture={roughnessTexture} glowMultiplier={glowMultiplier} flowSpeed={flowSpeed} stressIndex={stressIndex} viewMode={viewMode} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
