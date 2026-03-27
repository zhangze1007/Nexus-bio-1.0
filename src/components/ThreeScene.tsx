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

// ─── Utility & Math ──────────────────────────────────────────────────
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

function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isVec3(value: unknown): value is Vec3 { return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber); }
function isRenderableNode(node: PathwayNode | null | undefined): node is PathwayNode {
  return !!node && typeof node.id === 'string' && node.id.length > 0 && isVec3(node.position);
}

// ─── UI Fallback Labels ──────────────────────────────────────────────
function getRendererLabel(mode: RendererMode): string | null {
  switch (mode) {
    case 'loading': return 'INITIALIZING';
    case 'webgl2': return 'WEBGL2 ACTIVE';
    case 'webgl': return 'WEBGL FALLBACK';
    case 'error': return 'RENDERER ERROR';
    default: return null;
  }
}
function getRendererTone(mode: RendererMode): React.CSSProperties {
  if (mode === 'error') return { color: '#ff7875', border: '1px solid rgba(255,120,120,0.3)', background: 'rgba(48,12,16,0.6)' };
  if (mode === 'loading') return { color: 'rgba(232,240,248,0.8)', border: '1px solid rgba(200,216,232,0.2)', background: 'rgba(9,12,18,0.6)' };
  return { color: 'rgba(200,216,232,0.8)', border: '1px solid rgba(200,216,232,0.2)', background: 'rgba(9,12,18,0.6)' };
}

class SceneErrorBoundary extends React.Component<{ onError: (error: Error) => void; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ─── 纹理生成：保留你的微磨砂有机质感 ──────────────────────────────────
const createProceduralTexture = () => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = (128 + Math.random() * 80) | 0;
    imageData.data[i] = v; imageData.data[i+1] = v; imageData.data[i+2] = v; imageData.data[i+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
};

// ─── 核心逻辑：数据驱动的杂质与颜色预警 ────────────────────────────────
const PastelColors = ['#C8D8E8','#C8E0D0','#DDD0E8','#E8DCC8','#C8DCDC','#DCE8C8','#E8C8D4','#CCE0D8'];
const SHOWCASE_N_CONF: Record<string,number> = { acetyl_coa:85,hmg_coa:72,mevalonate:68,fpp:91,amorpha_4_11_diene:88,artemisinic_acid:76,artemisinin:93 };

function getComplianceIntel(node: PathwayNode) {
  const isImpurity = node.nodeType?.toLowerCase().includes('impurity') || node.color_mapping === 'Red';
  const riskScore = node.risk_score ?? 0;
  const isHighlyUnstable = node.thermodynamic_stability?.toLowerCase().includes('low');
  const isHighAlert = isImpurity || riskScore > 0.7 || isHighlyUnstable;

  let finalColor = node.color || PastelColors[hash(node.id) % PastelColors.length];
  if (isHighAlert) finalColor = '#ff4d4f'; // 杂质红色
  else if (node.color_mapping === 'Green') finalColor = '#28a745'; // 高产绿色
  else if (SHOWCASE_N_CONF[node.id] !== undefined) {
    const p = SHOWCASE_N_CONF[node.id];
    finalColor = p >= 90 ? '#C8D8E8' : p >= 70 ? '#C8E0D0' : p >= 50 ? '#E8DCC8' : '#E8C8D4';
  }

  const conf = node.confidenceScore !== undefined ? node.confidenceScore : (SHOWCASE_N_CONF[node.id] ? SHOWCASE_N_CONF[node.id] / 100 : 0.75);

  return {
    isHighAlert,
    statusText: isHighAlert ? "HIGH SEPARATION COST & TOXICITY RISK" : "VALIDATED PATHWAY NODE",
    complianceTag: isHighAlert ? "⚠️ IMPURITY DETECTED" : "✓ VERIFIED YIELD",
    finalColor,
    conf
  };
}

// ─── 场景网格：保留高级暗灰色系 ────────────────────────────────────────
function SpatialReference() {
  return (
    <group position={[0, -3.8, 0]}>
      <gridHelper args={[36, 36, '#404550', '#252a30']} /> 
      <Line points={[new THREE.Vector3(-10,0,0), new THREE.Vector3(10,0,0)]} color="#808a95" lineWidth={0.5} transparent opacity={0.25} /> 
      <Line points={[new THREE.Vector3(0,0,-10), new THREE.Vector3(0,0,10)]} color="#808a95" lineWidth={0.5} transparent opacity={0.25} /> 
    </group>
  );
}

// ─── 分子节点：修复点击失效、名字分离 ──────────────────────────────────
const MolNode = React.memo(function MolNode({ node, hov, sel, onClick, onHov, roughnessTexture }: {
  node: PathwayNode; hov: boolean; sel: boolean; cc: number;
  onClick: (n: PathwayNode) => void; onHov: (id: string | null) => void;
  roughnessTexture: THREE.Texture | null;
}) {
  const grp = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bodyRef = useRef<THREE.Mesh>(null);

  const { isHighAlert, finalColor, statusText, complianceTag, conf } = useMemo(() => getComplianceIntel(node), [node]);
  const lbl = node.canonicalLabel?.trim() || node.label || node.id;
  const colVec = useMemo(() => new THREE.Color(finalColor), [finalColor]);

  const ringsCount = useMemo(() => hashInt(node.id, 1, 1, 2), [node.id]);
  const ringRadii = useMemo(() => Array.from({length: ringsCount}, (_, i) => hashFloat(node.id, 10+i, 0.5, 0.8)), [node.id, ringsCount]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const targetScale = sel ? 1.25 : hov ? 1.15 : 1.0;
      grp.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 6);
      
      if (isHighAlert) grp.current.scale.multiplyScalar(1 + Math.sin(t * 6) * 0.03); // 杂质脉冲警告

      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 + hash(node.id) * 0.01) * 0.06;
      grp.current.rotation.y = Math.sin(t * 0.06 + hash(node.id) * 0.001) * 0.05;
    }
    
    ringRefs.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.z += dt * (0.10 + i * 0.05);
        const mat = ring.material as THREE.MeshPhysicalMaterial;
        const targetOpacity = hov || sel ? 0.35 : (isHighAlert ? 0.25 : 0.08);
        mat.opacity += (targetOpacity - mat.opacity) * dt * 3;
      }
    });

    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshPhysicalMaterial;
      const targetEmissive = sel ? 0.45 : hov ? 0.25 : (isHighAlert ? 0.3 : 0.05);
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * dt * 6;
    }
  });

  return (
    <group
      ref={grp} position={node.position}
      onClick={e => { e.stopPropagation(); onClick(node); }}
      onPointerOver={e => { e.stopPropagation(); onHov(node.id); document.body.style.cursor = 'pointer'; }}
      onPointerOut={e => { e.stopPropagation(); onHov(null); document.body.style.cursor = 'auto'; }}
    >
      {/* 视觉主体：微磨砂分子球 */}
      <mesh ref={bodyRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshPhysicalMaterial
          color={finalColor} emissive={finalColor} emissiveIntensity={0.05}
          roughnessMap={roughnessTexture} roughness={0.7} 
          clearcoat={0.3} clearcoatRoughness={0.4}
          metalness={0.1} transmission={isHighAlert ? 0 : 0.2} thickness={0.5}
        />
      </mesh>

      {/* 核心修复：隐形的大号 Hitbox，保证平板触控100%命中 */}
      <mesh>
        <sphereGeometry args={[0.75, 16, 16]} />
        <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 动态星轨 */}
      {ringRadii.map((r, i) => (
        <mesh key={`r${i}`} ref={el => { ringRefs.current[i] = el; }} rotation={[Math.PI / 4, 0, i * Math.PI / 2]}>
          <torusGeometry args={[r, 0.006, 6, 50]} />
          <meshPhysicalMaterial color={finalColor} emissive={finalColor} emissiveIntensity={0.2} transparent opacity={0.08} roughness={0.6} depthWrite={false} />
        </mesh>
      ))}

      {/* 核心修复：固定的绝对距离，保证标签与分子紧贴 */}
      <Html position={[0, -0.65, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          color: hov || sel ? '#ffffff' : 'rgba(210,220,230,0.65)',
          fontSize: '11px', fontWeight: sel ? 700 : 500,
          fontFamily: "'Public Sans', sans-serif", letterSpacing: '0.03em',
          textShadow: '0 2px 10px rgba(0,0,0,0.95)', transition: 'all 0.2s',
        }}>{lbl}</div>
      </Html>

      {/* 商业悬浮窗 */}
      {hov && !sel && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: isHighAlert ? 'rgba(35,10,12,0.96)' : 'rgba(10,14,22,0.96)', border: `1px solid ${isHighAlert ? '#ff4d4f' : 'rgba(200,216,232,0.15)'}`,
            borderRadius: '16px', padding: '12px 16px', width: '220px',
            backdropFilter: 'blur(24px)', transform: 'translateY(-110%)', fontFamily: "'Public Sans', sans-serif",
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: isHighAlert ? '#ff4d4f' : '#c8d8e4', fontSize: '13px', fontWeight: 700 }}>{lbl}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFeatureSettings: "'tnum' 1" }}>{Math.round(conf*100)}%</span>
            </div>
            
            {isHighAlert && (
              <div style={{ color: '#ff7875', fontSize: '9px', fontWeight: 800, marginBottom: '8px', padding: '5px', background: 'rgba(255,77,79,0.15)', borderRadius: '4px', border: '1px solid rgba(255,77,79,0.2)' }}>
                {complianceTag}
              </div>
            )}

            {node.nodeType && node.nodeType !== 'unknown' && (
              <span style={{ color: 'rgba(200,216,232,0.5)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px', fontWeight: 700 }}>{node.nodeType}</span>
            )}
            <p style={{ color: 'rgba(190,205,220,0.5)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 8px' }}>{node.summary?.slice(0, 80)}...</p>
            
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', marginBottom: '8px' }}>
              <div style={{ width: `${Math.round(conf*100)}%`, height: '100%', background: colVec.getStyle(), borderRadius: '1px', opacity: 0.9 }} />
            </div>

            {node.audit_trail && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.25)' }}>Source: </span> {node.audit_trail}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── 连线组件 ──────────────────────────────────────────────────────────
const PathEdge = React.memo(function PathEdge({ edge, s, e, active, color }: { edge:PathwayEdge; s:Vec3; e:Vec3; active:boolean; color:string }) {
  const sv   = useMemo(() => new THREE.Vector3(...s), [s]);
  const ev   = useMemo(() => new THREE.Vector3(...e), [e]);
  const mid  = useMemo(() => sv.clone().lerp(ev, 0.5).add(new THREE.Vector3(0, 0.4, 0)), [sv, ev]);
  const thickness = useMemo(() => {
    const map: Record<string, number> = { "Thick": 1.8, "Medium": 1.0, "Thin": 0.4 };
    return map[edge.thickness_mapping || "Medium"] || 0.4;
  }, [edge.thickness_mapping]);

  return (
    <group>
      <Line 
        points={[sv, mid, ev]} 
        color={active ? color : '#556677'} // 确保暗灰背景下连线清晰可见
        lineWidth={active ? thickness * 1.5 : thickness} 
        transparent opacity={active ? 0.8 : 0.25} 
      />
      {active && edge.predicted_delta_G_kJ_mol && (
        <Html position={mid.toArray() as Vec3}>
          <div style={{ background: 'rgba(10,14,22,0.9)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            ΔG: {edge.predicted_delta_G_kJ_mol} kJ/mol
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── 核心修复：镜头居中同步控制 ──────────────────────────────────────────
type OrbitControlsHandle = { target: THREE.Vector3; update(): void };
function ScrollSyncCamera({ nodes, selectedId, interact, controlsRef, centroid }: { nodes: PathwayNode[]; selectedId: string | null; interact: boolean; controlsRef: React.RefObject<OrbitControlsHandle | null>; centroid: THREE.Vector3; }) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (selectedId) {
      const node = nodes.find(n => n.id === selectedId);
      if (node && Array.isArray(node.position)) targetLookAt.current.set(...node.position);
    } else {
      // 核心修复：未选中时，看向计算出的分子中心点，而不是跑偏的[0,0,0]
      targetLookAt.current.copy(centroid);
    }
  }, [selectedId, nodes, centroid]);

  useFrame((_, dt) => {
    if (interact || !(camera instanceof THREE.PerspectiveCamera)) return;
    const alpha = 1 - Math.exp(-dt * 3.0);
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

// ─── Scene & Lighting ──────────────────────────────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId, roughnessTexture }: { nodes:PathwayNode[]; edges:PathwayEdge[]; onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null; roughnessTexture:THREE.Texture | null; }) {
  const [hovId, setHovId]       = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  
  const onStart = useCallback(() => { setInteract(true); if (timer.current) clearTimeout(timer.current); }, []);
  const onEnd   = useCallback(() => { timer.current = setTimeout(() => setInteract(false), 3500); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // 核心修复：计算所有分子的绝对中心坐标
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
    // 初始化时直接将镜头对准中心
    camera.position.set(centroid.x, centroid.y + 6, centroid.z + 18);
    camera.lookAt(centroid);
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
      return { key:`${edge.start}-${edge.end}`, edge, s, e, active: hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end, color: getComplianceIntel(s).finalColor };
    }).filter(Boolean) as any[],
  [edges, nodes, hovId, selectedNodeId]);

  return (
    <>
      <ambientLight intensity={0.9} color="#d0dcec" />
      <directionalLight position={[4, 10, 6]}  intensity={0.4} color="#e8f0f8" />
      <directionalLight position={[-8, -2, -6]} intensity={0.15} color="#2a3850" />
      <pointLight position={[centroid.x, centroid.y + 6, centroid.z]} intensity={0.25} color="#c0d0e8" distance={30} decay={2} />
      <fog attach="fog" args={['#101216', 15, 45]} />

      {/* 核心修复：添加 makeDefault，彻底解决触控被吃掉的问题 */}
      <OrbitControls ref={controlsRef as React.Ref<never>} makeDefault enableZoom autoRotate={!interact && !hovId && !selectedNodeId} autoRotateSpeed={0.15} zoomSpeed={0.5} minDistance={5} maxDistance={30} enablePan={true} onStart={onStart} onEnd={onEnd} target={centroid} />
      
      <SpatialReference />

      {ed.map(e => <PathEdge key={e.key} edge={e.edge} s={e.s.position} e={e.e.position} active={e.active} color={e.color} />)}
      {nodes.map(n => <MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId} roughnessTexture={roughnessTexture} />)}

      <ScrollSyncCamera nodes={nodes} selectedId={selectedNodeId} interact={interact} controlsRef={controlsRef} centroid={centroid} />
    </>
  );
}

// ─── Resize Handler ────────────────────────────────────────────────────
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

// ─── Main Component ────────────────────────────────────────────────────
interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [rendererMode, setRendererMode] = useState<RendererMode>('loading');
  const mountedRef = useRef(true);
  const roughnessTexture = useMemo(() => createProceduralTexture(), []);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes.filter(isRenderableNode) : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);
  const fallbackLabel = getRendererLabel(rendererMode);

  return (
    <div style={{
      width: '100%', height: 'clamp(500px, 65vh, 760px)', 
      background: 'linear-gradient(180deg, #101216 0%, #0a0b10 100%)', 
      borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative',
      boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', background:'linear-gradient(to bottom, rgba(16,18,22,0.95), transparent)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ display:'flex', gap:'5px' }}>
            {['#C8D8E8','#C8E0D0','#DDD0E8'].map(c => (
              <div key={c} style={{ width:'5px', height:'5px', borderRadius:'50%', background:c, opacity:0.4 }} />
            ))}
          </div>
          <span style={{ color:'rgba(255,255,255,0.25)', fontSize:'10px', fontFamily:"'Public Sans',sans-serif", fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            METABOLIC · {safeNodes.length} ENTITIES
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {fallbackLabel && (
            <span style={{ ...getRendererTone(rendererMode), fontSize:'9px', fontFamily:"'Public Sans',sans-serif", padding:'3px 10px', borderRadius:'99px', letterSpacing:'0.05em', fontWeight:800 }}>
              {fallbackLabel}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.15)', fontSize:'10px', fontFamily:"'Public Sans',sans-serif", fontWeight: 500 }}>drag · scroll · click</span>
        </div>
      </div>

      <div style={{ position:'absolute', bottom:'16px', left:'16px', zIndex:10 }}>
        <p style={{ color:'rgba(255,255,255,0.15)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif", fontWeight:800, margin:'0 0 6px', letterSpacing:'0.08em', textTransform:'uppercase' }}>CONFIDENCE</p>
        {[{ c:'#C8D8E8',l:'>90' },{ c:'#C8E0D0',l:'70–90' },{ c:'#E8DCC8',l:'50–70' },{ c:'#E8C8D4',l:'<50' }].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
            <div style={{ width:'14px', height:'3px', background:x.c, borderRadius:'2px', opacity:0.7 }} />
            <span style={{ color:'rgba(255,255,255,0.2)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif", fontFeatureSettings:"'tnum' 1", fontWeight: 600 }}>{x.l}</span>
          </div>
        ))}
      </div>

      <div style={{ position:'absolute', bottom:'16px', right:'16px', zIndex:10, background:'rgba(10,12,16,0.6)', padding:'8px 12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
          <div style={{ width:'10px', height:'10px', background:'#ff4d4f', borderRadius:'3px', boxShadow: '0 0 8px rgba(255,77,79,0.4)' }} />
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif", fontWeight: 600 }}>Impurity / High Cost</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'10px', height:'10px', background:'#28a745', borderRadius:'3px', boxShadow: '0 0 8px rgba(40,167,69,0.4)' }} />
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif", fontWeight: 600 }}>Verified High-Yield</span>
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
              renderer.setClearColor(new THREE.Color('#101216'), 1); 
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
          dpr={[1, 1.5]} performance={{ min: 0.5 }} style={{ background: 'transparent' }}
        >
          <ResizeHandler />
          <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} roughnessTexture={roughnessTexture} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
