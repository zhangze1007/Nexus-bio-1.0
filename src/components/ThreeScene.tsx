import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PathwayNode, PathwayEdge, MolecularStructure } from '../types';

type Vec3 = [number, number, number];

// ─── Hash ─────────────────────────────────────────────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
function hashFloat(str: string, idx: number, min = 0, max = 1) {
  return min + ((hash(str + idx) % 10000) / 10000) * (max - min);
}
function hashInt(str: string, idx: number, min: number, max: number) {
  return min + (hash(str + idx) % (max - min + 1));
}

// ─── Pastel palette ───────────────────────────────────────────────────
const PASTEL = [
  '#C8D8E8','#C8E0D0','#DDD0E8','#E8DCC8',
  '#C8DCDC','#DCE8C8','#E8C8D4','#CCE0D8',
];
const NODE_CONF: Record<string, number> = {
  acetyl_coa:85, hmg_coa:72, mevalonate:68,
  fpp:91, amorpha_4_11_diene:88,
  artemisinic_acid:76, artemisinin:93,
};
function conf2pastel(p:number):string {
  if(p>=90) return '#C8D8E8';
  if(p>=70) return '#C8E0D0';
  if(p>=50) return '#E8DCC8';
  return '#E8C8D4';
}
function getColor(node:PathwayNode):string {
  const c=NODE_CONF[node.id];
  if(c!==undefined) return conf2pastel(c);
  return PASTEL[hash(node.id)%PASTEL.length];
}
function getConf(node:PathwayNode):number {
  if(node.confidenceScore!==undefined) return node.confidenceScore;
  const c=NODE_CONF[node.id];
  return c!==undefined?c/100:0.75;
}

// ─── Element colors ───────────────────────────────────────────────────
const EC:Record<string,string>={H:'#E8EEF4',C:'#8A9BAA',N:'#A8BED8',O:'#D8B8A8',P:'#D8D4A8',S:'#B8D8C8',DEFAULT:'#B0BEC8'};
const ER:Record<string,number>={H:0.09,C:0.17,N:0.16,O:0.15,P:0.19,S:0.20,DEFAULT:0.17};
const ec=(e:string)=>EC[e.toUpperCase()]??EC.DEFAULT;
const er=(e:string)=>ER[e.toUpperCase()]??ER.DEFAULT;

function normalizeStruct(s:MolecularStructure){
  if(!s.atoms?.length) return null;
  const vecs=s.atoms.map(a=>new THREE.Vector3(...a.position));
  const ctr=vecs.reduce((acc,v)=>acc.add(v),new THREE.Vector3()).multiplyScalar(1/vecs.length);
  const shifted=vecs.map(v=>v.clone().sub(ctr));
  const maxD=Math.max(0.001,...shifted.map(v=>v.length()));
  const scale=0.42/maxD;
  return{atoms:s.atoms.map((a,i)=>({...a,position:shifted[i].multiplyScalar(scale).toArray() as Vec3})),bonds:s.bonds??[]};
}

// ─── Glyph config ─────────────────────────────────────────────────────
type GCfg={geom:'oct'|'dodec'|'tetra'|'icos'|'sph'|'tor';scale:number;rings:number;rr:number[];rt:number[];sats:number;sr:number;ss:number;spin:number;rs:number[];inner:boolean;};
function glyphCfg(id:string,cc:number):GCfg{
  const gs=['oct','dodec','tetra','icos','sph','tor'] as GCfg['geom'][];
  const rc=hashInt(id,1,1,3);
  return{geom:gs[hashInt(id,0,0,5)],scale:0.24+cc*0.045+hashFloat(id,2,0,0.05),rings:rc,rr:Array.from({length:rc},(_,i)=>hashFloat(id,10+i,0.45,0.85)),rt:Array.from({length:rc},(_,i)=>hashFloat(id,20+i,0,Math.PI)),sats:hashInt(id,3,2,5),sr:hashFloat(id,4,0.55,0.95),ss:hashFloat(id,5,0.04,0.07),spin:hashFloat(id,6,0.06,0.14),rs:Array.from({length:rc},(_,i)=>hashFloat(id,30+i,0.1,0.35)*(i%2?-1:1)),inner:hash(id)%3===0};
}
function GeoComp({g,s}:{g:GCfg['geom'];s:number}){
  switch(g){case'oct':return<octahedronGeometry args={[s,0]}/>;case'dodec':return<dodecahedronGeometry args={[s,0]}/>;case'tetra':return<tetrahedronGeometry args={[s,0]}/>;case'icos':return<icosahedronGeometry args={[s,1]}/>;case'tor':return<torusGeometry args={[s*0.8,s*0.32,8,20]}/>;default:return<sphereGeometry args={[s,14,14]}/>;}
}

// ─── Noise Terrain Background (WebGPU-style, Image 2 aesthetic) ──────
// GLSL vertex displacement — no gl_PointSize, no crash risk
const TERRAIN_VERT = `
  uniform float uTime;
  varying float vHeight;
  varying vec2  vUv;

  // Simplex-inspired noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = fract(sin(dot(i,             vec2(127.1,311.7)))*43758.5453);
    float b = fract(sin(dot(i+vec2(1,0),   vec2(127.1,311.7)))*43758.5453);
    float c = fract(sin(dot(i+vec2(0,1),   vec2(127.1,311.7)))*43758.5453);
    float d = fract(sin(dot(i+vec2(1,1),   vec2(127.1,311.7)))*43758.5453);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for(int i=0;i<5;i++){
      v += a * noise(p);
      p  = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vUv = uv;
    vec2 p  = position.xz * 0.28 + uTime * 0.04;
    float h = fbm(p) * 2.8;
    h      *= smoothstep(0.0, 0.5, 1.0 - length(position.xz / 18.0));
    vHeight = h;
    vec3 pos = position + vec3(0.0, h, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TERRAIN_FRAG = `
  uniform float uTime;
  varying float vHeight;
  varying vec2  vUv;

  void main() {
    // Blue → cyan gradient based on height, matching Image 2
    vec3 lo = vec3(0.05, 0.06, 0.22);   // deep navy
    vec3 hi = vec3(0.18, 0.30, 0.72);   // bright blue
    vec3 col = mix(lo, hi, clamp(vHeight / 2.8, 0.0, 1.0));

    // Edge glow on tall spikes
    col += vec3(0.05, 0.10, 0.30) * smoothstep(1.8, 2.8, vHeight);

    // Subtle pulse
    col *= 0.88 + 0.12 * sin(uTime * 0.6);

    float alpha = 0.55 + 0.15 * clamp(vHeight / 2.8, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function NoiseTerrain() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(36, 36, 120, 120);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geo} position={[0, -4.5, 0]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={TERRAIN_VERT}
        fragmentShader={TERRAIN_FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  );
}

// ─── Atom / Bond ───────────────────────────────────────────────────────
function AtomM({pos,elem,hov,sel}:{pos:Vec3;elem:string;hov:boolean;sel:boolean}){
  return(
    <mesh position={pos}>
      <sphereGeometry args={[er(elem),12,12]}/>
      <meshLambertMaterial color={sel?'#f0f4f8':ec(elem)} emissive={ec(elem)} emissiveIntensity={sel?0.12:hov?0.07:0.02}/>
    </mesh>
  );
}
function BondM({s,e,c}:{s:Vec3;e:Vec3;c:string}){
  const{mid,len,q}=useMemo(()=>{
    const sv=new THREE.Vector3(...s),ev=new THREE.Vector3(...e);
    const dir=new THREE.Vector3().subVectors(ev,sv);
    const len=dir.length();
    return{mid:sv.clone().add(ev).multiplyScalar(0.5),len,q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())};
  },[s,e]);
  return(
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.022,0.022,len,8,1]}/>
      <meshLambertMaterial color={c} emissive={c} emissiveIntensity={0.05}/>
    </mesh>
  );
}

// ─── Molecular Node ───────────────────────────────────────────────────
function MolNode({node,hov,sel,cc,onClick,onHov}:{
  node:PathwayNode;hov:boolean;sel:boolean;cc:number;
  onClick:(n:PathwayNode)=>void;onHov:(id:string|null)=>void;
}){
  const grp=useRef<THREE.Group>(null);
  const body=useRef<THREE.Mesh>(null);
  const orb=useRef<THREE.Group>(null);
  const ringMesh=useRef<THREE.Mesh>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const t=setTimeout(()=>setReady(true),120+hash(node.id)%380);
    return()=>clearTimeout(t);
  },[node.id]);

  const color=getColor(node);
  const conf=getConf(node);
  const lbl=node.canonicalLabel?.trim()||node.label;
  const norm=useMemo(()=>node.molecularStructure?normalizeStruct(node.molecularStructure):null,[node.molecularStructure]);
  const cfg=useMemo(()=>glyphCfg(node.id,cc),[node.id,cc]);
  const tgt=sel?1.32:hov?1.12:1.0;
  const bndC=useMemo(()=>new THREE.Color(color).lerp(new THREE.Color('#e0e8f0'),0.2).getStyle(),[color]);

  useEffect(()=>()=>{document.body.style.cursor='auto';},[]);

  useFrame((_s,dt)=>{
    const t=_s.clock.elapsedTime;
    if(grp.current){
      const cs=grp.current.scale.x;
      const dissolveTarget=ready?tgt:0.001;
      grp.current.scale.setScalar(cs+(dissolveTarget-cs)*dt*6);
      grp.current.rotation.y=Math.sin(t*0.05+hash(node.id)*0.001)*0.06;
    }
    if(body.current){
      const mat=body.current.material as THREE.MeshLambertMaterial;
      const tEmi=sel?0.18:hov?0.10:0.04;
      mat.emissiveIntensity+=(tEmi-mat.emissiveIntensity)*dt*4;
      body.current.rotation.y+=dt*cfg.spin;
    }
    if(orb.current) orb.current.rotation.y=_s.clock.elapsedTime*0.12+cfg.spin*3;
    if(ringMesh.current){
      ringMesh.current.rotation.z+=dt*0.14;
      const mat=ringMesh.current.material as THREE.MeshLambertMaterial;
      const to=hov||sel?0.42:0.12;
      mat.opacity+=(to-mat.opacity)*dt*4;
    }
  });

  const fallback=(
    <>
      {cfg.rr.map((r,i)=>(
        <mesh key={`r${i}`} ref={i===0?ringMesh:undefined} rotation={[cfg.rt[i]||0,0,i*1.1]}>
          <torusGeometry args={[r,0.011,6,44]}/>
          <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.08} transparent opacity={0.14} depthWrite={false}/>
        </mesh>
      ))}
      <group ref={orb}>
        {Array.from({length:cfg.sats}).map((_,i)=>{
          const phi=Math.acos(1-(2*(i+0.5))/cfg.sats);
          const theta=Math.PI*(1+Math.sqrt(5))*i;
          return(
            <mesh key={`s${i}`} position={[Math.sin(phi)*Math.cos(theta)*cfg.sr,Math.sin(phi)*Math.sin(theta)*cfg.sr,Math.cos(phi)*cfg.sr]}>
              <sphereGeometry args={[cfg.ss,7,7]}/>
              <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.08} transparent opacity={0.32}/>
            </mesh>
          );
        })}
      </group>
      {cfg.inner&&(
        <mesh>
          <octahedronGeometry args={[cfg.scale*0.38,0]}/>
          <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.12} transparent opacity={0.7}/>
        </mesh>
      )}
      <mesh ref={body}>
        <GeoComp g={cfg.geom} s={cfg.scale}/>
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.04}/>
      </mesh>
      <mesh>
        <GeoComp g={cfg.geom} s={cfg.scale*1.04}/>
        <meshLambertMaterial color={color} transparent opacity={hov||sel?0.10:0.03} wireframe/>
      </mesh>
    </>
  );

  const structural=norm?(
    <>
      {norm.bonds.map((b,i)=>{
        const a=norm.atoms[b.atomIndex1],bv=norm.atoms[b.atomIndex2];
        if(!a||!bv) return null;
        return<BondM key={i} s={a.position} e={bv.position} c={bndC}/>;
      })}
      {norm.atoms.map((a,i)=><AtomM key={i} pos={a.position} elem={a.element} hov={hov} sel={sel}/>)}
    </>
  ):null;

  return(
    <group ref={grp} position={node.position}
      onClick={e=>{e.stopPropagation();onClick(node);}}
      onPointerOver={e=>{e.stopPropagation();onHov(node.id);document.body.style.cursor='pointer';}}
      onPointerOut={e=>{e.stopPropagation();onHov(null);document.body.style.cursor='auto';}}
    >
      {norm?structural:fallback}
      <Html position={[0,-(cfg.scale+0.48),0]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}>
        <div style={{color:hov||sel?'#d0dce8':'#6a7a88',fontSize:'10px',fontWeight:sel?600:400,fontFamily:"'Public Sans',sans-serif",letterSpacing:'0.025em',textShadow:'0 1px 8px rgba(0,0,0,1)',padding:'2px 6px',background:sel?'rgba(200,216,232,0.08)':'transparent',borderRadius:'4px',border:sel?'1px solid rgba(200,216,232,0.18)':'1px solid transparent'}}>
          {lbl}
        </div>
      </Html>
      {hov&&!sel&&(
        <Html distanceFactor={10} center style={{pointerEvents:'none',zIndex:100}}>
          <div style={{background:'rgba(8,12,18,0.97)',border:'1px solid rgba(200,216,232,0.14)',borderRadius:'16px',padding:'10px 13px',width:'200px',backdropFilter:'blur(16px)',transform:'translateY(-118%)',fontFamily:"'Public Sans',sans-serif"}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{color:'#c8d8e4',fontSize:'12px',fontWeight:600}}>{lbl}</span>
              <span style={{color:'rgba(255,255,255,0.24)',fontSize:'10px',fontFeatureSettings:"'tnum' 1"}}>
                {Math.round(conf*100)}%
              </span>
            </div>
            <p style={{color:'rgba(180,200,215,0.45)',fontSize:'11px',lineHeight:1.6,margin:'0 0 7px'}}>{node.summary?.slice(0,85)}...</p>
            <div style={{width:'100%',height:'2px',background:'rgba(255,255,255,0.05)',borderRadius:'1px'}}>
              <div style={{width:`${Math.round(conf*100)}%`,height:'100%',background:'#C8D8E8',borderRadius:'1px'}}/>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────
function Grid(){
  return(
    <group position={[0,-3.8,0]}>
      <gridHelper args={[36,36,'#1a1a2e','#12121e']}/>
      <Line points={[new THREE.Vector3(-9,0,0),new THREE.Vector3(9,0,0)]} color="#A8C5DA" lineWidth={0.5} transparent opacity={0.15}/>
      <Line points={[new THREE.Vector3(0,0,-9),new THREE.Vector3(0,0,9)]} color="#C8E0D0" lineWidth={0.5} transparent opacity={0.15}/>
    </group>
  );
}

// ─── Edge ─────────────────────────────────────────────────────────────
function PathEdge({s,e,active,color}:{s:Vec3;e:Vec3;active:boolean;color:string}){
  const dot=useRef<THREE.Mesh>(null);
  const prog=useRef(Math.random());
  const sv=useMemo(()=>new THREE.Vector3(...s),[s]);
  const ev=useMemo(()=>new THREE.Vector3(...e),[e]);
  const mid=useMemo(()=>sv.clone().lerp(ev,0.5).add(new THREE.Vector3(0,0.5,0)),[sv,ev]);
  useFrame((_,dt)=>{
    prog.current=(prog.current+dt*0.2)%1;
    if(dot.current){
      const t=prog.current;
      dot.current.position.copy(new THREE.Vector3().addScaledVector(sv,(1-t)*(1-t)).addScaledVector(mid,2*(1-t)*t).addScaledVector(ev,t*t));
      dot.current.visible=active;
    }
  });
  return(
    <group>
      <Line points={[sv,mid,ev]} color={active?color:'#1e2d38'} lineWidth={active?1.0:0.35} transparent opacity={active?0.7:0.18}/>
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.04,6,6]}/>
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.4}/>
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────
function Scene({nodes,edges,onNodeClick,selectedNodeId}:{
  nodes:PathwayNode[];edges:PathwayEdge[];
  onNodeClick:(n:PathwayNode)=>void;selectedNodeId:string|null;
}){
  const[hovId,setHovId]=useState<string|null>(null);
  const[interact,setInteract]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const onStart=useCallback(()=>{setInteract(true);if(timer.current)clearTimeout(timer.current);},[]);
  const onEnd=useCallback(()=>{timer.current=setTimeout(()=>setInteract(false),3500);},[]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);

  const cc=useMemo(()=>{
    const c:Record<string,number>={};
    nodes.forEach(n=>{c[n.id]=0;});
    edges.forEach(e=>{if(c[e.start]!==undefined)c[e.start]++;if(c[e.end]!==undefined)c[e.end]++;});
    return c;
  },[nodes,edges]);

  const ed=useMemo(()=>edges.map(edge=>{
    const s=nodes.find(n=>n.id===edge.start);
    const e=nodes.find(n=>n.id===edge.end);
    if(!s||!e) return null;
    return{key:`${edge.start}-${edge.end}`,s,e,active:hovId===edge.start||hovId===edge.end||selectedNodeId===edge.start||selectedNodeId===edge.end,color:getColor(s)};
  }).filter(Boolean) as{key:string;s:PathwayNode;e:PathwayNode;active:boolean;color:string}[],
    [edges,nodes,hovId,selectedNodeId]);

  return(
    <>
      <ambientLight intensity={1.2} color="#d8e4ee"/>
      <hemisphereLight args={['#c8d8e8','#0a0d16',0.6]}/>
      <fog attach="fog" args={['#070a10',22,52]}/>
      <OrbitControls enableZoom autoRotate={!interact&&!hovId&&!selectedNodeId} autoRotateSpeed={0.15} zoomSpeed={0.5} minDistance={5} maxDistance={26} enablePan={false} onStart={onStart} onEnd={onEnd}/>

      {/* Noise terrain background */}
      <NoiseTerrain/>

      <Grid/>
      {ed.map(e=><PathEdge key={e.key} s={e.s.position} e={e.e.position} active={e.active} color={e.color}/>)}
      {nodes.map(n=><MolNode key={n.id} node={n} hov={hovId===n.id} sel={selectedNodeId===n.id} cc={cc[n.id]??0} onClick={onNodeClick} onHov={setHovId}/>)}
    </>
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────
const DEF_EDGES:PathwayEdge[]=[
  {start:'acetyl_coa',end:'hmg_coa',relationshipType:'converts',direction:'forward'},
  {start:'acetyl_coa',end:'mevalonate',relationshipType:'produces',direction:'forward'},
  {start:'hmg_coa',end:'mevalonate',relationshipType:'converts',direction:'forward'},
  {start:'mevalonate',end:'fpp',relationshipType:'produces',direction:'forward'},
  {start:'fpp',end:'amorpha_4_11_diene',relationshipType:'catalyzes',direction:'forward'},
  {start:'amorpha_4_11_diene',end:'artemisinic_acid',relationshipType:'converts',direction:'forward'},
  {start:'artemisinic_acid',end:'artemisinin',relationshipType:'produces',direction:'forward'},
];

interface Props{nodes:PathwayNode[];onNodeClick:(node:PathwayNode)=>void;edges?:PathwayEdge[];selectedNodeId?:string|null;}

export default function ThreeScene({nodes,onNodeClick,edges,selectedNodeId}:Props){
  return(
    <div style={{
      width:'100%',height:'clamp(500px,65vh,760px)',
      background:'linear-gradient(180deg,#07090f 0%,#0a0d14 100%)',
      borderRadius:'20px',overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.07)',
      position:'relative',
      boxShadow:'0 24px 80px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'linear-gradient(to bottom,rgba(7,9,15,0.96),transparent)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{display:'flex',gap:'5px'}}>
            <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'rgba(200,216,232,0.4)'}}/>
            <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'rgba(200,224,208,0.35)'}}/>
            <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'rgba(221,208,232,0.35)'}}/>
          </div>
          <span style={{color:'rgba(255,255,255,0.22)',fontSize:'10px',fontFamily:"'Public Sans',sans-serif",fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>
            METABOLIC · {nodes.length} ENTITIES
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {edges&&(
            <span style={{color:'rgba(200,216,232,0.5)',fontSize:'9px',fontFamily:"'Public Sans',sans-serif",padding:'2px 8px',border:'1px solid rgba(200,216,232,0.15)',borderRadius:'99px'}}>
              AI GENERATED
            </span>
          )}
          <span style={{color:'rgba(255,255,255,0.12)',fontSize:'9px',fontFamily:"'Public Sans',sans-serif"}}>
            drag · scroll · click
          </span>
        </div>
      </div>

      {/* pLDDT legend — bottom left */}
      <div style={{position:'absolute',bottom:'14px',left:'14px',zIndex:10}}>
        <p style={{color:'rgba(255,255,255,0.15)',fontSize:'8px',fontFamily:"'Public Sans',sans-serif",fontWeight:700,margin:'0 0 5px',letterSpacing:'0.07em',textTransform:'uppercase'}}>CONFIDENCE</p>
        {[{c:'#C8D8E8',l:'>90'},{c:'#C8E0D0',l:'70–90'},{c:'#E8DCC8',l:'50–70'},{c:'#E8C8D4',l:'<50'}].map(x=>(
          <div key={x.l} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px'}}>
            <div style={{width:'14px',height:'3px',background:x.c,borderRadius:'1.5px',opacity:0.8}}/>
            <span style={{color:'rgba(255,255,255,0.2)',fontSize:'8px',fontFamily:"'Public Sans',sans-serif",fontFeatureSettings:"'tnum' 1"}}>{x.l}</span>
          </div>
        ))}
      </div>

      <Canvas
        camera={{position:[0,4,14],fov:46}}
        gl={{antialias:true,powerPreference:'high-performance',alpha:false,toneMapping:THREE.LinearToneMapping,toneMappingExposure:1.0}}
        dpr={[1,1.5]}
        performance={{min:0.5}}
        onCreated={({gl})=>{gl.setClearColor(new THREE.Color('#07090f'),1);}}
        style={{background:'transparent'}}
      >
        <Scene nodes={nodes} edges={edges??DEF_EDGES} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId??null}/>
      </Canvas>
    </div>
  );
}
