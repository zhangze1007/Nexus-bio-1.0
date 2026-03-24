import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge, MolecularStructure } from '../types';

type Vec3 = [number, number, number];

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

const PASTEL = ['#C8D8E8','#C8E0D0','#DDD0E8','#E8DCC8','#C8DCDC','#DCE8C8','#E8C8D4','#CCE0D8'];
const NODE_CONF: Record<string,number> = { acetyl_coa:85,hmg_coa:72,mevalonate:68,fpp:91,amorpha_4_11_diene:88,artemisinic_acid:76,artemisinin:93 };

function conf2pastel(p: number): string {
  if (p >= 90) return '#C8D8E8'; if (p >= 70) return '#C8E0D0';
  if (p >= 50) return '#E8DCC8'; return '#E8C8D4';
}
function getColor(node: PathwayNode): string {
  const c = NODE_CONF[node.id];
  return c !== undefined ? conf2pastel(c) : PASTEL[hash(node.id) % PASTEL.length];
}
function getConf(node: PathwayNode): number {
  if (node.confidenceScore !== undefined) return node.confidenceScore;
  const c = NODE_CONF[node.id]; return c !== undefined ? c / 100 : 0.75;
}

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

// ════════════════════════════════════════════════════════════════════
// BASE FIELD — Perlin Noise shader from Google AI Studio
// Mouse interaction + hover/click disturbance + analysis mode
// ════════════════════════════════════════════════════════════════════
const BASE_VERT = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uAnalysisMode;
uniform float uHoverState;
uniform vec3 uHoverPos;
uniform float uClickState;
uniform vec3 uClickPos;
varying vec2 vUv;
varying float vElevation;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P);vec3 Pi1=Pi0+vec3(1.0);
  Pi0=mod(Pi0,289.0);Pi1=mod(Pi1,289.0);
  vec3 Pf0=fract(P);vec3 Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
  vec4 iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz;vec4 iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+iz0);vec4 ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0/7.0;vec4 gy0=fract(floor(gx0)/7.0)-0.5;
  gx0=fract(gx0);vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);
  vec4 sz0=step(gz0,vec4(0.0));gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1/7.0;vec4 gy1=fract(floor(gx1)/7.0)-0.5;
  gx1=fract(gx1);vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);
  vec4 sz1=step(gz1,vec4(0.0));gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x);vec3 g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z);vec3 g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x);vec3 g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z);vec3 g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;
  float n000=dot(g000,Pf0);float n100=dot(g100,vec3(Pf1.x,Pf0.yz));
  float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));float n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z));float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011=dot(g011,vec3(Pf0.x,Pf1.yz));float n111=dot(g111,Pf1);
  vec3 fade_xyz=fade(Pf0);
  vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);
  return 2.2*mix(n_yz.x,n_yz.y,fade_xyz.x);
}

void main(){
  vUv=uv;
  vec3 pos=position;
  vec2 worldXY=pos.xy;
  float baseNoise=cnoise(vec3(pos.x*0.03,pos.y*0.03,uTime*0.15))*2.5;
  float highFreq=cnoise(vec3(pos.x*0.2,pos.y*0.2,uTime*0.3))*1.5;
  highFreq+=cnoise(vec3(pos.x*0.5,pos.y*0.5,uTime*0.5))*0.5;
  float mouseDist=distance(worldXY,uMouse);
  float mouseWave=exp(-mouseDist*0.05)*sin(mouseDist*1.5-uTime*4.0)*1.5;
  vec2 hoverLocal=vec2(uHoverPos.x,-uHoverPos.z);
  float hoverDist=distance(worldXY,hoverLocal);
  float hoverWave=exp(-hoverDist*0.15)*sin(hoverDist*2.5-uTime*6.0)*2.0*uHoverState;
  vec2 clickLocal=vec2(uClickPos.x,-uClickPos.z);
  float clickDist=distance(worldXY,clickLocal);
  float clickWave=exp(-clickDist*0.08)*cos(clickDist*1.0-uTime*2.0)*3.0*uClickState;
  float elevation=baseNoise;
  elevation=mix(elevation,elevation+highFreq,uAnalysisMode);
  elevation+=mouseWave+hoverWave-clickWave;
  pos.z+=elevation;
  vElevation=elevation;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}`;

const BASE_FRAG = `
#extension GL_OES_standard_derivatives : enable
uniform float uTime;
uniform float uAnalysisMode;
uniform vec3 uColorBase;
uniform vec3 uColorHighlight;
uniform vec3 uColorAnalysis;
varying vec2 vUv;
varying float vElevation;
void main(){
  float mixVal=clamp((vElevation+3.0)/6.0,0.0,1.0);
  vec3 color=mix(uColorBase,uColorHighlight,mixVal);
  vec3 analysisColor=mix(uColorHighlight,uColorAnalysis,mixVal);
  color=mix(color,analysisColor,uAnalysisMode);
  vec2 grid=abs(fract(vUv*80.0-0.5)-0.5);
  vec2 df=fwidth(vUv*80.0);
  vec2 line=smoothstep(df*1.5,df*0.5,grid);
  float gridAlpha=max(line.x,line.y);
  float finalGrid=mix(gridAlpha*0.04,gridAlpha*0.18,uAnalysisMode);
  color+=vec3(finalGrid);
  float distToCenter=distance(vUv,vec2(0.5));
  float alpha=smoothstep(0.5,0.15,distToCenter);
  gl_FragColor=vec4(color,alpha*0.80);
}`;

function BaseField({ analysisMode, hoverPos, hoverState, clickPos, clickState }: {
  analysisMode:boolean; hoverPos:THREE.Vector3; hoverState:number;
  clickPos:THREE.Vector3; clickState:number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { mouse } = useThree();
  const curAnalysis = useRef(0), curHover = useRef(0), curClick = useRef(0);
  const curHoverPos = useRef(new THREE.Vector3()), curClickPos = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0,1,0), 6), []);

  const uniforms = useMemo(() => ({
    uTime:         { value: 0 },
    uMouse:        { value: new THREE.Vector2(0,0) },
    uAnalysisMode: { value: 0 },
    uHoverState:   { value: 0 },
    uHoverPos:     { value: new THREE.Vector3() },
    uClickState:   { value: 0 },
    uClickPos:     { value: new THREE.Vector3() },
    uColorBase:      { value: new THREE.Color('#050810') },
    uColorHighlight: { value: new THREE.Color('#121e30') },
    uColorAnalysis:  { value: new THREE.Color('#1e3350') },
  }), []);

  useFrame((state, dt) => {
    if (!matRef.current) return;
    curAnalysis.current += ((analysisMode?1:0) - curAnalysis.current) * dt * 2;
    curHover.current   += (hoverState - curHover.current) * dt * 4;
    curClick.current   += (clickState - curClick.current) * dt * 3;
    curHoverPos.current.lerp(hoverPos, dt * 5);
    curClickPos.current.lerp(clickPos, dt * 5);
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    raycaster.setFromCamera(mouse, state.camera);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) {
      matRef.current.uniforms.uMouse.value.lerp(new THREE.Vector2(target.x, -target.z), dt*3);
    }
    matRef.current.uniforms.uAnalysisMode.value = curAnalysis.current;
    matRef.current.uniforms.uHoverState.value   = curHover.current;
    matRef.current.uniforms.uHoverPos.value.copy(curHoverPos.current);
    matRef.current.uniforms.uClickState.value   = curClick.current;
    matRef.current.uniforms.uClickPos.value.copy(curClickPos.current);
  });

  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-6,0]}>
      {/* 128x128 segments — good quality, mobile-friendly */}
      <planeGeometry args={[80, 80, 128, 128]} />
      <shaderMaterial ref={matRef} vertexShader={BASE_VERT} fragmentShader={BASE_FRAG}
        uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ─── Atoms / Bonds ────────────────────────────────────────────────────
function AtomM({ pos, elem, hov, sel }: { pos:Vec3; elem:string; hov:boolean; sel:boolean }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[er(elem),12,12]}/>
      <meshPhysicalMaterial color={sel?'#f0f4f8':ec(elem)} emissive={ec(elem)}
        emissiveIntensity={sel?0.08:hov?0.04:0.01} roughness={0.55} metalness={0.05}
        transmission={0.15} thickness={0.5}/>
    </mesh>
  );
}
function BondM({ s, e, c }: { s:Vec3; e:Vec3; c:string }) {
  const { mid, len, q } = useMemo(() => {
    const sv=new THREE.Vector3(...s), ev=new THREE.Vector3(...e);
    const dir=new THREE.Vector3().subVectors(ev,sv);
    return { mid:sv.clone().add(ev).multiplyScalar(0.5), len:dir.length(), q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()) };
  },[s,e]);
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.018,0.018,len,8,1]}/>
      <meshPhysicalMaterial color={c} emissive={c} emissiveIntensity={0.03} roughness={0.6} transmission={0.1}/>
    </mesh>
  );
}

// ─── Molecular Node ───────────────────────────────────────────────────
function MolNode({ node, hov, sel, cc, onClick, onHov }: {
  node:PathwayNode; hov:boolean; sel:boolean; cc:number;
  onClick:(n:PathwayNode)=>void; onHov:(id:string|null)=>void;
}) {
  const grp=useRef<THREE.Group>(null), body=useRef<THREE.Mesh>(null);
  const orb=useRef<THREE.Group>(null), ring=useRef<THREE.Mesh>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80 + hash(node.id) % 320);
    return () => clearTimeout(t);
  }, [node.id]);

  const color  = getColor(node), conf = getConf(node);
  const lbl    = node.canonicalLabel?.trim() || node.label;
  const norm   = useMemo(() => node.molecularStructure ? normalizeStruct(node.molecularStructure) : null, [node.molecularStructure]);
  const cfg    = useMemo(() => glyphCfg(node.id, cc), [node.id, cc]);
  const tgt    = sel ? 1.28 : hov ? 1.10 : 1.0;
  const bndC   = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#c8d8e8'),0.3).getStyle(), [color]);
  const colVec = useMemo(() => new THREE.Color(color), [color]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (grp.current) {
      const cs = grp.current.scale.x;
      grp.current.scale.setScalar(cs + ((ready?tgt:0.001) - cs) * dt * 5);
      grp.current.position.y = node.position[1] + Math.sin(t*0.4+hash(node.id)*0.01)*0.06;
      grp.current.rotation.y = Math.sin(t*0.06+hash(node.id)*0.001)*0.05;
    }
    if (body.current) {
      const mat = body.current.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity += ((sel?0.14:hov?0.08:0.025) - mat.emissiveIntensity) * dt * 3;
      body.current.rotation.y += dt * cfg.spin * 0.6;
    }
    if (orb.current) orb.current.rotation.y = t*0.10 + cfg.spin*3;
    if (ring.current) {
      ring.current.rotation.z += dt * 0.10;
      const mat = ring.current.material as THREE.MeshPhysicalMaterial;
      mat.opacity += ((hov||sel?0.35:0.08) - mat.opacity) * dt * 3;
    }
  });

  const fallback = (
    <>
      {cfg.rr.map((r,i) => (
        <mesh key={`r${i}`} ref={i===0?ring:undefined} rotation={[cfg.rt[i]||0,0,i*1.1]}>
          <torusGeometry args={[r,0.009,5,40]}/>
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.05} transparent opacity={0.09} roughness={0.6} depthWrite={false}/>
        </mesh>
      ))}
      <group ref={orb}>
        {Array.from({length:cfg.sats}).map((_,i) => {
          const phi=Math.acos(1-(2*(i+0.5))/cfg.sats), theta=Math.PI*(1+Math.sqrt(5))*i;
          return (
            <mesh key={`s${i}`} position={[Math.sin(phi)*Math.cos(theta)*cfg.sr, Math.sin(phi)*Math.sin(theta)*cfg.sr, Math.cos(phi)*cfg.sr]}>
              <sphereGeometry args={[cfg.ss,7,7]}/>
              <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.06} transparent opacity={0.22} roughness={0.5}/>
            </mesh>
          );
        })}
      </group>
      {cfg.inner && (
        <mesh>
          <octahedronGeometry args={[cfg.scale*0.35,0]}/>
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.10} transparent opacity={0.55} roughness={0.4} transmission={0.2}/>
        </mesh>
      )}
      <mesh ref={body}>
        <GeoComp g={cfg.geom} s={cfg.scale}/>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.025} roughness={0.52} transmission={0.08} thickness={0.6} transparent opacity={0.92}/>
      </mesh>
      <mesh>
        <GeoComp g={cfg.geom} s={cfg.scale*1.12}/>
        <meshPhysicalMaterial color={color} transparent opacity={hov||sel?0.07:0.025} roughness={1} depthWrite={false} transmission={0.5}/>
      </mesh>
    </>
  );

  const structural = norm ? (
    <>
      {norm.bonds.map((b,i) => { const a=norm.atoms[b.atomIndex1],bv=norm.atoms[b.atomIndex2]; if(!a||!bv) return null; return <BondM key={i} s={a.position} e={bv.position} c={bndC}/>; })}
      {norm.atoms.map((a,i) => <AtomM key={i} pos={a.position} elem={a.element} hov={hov} sel={sel}/>)}
    </>
  ) : null;

  return (
    <group ref={grp} position={node.position}
      onClick={e=>{e.stopPropagation();onClick(node);}}
      onPointerOver={e=>{e.stopPropagation();onHov(node.id);document.body.style.cursor='pointer';}}
      onPointerOut={e=>{e.stopPropagation();onHov(null);document.body.style.cursor='auto';}}
    >
      {norm?structural:fallback}
      <Html position={[0,-(cfg.scale+0.52),0]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}>
        <div style={{color:hov||sel?'rgba(220,232,242,0.90)':'rgba(160,180,200,0.55)',fontSize:'10px',fontWeight:sel?600:400,fontFamily:"'Public Sans',sans-serif",letterSpacing:'0.02em',textShadow:'0 1px 12px rgba(0,0,0,0.9)',padding:'2px 7px',background:sel?'rgba(200,216,232,0.07)':'transparent',borderRadius:'4px',border:sel?'1px solid rgba(200,216,232,0.14)':'1px solid transparent'}}>
          {lbl}
        </div>
      </Html>
      {hov&&!sel&&(
        <Html distanceFactor={10} center style={{pointerEvents:'none',zIndex:100}}>
          <div style={{background:'rgba(6,9,16,0.95)',border:'1px solid rgba(200,216,232,0.12)',borderRadius:'16px',padding:'10px 14px',width:'196px',backdropFilter:'blur(20px)',transform:'translateY(-120%)',fontFamily:"'Public Sans',sans-serif"}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{color:'#c8d8e4',fontSize:'12px',fontWeight:600}}>{lbl}</span>
              <span style={{color:'rgba(255,255,255,0.3)',fontSize:'10px',fontFeatureSettings:"'tnum' 1"}}>{Math.round(conf*100)}%</span>
            </div>
            {node.nodeType&&node.nodeType!=='unknown'&&<span style={{color:'rgba(200,216,232,0.5)',fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:'5px',fontWeight:700}}>{node.nodeType}</span>}
            <p style={{color:'rgba(180,200,215,0.42)',fontSize:'11px',lineHeight:1.6,margin:'0 0 7px'}}>{node.summary?.slice(0,80)}...</p>
            <div style={{width:'100%',height:'2px',background:'rgba(255,255,255,0.06)',borderRadius:'1px'}}>
              <div style={{width:`${Math.round(conf*100)}%`,height:'100%',background:colVec.getStyle(),borderRadius:'1px',opacity:0.8}}/>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Edge ─────────────────────────────────────────────────────────────
function PathEdge({ s, e, active, color }: { s:Vec3; e:Vec3; active:boolean; color:string }) {
  const dot=useRef<THREE.Mesh>(null), prog=useRef(Math.random());
  const sv=useMemo(()=>new THREE.Vector3(...s),[s]);
  const ev=useMemo(()=>new THREE.Vector3(...e),[e]);
  const mid=useMemo(()=>sv.clone().lerp(ev,0.5).add(new THREE.Vector3(0,0.4,0)),[sv,ev]);
  useFrame((_,dt)=>{
    prog.current=(prog.current+dt*0.18)%1;
    if(dot.current){
      const t=prog.current;
      dot.current.position.copy(new THREE.Vector3().addScaledVector(sv,(1-t)*(1-t)).addScaledVector(mid,2*(1-t)*t).addScaledVector(ev,t*t));
      dot.current.visible=active;
    }
  });
  return (
    <group>
      <Line points={[sv,mid,ev]} color={active?color:'#141e2a'} lineWidth={active?0.8:0.25} transparent opacity={active?0.55:0.12}/>
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.035,5,5]}/>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.7}/>
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────
function Scene({ nodes, edges, onNodeClick, selectedNodeId }: {
  nodes:PathwayNode[]; edges:PathwayEdge[];
  onNodeClick:(n:PathwayNode)=>void; selectedNodeId:string|null;
}) {
  const [hovId, setHovId] = useState<string|null>(null);
  const [interact, setInteract] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart = useCallback(()=>{ setInteract(true); if(timer.current) clearTimeout(timer.current); },[]);
  const onEnd   = useCallback(()=>{ timer.current=setTimeout(()=>setInteract(false),3500); },[]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);

  const cc = useMemo(()=>{
    const c:Record<string,number>={};
    nodes.forEach(n=>{c[n.id]=0;});
    edges.forEach(e=>{if(c[e.start]!==undefined)c[e.start]++;if(c[e.end]!==undefined)c[e.end]++;});
    return c;
  },[nodes,edges]);

  const ed = useMemo(()=>edges.map(edge=>{
    const s=nodes.find(n=>n.id===edge.start), e=nodes.find(n=>n.id===edge.end);
    if(!s||!e) return null;
    return{key:`${edge.start}-${edge.end}`,s,e,active:hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end,color:getColor(s)};
  }).filter(Boolean) as{key:string;s:PathwayNode;e:PathwayNode;active:boolean;color:string}[],[edges,nodes,hovId,selectedNodeId]);

  // BaseField reactive states
  const analysisMode = selectedNodeId !== null;
  const hoveredNode  = useMemo(()=>nodes.find(n=>n.id===hovId),[nodes,hovId]);
  const hoverPos     = useMemo(()=>hoveredNode?new THREE.Vector3(...hoveredNode.position):new THREE.Vector3(),[hoveredNode]);
  const selectedNode = useMemo(()=>nodes.find(n=>n.id===selectedNodeId),[nodes,selectedNodeId]);
  const clickPos     = useMemo(()=>selectedNode?new THREE.Vector3(...selectedNode.position):new THREE.Vector3(),[selectedNode]);

  return (
    <>
      <ambientLight intensity={0.85} color="#d0dcec"/>
      <directionalLight position={[4,10,6]} intensity={0.35} color="#e8f0f8"/>
      <directionalLight position={[-8,-2,-6]} intensity={0.12} color="#1a2840"/>
      <pointLight position={[0,6,0]} intensity={0.20} color="#c0d0e8" distance={28} decay={2}/>
      <fog attach="fog" args={['#070a0e',18,48]}/>

      <OrbitControls enableZoom autoRotate={!interact&&!hovId&&!selectedNodeId} autoRotateSpeed={0.12}
        zoomSpeed={0.45} minDistance={5} maxDistance={26} enablePan={false} onStart={onStart} onEnd={onEnd}/>

      {/* Perlin noise field — mouse reactive */}
      <BaseField analysisMode={analysisMode} hoverPos={hoverPos} hoverState={hoveredNode?1:0}
        clickPos={clickPos} clickState={selectedNode?1:0}/>

      {/* Ambient star particles */}
      <Stars radius={35} depth={18} count={600} factor={2} saturation={0} fade speed={0.4}/>

      {ed.map(e=><PathEdge key={e.key} s={e.s.position} e={e.e.position} active={e.active} color={e.color}/>)}
      {nodes.map(n=><MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId}/>)}
    </>
  );
}

const DEF_EDGES: PathwayEdge[] = [
  {start:'acetyl_coa',end:'hmg_coa',relationshipType:'converts',direction:'forward'},
  {start:'acetyl_coa',end:'mevalonate',relationshipType:'produces',direction:'forward'},
  {start:'hmg_coa',end:'mevalonate',relationshipType:'converts',direction:'forward'},
  {start:'mevalonate',end:'fpp',relationshipType:'produces',direction:'forward'},
  {start:'fpp',end:'amorpha_4_11_diene',relationshipType:'catalyzes',direction:'forward'},
  {start:'amorpha_4_11_diene',end:'artemisinic_acid',relationshipType:'converts',direction:'forward'},
  {start:'artemisinic_acid',end:'artemisinin',relationshipType:'produces',direction:'forward'},
];

interface Props { nodes:PathwayNode[]; onNodeClick:(node:PathwayNode)=>void; edges?:PathwayEdge[]; selectedNodeId?:string|null; }

export default function ThreeScene({ nodes, onNodeClick, edges, selectedNodeId }: Props) {
  return (
    <div style={{
      width:'100%', height:'clamp(500px,65vh,760px)',
      background:'linear-gradient(180deg,#060810 0%,#08090f 100%)',
      borderRadius:'20px', overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.06)',
      position:'relative',
      boxShadow:'0 32px 80px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',background:'linear-gradient(to bottom,rgba(6,8,16,0.92),transparent)',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
          <div style={{display:'flex',gap:'4px'}}>
            {['rgba(200,216,232,0.35)','rgba(200,224,208,0.3)','rgba(221,208,232,0.3)'].map((c,i)=>(
              <div key={i} style={{width:'4px',height:'4px',borderRadius:'50%',background:c}}/>
            ))}
          </div>
          <span style={{color:'rgba(255,255,255,0.20)',fontSize:'10px',fontFamily:"'Public Sans',sans-serif",fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>
            METABOLIC · {nodes.length} ENTITIES
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {edges&&<span style={{color:'rgba(200,216,232,0.40)',fontSize:'9px',fontFamily:"'Public Sans',sans-serif",padding:'2px 8px',border:'1px solid rgba(200,216,232,0.14)',borderRadius:'99px'}}>AI GENERATED</span>}
          <span style={{color:'rgba(255,255,255,0.10)',fontSize:'9px',fontFamily:"'Public Sans',sans-serif"}}>drag · scroll · click</span>
        </div>
      </div>

      {/* pLDDT legend */}
      <div style={{position:'absolute',bottom:'13px',left:'13px',zIndex:10}}>
        <p style={{color:'rgba(255,255,255,0.12)',fontSize:'8px',fontFamily:"'Public Sans',sans-serif",fontWeight:700,margin:'0 0 4px',letterSpacing:'0.07em',textTransform:'uppercase'}}>CONFIDENCE</p>
        {[{c:'#C8D8E8',l:'>90'},{c:'#C8E0D0',l:'70–90'},{c:'#E8DCC8',l:'50–70'},{c:'#E8C8D4',l:'<50'}].map(x=>(
          <div key={x.l} style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'2px'}}>
            <div style={{width:'12px',height:'2px',background:x.c,borderRadius:'1px',opacity:0.65}}/>
            <span style={{color:'rgba(255,255,255,0.14)',fontSize:'8px',fontFamily:"'Public Sans',sans-serif",fontFeatureSettings:"'tnum' 1"}}>{x.l}</span>
          </div>
        ))}
      </div>

      <Canvas
        camera={{position:[0,5,15],fov:44}}
        gl={{antialias:true,powerPreference:'high-performance',alpha:false,toneMapping:THREE.LinearToneMapping,toneMappingExposure:1.0}}
        dpr={[1,1.5]} performance={{min:0.5}}
        onCreated={({gl})=>{gl.setClearColor(new THREE.Color('#060810'),1);}}
        style={{background:'transparent'}}
      >
        <Scene nodes={nodes} edges={edges??DEF_EDGES} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId??null}/>
      </Canvas>
    </div>
  );
}
