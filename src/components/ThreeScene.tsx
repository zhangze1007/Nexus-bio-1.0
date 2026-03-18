import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode } from '../types';

// Node importance: hub nodes (more connections) = bigger
function getNodeSize(nodeId: string, edges: { start: string; end: string }[]) {
  const connections = edges.filter(e => e.start === nodeId || e.end === nodeId).length;
  return 0.3 + connections * 0.12;
}

interface NodeProps {
  node: PathwayNode;
  size: number;
  onClick: (node: PathwayNode) => void;
  isHovered: boolean;
  isSelected: boolean;
  setHovered: (id: string | null) => void;
}

function PathwayNode3D({ node, size, onClick, isHovered, isSelected, setHovered }: NodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      // Gentle float animation
      meshRef.current.position.y = node.position[1] + Math.sin(t * 1.5 + node.position[0] * 0.5) * 0.08;
      // Slow rotation
      meshRef.current.rotation.y = t * 0.3;
      meshRef.current.rotation.x = t * 0.15;
    }
    if (glowRef.current) {
      glowRef.current.position.y = node.position[1] + Math.sin(t * 1.5 + node.position[0] * 0.5) * 0.08;
      const pulse = 1 + Math.sin(t * 2) * 0.08;
      glowRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current && (isHovered || isSelected)) {
      ringRef.current.position.y = node.position[1] + Math.sin(t * 1.5 + node.position[0] * 0.5) * 0.08;
      ringRef.current.rotation.z = t * 1.2;
      ringRef.current.rotation.x = t * 0.7;
    }
  });

  const color = new THREE.Color(node.color);
  const emissiveIntensity = isSelected ? 1.2 : isHovered ? 0.9 : 0.35;

  return (
    <group position={node.position}>
      {/* Outer glow sphere */}
      <Sphere ref={glowRef} args={[size * 1.8, 16, 16]} position={[0, 0, 0]}>
        <meshStandardMaterial
          color={node.color}
          transparent
          opacity={isHovered || isSelected ? 0.15 : 0.07}
          depthWrite={false}
        />
      </Sphere>

      {/* Spinning ring when hovered/selected */}
      {(isHovered || isSelected) && (
        <mesh ref={ringRef} position={[0, 0, 0]}>
          <torusGeometry args={[size * 1.4, 0.03, 8, 32]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.8} />
        </mesh>
      )}

      {/* Main sphere - AlphaFold style: smooth metallic */}
      <Sphere
        ref={meshRef}
        args={[size, 64, 64]}
        onClick={(e) => { e.stopPropagation(); onClick(node); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(null); document.body.style.cursor = 'auto'; }}
      >
        <meshPhysicalMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.05}
          metalness={0.3}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transmission={0.1}
        />
      </Sphere>

      {/* Label */}
      <Text
        position={[0, -(size + 0.45), 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
        outlineOpacity={0.8}
      >
        {node.label}
      </Text>

      {/* Hover tooltip */}
      {isHovered && !isSelected && (
        <Text
          position={[0, size + 0.5, 0]}
          fontSize={0.14}
          color={node.color}
          anchorX="center"
          anchorY="middle"
        >
          Click for details
        </Text>
      )}
    </group>
  );
}

// Animated directional edge with arrow
interface EdgeProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  isActive: boolean;
}

function AnimatedEdge({ start, end, color, isActive }: EdgeProps) {
  const particleRef = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random());

  useFrame((_, delta) => {
    if (particleRef.current) {
      progress.current = (progress.current + delta * 0.4) % 1;
      const pos = new THREE.Vector3().lerpVectors(start, end, progress.current);
      particleRef.current.position.copy(pos);
    }
  });

  const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const arrowPos = new THREE.Vector3().lerpVectors(start, end, 0.65);

  return (
    <group>
      {/* Main line */}
      <Line
        points={[start, end]}
        color={isActive ? color : '#3f3f46'}
        lineWidth={isActive ? 2 : 1}
        transparent
        opacity={isActive ? 0.8 : 0.35}
      />

      {/* Flowing particle along edge */}
      <mesh ref={particleRef} position={midPoint}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

interface ThreeSceneProps {
  nodes: PathwayNode[];
  onNodeClick: (node: PathwayNode) => void;
  edges?: { start: string; end: string }[];
  selectedNodeId?: string | null;
}

const DEFAULT_EDGES = [
  { start: 'glucose', end: 'pyruvate' },
  { start: 'pyruvate', end: 'lactic_acid' },
  { start: 'pyruvate', end: 'ethanol' },
  { start: 'pyruvate', end: 'propionic_acid' },
  { start: 'ethanol', end: 'acetic_acid' },
];

function Scene({ nodes, onNodeClick, edges, selectedNodeId }: ThreeSceneProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const activeEdges = edges ?? DEFAULT_EDGES;

  const edgeData = useMemo(() => {
    return activeEdges.map(edge => {
      const startNode = nodes.find(n => n.id === edge.start);
      const endNode = nodes.find(n => n.id === edge.end);
      if (!startNode || !endNode) return null;
      const startColor = startNode.color;
      const isActive = hoveredNode === edge.start || hoveredNode === edge.end ||
        selectedNodeId === edge.start || selectedNodeId === edge.end;
      return {
        start: new THREE.Vector3(...startNode.position),
        end: new THREE.Vector3(...endNode.position),
        color: startColor,
        isActive,
        key: `${edge.start}-${edge.end}`,
      };
    }).filter(Boolean);
  }, [activeEdges, nodes, hoveredNode, selectedNodeId]);

  return (
    <>
      {/* AlphaFold-style lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-10, -5, -10]} intensity={0.8} color="#4ade80" />
      <pointLight position={[0, 10, -10]} intensity={0.6} color="#60a5fa" />
      <fog attach="fog" args={['#09090b', 15, 35]} />

      <OrbitControls
        enableZoom={true}
        zoomSpeed={0.5}
        autoRotate
        autoRotateSpeed={0.3}
        minDistance={4}
        maxDistance={20}
      />

      {edgeData.map((edge: any) => (
        <AnimatedEdge key={edge.key} {...edge} />
      ))}

      {nodes.map((node) => (
        <PathwayNode3D
          key={node.id}
          node={node}
          size={getNodeSize(node.id, activeEdges)}
          onClick={onNodeClick}
          isHovered={hoveredNode === node.id}
          isSelected={selectedNodeId === node.id}
          setHovered={setHoveredNode}
        />
      ))}
    </>
  );
}

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: ThreeSceneProps) {
  return (
    <div className="w-full h-[560px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/50 relative shadow-2xl">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-zinc-950/80 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-400 font-mono text-xs">Metabolic Pathway · 3D Interactive</span>
        </div>
        {edges && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <span className="text-emerald-400 font-mono text-xs">AI Generated · {nodes.length} nodes</span>
          </div>
        )}
      </div>

      {/* Node legend */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5">
        {nodes.slice(0, 4).map(node => (
          <div key={node.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
            <span className="text-zinc-500 text-xs font-mono">{node.label}</span>
          </div>
        ))}
        {nodes.length > 4 && (
          <span className="text-zinc-600 text-xs font-mono">+{nodes.length - 4} more</span>
        )}
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 right-4 z-10 text-zinc-600 text-xs font-mono">
        Drag to rotate · Scroll to zoom
      </div>

      <Canvas
        camera={{ position: [0, 2, 10], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#09090b' }}
      >
        <Scene
          nodes={nodes}
          onNodeClick={onNodeClick}
          edges={edges}
          selectedNodeId={selectedNodeId}
        />
      </Canvas>
    </div>
  );
}
