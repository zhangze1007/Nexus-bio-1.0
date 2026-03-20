import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge } from '../types';

// ─────────────────────────────────────────────
// HASH UTILITY — stable per node ID
// ─────────────────────────────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
function hashFloat(str: string, index: number, min = 0, max = 1): number {
  const h = hash(str + index);
  return min + ((h % 10000) / 10000) * (max - min);
}
function hashInt(str: string, index: number, min: number, max: number): number {
  return min + (hash(str + index) % (max - min + 1));
}

// ─────────────────────────────────────────────
// COLOR SYSTEM — scientific, muted, cold
// ─────────────────────────────────────────────
const NODE_PLDDT: Record<string, number> = {
  acetyl_coa: 85, hmg_coa: 72, mevalonate: 68,
  fpp: 91, amorpha_4_11_diene: 88,
  artemisinic_acid: 76, artemisinin: 93,
};

// Cold steel palette — no neon
const SCIENTIFIC_PALETTE = [
  '#4A7FA5', // steel blue
  '#5A8F7B', // muted teal
  '#7A6E9A', // desaturated violet
  '#8F7A5A', // warm grey-bronze
  '#5A7A8F', // slate
  '#6E8F7A', // sage
  '#8F6E7A', // muted rose-grey
  '#7A8F6E', // olive-grey
];

function getNodeColor(node: PathwayNode): string {
  const plddt = NODE_PLDDT[node.id];
  if (plddt !== undefined) {
    if (plddt >= 90) return '#4A7FA5';
    if (plddt >= 70) return '#5A8F7B';
    if (plddt >= 50) return '#8F8A6A';
    return '#8F6E5A';
  }
  const idx = hash(node.id) % SCIENTIFIC_PALETTE.length;
  return SCIENTIFIC_PALETTE[idx];
}

function plddt2color(p: number): string {
  if (p >= 90) return '#4A7FA5';
  if (p >= 70) return '#5A8F7B';
  if (p >= 50) return '#C4A882';
  return '#A0856C';
}

// ─────────────────────────────────────────────
// PROCEDURAL GLYPH — unique 3D asset per node
// ─────────────────────────────────────────────
type GlyphConfig = {
  coreGeom: 'octahedron' | 'dodecahedron' | 'tetrahedron' | 'icosahedron' | 'sphere' | 'torus';
  coreScale: number;
  ringCount: number;
  ringRadii: number[];
  ringTilts: number[];
  satelliteCount: number;
  satelliteRadius: number;
  satelliteSize: number;
  spinSpeed: number;
  ringSpeeds: number[];
  hasInnerCore: boolean;
};

function buildGlyphConfig(nodeId: string, connectionCount: number): GlyphConfig {
  const geoms: GlyphConfig['coreGeom'][] = [
    'octahedron', 'dodecahedron', 'tetrahedron',
    'icosahedron', 'sphere', 'torus',
  ];
  const geomIdx = hashInt(nodeId, 0, 0, geoms.length - 1);
  const ringCount = hashInt(nodeId, 1, 1, 3);
  const ringRadii = Array.from({ length: ringCount }, (_, i) =>
    hashFloat(nodeId, 10 + i, 0.45, 0.85)
  );
  const ringTilts = Array.from({ length: ringCount }, (_, i) =>
    hashFloat(nodeId, 20 + i, 0, Math.PI)
  );
  const ringSpeeds = Array.from({ length: ringCount }, (_, i) =>
    hashFloat(nodeId, 30 + i, 0.12, 0.45) * (i % 2 === 0 ? 1 : -1)
  );

  return {
    coreGeom: geoms[geomIdx],
    coreScale: 0.22 + connectionCount * 0.04 + hashFloat(nodeId, 2, 0, 0.06),
    ringCount,
    ringRadii,
    ringTilts,
    satelliteCount: hashInt(nodeId, 3, 2, 5),
    satelliteRadius: hashFloat(nodeId, 4, 0.55, 0.95),
    satelliteSize: hashFloat(nodeId, 5, 0.04, 0.075),
    spinSpeed: hashFloat(nodeId, 6, 0.06, 0.18),
    ringSpeeds,
    hasInnerCore: hash(nodeId) % 3 === 0,
  };
}

// Core geometry selector
function CoreGeometry({ geom, scale }: { geom: GlyphConfig['coreGeom']; scale: number }) {
  switch (geom) {
    case 'octahedron':   return <octahedronGeometry args={[scale, 0]} />;
    case 'dodecahedron': return <dodecahedronGeometry args={[scale, 0]} />;
    case 'tetrahedron':  return <tetrahedronGeometry args={[scale, 0]} />;
    case 'icosahedron':  return <icosahedronGeometry args={[scale, 1]} />;
    case 'torus':        return <torusGeometry args={[scale * 0.8, scale * 0.32, 8, 20]} />;
    default:             return <sphereGeometry args={[scale, 14, 14]} />;
  }
}

// ─────────────────────────────────────────────
// SCIENTIFIC GLYPH COMPONENT
// ─────────────────────────────────────────────
function ScientificGlyph({ node, isHovered, isSelected, connectionCount, onClick, onHover }: {
  node: PathwayNode;
  isHovered: boolean;
  isSelected: boolean;
  connectionCount: number;
  onClick: (n: PathwayNode) => void;
  onHover: (id: string | null) => void;
}) {
  const groupRef    = useRef<THREE.Group>(null);
  const coreRef     = useRef<THREE.Mesh>(null);
  const innerRef    = useRef<THREE.Mesh>(null);
  const ringRefs    = useRef<(THREE.Mesh | null)[]>([]);
  const satRefs     = useRef<(THREE.Mesh | null)[]>([]);

  const color   = getNodeColor(node);
  const plddt   = NODE_PLDDT[node.id] ?? 75;
  const cfg     = useMemo(() => buildGlyphConfig(node.id, connectionCount), [node.id, connectionCount]);

  // Satellite positions on unit sphere (golden angle distribution)
  const satPositions = useMemo(() =>
    Array.from({ length: cfg.satelliteCount }, (_, i) => {
      const phi   = Math.acos(1 - (2 * (i + 0.5)) / cfg.satelliteCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * cfg.satelliteRadius,
        Math.sin(phi) * Math.sin(theta) * cfg.satelliteRadius,
        Math.cos(phi) * cfg.satelliteRadius
      );
    }), [cfg]);

  const targetScale = isSelected ? 1.38 : isHovered ? 1.18 : 1.0;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      const cs = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(cs + (targetScale - cs) * delta * 7);
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * cfg.spinSpeed;
      coreRef.current.rotation.x += delta * cfg.spinSpeed * 0.4;
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      const targetEmi = isSelected ? 0.35 : isHovered ? 0.2 : 0.07;
      mat.emissiveIntensity += (targetEmi - mat.emissiveIntensity) * delta * 5;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * cfg.spinSpeed * 1.5;
      innerRef.current.rotation.z += delta * cfg.spinSpeed * 0.8;
    }
    // Rings
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.rotation.z += delta * cfg.ringSpeeds[i];
      ring.rotation.x += delta * cfg.ringSpeeds[i] * 0.3;
      const mat = ring.material as THREE.MeshStandardMaterial;
      const targetOp = isHovered || isSelected ? 0.55 : 0.18;
      mat.opacity += (targetOp - mat.opacity) * delta * 4;
    });
    // Satellites — slow orbit
    satRefs.current.forEach((sat, i) => {
      if (!sat) return;
      const speed = cfg.spinSpeed * 0.35;
      const angle = t * speed + (i / cfg.satelliteCount) * Math.PI * 2;
      const r = cfg.satelliteRadius;
      const tilt = cfg.ringTilts[i % cfg.ringCount] || 0;
      sat.position.set(
        Math.cos(angle) * r,
        Math.sin(angle * 0.7 + tilt) * r * 0.5,
        Math.sin(angle) * r * 0.85
      );
      const mat = sat.material as THREE.MeshStandardMaterial;
      const targetOp = isHovered || isSelected ? 0.8 : 0.35;
      mat.opacity += (targetOp - mat.opacity) * delta * 4;
    });
  });

  const colorObj = new THREE.Color(color);

  return (
    <group position={node.position} ref={groupRef}>

      {/* Rings */}
      {cfg.ringRadii.map((r, i) => (
        <mesh
          key={`ring-${i}`}
          ref={el => { ringRefs.current[i] = el; }}
          rotation={[cfg.ringTilts[i] || 0, 0, i * 1.1]}
        >
          <torusGeometry args={[r, 0.012, 6, 48]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.15}
            transparent
            opacity={0.18}
            roughness={0.5}
            metalness={0.6}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Satellites */}
      {satPositions.map((pos, i) => (
        <mesh
          key={`sat-${i}`}
          ref={el => { satRefs.current[i] = el; }}
          position={pos}
        >
          <sphereGeometry args={[cfg.satelliteSize, 7, 7]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.25}
            transparent
            opacity={0.35}
            roughness={0.4}
            metalness={0.5}
          />
        </mesh>
      ))}

      {/* Inner core (some nodes) */}
      {cfg.hasInnerCore && (
        <mesh ref={innerRef}>
          <octahedronGeometry args={[cfg.coreScale * 0.45, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.2}
            metalness={0.7}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Main core — procedural geometry */}
      <mesh
        ref={coreRef}
        onClick={e => { e.stopPropagation(); onClick(node); }}
        onPointerOver={e => { e.stopPropagation(); onHover(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); document.body.style.cursor = 'auto'; }}
      >
        <CoreGeometry geom={cfg.coreGeom} scale={cfg.coreScale} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.07}
          roughness={0.38}
          metalness={0.65}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Wireframe overlay — modeling software feel */}
      <mesh>
        <CoreGeometry geom={cfg.coreGeom} scale={cfg.coreScale * 1.04} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isHovered || isSelected ? 0.12 : 0.04}
          wireframe
          depthWrite={false}
        />
      </mesh>

      {/* Label */}
      <Html position={[0, -(cfg.coreScale + 0.52), 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: isHovered || isSelected ? '#d0dde8' : '#607585',
          fontSize: '10px',
          fontWeight: isSelected ? 600 : 400,
          fontFamily: "'Inter', 'SF Mono', monospace",
          letterSpacing: '0.025em',
          textShadow: '0 0 12px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,1)',
          whiteSpace: 'nowrap',
          padding: '2px 6px',
          background: isSelected ? 'rgba(74,127,165,0.1)' : 'transparent',
          borderRadius: '3px',
          border: isSelected ? '1px solid rgba(74,127,165,0.25)' : '1px solid transparent',
        }}>
          {node.label}
        </div>
      </Html>

      {/* Hover tooltip */}
      {isHovered && !isSelected && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(8,12,18,0.97)',
            border: '1px solid rgba(74,127,165,0.18)',
            borderRadius: '8px',
            padding: '10px 13px',
            width: '200px',
            backdropFilter: 'blur(16px)',
            transform: 'translateY(-118%)',
            fontFamily: "'Inter', sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#c8d8e4', fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {node.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: plddt2color(plddt) }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'monospace' }}>
                  pLDDT {plddt}
                </span>
              </div>
            </div>
            {node.nodeType && node.nodeType !== 'unknown' && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'rgba(74,127,165,0.7)', fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {node.nodeType}
                </span>
              </div>
            )}
            <p style={{ color: 'rgba(180,200,215,0.45)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 8px' }}>
              {node.summary?.slice(0, 85)}...
            </p>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px' }}>
              <div style={{ width: `${plddt}%`, height: '100%', background: plddt2color(plddt), borderRadius: '1px' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: 'monospace', marginTop: '5px', marginBottom: 0 }}>
              click to inspect
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────
// ENGINEERING GRID — coordinate system
// ─────────────────────────────────────────────
function EngineeringGrid() {
  const lines = useMemo(() => {
    const result: { p: [number,number,number][]; op: number }[] = [];
    const size = 18;
    const step = 1.5;
    for (let i = -size; i <= size; i += step) {
      const isMajor = Math.abs(i % (step * 4)) < 0.01;
      result.push({
        p: [[i, 0, -size], [i, 0, size]],
        op: isMajor ? 0.14 : 0.055,
      });
      result.push({
        p: [[-size, 0, i], [size, 0, i]],
        op: isMajor ? 0.14 : 0.055,
      });
    }
    return result;
  }, []);

  return (
    <group position={[0, -3.8, 0]}>
      {lines.map((l, i) => (
        <Line
          key={i}
          points={l.p.map(p => new THREE.Vector3(...p))}
          color="#3a5060"
          lineWidth={0.3}
          transparent
          opacity={l.op}
        />
      ))}
      {/* Axis indicators */}
      <Line points={[new THREE.Vector3(-8,0,0), new THREE.Vector3(8,0,0)]} color="#4A7FA5" lineWidth={0.6} transparent opacity={0.22} />
      <Line points={[new THREE.Vector3(0,0,-8), new THREE.Vector3(0,0,8)]} color="#5A8F7B" lineWidth={0.6} transparent opacity={0.22} />
    </group>
  );
}

// ─────────────────────────────────────────────
// PATHWAY EDGE
// ─────────────────────────────────────────────
function PathEdge({ start, end, isActive, color }: {
  start: [number,number,number];
  end: [number,number,number];
  isActive: boolean;
  color: string;
}) {
  const dotRef = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  const sv = new THREE.Vector3(...start);
  const ev = new THREE.Vector3(...end);
  const mid = sv.clone().lerp(ev, 0.5).add(new THREE.Vector3(0, 0.5, 0));

  useFrame((_, delta) => {
    progress.current = (progress.current + delta * 0.22) % 1;
    if (dotRef.current) {
      const t = progress.current;
      const pos = new THREE.Vector3()
        .addScaledVector(sv, (1 - t) * (1 - t))
        .addScaledVector(mid, 2 * (1 - t) * t)
        .addScaledVector(ev, t * t);
      dotRef.current.position.copy(pos);
      dotRef.current.visible = isActive;
    }
  });

  return (
    <group>
      <Line
        points={[sv, ev]}
        color={isActive ? color : '#1e2d38'}
        lineWidth={isActive ? 1.0 : 0.4}
        transparent
        opacity={isActive ? 0.75 : 0.22}
      />
      <mesh ref={dotRef} visible={false}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  onNodeClick: (n: PathwayNode) => void;
  selectedNodeId: string | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [userInteracting, setUserInteracting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onStart = useCallback(() => {
    setUserInteracting(true);
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onEnd = useCallback(() => {
    timer.current = setTimeout(() => setUserInteracting(false), 3500);
  }, []);

  const connectionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    nodes.forEach(n => { c[n.id] = 0; });
    edges.forEach(e => { if (c[e.start] !== undefined) c[e.start]++; if (c[e.end] !== undefined) c[e.end]++; });
    return c;
  }, [nodes, edges]);

  const edgeData = useMemo(() =>
    edges.map(edge => {
      const s = nodes.find(n => n.id === edge.start);
      const e = nodes.find(n => n.id === edge.end);
      if (!s || !e) return null;
      const isActive = hoveredId === edge.start || hoveredId === edge.end ||
        selectedNodeId === edge.start || selectedNodeId === edge.end;
      return { key: `${edge.start}-${edge.end}`, s, e, isActive, color: getNodeColor(s) };
    }).filter(Boolean),
    [edges, nodes, hoveredId, selectedNodeId]
  );

  return (
    <>
      {/* Scientific workstation lighting — cold, directional, minimal */}
      <ambientLight intensity={0.12} color="#b0c8d8" />
      <directionalLight position={[8, 12, 6]} intensity={0.7} color="#ddeeff" />
      <directionalLight position={[-6, -4, -8]} intensity={0.1} color="#223344" />
      <pointLight position={[0, 8, 0]} intensity={0.2} color="#aac0d0" distance={30} />
      <hemisphereLight args={['#1a2a38', '#080c10', 0.3]} />

      <fog attach="fog" args={['#0a1018', 24, 55]} />

      <OrbitControls
        enableZoom autoRotate={!userInteracting}
        autoRotateSpeed={0.15}
        zoomSpeed={0.5} minDistance={5} maxDistance={26}
        enablePan={false}
        onStart={onStart} onEnd={onEnd}
      />

      <EngineeringGrid />

      {edgeData.map((ed: any) => (
        <PathEdge key={ed.key} start={ed.s.position} end={ed.e.position} isActive={ed.isActive} color={ed.color} />
      ))}

      {nodes.map(node => (
        <ScientificGlyph
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

// ─────────────────────────────────────────────
// DEFAULT EDGES
// ─────────────────────────────────────────────
const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa', end: 'hmg_coa', relationshipType: 'converts', direction: 'forward' },
  { start: 'acetyl_coa', end: 'mevalonate', relationshipType: 'produces', direction: 'forward' },
  { start: 'hmg_coa', end: 'mevalonate', relationshipType: 'converts', direction: 'forward' },
  { start: 'mevalonate', end: 'fpp', relationshipType: 'produces', direction: 'forward' },
  { start: 'fpp', end: 'amorpha_4_11_diene', relationshipType: 'catalyzes', direction: 'forward' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid', relationshipType: 'converts', direction: 'forward' },
  { start: 'artemisinic_acid', end: 'artemisinin', relationshipType: 'produces', direction: 'forward' },
];

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
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
      width: '100%', height: '580px',
      background: 'linear-gradient(180deg, #090e14 0%, #0b1219 50%, #0d1520 100%)',
      borderRadius: '12px', overflow: 'hidden',
      border: '1px solid rgba(58,80,96,0.35)',
      position: 'relative',
      boxShadow: 'inset 0 1px 0 rgba(74,127,165,0.08)',
    }}>

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(to bottom, rgba(9,14,20,0.98), transparent)',
        borderBottom: '1px solid rgba(58,80,96,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(74,127,165,0.5)' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(90,143,123,0.4)' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(122,110,154,0.4)' }} />
          </div>
          <span style={{ color: 'rgba(140,170,190,0.35)', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.07em' }}>
            METABOLIC · {nodes.length} ENTITIES · PROCEDURAL RECONSTRUCTION
          </span>
        </div>
        {edges && (
          <span style={{ color: 'rgba(74,127,165,0.55)', fontSize: '9px', fontFamily: 'monospace', padding: '2px 7px', border: '1px solid rgba(74,127,165,0.15)', borderRadius: '3px', letterSpacing: '0.05em' }}>
            AI GENERATED
          </span>
        )}
      </div>

      {/* pLDDT legend */}
      <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 10 }}>
        <p style={{ color: 'rgba(140,170,190,0.2)', fontSize: '8px', fontFamily: 'monospace', margin: '0 0 5px', letterSpacing: '0.07em' }}>
          pLDDT CONFIDENCE
        </p>
        {[
          { c: '#4A7FA5', l: '>90', d: 'Very high' },
          { c: '#5A8F7B', l: '70–90', d: 'Confident' },
          { c: '#8F8A6A', l: '50–70', d: 'Medium' },
          { c: '#8F6E5A', l: '<50', d: 'Low' },
        ].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '18px', height: '2px', background: x.c, borderRadius: '1px', opacity: 0.7 }} />
            <span style={{ color: 'rgba(140,170,190,0.22)', fontSize: '8px', fontFamily: 'monospace' }}>{x.l}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 10 }}>
        <span style={{ color: 'rgba(140,170,190,0.15)', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          drag · scroll · click
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 3, 13], fov: 46 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
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
