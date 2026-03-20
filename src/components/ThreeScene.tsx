import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge, MolecularStructure, RenderStyle } from '../types';

type Vec3 = [number, number, number];

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

const NODE_CONFIDENCE: Record<string, number> = {
  acetyl_coa: 85,
  hmg_coa: 72,
  mevalonate: 68,
  fpp: 91,
  amorpha_4_11_diene: 88,
  artemisinic_acid: 76,
  artemisinin: 93,
};

const SCIENTIFIC_PALETTE = [
  '#4A7FA5',
  '#5A8F7B',
  '#7A6E9A',
  '#8F7A5A',
  '#5A7A8F',
  '#6E8F7A',
  '#8F6E7A',
  '#7A8F6E',
];

function plddt2color(p: number): string {
  if (p >= 90) return '#4A7FA5';
  if (p >= 70) return '#5A8F7B';
  if (p >= 50) return '#8F8A6A';
  return '#8F6E5A';
}

function getNodeColor(node: PathwayNode): string {
  const confidence = NODE_CONFIDENCE[node.id];
  if (confidence !== undefined) return plddt2color(confidence);
  return SCIENTIFIC_PALETTE[hash(node.id) % SCIENTIFIC_PALETTE.length];
}

function getDisplayLabel(node: PathwayNode) {
  return node.canonicalLabel?.trim() || node.label;
}

function getConfidenceScore(node: PathwayNode) {
  return node.confidenceScore ?? (NODE_CONFIDENCE[node.id] !== undefined ? NODE_CONFIDENCE[node.id] / 100 : 0.75);
}

function elementKey(element: string) {
  return element.trim().toUpperCase();
}

const ELEMENT_COLOR: Record<string, string> = {
  H: '#D6DEE7',
  C: '#627180',
  N: '#4A7FA5',
  O: '#8F6E5A',
  P: '#8F8A6A',
  S: '#5A8F7B',
  F: '#7A8F6E',
  CL: '#6E8F7A',
  BR: '#8F7A5A',
  I: '#7A6E9A',
  B: '#8A9BA8',
  SI: '#8A8F95',
  DEFAULT: '#8E9AA5',
};

const ELEMENT_RADIUS: Record<string, number> = {
  H: 0.10,
  C: 0.18,
  N: 0.17,
  O: 0.16,
  P: 0.20,
  S: 0.21,
  F: 0.15,
  CL: 0.17,
  BR: 0.18,
  I: 0.19,
  B: 0.16,
  SI: 0.20,
  DEFAULT: 0.18,
};

function elementColor(element: string) {
  const key = elementKey(element);
  return ELEMENT_COLOR[key] || ELEMENT_COLOR.DEFAULT;
}

function elementRadius(element: string) {
  const key = elementKey(element);
  return ELEMENT_RADIUS[key] || ELEMENT_RADIUS.DEFAULT;
}

function normalizeStructure(structure: MolecularStructure) {
  if (!structure.atoms?.length) return null;

  const positions = structure.atoms.map((a) => new THREE.Vector3(...a.position));
  const center = positions.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / positions.length);
  const shifted = positions.map((p) => p.clone().sub(center));

  const maxDist = Math.max(0.001, ...shifted.map((p) => p.length()));
  const scale = 0.42 / maxDist;

  const atoms = structure.atoms.map((atom, index) => ({
    ...atom,
    position: shifted[index].multiplyScalar(scale).toArray() as Vec3,
  }));

  return { atoms, bonds: structure.bonds ?? [], scale, optimized: structure.optimized ?? false };
}

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
  const geoms: GlyphConfig['coreGeom'][] = ['octahedron', 'dodecahedron', 'tetrahedron', 'icosahedron', 'sphere', 'torus'];
  const geomIdx = hashInt(nodeId, 0, 0, geoms.length - 1);
  const ringCount = hashInt(nodeId, 1, 1, 3);
  const ringRadii = Array.from({ length: ringCount }, (_, i) => hashFloat(nodeId, 10 + i, 0.45, 0.85));
  const ringTilts = Array.from({ length: ringCount }, (_, i) => hashFloat(nodeId, 20 + i, 0, Math.PI));
  const ringSpeeds = Array.from({ length: ringCount }, (_, i) => hashFloat(nodeId, 30 + i, 0.12, 0.45) * (i % 2 === 0 ? 1 : -1));

  return {
    coreGeom: geoms[geomIdx],
    coreScale: 0.24 + connectionCount * 0.045 + hashFloat(nodeId, 2, 0, 0.05),
    ringCount,
    ringRadii,
    ringTilts,
    satelliteCount: hashInt(nodeId, 3, 2, 5),
    satelliteRadius: hashFloat(nodeId, 4, 0.55, 0.95),
    satelliteSize: hashFloat(nodeId, 5, 0.04, 0.07),
    spinSpeed: hashFloat(nodeId, 6, 0.06, 0.16),
    ringSpeeds,
    hasInnerCore: hash(nodeId) % 3 === 0,
  };
}

function CoreGeometry({ geom, scale }: { geom: GlyphConfig['coreGeom']; scale: number }) {
  switch (geom) {
    case 'octahedron':
      return <octahedronGeometry args={[scale, 0]} />;
    case 'dodecahedron':
      return <dodecahedronGeometry args={[scale, 0]} />;
    case 'tetrahedron':
      return <tetrahedronGeometry args={[scale, 0]} />;
    case 'icosahedron':
      return <icosahedronGeometry args={[scale, 1]} />;
    case 'torus':
      return <torusGeometry args={[scale * 0.8, scale * 0.32, 8, 20]} />;
    default:
      return <sphereGeometry args={[scale, 14, 14]} />;
  }
}

function AtomMesh({
  position,
  element,
  radiusScale = 1,
  isHovered,
  isSelected,
}: {
  position: Vec3;
  element: string;
  radiusScale?: number;
  isHovered: boolean;
  isSelected: boolean;
}) {
  const color = elementColor(element);
  const radius = elementRadius(element) * radiusScale;

  return (
    <mesh position={position} castShadow receiveShadow>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={isSelected ? '#f6f8fb' : color}
        emissive={color}
        emissiveIntensity={isSelected ? 0.18 : isHovered ? 0.10 : 0.04}
        roughness={0.34}
        metalness={0.14}
      />
    </mesh>
  );
}

function BondMesh({
  start,
  end,
  color,
  visible = true,
  thickness = 0.028,
}: {
  start: Vec3;
  end: Vec3;
  color: string;
  visible?: boolean;
  thickness?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const data = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const dir = new THREE.Vector3().subVectors(e, s);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);

    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    return { mid, len, q };
  }, [start, end]);

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={data.mid} quaternion={data.q} castShadow receiveShadow>
      <cylinderGeometry args={[thickness, thickness, data.len, 10, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.36}
        metalness={0.20}
      />
    </mesh>
  );
}

function MolecularNode({
  node,
  isHovered,
  isSelected,
  connectionCount,
  onClick,
  onHover,
}: {
  node: PathwayNode;
  isHovered: boolean;
  isSelected: boolean;
  connectionCount: number;
  onClick: (n: PathwayNode) => void;
  onHover: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);

  const color = getNodeColor(node);
  const confidence = getConfidenceScore(node);
  const displayLabel = getDisplayLabel(node);
  const normalized = useMemo(() => (node.structure3D ? normalizeStructure(node.structure3D) : null), [node.structure3D]);
  const renderStyle: RenderStyle = node.renderStyle ?? (normalized ? 'ball-stick' : 'sphere');

  const cfg = useMemo(() => buildGlyphConfig(node.id, connectionCount), [node.id, connectionCount]);

  const targetScale = isSelected ? 1.34 : isHovered ? 1.14 : 1.0;

  const structureAtoms = normalized?.atoms ?? [];
  const structureBonds = normalized?.bonds ?? [];

  const bondColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#dce5ee'), 0.22).getStyle(), [color]);
  const shellColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#eef3f8'), 0.18).getStyle(), [color]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      const current = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(current + (targetScale - current) * delta * 7);
      groupRef.current.rotation.x = Math.sin(t * 0.06 + hash(node.id) * 0.001) * 0.04;
      groupRef.current.rotation.y = Math.sin(t * 0.08 + hash(node.id) * 0.002) * 0.06;
    }

    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += ((isSelected ? 0.18 : isHovered ? 0.10 : 0.04) - mat.emissiveIntensity) * delta * 5;
      bodyRef.current.rotation.y += delta * cfg.spinSpeed;
      bodyRef.current.rotation.x += delta * cfg.spinSpeed * 0.35;
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = isSelected ? 0.10 : isHovered ? 0.07 : 0.025;
      mat.opacity += (targetOp - mat.opacity) * delta * 4;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.16;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      const targetOp = isHovered || isSelected ? 0.44 : 0.14;
      mat.opacity += (targetOp - mat.opacity) * delta * 4;
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.y = t * 0.14 + cfg.spinSpeed * 3.2;
      orbitRef.current.rotation.x = 0.24 + Math.sin(t * 0.42 + cfg.spinSpeed * 10) * 0.05;
    }
  });

  const fallbackGlyph = (
    <>
      {cfg.ringRadii.map((r, i) => (
        <mesh
          key={`ring-${i}`}
          ref={i === 0 ? ringRef : undefined}
          rotation={[cfg.ringTilts[i] || 0, 0, i * 1.1]}
        >
          <torusGeometry args={[r, 0.012, 6, 48]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.12}
            transparent
            opacity={0.16}
            roughness={0.54}
            metalness={0.20}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group ref={orbitRef}>
        {Array.from({ length: cfg.satelliteCount }).map((_, i) => {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / cfg.satelliteCount);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          return (
            <mesh
              key={`sat-${i}`}
              position={[
                Math.sin(phi) * Math.cos(theta) * cfg.satelliteRadius,
                Math.sin(phi) * Math.sin(theta) * cfg.satelliteRadius,
                Math.cos(phi) * cfg.satelliteRadius,
              ]}
            >
              <sphereGeometry args={[cfg.satelliteSize, 8, 8]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.12}
                transparent
                opacity={0.36}
                roughness={0.44}
                metalness={0.18}
              />
            </mesh>
          );
        })}
      </group>

      {cfg.hasInnerCore && (
        <mesh>
          <octahedronGeometry args={[cfg.coreScale * 0.38, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.22}
            roughness={0.24}
            metalness={0.44}
            transparent
            opacity={0.74}
          />
        </mesh>
      )}

      <mesh ref={bodyRef}>
        <CoreGeometry geom={cfg.coreGeom} scale={cfg.coreScale} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.05}
          roughness={0.42}
          metalness={0.56}
        />
      </mesh>

      <mesh>
        <CoreGeometry geom={cfg.coreGeom} scale={cfg.coreScale * 1.04} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isHovered || isSelected ? 0.11 : 0.04}
          wireframe
          depthWrite={false}
        />
      </mesh>
    </>
  );

  const structureGlyph = (
    <>
      <mesh ref={glowRef} position={[0, 0, -0.03]}>
        <sphereGeometry args={[0.9, 22, 22]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.02}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {renderStyle !== 'stick' && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <torusGeometry args={[0.78, 0.018, 8, 48]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            transparent
            opacity={0.14}
            roughness={0.24}
            metalness={0.10}
            depthWrite={false}
          />
        </mesh>
      )}

      {structureBonds.map((bond, i) => {
        const startAtom = structureAtoms[bond.from];
        const endAtom = structureAtoms[bond.to];
        if (!startAtom || !endAtom) return null;

        const thickness = renderStyle === 'stick' ? 0.022 : 0.028;
        return (
          <BondMesh
            key={`bond-${i}`}
            start={startAtom.position}
            end={endAtom.position}
            color={bondColor}
            visible={renderStyle !== 'sphere'}
            thickness={thickness}
          />
        );
      })}

      {structureAtoms.map((atom, i) => (
        <AtomMesh
          key={`atom-${i}`}
          position={atom.position}
          element={atom.element}
          radiusScale={renderStyle === 'sphere' ? 1.55 : renderStyle === 'stick' ? 0.62 : 1.0}
          isHovered={isHovered}
          isSelected={isSelected}
        />
      ))}

      {renderStyle === 'surface' && (
        <mesh ref={bodyRef}>
          <sphereGeometry args={[0.82, 24, 24]} />
          <meshStandardMaterial
            color={shellColor}
            emissive={color}
            emissiveIntensity={0.06}
            transparent
            opacity={0.18}
            roughness={0.22}
            metalness={0.16}
          />
        </mesh>
      )}
    </>
  );

  return (
    <group
      ref={groupRef}
      position={node.position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(node.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = 'auto';
      }}
    >
      {normalized ? structureGlyph : fallbackGlyph}

      <Html position={[0, -(cfg.coreScale + 0.48), 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div
          style={{
            color: isHovered || isSelected ? '#d6e0e8' : '#627381',
            fontSize: '10px',
            fontWeight: isSelected ? 600 : 400,
            fontFamily: "'Inter', 'SF Mono', monospace",
            letterSpacing: '0.025em',
            textShadow: '0 1px 8px rgba(0,0,0,1)',
            whiteSpace: 'nowrap',
            padding: '2px 6px',
            background: isSelected ? 'rgba(74,127,165,0.10)' : 'transparent',
            borderRadius: '3px',
            border: isSelected ? '1px solid rgba(74,127,165,0.22)' : '1px solid transparent',
          }}
        >
          {displayLabel}
        </div>
      </Html>

      {isHovered && !isSelected && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div
            style={{
              background: 'rgba(8,12,18,0.97)',
              border: '1px solid rgba(74,127,165,0.18)',
              borderRadius: '8px',
              padding: '10px 13px',
              width: '206px',
              backdropFilter: 'blur(16px)',
              transform: 'translateY(-118%)',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#c8d8e4', fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {displayLabel}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: plddt2color(confidence * 100) }} />
                <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '9px', fontFamily: 'monospace' }}>
                  conf {Math.round(confidence * 100)}
                </span>
              </div>
            </div>

            {node.nodeType && node.nodeType !== 'unknown' && (
              <div style={{ marginBottom: '6px' }}>
                <span
                  style={{
                    color: 'rgba(74,127,165,0.75)',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {node.nodeType}
                </span>
              </div>
            )}

            <p style={{ color: 'rgba(180,200,215,0.45)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 8px' }}>
              {node.summary?.slice(0, 85)}...
            </p>

            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px' }}>
              <div
                style={{
                  width: `${Math.round(confidence * 100)}%`,
                  height: '100%',
                  background: plddt2color(confidence * 100),
                  borderRadius: '1px',
                }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function EngineeringGrid() {
  const lines = useMemo(() => {
    const result: { p: [number, number, number][]; op: number }[] = [];
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
      <gridHelper args={[36, 36, '#32414d', '#1d2630']} position={[0, 0, 0]} />
      {lines.map((l, i) => (
        <Line
          key={i}
          points={l.p.map((p) => new THREE.Vector3(...p))}
          color="#3a5060"
          lineWidth={0.3}
          transparent
          opacity={l.op}
        />
      ))}
      <Line points={[new THREE.Vector3(-8, 0, 0), new THREE.Vector3(8, 0, 0)]} color="#4A7FA5" lineWidth={0.6} transparent opacity={0.22} />
      <Line points={[new THREE.Vector3(0, 0, -8), new THREE.Vector3(0, 0, 8)]} color="#5A8F7B" lineWidth={0.6} transparent opacity={0.22} />
    </group>
  );
}

function PathEdge({
  start,
  end,
  isActive,
  color,
}: {
  start: Vec3;
  end: Vec3;
  isActive: boolean;
  color: string;
}) {
  const dotRef = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  const sv = useMemo(() => new THREE.Vector3(...start), [start]);
  const ev = useMemo(() => new THREE.Vector3(...end), [end]);
  const mid = useMemo(() => sv.clone().lerp(ev, 0.5).add(new THREE.Vector3(0, 0.52, 0)), [sv, ev]);

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
        points={[sv, mid, ev]}
        color={isActive ? color : '#1e2d38'}
        lineWidth={isActive ? 1.0 : 0.4}
        transparent
        opacity={isActive ? 0.76 : 0.22}
      />
      <mesh ref={dotRef} visible={false}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Scene({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
}: {
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

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const connectionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    nodes.forEach((n) => {
      c[n.id] = 0;
    });
    edges.forEach((e) => {
      if (c[e.start] !== undefined) c[e.start]++;
      if (c[e.end] !== undefined) c[e.end]++;
    });
    return c;
  }, [nodes, edges]);

  const edgeData = useMemo(
    () =>
      edges
        .map((edge) => {
          const s = nodes.find((n) => n.id === edge.start);
          const e = nodes.find((n) => n.id === edge.end);
          if (!s || !e) return null;
          const isActive =
            hoveredId === edge.start ||
            hoveredId === edge.end ||
            selectedNodeId === edge.start ||
            selectedNodeId === edge.end;

          return {
            key: `${edge.start}-${edge.end}`,
            s,
            e,
            isActive,
            color: getNodeColor(s),
          };
        })
        .filter(Boolean) as {
        key: string;
        s: PathwayNode;
        e: PathwayNode;
        isActive: boolean;
        color: string;
      }[],
    [edges, nodes, hoveredId, selectedNodeId],
  );

  return (
    <>
      <ambientLight intensity={0.12} color="#b0c8d8" />
      <directionalLight position={[8, 12, 6]} intensity={0.7} color="#ddeeff" />
      <directionalLight position={[-6, -4, -8]} intensity={0.1} color="#223344" />
      <pointLight position={[0, 8, 0]} intensity={0.2} color="#aac0d0" distance={30} />
      <hemisphereLight args={['#1a2a38', '#080c10', 0.3]} />

      <fog attach="fog" args={['#0a1018', 24, 55]} />

      <OrbitControls
        enableZoom
        autoRotate={!userInteracting && !hoveredId && !selectedNodeId}
        autoRotateSpeed={0.15}
        zoomSpeed={0.5}
        minDistance={5}
        maxDistance={26}
        enablePan={false}
        onStart={onStart}
        onEnd={onEnd}
      />

      <EngineeringGrid />

      {edgeData.map((ed) => (
        <PathEdge
          key={ed.key}
          start={ed.s.position}
          end={ed.e.position}
          isActive={ed.isActive}
          color={ed.color}
        />
      ))}

      {nodes.map((node) => (
        <MolecularNode
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
    <div
      style={{
        width: '100%',
        height: '580px',
        background: 'linear-gradient(180deg, #090e14 0%, #0b1219 50%, #0d1520 100%)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(58,80,96,0.35)',
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(74,127,165,0.08)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'linear-gradient(to bottom, rgba(9,14,20,0.98), transparent)',
          borderBottom: '1px solid rgba(58,80,96,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(74,127,165,0.5)' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(90,143,123,0.4)' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(122,110,154,0.4)' }} />
          </div>
          <span
            style={{
              color: 'rgba(140,170,190,0.35)',
              fontSize: '10px',
              fontFamily: 'monospace',
              letterSpacing: '0.07em',
            }}
          >
            METABOLIC · {nodes.length} ENTITIES · PROCEDURAL + STRUCTURAL RENDERING
          </span>
        </div>

        {edges && (
          <span
            style={{
              color: 'rgba(74,127,165,0.55)',
              fontSize: '9px',
              fontFamily: 'monospace',
              padding: '2px 7px',
              border: '1px solid rgba(74,127,165,0.15)',
              borderRadius: '3px',
              letterSpacing: '0.05em',
            }}
          >
            AI GENERATED
          </span>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 10 }}>
        <p
          style={{
            color: 'rgba(140,170,190,0.2)',
            fontSize: '8px',
            fontFamily: 'monospace',
            margin: '0 0 5px',
            letterSpacing: '0.07em',
          }}
        >
          CONFIDENCE
        </p>
        {[
          { c: '#4A7FA5', l: '>90' },
          { c: '#5A8F7B', l: '70–90' },
          { c: '#8F8A6A', l: '50–70' },
          { c: '#8F6E5A', l: '<50' },
        ].map((x) => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '18px', height: '2px', background: x.c, borderRadius: '1px', opacity: 0.7 }} />
            <span style={{ color: 'rgba(140,170,190,0.22)', fontSize: '8px', fontFamily: 'monospace' }}>{x.l}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 10 }}>
        <span
          style={{
            color: 'rgba(140,170,190,0.15)',
            fontSize: '9px',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
        >
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
