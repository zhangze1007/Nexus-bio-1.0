'use client';
/**
 * Nexus-Bio — FluidSimCanvas
 *
 * Architecture:
 *   Layer 0 (z=0): R3F scene — InstancedMesh metabolite molecules
 *   Layer 1 (z=1): Blueprint grid overlay (SVG)
 *
 * GPU Instancing: 8000 metabolite instances — single draw call
 * Frustum culling: enabled (Three.js default)
 * No gl_PointSize anywhere
 */

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MachineState } from '../../machines/metabolicMachine';

// ─── FluidForce — exported, used by MetabolicEngPage + ToolOverlay ─────────────

export interface FluidForce {
  x: number; y: number; dx: number; dy: number;
  strength?: number;
  color?: [number, number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// R3F scene — InstancedMesh metabolites (8000 instances, single draw call)
// ─────────────────────────────────────────────────────────────────────────────

const MOLECULE_COUNT = 8000;

interface MoleculesProps {
  reactionRate: number;
  stressIndex: number;
  state: MachineState;
}

// State-based tint palettes
const STATE_TINT: Record<MachineState, THREE.Color> = {
  idle:        new THREE.Color('#1a3040'),
  simulating:  new THREE.Color('#0a4055'),
  stress_test: new THREE.Color('#4a1010'),
  equilibrium: new THREE.Color('#0a4030'),
};

function MetaboliteMolecules({ reactionRate, stressIndex, state }: MoleculesProps) {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const dummy    = useMemo(() => new THREE.Object3D(), []);

  // Deterministic seed positions — golden angle sphere distribution
  const seeds = useMemo(() => {
    const pos: [number,number,number][] = [];
    const vel: [number,number,number][] = [];
    for (let i=0; i<MOLECULE_COUNT; i++) {
      const theta = Math.acos(1 - 2*(i+0.5)/MOLECULE_COUNT);
      const phi   = Math.PI * (1 + Math.sqrt(5)) * i;
      const r     = 4 + Math.random() * 9;
      pos.push([r*Math.sin(theta)*Math.cos(phi), r*Math.sin(theta)*Math.sin(phi), r*Math.cos(theta)]);
      const spd = 0.008 + Math.random() * 0.012;
      const va = Math.random()*Math.PI*2;
      vel.push([Math.cos(va)*spd, (Math.random()-0.5)*spd, Math.sin(va)*spd]);
    }
    return { pos, vel };
  }, []);

  const positions   = useMemo(() => seeds.pos.map(p => [...p] as [number,number,number]), [seeds]);
  const colorArr    = useMemo(() => new Float32Array(MOLECULE_COUNT * 3), []);

  useFrame((state3f) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t   = state3f.clock.elapsedTime;
    const spd = 0.6 + reactionRate * 0.08;
    const tint = STATE_TINT[state];

    for (let i=0; i<MOLECULE_COUNT; i++) {
      const [sx, sy, sz] = seeds.pos[i];
      const [vx, vy, vz] = seeds.vel[i];

      positions[i][0] = sx + Math.sin(t * spd * vx * 40 + i) * 0.8;
      positions[i][1] = sy + Math.cos(t * spd * vy * 40 + i) * 0.5;
      positions[i][2] = sz + Math.sin(t * spd * vz * 40 + i * 0.7) * 0.6;

      dummy.position.set(...positions[i]);
      const s = 0.022 + (i % 7 === 0 ? 0.03 : 0) + stressIndex * 0.015;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color: blend base tint with cyan highlight by flux magnitude
      const flux = Math.sin(t * 1.2 + i * 0.05) * 0.5 + 0.5;
      const ci = i * 3;
      colorArr[ci]   = tint.r + flux * 0.1;
      colorArr[ci+1] = tint.g + (reactionRate / 20) * 0.4 * flux;
      colorArr[ci+2] = tint.b + flux * 0.3;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    // frustumCulled=true — Three.js default, explicit for clarity
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MOLECULE_COUNT]}
      frustumCulled={true}
    >
      {/* icosahedronGeometry — no gl_PointSize */}
      <icosahedronGeometry args={[1, 0]} />
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.72}
        roughness={0.55}
        metalness={0.12}
        depthWrite={false}
        envMapIntensity={0.4}
      />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint grid (SVG overlay — no GPU cost)
// ─────────────────────────────────────────────────────────────────────────────

function BlueprintGrid({ state }: { state: MachineState }) {
  const opacity = state === 'idle' ? 0.07 : state === 'equilibrium' ? 0.12 : 0.05;
  const color   = 'rgba(255,255,255,0.55)';

  return (
    <svg
      aria-hidden="true"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity, transition:'opacity 0.8s, color 0.8s' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid-minor" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color} strokeWidth="0.4"/>
        </pattern>
        <pattern id="grid-major" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="url(#grid-minor)"/>
          <path d="M 200 0 L 0 0 0 200" fill="none" stroke={color} strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-major)"/>
      {/* Crosshair center */}
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke={color} strokeWidth="0.6" strokeDasharray="4 12"/>
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke={color} strokeWidth="0.6" strokeDasharray="4 12"/>
      <circle cx="50%" cy="50%" r="120" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3 9"/>
      <circle cx="50%" cy="50%" r="280" fill="none" stroke={color} strokeWidth="0.4" strokeDasharray="2 12"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported composite component
// ─────────────────────────────────────────────────────────────────────────────

interface FluidSimCanvasProps {
  forceRef: React.MutableRefObject<FluidForce | null>;
  reactionRate: number;
  stressIndex: number;
  state: MachineState;
}

export default function FluidSimCanvas({
  reactionRate, stressIndex, state,
}: FluidSimCanvasProps) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
      {/* Layer 0 — R3F metabolite instances */}
      <Canvas
        camera={{ position:[0,0,16], fov:55 }}
        dpr={[1, typeof window !== 'undefined' && window.innerWidth < 1024 ? 1.2 : 1.5]}
        performance={{ min: 0.45 }}
        gl={{ antialias:false, alpha:true, powerPreference:'high-performance' }}
        style={{ position:'absolute', inset:0, background:'transparent', pointerEvents:'none' }}
      >
        <ambientLight intensity={0.5} color="#FFFFFF" />
        <pointLight position={[0,0,12]} intensity={0.9} color="#FFFFFF" distance={30} decay={2} />
        <pointLight position={[8,-6,8]} intensity={0.4} color="#FFFFFF" distance={20} decay={2} />
        <MetaboliteMolecules
          reactionRate={reactionRate}
          stressIndex={stressIndex}
          state={state}
        />
      </Canvas>

      {/* Layer 1 — Blueprint grid SVG */}
      <BlueprintGrid state={state} />
    </div>
  );
}
