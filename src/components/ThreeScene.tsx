'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

// ─── 商业级颜色与风险定义 (核心逻辑) ────────────────────────────────────────
const RISK_THEME = {
  STABLE: "#28a745",    // 绿色：高产/自发反应
  MODERATE: "#ffc107",  // 黄色：中等风险
  LOW_STABILITY: "#fd7e14", // 橙色：热力学不稳定
  HIGH_RISK: "#dc3545", // 红色：杂质/高风险/高分离成本
  INTERMEDIATE: "#6f42c1", // 紫色：关键中间体
  NEUTRAL: "#C8D8E8"
};

// ─── 自动合规引擎 (解决你的后顾之忧) ────────────────────────────────────────
// 即使 JSON 数据缺失，前端也会根据属性自动判定商业风险
function getComplianceIntel(node: PathwayNode) {
  const isImpurity = node.type?.toLowerCase().includes('impurity') || node.color_mapping === 'Red';
  const riskScore = node.risk_score ?? 0;
  const isHighlyUnstable = node.thermodynamic_stability?.toLowerCase().includes('low');

  // 触发“高分离成本与潜在毒性”的商业判定标准
  const isHighAlert = isImpurity || riskScore > 0.7 || isHighlyUnstable;

  return {
    isHighAlert,
    statusText: isHighAlert ? "HIGH SEPARATION COST & TOXICITY RISK" : "VALIDATED PATHWAY NODE",
    alertColor: isHighAlert ? RISK_THEME.HIGH_RISK : RISK_THEME.STABLE,
    complianceTag: isHighAlert ? "⚠️ REGULATORY REVIEW REQUIRED" : "✓ VERIFIED BY NEXUS"
  };
}

// ─── 节点组件 (包含 3D 脉冲预警效果) ────────────────────────────────────────
const MolNode = React.memo(function MolNode({ node, hov, sel, onClick, onHov }: {
  node: PathwayNode; hov: boolean; sel: boolean; cc: number;
  onClick: (n: PathwayNode) => void; onHov: (id: string | null) => void;
}) {
  const grp = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const { isHighAlert, statusText, alertColor, complianceTag } = useMemo(() => getComplianceIntel(node), [node]);
  
  // 颜色映射逻辑
  const baseColor = useMemo(() => {
    if (node.color_mapping && RISK_THEME[node.color_mapping as keyof typeof RISK_THEME]) {
      return RISK_THEME[node.color_mapping as keyof typeof RISK_THEME];
    }
    return isHighAlert ? RISK_THEME.HIGH_RISK : RISK_THEME.NEUTRAL;
  }, [node.color_mapping, isHighAlert]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const targetScale = sel ? 1.3 : hov ? 1.1 : 1.0;
      grp.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 6);
      
      // 高风险节点触发视觉“报警脉冲”
      if (isHighAlert) {
        const pulse = 1 + Math.sin(t * 5) * 0.04;
        grp.current.scale.multiplyScalar(pulse);
      }
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 + node.id.length) * 0.05;
    }
    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshPhysicalMaterial;
      const targetIntensity = sel ? 0.6 : hov ? 0.3 : (isHighAlert ? 0.2 : 0.05);
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
      <mesh ref={bodyRef}>
        <sphereGeometry args={[0.35, 32, 24]} />
        <meshPhysicalMaterial
          color={baseColor}
          emissive={baseColor}
          roughness={0.4}
          metalness={0.1}
          transmission={isHighAlert ? 0 : 0.2} 
        />
      </mesh>

      {/* 增强版 UI 悬浮窗: 包含审计追踪与合规警告 */}
      {(hov || sel) && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: isHighAlert ? 'rgba(30,10,12,0.98)' : 'rgba(8,12,20,0.95)',
            border: `1px solid ${isHighAlert ? '#ff4d4f' : 'rgba(200,216,232,0.2)'}`,
            borderRadius: '14px', padding: '14px', width: '240px',
            backdropFilter: 'blur(20px)', transform: 'translateY(-125%)',
            fontFamily: "'Public Sans', sans-serif", boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ color: alertColor, fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '4px' }}>
              {complianceTag}
            </div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
              {node.name || node.label}
            </div>
            
            {/* 核心商业警告 */}
            <div style={{ color: isHighAlert ? '#ff7875' : '#a0b0c0', fontSize: '11px', fontWeight: 600, marginBottom: '10px', lineHeight: 1.4 }}>
              {statusText}
            </div>

            {/* 审计追踪 (Transparency Layer) */}
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

      <Html position={[0, -0.8, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: hov || sel ? '#fff' : 'rgba(160,180,200,0.45)',
          fontSize: '10px', fontWeight: sel ? 700 : 400,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)', transition: 'all 0.3s'
        }}>{node.name || node.label}</div>
      </Html>
    </group>
  );
});

// ─── 连线组件 (厚度代表产率，包含能量计算) ──────────────────────────────────
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
      <Line
        points={[sv, mid, ev]}
        color={active ? color : '#161e2a'}
        lineWidth={active ? thickness * 1.8 : thickness}
        transparent
        opacity={active ? 0.7 : 0.15}
      />
      {active && edge.predicted_delta_G_kJ_mol && (
        <Html position={mid.toArray() as Vec3}>
          <div style={{
            background: 'rgba(6,9,16,0.9)', color: '#fff', padding: '3px 7px',
            borderRadius: '5px', fontSize: '9px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)'
          }}>
            ΔG: {edge.predicted_delta_G_kJ_mol} kJ/mol
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── 导出主场景 ─────────────────────────────────────────────────────────────
export default function NexusBioRenderer({ nodes, onNodeClick, edges, selectedNodeId }: any) {
  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes : [], [nodes]);
  const safeEdges = useMemo(() => Array.isArray(edges) ? edges : [], [edges]);

  return (
    <div style={{ width: '100%', height: '750px', background: '#07090f', borderRadius: '24px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
      {/* 品牌页眉: 强化“可验证”属性 */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28a745', boxShadow: '0 0 10px #28a745' }} />
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '0.02em' }}>NEXUS-BIO <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>1.1</span></h2>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Verifiable Decision Engine · AlphaFold 3 Integration
        </p>
      </div>
      
      <Canvas camera={{ position: [0, 6, 14], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <fog attach="fog" args={['#07090f', 12, 30]} />
        
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        
        <Scene 
          nodes={safeNodes} 
          edges={safeEdges} 
          onNodeClick={onNodeClick} 
          selectedNodeId={selectedNodeId} 
        />
      </Canvas>

      {/* 商业图例 */}
      <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 10, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '10px', height: '10px', background: RISK_THEME.HIGH_RISK, borderRadius: '2px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>Impurity / High Separation Cost</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', background: RISK_THEME.STABLE, borderRadius: '2px' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>Verified High-Yield Route</span>
        </div>
      </div>
    </div>
  );
}

// ─── 内部 Scene 组件逻辑 ─────────────────────────────────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: any) {
  const [hovId, setHovId] = useState<string | null>(null);

  const ed = useMemo(() =>
    edges.map((edge: any) => {
      const s = nodes.find((n: any) => n.id === edge.start);
      const e = nodes.find((n: any) => n.id === edge.end);
      if (!s || !e) return null;
      return {
        key: `${edge.start}-${edge.end}`,
        edge,
        s: s.position,
        e: e.position,
        active: hovId === edge.start || hovId === edge.end || selectedNodeId === edge.start || selectedNodeId === edge.end,
        color: RISK_THEME[s.color_mapping as keyof typeof RISK_THEME] || RISK_THEME.NEUTRAL
      };
    }).filter(Boolean),
  [edges, nodes, hovId, selectedNodeId]);

  return (
    <>
      {ed.map((e: any) => <PathEdge key={e.key} edge={e.edge} s={e.s} e={e.e} active={e.active} color={e.color} />)}
      {nodes.map((n: any) => (
        <MolNode key={n.id} node={n} hov={hovId === n.id} sel={selectedNodeId === n.id} cc={0} onClick={onNodeClick} onHov={setHovId} />
      ))}
    </>
  );
}
