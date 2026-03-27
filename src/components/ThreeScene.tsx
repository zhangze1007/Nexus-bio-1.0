'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

type Vec3 = [number, number, number];
type RendererMode = 'loading' | 'webgpu' | 'webgl2' | 'webgl' | 'error';
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
    case 'webgl2': return 'WEBGL2 FALLBACK';
    case 'webgl': return 'WEBGL FALLBACK';
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

// ─── Pastels & Scientific colors ────────────────────────────────────────
const PastelColors = ['#C8D8E8','#C8E0D0','#DDD0E8','#E8DCC8','#C8DCDC','#DCE8C8','#E8C8D4','#CCE0D8'];
const SHOWCASE_N_CONF: Record<string,number> = { acetyl_coa:85,hmg_coa:72,mevalonate:68,fpp:91,amorpha_4_11_diene:88,artemisinic_acid:76,artemisinin:93 };

function conf2pastel(p: number): string {
  if (p >= 90) return '#C8D8E8'; // Blue
  if (p >= 70) return '#C8E0D0'; // Green
  if (p >= 50) return '#E8DCC8'; // Yellow
  return '#E8C8D4'; // Red
}

function getColor(node: PathwayNode): string {
  // --- 功能修复：恢复杂质/高产标签颜色逻辑 ---
  if (node.color_mapping === 'Red') return '#dc3545'; // Impurity / High Cost (Red)
  if (node.color_mapping === 'Green') return '#28a745'; // Verified High-Yield (Green)

  // Fallback to confidence scores for PubChem conformers or showcase nodes
  const c = SHOWCASE_N_CONF[node.id];
  return c !== undefined ? conf2pastel(c) : (node.color || PastelColors[hash(node.id) % PastelColors.length]);
}

function getConfidenceValue(node: PathwayNode): number {
  if (node.confidenceScore !== undefined) return node.confidenceScore;
  const c = SHOWCASE_N_CONF[node.id];
  return c !== undefined ? c / 100 : 0.75; // Default for missing data
}

// ─── Geometry Components — deterministic shape distribution ────────────
type GCfg = { geom:'oct'|'dodec'|'tetra'|'icos'|'sph'|'tor'; scale:number; rings:number; rr:number[]; rt:number[]; sats:number; sr:number; ss:number; spin:number; inner:boolean; };
function glyphCfg(id: string, cc: number): GCfg {
  const geoms = ['oct','dodec','tetra','icos','sph'] as GCfg['geom'][]; // Torus is too heavy
  const rc = hashInt(id,1,1,2);
  return { geom: geoms[hashInt(id,0,0,4)], scale: 0.22+cc*0.04+hashFloat(id,2,0,0.04), rings: rc, rr: Array.from({length:rc},(_,i)=>hashFloat(id,10+i,0.5,0.8)), rt: Array.from({length:rc},(_,i)=>hashFloat(id,20+i,0,Math.PI)), sats: hashInt(id,3,2,4), sr: hashFloat(id,4,0.6,0.9), ss: hashFloat(id,5,0.035,0.055), spin: hashFloat(id,6,0.04,0.10), inner: hash(id)%3===0 };
}

function GeoComp({ g, s }: { g: GCfg['geom']; s: number }) {
  switch(g) {
    case 'oct':   return <octahedronGeometry args={[s, 0]} />;
    case 'dodec': return <dodecahedronGeometry args={[s, 0]} />;
    case 'tetra': return <tetrahedronGeometry args={[s, 0]} />;
    case 'icos':  return <icosahedronGeometry args={[s, 1]} />;
    default:      return <sphereGeometry args={[s, 24, 24]} />;
  }
}

// ─── Spatial Grid — darker theme requested ─────────────────────────────
function SpatialReference() {
  return (
    <group position={[0, -3.8, 0]}>
      {/* 保持你原本的黑白灰网格颜色 */}
      <gridHelper args={[36, 36, '#606060', '#404040']} /> 
      <Line points={[new THREE.Vector3(-10,0,0), new THREE.Vector3(10,0,0)]} color="#aaaaaa" lineWidth={0.5} transparent opacity={0.35} /> 
      <Line points={[new THREE.Vector3(0,0,-10), new THREE.Vector3(0,0,10)]} color="#aaaaaa" lineWidth={0.5} transparent opacity={0.35} /> 
    </group>
  );
}

// ─── Molecular Node with texture and correct commercial coloring ──────
const MolNode = React.memo(function MolNode({ node, hov, sel, cc, onClick, onHov, roughnessTexture }: {
  node: PathwayNode; hov: boolean; sel: boolean; cc: number;
  onClick: (n: PathwayNode) => void; onHov: (id: string | null) => void;
  roughnessTexture: THREE.Texture | null;
}) {
  const grp     = useRef<THREE.Group>(null);
  const ring    = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const ready   = true;

  const conf   = getConfidenceValue(node);
  const finalColor = getColor(node);
  const lbl    = node.canonicalLabel?.trim() || node.label || node.id;
  const cfg    = useMemo(() => glyphCfg(node.id, cc), [node.id, cc]);
  const tgt    = sel ? 1.28 : hov ? 1.10 : 1.0;
  const colVec = useMemo(() => new THREE.Color(finalColor), [finalColor]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const cs = grp.current.scale.x;
      grp.current.scale.setScalar(cs + ((ready ? tgt : 0.001) - cs) * dt * 5);
      // Organic breathing
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 + hash(node.id) * 0.01) * 0.06;
      grp.current.rotation.y = Math.sin(t * 0.06 + hash(node.id) * 0.001) * 0.05;
      grp.current.rotation.z = t * cfg.spin * 0.5; // Spinning different geoms
    }
    if (ring.current) {
      ring.current.rotation.z += dt * 0.10;
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
        <GeoComp g={cfg.geom} s={0.32 + cc * 0.05} />
        {/* 保持你的噪点不光滑质感 */}
        <meshPhysicalMaterial
          color={finalColor}
          emissive={finalColor}
          emissiveIntensity={0.03}
          roughnessMap={roughnessTexture} 
          roughness={0.8} 
          metalness={0.03}
          transmission={0.1}
          depthWrite={true} 
        />
      </mesh>

      {/* 【关键修复】: 隐形 Hitbox 触摸判定区，彻底解决点不到分子的 bug */}
      <mesh visible={false}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
      </mesh>

      {cfg.rr.map((r, i) => (
        <mesh key={`r${i}`} ref={i === 0 ? ring : undefined} rotation={[cfg.rt[i] || 0, 0, i * 1.1]}>
          <torusGeometry args={[r, 0.007, 4, 40]} />
          <meshPhysicalMaterial color={finalColor} emissive={finalColor} emissiveIntensity={0.08} transparent opacity={0.07} roughness={0.6} metalness={0} depthWrite={false} />
        </mesh>
      ))}

      {/* 【关键修复】: 固定偏移量，让分子名字死死贴在正下方 */}
      <Html position={[0, -0.65, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          color: hov || sel ? '#fff' : 'rgba(160,180,200,0.55)',
          fontSize: '10px', fontWeight: sel ? 600 : 400,
          fontFamily: "'Public Sans', sans-serif", letterSpacing: '0.02em',
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
const PathEdge = React.memo(function PathEdge({ edge, s, e, active, color }: { edge:PathwayEdge; s:Vec3; e:Vec3; active:boolean; color:string }) {
  const dot  = useRef<THREE.Mesh>(null);
  const prog = useRef(Math.random());
  const sv   = useMemo(() => new THREE.Vector3(...s), [s]);
  const ev   = useMemo(() => new THREE.Vector3(...e), [e]);
  const mid  = useMemo(() => sv.clone().lerp(ev, 0.5), [sv, ev]);

  const thickness = useMemo(() => {
    const map: Record<string, number> = { "Thick": 1.5, "Medium": 0.8, "Thin": 0.25 };
    return map[edge.thickness_mapping || "Medium"] || 0.25;
  }, [edge.thickness_mapping]);

  const thickness = useMemo(() => {
    const map: Record<string, number> = { "Thick": 1.5, "Medium": 0.8, "Thin": 0.25 };
    return map[edge.thickness_mapping || "Medium"] || 0.25;
  }, [edge.thickness_mapping]);

  useFrame((_, dt) => {
    prog.current = (prog.current + dt * 0.18) % 1;
    if (dot.current) {

      dot.current.visible = active;
    }
  });

  return (
    <group>
      {/* 【关键修复】: 暗灰背景下使用略亮的连线颜色 #556677 防止隐身 */}

      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.04, 5, 5]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.8} />
      </mesh>
      {active && edge.predicted_delta_G_kJ_mol && (
        <Html position={mid.toArray() as Vec3}>
          <div style={{ background: 'rgba(6,9,16,0.9)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
            ΔG: {edge.predicted_delta_G_kJ_mol}
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

// ─── Scene — unified lighting, integrated depth ────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId, roughnessTexture }: { nodes:PathwayNode[]; edges:PathwayEdge[]; onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null; roughnessTexture:THREE.Texture | null; }) {
  const [hovId, setHovId]       = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart = useCallback(() => { setInteract(true); if (timer.current) clearTimeout(timer.current); }, []);
  const onEnd   = useCallback(() => { timer.current = setTimeout(() => setInteract(false), 3500); }, []);
  
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // 【关键修复】: 动态计算网络图几何中心 (Centroid)
  const centroid = useMemo(() => {
    const center = new THREE.Vector3();
    let count = 0;
    nodes.forEach(n => {
      if (n && Array.isArray(n.position) && n.position.length === 3) {
        center.add(new THREE.Vector3(...n.position));
        count++;
      }
    });
    if (count > 0) center.divideScalar(count);
    return center;
  }, [nodes]);

  const { camera } = useThree();
  useEffect(() => {
    // 渲染的第一秒直接把镜头架在中心点前
    camera.position.set(centroid.x, centroid.y + 6, centroid.z + 18);
    camera.lookAt(centroid);
    if (controlsRef.current) {
      controlsRef.current.target.copy(centroid);
      controlsRef.current.update();
    }
  }, [centroid, camera]);

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
      <ambientLight intensity={0.85} color="#d0dcec" />
      <directionalLight position={[4, 10, 6]}  intensity={0.35} color="#e8f0f8" />
      <directionalLight position={[-8, -2, -6]} intensity={0.12} color="#1a2840" />
      <pointLight position={[centroid.x, centroid.y + 6, centroid.z]} intensity={0.20} color="#c0d0e8" distance={28} decay={2} />
      <fog attach="fog" args={['#101010', 20, 48]} />

      {/* 【关键修复】: 添加 makeDefault 和 target 保证触控生效且中心不偏 */}
      <OrbitControls ref={controlsRef as React.Ref<never>} makeDefault enableZoom autoRotate={!interact && !hovId && !selectedNodeId} autoRotateSpeed={0.12} zoomSpeed={0.45} minDistance={6} maxDistance={24} enablePan={false} onStart={onStart} onEnd={onEnd} target={centroid} />
      <SpatialReference />

      {ed.map(e => <PathEdge key={e.key} edge={e.edge} s={e.s.position} e={e.e.position} active={e.active} color={e.color} />)}
      {nodes.map(n => <MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId} roughnessTexture={roughnessTexture} />)}

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
interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [rendererMode, setRendererMode] = useState<RendererMode>('loading');
  const mountedRef = useRef(true);
  const roughnessTexture = useMemo(() => createProceduralTexture(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes.filter(isRenderableNode) : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);
  const fallbackLabel = getRendererLabel(rendererMode);

  return (
    <div style={{
      width: '100%', 
      height: 'clamp(500px, 65vh, 760px)', 
      background: 'linear-gradient(180deg, #101010 0%, #0c0e18 100%)', 
      borderRadius: '20px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)', position: 'relative',
      boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* 【关键修复】: 所有的绝对定位UI容器加上 pointerEvents:'none' 防止吞掉鼠标点击 */}
      <div style={{ pointerEvents: 'none', position:'absolute', top:0, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', background:'linear-gradient(to bottom, rgba(16,16,16,0.92), transparent)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            {['#C8D8E8','#C8E0D0','#DDD0E8'].map(c => (
              <div key={c} style={{ width:'4px', height:'4px', borderRadius:'50%', background:c, opacity:0.35 }} />
            ))}
          </div>
          <span style={{ color:'rgba(255,255,255,0.20)', fontSize:'10px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            METABOLIC · {safeNodes.length} ENTITIES
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {fallbackLabel && (
            <span style={{ ...getRendererTone(rendererMode), fontSize:'9px', fontFamily:"'Public Sans',sans-serif", padding:'2px 8px', borderRadius:'99px', letterSpacing:'0.04em', fontWeight:700 }}>
              {fallbackLabel}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.10)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif" }}>drag · scroll · click</span>
        </div>
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:'13px', left:'13px', zIndex:10 }}>
        <p style={{ color:'rgba(255,255,255,0.12)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, margin:'0 0 4px', letterSpacing:'0.07em', textTransform:'uppercase' }}>CONFIDENCE</p>
        {[{ c:'#C8D8E8',l:'>90' },{ c:'#C8E0D0',l:'70–90' },{ c:'#E8DCC8',l:'50–70' },{ c:'#E8C8D4',l:'<50' }].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'2px' }}>
            <div style={{ width:'12px', height:'2px', background:x.c, borderRadius:'1px', opacity:0.65 }} />
            <span style={{ color:'rgba(255,255,255,0.14)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontFeatureSettings:"'tnum' 1" }}>{x.l}</span>
          </div>
        ))}
      </div>

      <div style={{ pointerEvents: 'none', position:'absolute', bottom:'13px', right:'13px', zIndex:10, background:'rgba(0,0,0,0.4)', padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
          <div style={{ width:'8px', height:'8px', background:'#dc3545', borderRadius:'2px' }} />
          <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif" }}>Impurity / High Cost</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <div style={{ width:'8px', height:'8px', background:'#28a745', borderRadius:'2px' }} />
          <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif" }}>Verified High-Yield</span>
        </div>
      </div>

      <SceneErrorBoundary onError={(e) => setStatus('error')}>
        <Canvas
          camera={{ position: [0, 5, 15], fov: 44 }}
          gl={async (props) => {
            const canvas = props.canvas as HTMLCanvasElement;
            const parent = canvas.parentElement;
            const width = parent?.clientWidth ?? canvas.width;
            const height = parent?.clientHeight ?? canvas.height;

            const applyRendererDefaults = <Renderer extends ConfigurableRenderer>(renderer: Renderer) => {
              renderer.setSize(width, height, false);
              renderer.toneMapping = THREE.LinearToneMapping;
              renderer.toneMappingExposure = 1.0;
              renderer.setClearColor(new THREE.Color('#101010'), 1); 
              return renderer;
            };

            const webgl2 = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: false });
            if (webgl2) {
              setRendererMode('webgl2'); setStatus('ready');
              return applyRendererDefaults(new THREE.WebGLRenderer({ canvas, context: webgl2, antialias: true, powerPreference: 'high-performance', alpha: false }));
            }

            const webgl = canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance', alpha: false });
            if (webgl) {
              setRendererMode('webgl'); setStatus('ready');
              return applyRendererDefaults(new THREE.WebGLRenderer({ canvas, context: webgl, antialias: true, powerPreference: 'high-performance', alpha: false }));
            }
            throw new Error('WebGL unavailable');
          }}
          dpr={[1, 1.5]} performance={{ min: 0.5 }} style={{ background: 'transparent', pointerEvents: 'auto' }}
        >
          <ResizeHandler />
          <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} roughnessTexture={roughnessTexture} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
