import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge, MolecularStructure } from '../types';

type Vec3 = [number, number, number];
type RendererMode = 'loading' | 'webgpu' | 'webgl2' | 'webgl' | 'error';

const INIT_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = INIT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function isRenderableNode(node: PathwayNode | null | undefined): node is PathwayNode {
  return !!node &&
    typeof node.id === 'string' &&
    node.id.length > 0 &&
    typeof node.label === 'string' &&
    node.label.length > 0 &&
    isVec3(node.position);
}

function getRendererLabel(mode: RendererMode): string | null {
  switch (mode) {
    case 'loading': return 'INITIALIZING';
    case 'webgl2': return 'WEBGL2 FALLBACK';
    case 'webgl': return 'WEBGL FALLBACK';
    case 'error': return 'RENDERER ERROR';
    default: return null;
  }
}

function getRendererTone(mode: RendererMode): React.CSSProperties {
  if (mode === 'error') {
    return {
      color: 'rgba(255,186,186,0.92)',
      border: '1px solid rgba(255,120,120,0.22)',
      background: 'rgba(48,12,16,0.55)',
    };
  }
  if (mode === 'loading') {
    return {
      color: 'rgba(232,240,248,0.82)',
      border: '1px solid rgba(200,216,232,0.18)',
      background: 'rgba(9,12,18,0.55)',
    };
  }
  return {
    color: 'rgba(200,216,232,0.78)',
    border: '1px solid rgba(200,216,232,0.18)',
    background: 'rgba(9,12,18,0.55)',
  };
}

class SceneErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── Hash ─────────────────────────────────────────────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function hashFloat(str: string, idx: number, min = 0, max = 1) {
  return min + ((hash(str + idx) % 10000) / 10000) * (max - min);
}
function hashInt(str: string, idx: number, min: number, max: number) {
  return min + (hash(str + idx) % (max - min + 1));
}

// ─── Color system ─────────────────────────────────────────────────────
const PASTEL = ['#C8D8E8','#C8E0D0','#DDD0E8','#E8DCC8','#C8DCDC','#DCE8C8','#E8C8D4','#CCE0D8'];
const NODE_CONF: Record<string,number> = { acetyl_coa:85,hmg_coa:72,mevalonate:68,fpp:91,amorpha_4_11_diene:88,artemisinic_acid:76,artemisinin:93 };

function conf2pastel(p: number): string {
  if (p >= 90) return '#C8D8E8';
  if (p >= 70) return '#C8E0D0';
  if (p >= 50) return '#E8DCC8';
  return '#E8C8D4';
}
function getColor(node: PathwayNode): string {
  const c = NODE_CONF[node.id];
  return c !== undefined ? conf2pastel(c) : PASTEL[hash(node.id) % PASTEL.length];
}
function getConf(node: PathwayNode): number {
  if (node.confidenceScore !== undefined) return node.confidenceScore;
  const c = NODE_CONF[node.id];
  return c !== undefined ? c / 100 : 0.75;
}

// ─── CPK elements ─────────────────────────────────────────────────────
const EC: Record<string,string> = { H:'#E8EEF4',C:'#8A9BAA',N:'#A8BED8',O:'#D8B8A8',P:'#D8D4A8',S:'#B8D8C8',DEFAULT:'#B0BEC8' };
const ER: Record<string,number> = { H:0.09,C:0.17,N:0.16,O:0.15,P:0.19,S:0.20,DEFAULT:0.17 };
const ec = (e: string) => EC[e.toUpperCase()] ?? EC.DEFAULT;
const er = (e: string) => ER[e.toUpperCase()] ?? ER.DEFAULT;

function normalizeStruct(s: MolecularStructure) {
  if (!s.atoms?.length) return null;
  const vecs = s.atoms.map(a => new THREE.Vector3(...a.position));
  const ctr = vecs.reduce((acc,v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1/vecs.length);
  const shifted = vecs.map(v => v.clone().sub(ctr));
  const maxD = Math.max(0.001, ...shifted.map(v => v.length()));
  const scale = 0.42 / maxD;
  return { atoms: s.atoms.map((a,i) => ({...a, position: shifted[i].multiplyScalar(scale).toArray() as Vec3})), bonds: s.bonds ?? [] };
}

// ─── Glyph config ─────────────────────────────────────────────────────
type GCfg = { geom:'oct'|'dodec'|'tetra'|'icos'|'sph'|'tor'; scale:number; rings:number; rr:number[]; rt:number[]; sats:number; sr:number; ss:number; spin:number; inner:boolean; };
function glyphCfg(id: string, cc: number): GCfg {
  const gs = ['oct','dodec','tetra','icos','sph','tor'] as GCfg['geom'][];
  const rc = hashInt(id,1,1,2);
  return { geom:gs[hashInt(id,0,0,5)], scale:0.22+cc*0.04+hashFloat(id,2,0,0.04), rings:rc, rr:Array.from({length:rc},(_,i)=>hashFloat(id,10+i,0.5,0.8)), rt:Array.from({length:rc},(_,i)=>hashFloat(id,20+i,0,Math.PI)), sats:hashInt(id,3,2,4), sr:hashFloat(id,4,0.6,0.9), ss:hashFloat(id,5,0.035,0.055), spin:hashFloat(id,6,0.04,0.10), inner:hash(id)%3===0 };
}
function GeoComp({ g, s }: { g: GCfg['geom']; s: number }) {
  switch(g) {
    case 'oct':   return <octahedronGeometry args={[s,0]}/>;
    case 'dodec': return <dodecahedronGeometry args={[s,0]}/>;
    case 'tetra': return <tetrahedronGeometry args={[s,0]}/>;
    case 'icos':  return <icosahedronGeometry args={[s,1]}/>;
    case 'tor':   return <torusGeometry args={[s*0.8,s*0.3,8,20]}/>;
    default:      return <sphereGeometry args={[s,16,16]}/>;
  }
}

// ─── Scientific grid — minimal, space reference only ──────────────────
function SpatialReference() {
  return (
    <group position={[0, -3.8, 0]}>
      {/* Primary grid — very subtle */}
      <gridHelper args={[36, 36, '#1c2535', '#141e2a']} />
      {/* Major axis lines — barely perceptible */}
      <Line points={[new THREE.Vector3(-10,0,0), new THREE.Vector3(10,0,0)]}
        color="#2a3a50" lineWidth={0.5} transparent opacity={0.35} />
      <Line points={[new THREE.Vector3(0,0,-10), new THREE.Vector3(0,0,10)]}
        color="#2a3a50" lineWidth={0.5} transparent opacity={0.35} />
    </group>
  );
}

// ─── Node: unified material system ────────────────────────────────────
// Uses MeshPhysicalMaterial for translucency + soft shading
function AtomM({ pos, elem, hov, sel }: { pos:Vec3; elem:string; hov:boolean; sel:boolean }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[er(elem), 12, 12]} />
      <meshPhysicalMaterial
        color={sel ? '#f0f4f8' : ec(elem)}
        emissive={ec(elem)} emissiveIntensity={sel ? 0.08 : hov ? 0.04 : 0.01}
        roughness={0.55} metalness={0.05} transmission={0.15} thickness={0.5}
      />
    </mesh>
  );
}

function BondM({ s, e, c }: { s:Vec3; e:Vec3; c:string }) {
  const { mid, len, q } = useMemo(() => {
    const sv = new THREE.Vector3(...s), ev = new THREE.Vector3(...e);
    const dir = new THREE.Vector3().subVectors(ev, sv);
    const len = dir.length();
    return { mid: sv.clone().add(ev).multiplyScalar(0.5), len, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize()) };
  }, [s, e]);
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.018, 0.018, len, 8, 1]} />
      <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={0.03} roughness={0.6} metalness={0.0} transmission={0.1} />
    </mesh>
  );
}

// ─── Molecular Node — organic, volume-integrated ──────────────────────
const MolNode = React.memo(function MolNode({ node, hov, sel, cc, onClick, onHov }: {
  node:PathwayNode; hov:boolean; sel:boolean; cc:number;
  onClick:(n:PathwayNode)=>void; onHov:(id:string|null)=>void;
}) {
  const grp  = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const orb  = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80 + hash(node.id) % 320);
    return () => clearTimeout(t);
  }, [node.id]);

  const color  = getColor(node);
  const conf   = getConf(node);
  const lbl    = node.canonicalLabel?.trim() || node.label;
  const norm   = useMemo(() => node.molecularStructure ? normalizeStruct(node.molecularStructure) : null, [node.molecularStructure]);
  const cfg    = useMemo(() => glyphCfg(node.id, cc), [node.id, cc]);
  const tgt    = sel ? 1.28 : hov ? 1.10 : 1.0;
  const bndC   = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#c8d8e8'), 0.3).getStyle(), [color]);
  const colVec = useMemo(() => new THREE.Color(color), [color]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const cs = grp.current.scale.x;
      grp.current.scale.setScalar(cs + ((ready ? tgt : 0.001) - cs) * dt * 5);
      // Organic breathing — subtle, continuous
      grp.current.position.y = node.position[1] + Math.sin(t * 0.4 + hash(node.id) * 0.01) * 0.06;
      grp.current.rotation.y = Math.sin(t * 0.06 + hash(node.id) * 0.001) * 0.05;
    }
    if (body.current) {
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      const tEmi = sel ? 0.14 : hov ? 0.08 : 0.025;
      mat.emissiveIntensity += (tEmi - mat.emissiveIntensity) * dt * 3;
      body.current.rotation.y += dt * cfg.spin * 0.6;
    }
    if (orb.current) orb.current.rotation.y = t * 0.10 + cfg.spin * 3;
    if (ring.current) {
      ring.current.rotation.z += dt * 0.10;
      const mat = ring.current.material as THREE.MeshPhysicalMaterial;
      const to = hov || sel ? 0.35 : 0.08;
      mat.opacity += (to - mat.opacity) * dt * 3;
    }
  });

  // Translucent, soft-shaded fallback glyph
  const fallback = (
    <>
      {cfg.rr.map((r, i) => (
        <mesh key={`r${i}`} ref={i === 0 ? ring : undefined} rotation={[cfg.rt[i] || 0, 0, i * 1.1]}>
          <torusGeometry args={[r, 0.009, 5, 40]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.05} transparent opacity={0.09} roughness={0.6} metalness={0} depthWrite={false} />
        </mesh>
      ))}
      <group ref={orb}>
        {Array.from({ length: cfg.sats }).map((_, i) => {
          const phi = Math.acos(1 - (2*(i+0.5))/cfg.sats);
          const theta = Math.PI*(1+Math.sqrt(5))*i;
          return (
            <mesh key={`s${i}`} position={[Math.sin(phi)*Math.cos(theta)*cfg.sr, Math.sin(phi)*Math.sin(theta)*cfg.sr, Math.cos(phi)*cfg.sr]}>
              <sphereGeometry args={[cfg.ss, 7, 7]} />
              <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.06} transparent opacity={0.22} roughness={0.5} metalness={0} />
            </mesh>
          );
        })}
      </group>
      {cfg.inner && (
        <mesh>
          <octahedronGeometry args={[cfg.scale * 0.35, 0]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.10} transparent opacity={0.55} roughness={0.4} metalness={0} transmission={0.2} />
        </mesh>
      )}
      {/* Core body — MeshPhysical for soft shading */}
      <mesh ref={body}>
        <GeoComp g={cfg.geom} s={cfg.scale} />
        <meshPhysicalMaterial
          color={color} emissive={color} emissiveIntensity={0.025}
          roughness={0.52} metalness={0.0}
          transmission={0.08} thickness={0.6}
          transparent opacity={0.92}
        />
      </mesh>
      {/* Soft outer shell — volume/translucency */}
      <mesh>
        <GeoComp g={cfg.geom} s={cfg.scale * 1.12} />
        <meshPhysicalMaterial
          color={color} transparent opacity={hov || sel ? 0.07 : 0.025}
          roughness={1} metalness={0} depthWrite={false} transmission={0.5}
        />
      </mesh>
    </>
  );

  const structural = norm ? (
    <>
      {norm.bonds.map((b, i) => {
        const a = norm.atoms[b.atomIndex1], bv = norm.atoms[b.atomIndex2];
        if (!a || !bv) return null;
        return <BondM key={i} s={a.position} e={bv.position} c={bndC} />;
      })}
      {norm.atoms.map((a, i) => <AtomM key={i} pos={a.position} elem={a.element} hov={hov} sel={sel} />)}
    </>
  ) : null;

  return (
    <group
      ref={grp}
      position={node.position}
      onClick={e => { e.stopPropagation(); onClick(node); }}
      onPointerOver={e => { e.stopPropagation(); onHov(node.id); document.body.style.cursor = 'pointer'; }}
      onPointerOut={e => { e.stopPropagation(); onHov(null); document.body.style.cursor = 'auto'; }}
    >
      {norm ? structural : fallback}

      <Html position={[0, -(cfg.scale + 0.52), 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          color: hov || sel ? 'rgba(220,232,242,0.90)' : 'rgba(160,180,200,0.55)',
          fontSize: '10px', fontWeight: sel ? 600 : 400,
          fontFamily: "'Public Sans', sans-serif",
          letterSpacing: '0.02em',
          textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7)',
          padding: '2px 7px',
          background: sel ? 'rgba(200,216,232,0.07)' : 'transparent',
          borderRadius: '4px',
          border: sel ? '1px solid rgba(200,216,232,0.14)' : '1px solid transparent',
          transition: 'color 0.2s',
        }}>{lbl}</div>
      </Html>

      {hov && !sel && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div style={{
            background: 'rgba(6,9,16,0.95)', border: '1px solid rgba(200,216,232,0.12)',
            borderRadius: '16px', padding: '10px 14px', width: '196px',
            backdropFilter: 'blur(20px)', transform: 'translateY(-120%)',
            fontFamily: "'Public Sans', sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#c8d8e4', fontSize: '12px', fontWeight: 600 }}>{lbl}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFeatureSettings: "'tnum' 1" }}>{Math.round(conf*100)}%</span>
            </div>
            {node.nodeType && node.nodeType !== 'unknown' && (
              <span style={{ color: 'rgba(200,216,232,0.5)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px', fontWeight: 700 }}>{node.nodeType}</span>
            )}
            <p style={{ color: 'rgba(180,200,215,0.42)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 7px' }}>{node.summary?.slice(0, 80)}...</p>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
              <div style={{ width: `${Math.round(conf*100)}%`, height: '100%', background: colVec.getStyle(), borderRadius: '1px', opacity: 0.8 }} />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
});

// ─── Soft path edges ───────────────────────────────────────────────────
const PathEdge = React.memo(function PathEdge({ s, e, active, color }: { s:Vec3; e:Vec3; active:boolean; color:string }) {
  const dot  = useRef<THREE.Mesh>(null);
  const prog = useRef(Math.random());
  const sv   = useMemo(() => new THREE.Vector3(...s), [s]);
  const ev   = useMemo(() => new THREE.Vector3(...e), [e]);
  const mid  = useMemo(() => sv.clone().lerp(ev, 0.5).add(new THREE.Vector3(0, 0.4, 0)), [sv, ev]);

  useFrame((_, dt) => {
    prog.current = (prog.current + dt * 0.18) % 1;
    if (dot.current) {
      const t = prog.current;
      dot.current.position.copy(
        new THREE.Vector3()
          .addScaledVector(sv, (1-t)*(1-t))
          .addScaledVector(mid, 2*(1-t)*t)
          .addScaledVector(ev, t*t)
      );
      dot.current.visible = active;
    }
  });

  return (
    <group>
      <Line
        points={[sv, mid, ev]}
        color={active ? color : '#141e2a'}
        lineWidth={active ? 0.8 : 0.25}
        transparent
        opacity={active ? 0.55 : 0.12}
      />
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.035, 5, 5]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.7} />
      </mesh>
    </group>
  );
});

// ─── Scene — unified lighting, integrated depth ────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: {
  nodes:PathwayNode[]; edges:PathwayEdge[];
  onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null;
}) {
  const [hovId, setHovId]     = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart = useCallback(() => { setInteract(true); if (timer.current) clearTimeout(timer.current); }, []);
  const onEnd   = useCallback(() => { timer.current = setTimeout(() => setInteract(false), 3500); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const cc = useMemo(() => {
    const c: Record<string,number> = {};
    nodes.forEach(n => { c[n.id] = 0; });
    edges.forEach(e => { if (c[e.start] !== undefined) c[e.start]++; if (c[e.end] !== undefined) c[e.end]++; });
    return c;
  }, [nodes, edges]);

  const ed = useMemo(() =>
    edges.map(edge => {
      const s = nodes.find(n => n.id === edge.start);
      const e = nodes.find(n => n.id === edge.end);
      if (!s || !e) return null;
      return { key:`${edge.start}-${edge.end}`, s, e,
        active: hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end,
        color: getColor(s) };
    }).filter(Boolean) as { key:string; s:PathwayNode; e:PathwayNode; active:boolean; color:string }[],
  [edges, nodes, hovId, selectedNodeId]);

  return (
    <>
      {/* Lighting — soft, unified, no harsh spots */}
      <ambientLight intensity={0.85} color="#d0dcec" />
      <directionalLight position={[4, 10, 6]}  intensity={0.35} color="#e8f0f8" />
      <directionalLight position={[-8, -2, -6]} intensity={0.12} color="#1a2840" />
      <pointLight position={[0, 6, 0]} intensity={0.20} color="#c0d0e8" distance={28} decay={2} />

      {/* Deep, soft fog — creates natural depth, no hard cutoff */}
      <fog attach="fog" args={['#07090f', 20, 48]} />

      <OrbitControls
        enableZoom
        autoRotate={!interact && !hovId && !selectedNodeId}
        autoRotateSpeed={0.12}
        zoomSpeed={0.45}
        minDistance={6}
        maxDistance={24}
        enablePan={false}
        onStart={onStart} onEnd={onEnd}
      />


      {/* Spatial reference — barely visible */}
      <SpatialReference />

      {/* Edges — soft, secondary */}
      {ed.map(e => <PathEdge key={e.key} s={e.s.position} e={e.e.position} active={e.active} color={e.color} />)}

      {/* Nodes — primary subject */}
      {nodes.map(n => (
        <MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId} />
      ))}
    </>
  );
}

// ─── Resize handler — explicit window resize fallback ──────────────────
function ResizeHandler() {
  const { gl, camera } = useThree();

  useEffect(() => {
    const handleResize = () => {
      const parent = gl.domElement.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      gl.setSize(width, height, false);

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera, gl]);

  return null;
}

// ─── Defaults ─────────────────────────────────────────────────────────
const DEF_EDGES: PathwayEdge[] = [
  { start:'acetyl_coa', end:'hmg_coa', relationshipType:'converts', direction:'forward' },
  { start:'acetyl_coa', end:'mevalonate', relationshipType:'produces', direction:'forward' },
  { start:'hmg_coa', end:'mevalonate', relationshipType:'converts', direction:'forward' },
  { start:'mevalonate', end:'fpp', relationshipType:'produces', direction:'forward' },
  { start:'fpp', end:'amorpha_4_11_diene', relationshipType:'catalyzes', direction:'forward' },
  { start:'amorpha_4_11_diene', end:'artemisinic_acid', relationshipType:'converts', direction:'forward' },
  { start:'artemisinic_acid', end:'artemisinin', relationshipType:'produces', direction:'forward' },
];

interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rendererMode, setRendererMode] = useState<RendererMode>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const setRenderState = useCallback((nextStatus: 'loading' | 'ready' | 'error', mode: RendererMode, message?: string) => {
    if (!mountedRef.current) return;
    setStatus(nextStatus);
    setRendererMode(mode);
    setErrorMessage(message ?? null);
  }, []);

  const safeNodes = useMemo(() => Array.isArray(nodes) ? nodes.filter(isRenderableNode) : [], [nodes]);
  const safeNodeIds = useMemo(() => new Set(safeNodes.map(node => node.id)), [safeNodes]);
  const safeEdges = useMemo(() => {
    const sourceEdges = Array.isArray(edges) ? edges : DEF_EDGES;
    return sourceEdges.filter((edge): edge is PathwayEdge =>
      !!edge &&
      typeof edge.start === 'string' &&
      typeof edge.end === 'string' &&
      safeNodeIds.has(edge.start) &&
      safeNodeIds.has(edge.end),
    );
  }, [edges, safeNodeIds]);
  const hasRenderableContent = safeNodes.length > 0;
  const fallbackLabel = getRendererLabel(rendererMode);

  useEffect(() => {
    if (!hasRenderableContent) {
      setRenderState('error', 'error', 'Pathway data is unavailable or incomplete, so the visualization could not be rendered.');
      return;
    }

    setRenderState('loading', 'loading');
  }, [hasRenderableContent, safeEdges.length, safeNodes.length, setRenderState]);

  return (
    <div style={{
      width: '100%', height: 'clamp(500px, 65vh, 760px)',
      background: 'linear-gradient(180deg, #070910 0%, #090c15 60%, #0b0e18 100%)',
      borderRadius: '20px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      position: 'relative',
      boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Minimal header */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', background:'linear-gradient(to bottom, rgba(7,9,16,0.92), transparent)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            {['rgba(200,216,232,0.35)','rgba(200,224,208,0.3)','rgba(221,208,232,0.3)'].map((c,i) => (
              <div key={i} style={{ width:'4px', height:'4px', borderRadius:'50%', background:c }} />
            ))}
          </div>
          <span style={{ color:'rgba(255,255,255,0.20)', fontSize:'10px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            METABOLIC · {nodes.length} ENTITIES
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {fallbackLabel && (
            <span style={{
              ...getRendererTone(rendererMode),
              fontSize:'9px',
              fontFamily:"'Public Sans',sans-serif",
              padding:'2px 8px',
              borderRadius:'99px',
              letterSpacing:'0.04em',
              fontWeight:700,
            }}>
              {fallbackLabel}
            </span>
          )}
          {edges && <span style={{ color:'rgba(200,216,232,0.40)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif", padding:'2px 8px', border:'1px solid rgba(200,216,232,0.14)', borderRadius:'99px' }}>AI GENERATED</span>}
          <span style={{ color:'rgba(255,255,255,0.10)', fontSize:'9px', fontFamily:"'Public Sans',sans-serif" }}>drag · scroll · click</span>
        </div>
      </div>

      {/* pLDDT legend — minimal weight */}
      <div style={{ position:'absolute', bottom:'13px', left:'13px', zIndex:10 }}>
        <p style={{ color:'rgba(255,255,255,0.12)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontWeight:700, margin:'0 0 4px', letterSpacing:'0.07em', textTransform:'uppercase' }}>CONFIDENCE</p>
        {[{ c:'#C8D8E8',l:'>90' },{ c:'#C8E0D0',l:'70–90' },{ c:'#E8DCC8',l:'50–70' },{ c:'#E8C8D4',l:'<50' }].map(x => (
          <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'2px' }}>
            <div style={{ width:'12px', height:'2px', background:x.c, borderRadius:'1px', opacity:0.65 }} />
            <span style={{ color:'rgba(255,255,255,0.14)', fontSize:'8px', fontFamily:"'Public Sans',sans-serif", fontFeatureSettings:"'tnum' 1" }}>{x.l}</span>
          </div>
        ))}
      </div>

      {status !== 'ready' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px 40px',
          background: status === 'error' ? 'linear-gradient(180deg, rgba(14,10,14,0.92), rgba(11,14,24,0.94))' : 'linear-gradient(180deg, rgba(7,9,16,0.72), rgba(7,9,16,0.36))',
          backdropFilter: 'blur(14px)',
          zIndex: 6,
        }}>
          <div style={{
            width: 'min(420px, 100%)',
            padding: '20px 22px',
            borderRadius: '20px',
            border: status === 'error' ? '1px solid rgba(255,120,120,0.18)' : '1px solid rgba(200,216,232,0.12)',
            background: status === 'error' ? 'rgba(32,11,16,0.76)' : 'rgba(9,12,18,0.76)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
          }}>
            <p style={{ margin: '0 0 8px', color: status === 'error' ? 'rgba(255,196,196,0.92)' : 'rgba(220,232,242,0.92)', fontSize: '11px', fontFamily:"'Public Sans',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {status === 'error' ? 'Atomic Pathway unavailable' : 'Loading Atomic Pathway'}
            </p>
            <p style={{ margin: 0, color: status === 'error' ? 'rgba(255,214,214,0.78)' : 'rgba(200,216,232,0.62)', fontSize: '13px', lineHeight: 1.6, fontFamily:"'Public Sans',sans-serif" }}>
              {errorMessage ?? 'Initializing the molecular scene and selecting the best available renderer for this device.'}
            </p>
          </div>
        </div>
      )}

      {hasRenderableContent && (
        <SceneErrorBoundary onError={(error) => {
          console.error('Atomic Pathway render error:', error);
          setRenderState('error', 'error', 'The molecular scene encountered an unexpected rendering error.');
        }}>
          <Canvas
            camera={{ position: [0, 5, 15], fov: 44 }}
            gl={async (props) => {
              const canvas = props.canvas as HTMLCanvasElement;
              const parent = canvas.parentElement;
              const width = parent?.clientWidth ?? canvas.width;
              const height = parent?.clientHeight ?? canvas.height;

              const applyRendererDefaults = <TRenderer extends THREE.WebGLRenderer | { setSize: (w: number, h: number, updateStyle?: boolean) => void; toneMapping: THREE.ToneMapping; toneMappingExposure: number; setClearColor: (color: THREE.ColorRepresentation, alpha?: number) => void; }>(renderer: TRenderer) => {
                renderer.setSize(width, height, false);
                renderer.toneMapping = THREE.LinearToneMapping;
                renderer.toneMappingExposure = 1.0;
                renderer.setClearColor(new THREE.Color('#07090f'), 1);
                return renderer;
              };

              const createWebGLRenderer = (context: WebGL2RenderingContext | WebGLRenderingContext, mode: 'webgl2' | 'webgl') => {
                const renderer = applyRendererDefaults(new THREE.WebGLRenderer({
                  canvas,
                  context,
                  antialias: true,
                  powerPreference: 'high-performance',
                  alpha: false,
                }));
                setRenderState('ready', mode);
                return renderer;
              };

              setRenderState('loading', 'loading');

              if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
                try {
                  const gpu = (navigator as Navigator & { gpu: GPU }).gpu;
                  const adapter = await withTimeout(gpu.requestAdapter(), 'Requesting a WebGPU adapter');
                  if (adapter) {
                    await withTimeout(adapter.requestDevice(), 'Requesting a WebGPU device');
                    const { WebGPURenderer } = await withTimeout(import('three/webgpu'), 'Loading the WebGPU renderer');
                    const renderer = applyRendererDefaults(new WebGPURenderer({
                      canvas,
                      antialias: true,
                      powerPreference: 'high-performance',
                      alpha: false,
                    } as ConstructorParameters<typeof WebGPURenderer>[0]));
                    await withTimeout(renderer.init(), 'Initializing WebGPU');
                    setRenderState('ready', 'webgpu');
                    return renderer;
                  }
                } catch (error) {
                  console.warn('WebGPU initialization failed, falling back to WebGL2.', error);
                }
              }

              const webgl2 = canvas.getContext('webgl2', {
                antialias: true,
                powerPreference: 'high-performance',
                alpha: false,
              });
              if (webgl2) return createWebGLRenderer(webgl2, 'webgl2');

              const webgl = canvas.getContext('webgl', {
                antialias: true,
                powerPreference: 'high-performance',
                alpha: false,
              }) || canvas.getContext('experimental-webgl', {
                antialias: true,
                powerPreference: 'high-performance',
                alpha: false,
              });
              if (webgl) return createWebGLRenderer(webgl as WebGLRenderingContext, 'webgl');

              const message = 'WebGPU and WebGL are unavailable in this browser session. Please check graphics acceleration and try again.';
              setRenderState('error', 'error', message);
              throw new Error(message);
            }}
            dpr={[1, 1.5]}
            performance={{ min: 0.5 }}
            onCreated={({ gl }) => {
              gl.setClearColor(new THREE.Color('#07090f'), 1);
            }}
            style={{ background: 'transparent' }}
          >
            <ResizeHandler />
            <Scene nodes={safeNodes} edges={safeEdges} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId ?? null} />
          </Canvas>
        </SceneErrorBoundary>
      )}
    </div>
  );
}
