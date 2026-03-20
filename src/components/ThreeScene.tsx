import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

// ── pLDDT confidence color scale (AlphaFold standard) ──
function plddt2color(score: number): string {
  if (score >= 90) return '#4A90D9';  // high confidence — steel blue
  if (score >= 70) return '#7FB3D3';  // confident — muted blue
  if (score >= 50) return '#C4A882';  // medium — warm grey
  return '#A0856C';                   // low — muted amber
}

// Node pLDDT scores per showcase node
const NODE_PLDDT: Record<string, number> = {
  acetyl_coa: 85, hmg_coa: 72, mevalonate: 68,
  fpp: 91, amorpha_4_11_diene: 88,
  artemisinic_acid: 76, artemisinin: 93,
};

function getNodeColor(node: PathwayNode): string {
  const plddt = NODE_PLDDT[node.id];
  if (plddt !== undefined) return plddt2color(plddt);
  // For AI-generated nodes, use muted palette based on node color hint
  const muted: Record<string, string> = {
    '#e5e5e5': '#8A9BA8', '#d4d4d4': '#7A8E9B', '#a3a3a3': '#6B7F8C',
    '#737373': '#5C707D', '#525252': '#4D616E', '#f5f5f5': '#9AABB8',
  };
  return muted[node.color] || '#6B8A9E';
}

// ── Subtle technical grid background ──
function TechGrid() {
  const gridRef = useRef<THREE.Group>(null);

  const gridLines = useMemo(() => {
    const lines: { start: [number,number,number]; end: [number,number,number] }[] = [];
    const size = 20;
    const step = 2;
    for (let i = -size; i <= size; i += step) {
      lines.push({ start: [i, -8, -12], end: [i, -8, 12] });
      lines.push({ start: [-size, -8, i * 0.6], end: [size, -8, i * 0.6] });
    }
    return lines;
  }, []);

  return (
    <group ref={gridRef} position={[0, -3.5, 0]}>
      {gridLines.map((line, i) => (
        <Line
          key={i}
          points={[new THREE.Vector3(...line.start), new THREE.Vector3(...line.end)]}
          color="#1a2530"
          lineWidth={0.4}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  );
}

// ── Edge with directional flow indicator ──
function PathEdge({ start, end, isActive, color }: {
  start: [number,number,number];
  end: [number,number,number];
  isActive: boolean;
  color: string;
}) {
  const progressRef = useRef(0);
  const dotRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * 0.3) % 1;
    if (dotRef.current) {
      const t = progressRef.current;
      const s = new THREE.Vector3(...start);
      const e = new THREE.Vector3(...end);
      dotRef.current.position.lerpVectors(s, e, t);
      dotRef.current.visible = isActive;
    }
  });

  return (
    <group>
      <Line
        points={[new THREE.Vector3(...start), new THREE.Vector3(...end)]}
        color={isActive ? color : '#2a3a45'}
        lineWidth={isActive ? 1.2 : 0.5}
        transparent
        opacity={isActive ? 0.85 : 0.3}
      />
      {/* Flow dot */}
      <mesh ref={dotRef} visible={isActive}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

// ── Scientific node — flat disc style like molecular modeling software ──
function ScientificNode({ node, isHovered, isSelected, connectionCount, onClick, onHover }: {
  node: PathwayNode;
  isHovered: boolean;
  isSelected: boolean;
  connectionCount: number;
  onClick: (n: PathwayNode) => void;
  onHover: (id: string | null) => void;
}) {
  const discRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const nodeColor = getNodeColor(node);
  const plddt = NODE_PLDDT[node.id] ?? 75;

  // Size based on connections — major nodes are larger
  const baseRadius = 0.18 + connectionCount * 0.055;
  const targetScale = isSelected ? 1.35 : isHovered ? 1.15 : 1.0;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (discRef.current) {
      // Smooth scale transition
      const cs = discRef.current.scale.x;
      const ns = cs + (targetScale - cs) * delta * 7;
      discRef.current.scale.setScalar(ns);
      // Very slow rotation — technical feel
      discRef.current.rotation.y = t * 0.08;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.15;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = isHovered || isSelected ? 0.7 : 0.15;
      mat.opacity += (targetOp - mat.opacity) * delta * 5;
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = isSelected ? 0.12 : isHovered ? 0.08 : 0.0;
      mat.opacity += (targetOp - mat.opacity) * delta * 5;
    }
  });

  const plddt2colorConf = (p: number) => {
    if (p >= 90) return '#4A90D9';
    if (p >= 70) return '#7FB3D3';
    if (p >= 50) return '#C4A882';
    return '#A0856C';
  };

  return (
    <group position={node.position}>
      {/* Glow volume */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseRadius * 2.8, 12, 12]} />
        <meshStandardMaterial
          color={nodeColor}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Selection ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 1.4, baseRadius * 1.6, 32]} />
        <meshStandardMaterial
          color={nodeColor}
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main disc — primary node body */}
      <mesh
        ref={discRef}
        onClick={e => { e.stopPropagation(); onClick(node); }}
        onPointerOver={e => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); document.body.style.cursor = 'auto'; }}
      >
        <cylinderGeometry args={[baseRadius, baseRadius, baseRadius * 0.35, 32]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={isSelected ? 0.4 : isHovered ? 0.25 : 0.08}
          roughness={0.45}
          metalness={0.6}
        />
      </mesh>

      {/* Top face highlight */}
      <mesh position={[0, baseRadius * 0.18, 0]}>
        <cylinderGeometry args={[baseRadius * 0.65, baseRadius * 0.65, 0.01, 32]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, -(baseRadius + 0.38), 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          color: isHovered || isSelected ? '#e8eef2' : '#8a9ba8',
          fontSize: '10px',
          fontWeight: isSelected ? 600 : 400,
          fontFamily: "'Inter', 'SF Mono', monospace",
          letterSpacing: '0.03em',
          textShadow: '0 1px 8px rgba(0,0,0,1)',
          whiteSpace: 'nowrap',
          padding: '2px 6px',
          background: isSelected ? 'rgba(74,144,217,0.12)' : 'transparent',
          border: isSelected ? '1px solid rgba(74,144,217,0.2)' : '1px solid transparent',
          borderRadius: '4px',
          transition: 'color 0.2s',
        }}>
          {node.label}
        </div>
      </Html>

      {/* Hover panel */}
      {isHovered && !isSelected && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(10,15,20,0.97)',
            border: '1px solid rgba(74,144,217,0.2)',
            borderRadius: '8px',
            padding: '10px 13px',
            width: '196px',
            backdropFilter: 'blur(12px)',
            transform: 'translateY(-118%)',
            fontFamily: "'Inter', sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ color: '#e0eaf0', fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {node.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: plddt2colorConf(plddt) }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'monospace' }}>
                  {plddt}
                </span>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 8px' }}>
              {node.summary?.slice(0, 80)}...
            </p>
            {/* pLDDT bar */}
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
              <div style={{ width: `${plddt}%`, height: '100%', background: plddt2colorConf(plddt), borderRadius: '1px' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'monospace', marginTop: '5px', marginBottom: 0 }}>
              click to inspect · pLDDT {plddt}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Scene with auto-rotate pause on interaction ──
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  onNodeClick: (n: PathwayNode) => void;
  selectedNodeId: string | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [userInteracting, setUserInteracting] = useState(false);
  const controlsRef = useRef<any>(null);
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInteractionStart = useCallback(() => {
    setUserInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    // Resume auto-rotate after 3 seconds of inactivity
    interactionTimer.current = setTimeout(() => setUserInteracting(false), 3000);
  }, []);

  const edgeData = useMemo(() => {
    return edges.map(edge => {
      const s = nodes.find(n => n.id === edge.start);
      const e = nodes.find(n => n.id === edge.end);
      if (!s || !e) return null;
      const isActive = hoveredId === edge.start || hoveredId === edge.end ||
        selectedNodeId === edge.start || selectedNodeId === edge.end;
      const color = getNodeColor(s);
      return { key: `${edge.start}-${edge.end}`, s, e, isActive, color };
    }).filter(Boolean);
  }, [edges, nodes, hoveredId, selectedNodeId]);

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach(n => { counts[n.id] = 0; });
    edges.forEach(e => {
      if (counts[e.start] !== undefined) counts[e.start]++;
      if (counts[e.end] !== undefined) counts[e.end]++;
    });
    return counts;
  }, [nodes, edges]);

  return (
    <>
      {/* Lighting — cold, precise, scientific workstation */}
      <ambientLight intensity={0.18} color="#c8d8e8" />
      <directionalLight position={[6, 10, 6]} intensity={0.9} color="#ddeeff" castShadow={false} />
      <directionalLight position={[-8, -4, -6]} intensity={0.15} color="#334455" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#aaccdd" />

      {/* Subtle fog for depth */}
      <fog attach="fog" args={['#0c1218', 22, 50]} />

      <OrbitControls
        ref={controlsRef}
        enableZoom
        autoRotate={!userInteracting}
        autoRotateSpeed={0.18}
        zoomSpeed={0.5}
        minDistance={5}
        maxDistance={24}
        enablePan={false}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      {/* Technical grid floor */}
      <TechGrid />

      {/* Edges */}
      {edgeData.map((ed: any) => (
        <PathEdge
          key={ed.key}
          start={ed.s.position}
          end={ed.e.position}
          isActive={ed.isActive}
          color={ed.color}
        />
      ))}

      {/* Nodes */}
      {nodes.map(node => (
        <ScientificNode
          key={node.id}
          node={node}
          isHovered={hoveredId === node.id}
          isSelected={selectedNodeId === node.id}
          connectionCount={connectionCounts[node.id] ?? 0}
          onClick={onNodeClick}
          onHover={setHoveredId}
        />
      ))}
    </>
  );
}

const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa', end: 'hmg_coa', relationshipType: 'converts', direction: 'forward' },
  { start: 'acetyl_coa', end: 'mevalonate', relationshipType: 'produces', direction: 'forward' },
  { start: 'hmg_coa', end: 'mevalonate', relationshipType: 'converts', direction: 'forward' },
  { start: 'mevalonate', end: 'fpp', relationshipType: 'produces', direction: 'forward' },
  { start: 'fpp', end: 'amorpha_4_11_diene', relationshipType: 'catalyzes', direction: 'forward' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid', relationshipType: 'converts', direction: 'forward' },
  { start: 'artemisinic_acid', end: 'artemisinin', relationshipType: 'produces', direction: 'forward' },
];

interface ThreeSceneProps {
  nodes: PathwayNode[];
  onNodeClick: (node: PathwayNode) => void;
  edges?: PathwayEdge[];
  selectedNodeId?: string | null;
}

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: ThreeSceneProps) {
  const activeEdges = edges ?? DEFAULT_EDGES;

  return (
    <div style={{
      width: '100%',
      height: '560px',
      background: 'linear-gradient(180deg, #0c1218 0%, #0e1520 60%, #111a22 100%)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(74,144,217,0.1)',
      position: 'relative',
    }}>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(to bottom, rgba(12,18,24,0.95), transparent)',
        borderBottom: '1px solid rgba(74,144,217,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(74,144,217,0.6)' }} />
          <span style={{ color: 'rgba(180,200,220,0.4)', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            METABOLIC PATHWAY · {nodes.length} ENTITIES
          </span>
        </div>
        {edges && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(74,144,217,0.06)', border: '1px solid rgba(74,144,217,0.15)' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4A90D9' }} />
            <span style={{ color: 'rgba(74,144,217,0.7)', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              AI GENERATED
            </span>
          </div>
        )}
      </div>

      {/* pLDDT legend */}
      <div style={{
        position: 'absolute', bottom: '14px', left: '14px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        <span style={{ color: 'rgba(180,200,220,0.25)', fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.06em', marginBottom: '2px' }}>
          pLDDT
        </span>
        {[
          { c: '#4A90D9', l: '>90', desc: 'Very high' },
          { c: '#7FB3D3', l: '70–90', desc: 'Confident' },
          { c: '#C4A882', l: '50–70', desc: 'Medium' },
          { c: '#A0856C', l: '<50', desc: 'Low' },
        ].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '16px', height: '3px', borderRadius: '1.5px', background: x.c, opacity: 0.8 }} />
            <span style={{ color: 'rgba(180,200,220,0.25)', fontSize: '8px', fontFamily: 'monospace' }}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 10 }}>
        <span style={{ color: 'rgba(180,200,220,0.18)', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          drag · scroll · click to inspect
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 3, 12], fov: 46 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <Scene
          nodes={nodes}
          edges={activeEdges}
          onNodeClick={onNodeClick}
          selectedNodeId={selectedNodeId ?? null}
        />
      </Canvas>
    </div>
  );
}
