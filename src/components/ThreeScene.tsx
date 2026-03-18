import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode } from '../types';

interface NodeProps {
  node: PathwayNode;
  onClick: (node: PathwayNode) => void;
  isHovered: boolean;
  setHovered: (id: string | null) => void;
}

function PathwaySphere({ node, onClick, isHovered, setHovered }: NodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 2 + node.position[0]) * 0.1;
    }
  });

  return (
    <group position={node.position}>
      <Sphere
        ref={meshRef}
        args={[0.4, 32, 32]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(node.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isHovered ? 0.8 : 0.2}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.25}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
      {isHovered && (
        <Text
          position={[0, 0.7, 0]}
          fontSize={0.15}
          color="#a1a1aa"
          anchorX="center"
          anchorY="middle"
          maxWidth={2}
          textAlign="center"
        >
          Click for details
        </Text>
      )}
    </group>
  );
}

interface ThreeSceneProps {
  nodes: PathwayNode[];
  onNodeClick: (node: PathwayNode) => void;
}

export default function ThreeScene({ nodes, onNodeClick }: ThreeSceneProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Define edges based on the pathway logic
  const edges = [
    { start: 'glucose', end: 'pyruvate' },
    { start: 'pyruvate', end: 'lactic_acid' },
    { start: 'pyruvate', end: 'ethanol' },
    { start: 'pyruvate', end: 'propionic_acid' },
    { start: 'ethanol', end: 'acetic_acid' },
  ];

  return (
    <div className="w-full h-[500px] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative">
      <div className="absolute top-4 left-4 z-10 text-zinc-400 font-mono text-xs">
        Interactive Metabolic Pathway (交互式代谢途径)
      </div>
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        
        {edges.map((edge, i) => {
          const startNode = nodes.find(n => n.id === edge.start);
          const endNode = nodes.find(n => n.id === edge.end);
          if (!startNode || !endNode) return null;
          return (
            <Line
              key={i}
              points={[startNode.position, endNode.position]}
              color="#52525b"
              lineWidth={2}
              dashed={false}
            />
          );
        })}

        {nodes.map((node) => (
          <PathwaySphere
            key={node.id}
            node={node}
            onClick={onNodeClick}
            isHovered={hoveredNode === node.id}
            setHovered={setHoveredNode}
          />
        ))}
      </Canvas>
    </div>
  );
}
