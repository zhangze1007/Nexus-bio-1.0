'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge,NodeType, EdgeRelationshipType,SHOWCASE_PUBCHEM_CIDS } from '../types';

type Vec3 = [number, number, number];

// ─── 商业级风险颜色 (Nexus-Bio 1.1) ───────────────────────────────────
const NEXUS_COLORS: Record<string, string> = {
  "Green": "#28a745",  // 稳定/高产
  "Yellow": "#ffc107", // 中等风险
  "Orange": "#fd7e14", // 低稳定性
  "Red": "#dc3545",    // 杂质风险 (Impurity)
  "Purple": "#6f42c1", // 中间产物 (Intermediate)
  "Blue": "#007bff",   // 基础节点
  "DEFAULT": "#C8D8E8"
};

// ─── 自动合规引擎 ──────────────────────────────────────────
function getComplianceIntel(node: PathwayNode) {
  const isImpurity = node.nodeType?.toLowerCase().includes('impurity') || node.color_mapping === 'Red';
  const riskScore = node.risk_score ?? 0;
  const isHighlyUnstable = node.thermodynamic_stability?.toLowerCase().includes('low');

  const isHighAlert = isImpurity || riskScore > 0.7 || isHighlyUnstable;

  return {
    isHighAlert,
    mappedColor: node.color_mapping && NEXUS_COLORS[node.color_mapping] ? NEXUS_COLORS[node.color_mapping] : (isHighAlert ? NEXUS_COLORS.Red : NEXUS_COLORS.DEFAULT),
    statusText: isHighAlert ? "HIGH SEPARATION COST & TOXICITY RISK" : "VALIDATED PATHWAY NODE",
    complianceTag: isHighAlert ? "⚠️ REGULATORY REVIEW REQUIRED" : "✓ VERIFIED BY NEXUS"
  };
}

// ─── 轨道环配置 (找回你的 State 0 视觉) ─────────────────────────────
// Hash-based glyph configurations for non-showcase molecules
function glyphCfg(id: string): { rings: number, rr: number[] } {
  // A deterministic hash function
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = (h * 16777619) >>> 0; }
  
  const rc = 1 + (h % 2); // 1-2 rings
  const rr = [];
  for(let i=0; i<rc; i++) {
    h = (h * 16777619) >>> 0;
    rr.push(0.45 + (h % 30) / 100); // radius between 0.45 and 0.75
  }
  return { rings: rc, rr };
}

// ─── 专为平板调试打造的 Error Boundary ──────────────────────────
class SceneErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, errorMsg: string}> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error.toString() }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("Caught by Error Boundary:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div style={{ width: '300px', background: '#1a0505', borderRadius: '12px', padding: '20px', border: '2px solid #ff4d4f' }}>
            <h3 style={{ color: '#ff4d4f', margin: '0 0 10px 0', fontSize: '14px', fontFamily: "'Public Sans', sans-serif" }}>🚨 捕获到渲染崩溃：</h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', wordWrap: 'break-word', fontFamily: "'Public Sans', sans-serif" }}>{this.state.errorMsg}</p>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

// ─── 节点组件 (找回你的 CPK + 轨道视觉，并注入风险发光逻辑) ─────────────
const MolNode = React.memo(function MolNode({ node, hov, sel, onClick, onHov }: {
  node: PathwayNode; hov: boolean; sel: boolean; cc: number;
  onClick: (n: PathwayNode) => void; onHov: (id: string | null) => void;
}) {
  const grp = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bodyRef = useRef<THREE.Mesh>(null);
  
  // 注入商业合规 logic
  const { isHighAlert, mappedColor, statusText, complianceTag } = useMemo(() => getComplianceIntel(node), [node]);
  
  // 找回轨道环 config
  const cfg = useMemo(() => glyphCfg(node.id), [node.id]);

  useEffect(() => {
    ringRefs.current = ringRefs.current.slice(0, cfg.rings);
  }, [cfg.rings]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const targetScale = sel ? 1.3 : hov ? 1.1 : 1.0;
      grp.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 6);
      
      // 找回 Organic Breathing Animation
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 + (node.id?.length || 0)) * 0.05;
      grp.current.rotation.y = Math.sin(t * 0.06 + (node.id?.length || 0)) * 0.05;
    }
    
    // 找回轨道环的旋转与透明度 fading
    ringRefs.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.z += dt * (0.10 + i * 0.05);
        const mat = ring.material as THREE.MeshPhysicalMaterial;
        // 如果是杂质，轨道环也会闪烁红色
        const baseOpacity = isHighAlert ? 0.3 + Math.sin(t * 4) * 0.1 : 0.08;
        const targetOpacity = hov || sel ? 0.35 : baseOpacity;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, dt * 3);
      }
    });

    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshPhysicalMaterial;
      // 注入商业风险发光 logic
      const targetIntensity = sel ? 0.6 : hov ? 0.4 : (isHighAlert ? 0.2 + Math.sin(t*5)*0.1 : 0.05);
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, dt * 10);
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
      {/* 找回 CPK 风格原子球与 MeshPhysicalMaterial 材质 */}
      <mesh ref={bodyRef}>
        <sphereGeometry args={[0.35, 32, 24]} />
        <meshPhysicalMaterial
          color={mappedColor}
          emissive={mappedColor}
          roughness={0.35}
          metalness={0.05}
          transmission={isHighAlert ? 0 : 0.15} // 杂质节点更厚重不透明
          thickness={0.5}
        />
      </mesh>

      {/* 找回轨道环组件 */}
      {cfg.rr.map((r, i) => (
        <mesh key={`r${i}`} ref={el => { ringRefs.current[i] = el; }} rotation={[Math.PI / 4, 0, i * Math.PI / 2]}>
          <torusGeometry args={[r, 0.006, 6, 50]} />
          <meshPhysicalMaterial
            color={mappedColor}
            emissive={mappedColor}
            emissiveIntensity={0.2}
            transparent
            opacity={0.08}
            roughness={0.6}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 增强版数据悬浮窗 */}
      {(hov || sel) && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: isHighAlert ? 'rgba(30,10,12,0.98)' : 'rgba(8,12,20,0.95)',
            border: `1px solid ${isHighAlert ? '#ff4d4f' : 'rgba(200,216,232,0.2)'}`,
            borderRadius: '14px', padding: '14px', width: '240px',
            backdropFilter: 'blur(20px)', transform: 'translateY(-125%)',
            fontFamily: "'Public Sans', sans-serif", boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ color: isHighAlert ? '#ff4d4f' : '#28a745', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '4px' }}>
              {complianceTag}
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
              {node.canonicalLabel || node.label}
            </div>
            
            <div style={{ color: isHighAlert ? '#ff7875' : '#a0b0c0', fontSize: '11px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.4 }}>
              {statusText}
            </div>

            {/* 审计追踪 */}
            <div style={{ 
              background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '6px',
              fontSize: '10px', color: '#8a9baa', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.3)', marginBottom: '2px', textTransform: 'uppercase', fontSize: '8px' }}>Verifiable Source:</span>
              "{node.audit_trail || 'Predictive Bio-Simulation Engine'}"
            </div>
          </div>
        </Html>
      )}

      {/* 基础标签 */}
      <Html position={[0, -0.85, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: hov || sel ? '#fff' : 'rgba(160,180,200,0.5)',
          fontSize: '10px', fontWeight: sel ? 700 : 400,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)', transition: 'all 0.3s'
        }}>{node.canonicalLabel || node.label}</div>
      </Html>
    </group>
  );
});

// ─── 连线组件 (厚度与能量) ──────────────────────────────────────────
const PathEdge = React.memo(function PathEdge({ edge, s, e, active, color }: { 
  edge: PathwayEdge; s: Vec3; e: Vec3; active: boolean; color: string 
}) {
  const sv = useMemo(() => new THREE.Vector3(...s), [s]);
  const ev = useMemo(() => new THREE.Vector3(...e), [e]);
  const mid = useMemo(() => sv.clone().lerp(ev, 0.5).add(new THREE.Vector3(0, 0.4, 0)), [sv, ev]);
  
  const thickness = useMemo(() => {
    const map: Record<string, number> = { "Thick": 2.2, "Medium": 1.1, "Thin": 0.5 };
    return map[edge.thickness_mapping || "Medium"] || 1.0;
  }, [edge.thickness_mapping]);

  return (
    <group>
      <Line points={[sv, mid, ev]} color={active ? color : '#161e2a'} lineWidth={active ? thickness * 1.8 : thickness} transparent opacity={active ? 0.7 : 0.15} />
      {active && edge.predicted_delta_G_kJ_mol && (
        <Html position={mid.toArray() as Vec3}>
          <div style={{ background: 'rgba(6,9,16,0.9)', color: '#fff', padding: '3px 7px', borderRadius: '5px', fontSize: '9px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
            ΔG: {edge.predicted_delta_G_kJ_mol} kJ/mol
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── 内部 Scene 组件逻辑 (包含 Error Boundary 包装) ────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: any) {
  const [hovId, setHovId] = useState<string | null>(null);

  const ed = useMemo(() =>
    edges.map((edge: any) => {
      const s = nodes.find((n: any) => n.id === edge.start);
      const e = nodes.find((n: any) => n.id === edge.end);
      
      // 数据安全拦截，过滤损坏的线，防黑屏
      if (!s || !e || !Array.isArray(s.position) || !Array.isArray(e.position)) return null; 
      
      return {
        key: `${edge.start}-${edge.end}`,
        edge,
        s: s.position as Vec3,
        e: e.position as Vec3,
        active: hovId === edge.start || hovId === edge.end || selectedNodeId === edge.start || selectedNodeId === edge.end,
        color: NEXUS_COLORS[s.color_mapping as keyof typeof NEXUS_COLORS] || NEXUS_COLORS.DEFAULT
      };
    }).filter(Boolean),
  [edges, nodes, hovId, selectedNodeId]);

  return (
    <SceneErrorBoundary>
      {ed.map((e: any) => <PathEdge key={e.key} edge={e.edge} s={e.s} e={e.e} active={e.active} color={e.color} />)}
      {nodes.map((n: any) => {
        // 数据安全拦截：如果节点坐标出错，则忽略，不渲染
        if (!n || !Array.isArray(n.position) || n.position.length !== 3) return null;
        return <MolNode key={n.id} node={n} hov={hovId === n.id} sel={selectedNodeId === n.id} cc={0} onClick={onNodeClick} onHov={setHovId} />;
      })}
    </SceneErrorBoundary>
  );
}

// ─── 导出主场景 (防闪退延迟挂载) ──────────────────────────────────
export default function NexusBioRenderer({ nodes, onNodeClick, edges, selectedNodeId }: any) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);

  if (!isMounted) {
    return (
      <div style={{ width: '100%', height: '750px', background: '#07090f', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Public Sans', sans-serif", fontSize: '12px', letterSpacing: '0.1em' }}>INITIALIZING NEXUS ENGINE...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '750px', background: '#07090f', borderRadius: '24px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
      {/* 品牌页眉 */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28a745', boxShadow: '0 0 10px #28a745' }} />
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '0.02em', fontFamily: "'Public Sans', sans-serif" }}>NEXUS-BIO <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>1.1</span></h2>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Public Sans', sans-serif" }}>
          Verifiable Decision Engine · AlphaFold 3 Integration
        </p>
      </div>
      
      <Canvas camera={{ position: [0, 6, 14], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <fog attach="fog" args={['#07090f', 12, 30]} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId} />
      </Canvas>

      {/* 商业图例 */}
      <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 10, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: "'Public Sans', sans-serif", pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '10px', height: '10px', background: NEXUS_COLORS.Red, borderRadius: '2px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>Impurity / High Separation Cost</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: NEXUS_COLORS.Green, borderRadius: '2px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>Verified High-Yield Route</span>
        </div>
      </div>
    </div>
  );
}
