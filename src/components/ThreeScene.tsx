import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode } from '../types';

// ── Hover info card (HTML overlay) ──
function NodeCard({ node, visible }: { node: PathwayNode; visible: boolean }) {
  if (!visible) return null;

  return (
    <Html distanceFactor={8} center style={{ pointerEvents: 'none', zIndex: 100 }}>
      <div
        style={{
          background: 'rgba(10,10,10,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '12px 14px',
          width: '200px',
          backdropFilter: 'blur(12px)',
          transform: 'translateY(-110%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: node.color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${node.color}`,
            }}
          />
          <span
            style={{
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {node.label}
          </span>
        </div>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {node.summary?.slice(0, 100)}
          {node.summary?.length > 100 ? '...' : ''}
        </p>
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: '10px',
              fontFamily: 'monospace',
            }}
          >
            Click for full details
          </span>
        </div>
      </div>
    </Html>
  );
}

// ── Single network node ──
interface NetworkNodeProps {
  node: PathwayNode;
  isHovered: boolean;
  isSelected: boolean;
  connectionCount: number;
  onClick: (node: PathwayNode) => void;
  onHover: (id: string | null) => void;
}

function NetworkNode({
  node,
  isHovered,
  isSelected,
  connectionCount,
  onClick,
  onHover,
}: NetworkNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const baseSize = 0.28 + connectionCount * 0.08;
  const targetScale = isHovered || isSelected ? 1.25 : 1;

  useFrame((_, delta) => {
    if (meshRef.current) {
      const s = meshRef.current.scale.x;
      meshRef.current.scale.setScalar(s + (targetScale - s) * delta * 8);
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (isSelected ? 1.5 : 0.6);
      const targetOpacity = isHovered || isSelected ? 0.8 : 0;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * delta * 6;
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      const targetOpacity = isHovered || isSelected ? 0.18 : 0.04;
      mat.opacity += (targetOpacity - mat.opacity) * delta * 6;
    }
  });

  return (
    <group position={node.position}>
      <mesh ref={glowRef}>
        <circleGeometry args={[baseSize * 2.2, 32]} />
        <meshStandardMaterial color={node.color} transparent opacity={0.04} depthWrite={false} />
      </mesh>

      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[baseSize * 1.35, baseSize * 1.5, 48]} />
        <meshStandardMaterial color={node.color} transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
      >
        <circleGeometry args={[baseSize, 48]} />
        <meshStandardMaterial
          color={isSelected ? '#ffffff' : node.color}
          emissive={node.color}
          emissiveIntensity={isHovered ? 0.6 : isSelected ? 0.8 : 0.15}
        />
      </mesh>

      <mesh position={[baseSize * 0.25, baseSize * 0.25, 0.01]}>
        <circleGeometry args={[baseSize * 0.18, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>

      <Html
        position={[0, -(baseSize + 0.32), 0]}
        center
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        <div
          style={{
            color: isHovered || isSelected ? '#ffffff' : 'rgba(255,255,255,0.65)',
            fontSize: '11px',
            fontWeight: isSelected ? 700 : 500,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '-0.01em',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            transition: 'color 0.2s',
            padding: '2px 6px',
            background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
            borderRadius: '4px',
          }}
        >
          {node.label}
        </div>
      </Html>

      <NodeCard node={node} visible={isHovered && !isSelected} />
    </group>
  );
}

// ── Animated directed edge ──
interface EdgeProps {
  startPos: [number, number, number];
  endPos: [number, number, number];
  color: string;
  isHighlighted: boolean;
}

function AnimatedEdge({ startPos, endPos, color, isHighlighted }: EdgeProps) {
  const particleRef = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  const start = useMemo(() => new THREE.Vector3(...startPos), [startPos]);
  const end = useMemo(() => new THREE.Vector3(...endPos), [endPos]);
  const temp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    progress.current = (progress.current + delta * 0.5) % 1;

    if (particleRef.current) {
      temp.lerpVectors(start, end, progress.current);
      particleRef.current.position.copy(temp);

      const mat = particleRef.current.material as THREE.MeshStandardMaterial;
      const targetOpacity = isHighlighted ? 1 : 0.3;
      mat.opacity += (targetOpacity - mat.opacity) * delta * 5;
    }
  });

  return (
    <group>
      <Line
        points={[start, end]}
        color={isHighlighted ? color : '#404040'}
        lineWidth={isHighlighted ? 1.5 : 0.8}
        transparent
        opacity={isHighlighted ? 0.7 : 0.2}
        dashed={false}
      />
      <mesh ref={particleRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

// ── Main scene ──
interface SceneProps {
  nodes: PathwayNode[];
  edges: { start: string; end: string }[];
  onNodeClick: (node: PathwayNode) => void;
  selectedNodeId: string | null;
}

function Scene({ nodes, edges, onNodeClick, selectedNodeId }: SceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.cursor = hoveredId ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hoveredId]);

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((n) => {
      counts[n.id] = 0;
    });
    edges.forEach((e) => {
      if (counts[e.start] !== undefined) counts[e.start]++;
      if (counts[e.end] !== undefined) counts[e.end]++;
    });
    return counts;
  }, [nodes, edges]);

  const nodeMap = useMemo(() => {
    const map: Record<string, PathwayNode> = {};
    nodes.forEach((node) => {
      map[node.id] = node;
    });
    return map;
  }, [nodes]);

  const edgeData = useMemo(() => {
    return edges
      .map((edge) => {
        const s = nodeMap[edge.start];
        const e = nodeMap[edge.end];
        if (!s || !e) return null;

        const isHighlighted =
          hoveredId === edge.start ||
          hoveredId === edge.end ||
          selectedNodeId === edge.start ||
          selectedNodeId === edge.end;

        return {
          key: `${edge.start}-${edge.end}`,
          startPos: s.position,
          endPos: e.position,
          color: s.color,
          isHighlighted,
        };
      })
      .filter(Boolean) as {
      key: string;
      startPos: [number, number, number];
      endPos: [number, number, number];
      color: string;
      isHighlighted: boolean;
    }[];
  }, [edges, nodeMap, hoveredId, selectedNodeId]);

  const shouldAutoRotate = !hoveredId && !selectedNodeId;

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} intensity={0.4} color="#6495ED" />

      <OrbitControls
        enableZoom
        zoomSpeed={0.5}
        autoRotate={shouldAutoRotate}
        autoRotateSpeed={0.2}
        minDistance={3}
        maxDistance={18}
        enablePan={false}
      />

      {edgeData.map((e) => (
        <AnimatedEdge key={e.key} {...e} />
      ))}

      {nodes.map((node) => (
        <NetworkNode
          key={node.id}
          node={node}
          isHovered={hoveredId === node.id}
          isSelected={selectedNodeId === node.id}
          connectionCount={connectionCounts[node.id] || 0}
          onClick={onNodeClick}
          onHover={setHoveredId}
        />
      ))}
    </>
  );
}

// ── Legend ──
function Legend({ nodes }: { nodes: PathwayNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {nodes.slice(0, 5).map((node) => (
        <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: node.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            {node.label}
          </span>
        </div>
      ))}
      {nodes.length > 5 && (
        <span
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        >
          +{nodes.length - 5} more
        </span>
      )}
    </div>
  );
}

// ── Default edges ──
const DEFAULT_EDGES = [
  { start: 'glucose', end: 'pyruvate' },
  { start: 'pyruvate', end: 'lactic_acid' },
  { start: 'pyruvate', end: 'ethanol' },
  { start: 'pyruvate', end: 'propionic_acid' },
  { start: 'ethanol', end: 'acetic_acid' },
];

interface ThreeSceneProps {
  nodes: PathwayNode[];
  onNodeClick: (node: PathwayNode) => void;
  edges?: { start: string; end: string }[];
  selectedNodeId?: string | null;
}

export default function ThreeScene({
  nodes,
  onNodeClick,
  edges,
  selectedNodeId,
}: ThreeSceneProps) {
  const activeEdges = edges ?? DEFAULT_EDGES;
  const hasNodes = nodes.length > 0;

  return (
    <div
      style={{
        width: '100%',
        height: '540px',
        background: '#0d0d0d',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        position: 'relative',
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
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(13,13,13,0.9), transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)',
            }}
          />
          <span
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            Metabolic Network · {nodes.length} nodes · {activeEdges.length} reactions
          </span>
        </div>

        {edges && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(100,149,237,0.1)',
              border: '1px solid rgba(100,149,237,0.2)',
            }}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#6495ED',
              }}
            />
            <span style={{ color: '#6495ED', fontSize: '10px', fontFamily: 'monospace' }}>
              AI Generated
            </span>
          </div>
        )}
      </div>

      <Legend nodes={nodes} />

      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 10,
          color: 'rgba(255,255,255,0.15)',
          fontSize: '10px',
          fontFamily: 'monospace',
        }}
      >
        {hasNodes ? 'Hover to preview · Click for details · Drag to rotate' : 'No pathway nodes available'}
      </div>

      {hasNodes ? (
        <Canvas
          camera={{ position: [0, 0, 9], fov: 50 }}
          gl={{ antialias: true }}
          style={{ background: '#0d0d0d' }}
        >
          <Scene
            nodes={nodes}
            edges={activeEdges}
            onNodeClick={onNodeClick}
            selectedNodeId={selectedNodeId ?? null}
          />
        </Canvas>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.25)',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        >
          Waiting for pathway data...
        </div>
      )}
    </div>
  );
}
