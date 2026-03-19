import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode } from '../types';

// pLDDT per node — simulated from AlphaFold data
const NODE_PLDDT: Record<string, number> = {
  acetyl_coa: 85, hmg_coa: 72, mevalonate: 68,
  fpp: 91, amorpha_4_11_diene: 88,
  artemisinic_acid: 76, artemisinin: 93,
};

function plddt2color(score: number): string {
  if (score >= 90) return '#0053D6';
  if (score >= 70) return '#65CBF3';
  if (score >= 50) return '#FFDB13';
  return '#FF7D45';
}

// ── CYP71AV1 Active Site — Heme + surrounding atoms ──
// Based on P450 crystal structures: heme iron in center, substrate channel above
function CYP71AV1ActiveSite({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const hemeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15;
    }
    if (hemeRef.current) {
      const mat = hemeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.3;
    }
  });

  // Heme porphyrin ring — 8 pyrrole carbons arranged in ring
  const hemeAtoms = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.38, z: Math.sin(angle) * 0.38 };
    });
  }, []);

  // Surrounding protein residues (Cys, His, Asp)
  const residues = useMemo(() => [
    { pos: [0.6, 0.3, 0.2] as [number, number, number], color: '#E6E600', label: 'CYS' },
    { pos: [-0.5, 0.4, 0.3] as [number, number, number], color: '#8282D2', label: 'HIS' },
    { pos: [0.2, -0.4, 0.5] as [number, number, number], color: '#E60A0A', label: 'ASP' },
    { pos: [-0.3, 0.2, -0.5] as [number, number, number], color: '#145AFF', label: 'ARG' },
    { pos: [0.4, -0.2, -0.4] as [number, number, number], color: '#FA9600', label: 'SER' },
    { pos: [-0.6, -0.3, 0.1] as [number, number, number], color: '#0F820F', label: 'LEU' },
  ], []);

  return (
    <group ref={groupRef} position={position}>
      {/* Heme ring — porphyrin carbons */}
      {hemeAtoms.map((a, i) => (
        <mesh key={i} position={[a.x, 0, a.z]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color="#CC4400" emissive="#CC4400" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Heme bonds */}
      {hemeAtoms.map((a, i) => {
        const next = hemeAtoms[(i + 1) % hemeAtoms.length];
        return (
          <Line key={`bond-${i}`}
            points={[new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(next.x, 0, next.z)]}
            color="#CC4400" lineWidth={1.5} />
        );
      })}

      {/* Fe²⁺ Iron center — catalytic metal */}
      <mesh ref={hemeRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial
          color="#FF4500"
          emissive="#FF4500"
          emissiveIntensity={0.6}
          metalness={0.8}
          roughness={0.1}
        />
      </mesh>

      {/* Fe axial ligands — up/down bonds */}
      <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.35, 0)]} color="#FF8C00" lineWidth={2} />
      <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.35, 0)]} color="#FF8C00" lineWidth={2} />

      {/* Surrounding residues */}
      {residues.map((r, i) => (
        <group key={i} position={r.pos}>
          <mesh>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color={r.color} emissive={r.color} emissiveIntensity={0.2} />
          </mesh>
          <Html center style={{ pointerEvents: 'none' }}>
            <span style={{ color: r.color, fontSize: '8px', fontFamily: 'monospace', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>{r.label}</span>
          </Html>
        </group>
      ))}

      {/* Label */}
      <Html position={[0, 0.7, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ padding: '3px 8px', background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.4)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#FF8C00', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700 }}>CYP71AV1 Active Site</span>
        </div>
      </Html>
    </group>
  );
}

// ── Amorphadiene substrate molecule — diffusing into active site ──
function AmorphadieneMolecule({ target }: { target: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(0);

  // Start position: FPP node area
  const startPos = new THREE.Vector3(2, 1.5, 0);
  const endPos = new THREE.Vector3(...target);
  const midPos = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5).add(new THREE.Vector3(0, 1, 0.5));

  useFrame((state, delta) => {
    progress.current = (progress.current + delta * 0.2) % 1;
    const t = progress.current;

    // Bezier curve path
    const pos = new THREE.Vector3()
      .addScaledVector(startPos, (1 - t) * (1 - t))
      .addScaledVector(midPos, 2 * (1 - t) * t)
      .addScaledVector(endPos, t * t);

    if (groupRef.current) {
      groupRef.current.position.copy(pos);
      groupRef.current.rotation.y = state.clock.elapsedTime * 3;
      groupRef.current.rotation.x = state.clock.elapsedTime * 1.5;

      // Pulse when near active site
      const distToTarget = pos.distanceTo(endPos);
      const scale = distToTarget < 0.5 ? 1 + (0.5 - distToTarget) * 0.5 : 1;
      groupRef.current.scale.setScalar(scale);
    }
  });

  // Sesquiterpene C15 structure — simplified as atom cluster
  const atoms = [
    { pos: [0, 0, 0] as [number, number, number], color: '#888888', size: 0.08 },    // C1
    { pos: [0.15, 0.1, 0] as [number, number, number], color: '#888888', size: 0.07 },  // C2
    { pos: [0.25, -0.05, 0.1] as [number, number, number], color: '#888888', size: 0.07 }, // C3
    { pos: [-0.1, 0.15, 0.1] as [number, number, number], color: '#888888', size: 0.065 }, // C4
    { pos: [0.05, -0.15, 0] as [number, number, number], color: '#888888', size: 0.065 }, // C5
    { pos: [0.12, 0.08, -0.12] as [number, number, number], color: '#888888', size: 0.06 }, // C6 methyl
  ];

  return (
    <group ref={groupRef}>
      {atoms.map((a, i) => (
        <mesh key={i} position={a.pos}>
          <sphereGeometry args={[a.size, 8, 8]} />
          <meshStandardMaterial color={a.color} emissive="#aaaaaa" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* C-C bonds */}
      <Line points={[new THREE.Vector3(0,0,0), new THREE.Vector3(0.15,0.1,0)]} color="#666" lineWidth={1.2} />
      <Line points={[new THREE.Vector3(0.15,0.1,0), new THREE.Vector3(0.25,-0.05,0.1)]} color="#666" lineWidth={1.2} />
      <Line points={[new THREE.Vector3(0,0,0), new THREE.Vector3(-0.1,0.15,0.1)]} color="#666" lineWidth={1.2} />
      <Line points={[new THREE.Vector3(0,0,0), new THREE.Vector3(0.05,-0.15,0)]} color="#666" lineWidth={1.2} />
    </group>
  );
}

// ── Metabolon cluster — enzymes physically grouped together ──
function MetabolonCluster({ nodes, edges, onNodeClick, selectedNodeId }: {
  nodes: PathwayNode[];
  edges: { start: string; end: string }[];
  onNodeClick: (n: PathwayNode) => void;
  selectedNodeId: string | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getCyp = nodes.find(n => n.id === 'amorpha_4_11_diene');
  const cypPos = getCyp?.position ?? [2, 1.5, 0];

  return (
    <group>
      {/* Metabolon "membrane" — translucent ellipsoid showing enzyme cluster */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[4.5, 32, 32]} />
        <meshStandardMaterial
          color="#6495ED"
          transparent
          opacity={0.025}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Edges */}
      {edges.map((edge, i) => {
        const s = nodes.find(n => n.id === edge.start);
        const e = nodes.find(n => n.id === edge.end);
        if (!s || !e) return null;
        const isActive = hoveredId === edge.start || hoveredId === edge.end ||
          selectedNodeId === edge.start || selectedNodeId === edge.end;
        return (
          <Line key={i}
            points={[new THREE.Vector3(...s.position), new THREE.Vector3(...e.position)]}
            color={isActive ? plddt2color(NODE_PLDDT[s.id] ?? 75) : '#2a2a2a'}
            lineWidth={isActive ? 2 : 0.6}
            transparent opacity={isActive ? 0.9 : 0.2}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const plddt = NODE_PLDDT[node.id] ?? 75;
        const color = plddt2color(plddt);
        const connections = edges.filter(e => e.start === node.id || e.end === node.id).length;
        const size = 0.2 + connections * 0.07;
        const isHov = hoveredId === node.id;
        const isSel = selectedNodeId === node.id;
        const targetScale = isSel ? 1.4 : isHov ? 1.2 : 1;

        return (
          <MetabolonNode
            key={node.id}
            node={node}
            size={size}
            color={color}
            plddt={plddt}
            isHovered={isHov}
            isSelected={isSel}
            targetScale={targetScale}
            onClick={onNodeClick}
            onHover={setHoveredId}
          />
        );
      })}

      {/* CYP71AV1 Active Site overlay at amorphadiene node */}
      {getCyp && (
        <CYP71AV1ActiveSite position={[cypPos[0], cypPos[1] + 0.8, cypPos[2]]} />
      )}

      {/* Amorphadiene substrate diffusion */}
      <AmorphadieneMolecule target={[cypPos[0], cypPos[1] + 0.8, cypPos[2]] as [number,number,number]} />
    </group>
  );
}

function MetabolonNode({ node, size, color, plddt, isHovered, isSelected, targetScale, onClick, onHover }: {
  node: PathwayNode; size: number; color: string; plddt: number;
  isHovered: boolean; isSelected: boolean; targetScale: number;
  onClick: (n: PathwayNode) => void; onHover: (id: string | null) => void;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      const s = coreRef.current.scale.x;
      coreRef.current.scale.setScalar(s + (targetScale - s) * delta * 8);
      coreRef.current.rotation.y = t * 0.35;
      coreRef.current.rotation.x = t * 0.2;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = t * -0.2;
      shellRef.current.rotation.z = t * 0.15;
      const mat = shellRef.current.material as THREE.MeshStandardMaterial;
      const op = isHovered || isSelected ? 0.12 : 0.03;
      mat.opacity += (op - mat.opacity) * delta * 5;
    }
  });

  // Satellite atoms based on pLDDT (higher = more ordered = more atoms visible)
  const satelliteCount = Math.floor(plddt / 20);
  const satellites = useMemo(() => Array.from({ length: satelliteCount }, (_, i) => {
    const phi = (i / satelliteCount) * Math.PI * 2;
    return {
      x: Math.cos(phi) * (size * 1.5),
      y: Math.sin(phi * 0.7) * (size * 0.8),
      z: Math.sin(phi) * (size * 1.2),
    };
  }), [satelliteCount, size]);

  return (
    <group position={node.position}>
      {/* Electron shell */}
      <mesh ref={shellRef}>
        <sphereGeometry args={[size * 2, 8, 6]} />
        <meshStandardMaterial color={color} transparent opacity={0.03} wireframe depthWrite={false} />
      </mesh>

      {/* Satellite atoms */}
      {satellites.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Core nucleus */}
      <mesh
        ref={coreRef}
        onClick={e => { e.stopPropagation(); onClick(node); }}
        onPointerOver={e => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); document.body.style.cursor = 'auto'; }}
      >
        <icosahedronGeometry args={[size, 2]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1.0 : isHovered ? 0.7 : 0.25}
          roughness={0.05}
          metalness={0.35}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Label */}
      <Html position={[0, -(size + 0.42), 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: isHovered || isSelected ? '#ffffff' : 'rgba(255,255,255,0.55)',
          fontSize: '10px', fontWeight: isSelected ? 700 : 500,
          fontFamily: '-apple-system, sans-serif',
          textShadow: '0 1px 6px rgba(0,0,0,0.95)',
          whiteSpace: 'nowrap',
          padding: '2px 6px',
          background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
          borderRadius: '4px',
        }}>
          {node.label}
        </div>
      </Html>

      {/* Hover tooltip */}
      {isHovered && !isSelected && (
        <Html distanceFactor={9} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(8,8,8,0.96)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '11px 13px', width: '200px',
            backdropFilter: 'blur(16px)', transform: 'translateY(-115%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{node.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontFamily: 'monospace' }}>pLDDT {plddt}</span>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', lineHeight: 1.55, margin: '0 0 7px' }}>
              {node.summary?.slice(0, 85)}...
            </p>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <div style={{ width: `${plddt}%`, height: '100%', background: color, borderRadius: '2px' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'monospace', marginTop: '5px', marginBottom: 0 }}>Click for details · AlphaFold confidence</p>
          </div>
        </Html>
      )}
    </group>
  );
}

const DEFAULT_EDGES = [
  { start: 'acetyl_coa', end: 'hmg_coa' },
  { start: 'acetyl_coa', end: 'mevalonate' },
  { start: 'hmg_coa', end: 'mevalonate' },
  { start: 'mevalonate', end: 'fpp' },
  { start: 'fpp', end: 'amorpha_4_11_diene' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid' },
  { start: 'artemisinic_acid', end: 'artemisinin' },
];

interface ThreeSceneProps {
  nodes: PathwayNode[];
  onNodeClick: (node: PathwayNode) => void;
  edges?: { start: string; end: string }[];
  selectedNodeId?: string | null;
}

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: ThreeSceneProps) {
  const activeEdges = edges ?? DEFAULT_EDGES;

  return (
    <div style={{
      width: '100%', height: '580px', background: '#050505',
      borderRadius: '16px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)', position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'linear-gradient(to bottom, rgba(5,5,5,0.95), transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}>
            Metabolon · {nodes.length} enzymes · CYP71AV1 active site · pLDDT colored
          </span>
        </div>
        {edges && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(100,149,237,0.08)', border: '1px solid rgba(100,149,237,0.2)' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6495ED' }} />
            <span style={{ color: '#6495ED', fontSize: '10px', fontFamily: 'monospace' }}>AI Generated</span>
          </div>
        )}
      </div>

      {/* pLDDT mini legend */}
      <div style={{ position: 'absolute', bottom: '14px', left: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '2px' }}>pLDDT</span>
        {[{ c: '#0053D6', l: '>90' }, { c: '#65CBF3', l: '70-90' }, { c: '#FFDB13', l: '50-70' }, { c: '#FF7D45', l: '<50' }].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: x.c }} />
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'monospace' }}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Substrate legend */}
      <div style={{ position: 'absolute', bottom: '14px', right: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: 'rgba(255,69,0,0.7)', fontSize: '9px', fontFamily: 'monospace' }}>Fe²⁺ active site</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF4500' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: 'rgba(150,150,150,0.6)', fontSize: '9px', fontFamily: 'monospace' }}>amorphadiene →</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '3px', background: '#888', transform: 'rotate(45deg)' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: 'monospace' }}>Drag · Zoom · Click</span>
      </div>

      <Canvas
        camera={{ position: [0, 2, 12], fov: 48 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          precision: 'highp',
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        style={{ background: '#050505' }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[8, 8, 8]} intensity={1.2} />
        <pointLight position={[-8, -4, -8]} intensity={0.5} color="#6495ED" />
        <pointLight position={[0, -8, 4]} intensity={0.3} color="#65CBF3" />
        <fog attach="fog" args={['#030303', 20, 45]} />
        <OrbitControls enableZoom autoRotate autoRotateSpeed={0.2} zoomSpeed={0.5} minDistance={4} maxDistance={22} enablePan={false} />
        <MetabolonCluster nodes={nodes} edges={activeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} />
      </Canvas>
    </div>
  );
}
