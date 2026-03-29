'use client';
/**
 * Nexus-Bio — FluidSimCanvas
 *
 * Architecture:
 *   Layer 0 (z=0): WebGL2 Navier-Stokes cytoplasm fluid — standalone <canvas>
 *   Layer 1 (z=1): R3F scene — InstancedMesh metabolite molecules
 *   Layer 2 (z=2): Blueprint grid overlay (SVG)
 *
 * GPU Instancing: 8000 metabolite instances — single draw call
 * Frustum culling: enabled (Three.js default)
 * No gl_PointSize anywhere
 *
 * Fluid perturbation: velocity vector dP/dt injected from parent
 * via fluidForceRef — synced to RAF, never blocks main thread
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MachineState } from '../../machines/metabolicMachine';

// ─────────────────────────────────────────────────────────────────────────────
// WebGL2 Navier-Stokes cytoplasm fluid (ping-pong FBO)
// Identical pipeline to FluidBackground but tuned for cyan/teal bio palette
// ─────────────────────────────────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos,0,1); }`;

const FBM_GLSL = `
float _h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float _n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
  return mix(mix(_h(i),_h(i+vec2(1,0)),u.x),mix(_h(i+vec2(0,1)),_h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*_n(p);p*=2.;a*=.5;}return v;}`;

const ADVECT = `#version 300 es
precision highp float;
uniform sampler2D u_vel,u_src;
uniform float u_dt,u_diss,u_time;
uniform vec2 u_txl;
in vec2 v_uv; out vec4 o;
${FBM_GLSL}
void main(){
  vec2 v=texture(u_vel,v_uv).xy;
  float t=u_time*.25;
  vec2 n=vec2(fbm(v_uv*5.+vec2(t,0))-.5,fbm(v_uv*5.+vec2(0,t+1.7))-.5)*.015;
  vec2 c=clamp(v_uv-(v+n)*u_dt,u_txl,1.-u_txl);
  o=u_diss*texture(u_src,c);
}`;

const DIVG = `#version 300 es
precision highp float;
uniform sampler2D u_vel; uniform vec2 u_txl;
in vec2 v_uv; out vec4 o;
void main(){
  float L=texture(u_vel,v_uv-vec2(u_txl.x,0)).x,R=texture(u_vel,v_uv+vec2(u_txl.x,0)).x;
  float T=texture(u_vel,v_uv+vec2(0,u_txl.y)).y,B=texture(u_vel,v_uv-vec2(0,u_txl.y)).y;
  o=vec4(.5*((R-L)+(T-B)),0,0,1);
}`;

const JACOBI = `#version 300 es
precision highp float;
uniform sampler2D u_p,u_d; uniform vec2 u_txl;
in vec2 v_uv; out vec4 o;
void main(){
  float L=texture(u_p,v_uv-vec2(u_txl.x,0)).x,R=texture(u_p,v_uv+vec2(u_txl.x,0)).x;
  float T=texture(u_p,v_uv+vec2(0,u_txl.y)).x,B=texture(u_p,v_uv-vec2(0,u_txl.y)).x;
  o=vec4((L+R+T+B-texture(u_d,v_uv).x)*.25,0,0,1);
}`;

const GRAD = `#version 300 es
precision highp float;
uniform sampler2D u_p,u_vel; uniform vec2 u_txl;
in vec2 v_uv; out vec4 o;
void main(){
  float L=texture(u_p,v_uv-vec2(u_txl.x,0)).x,R=texture(u_p,v_uv+vec2(u_txl.x,0)).x;
  float T=texture(u_p,v_uv+vec2(0,u_txl.y)).x,B=texture(u_p,v_uv-vec2(0,u_txl.y)).x;
  vec2 v=texture(u_vel,v_uv).xy-.5*vec2(R-L,T-B);
  o=vec4(v,0,1);
}`;

const SPLAT_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_src; uniform vec2 u_pt; uniform vec3 u_col;
uniform float u_r,u_aspect;
in vec2 v_uv; out vec4 o;
void main(){
  vec2 p=v_uv-u_pt; p.x*=u_aspect;
  float s=exp(-dot(p,p)/u_r);
  o=vec4(texture(u_src,v_uv).xyz+s*u_col,1);
}`;

const DISPLAY_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_dye; uniform float u_stressIndex;
in vec2 v_uv; out vec4 o;
void main(){
  vec3 d=texture(u_dye,v_uv).xyz;
  // Stress tint: shift toward red as stress rises
  d=mix(d,vec3(d.x*.9+d.y*.2,d.y*.4,d.z*.1),u_stressIndex*.6);
  d=pow(max(d,vec3(0)),vec3(.4545));
  o=vec4(d,1);
}`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────

type GL2 = WebGL2RenderingContext;

function compile(gl: GL2, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
  return s;
}
function prog(gl: GL2, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

interface FBO { tex: WebGLTexture; fb: WebGLFramebuffer; }
interface PP  { r: FBO; w: FBO; swap(): void }

function mkFBO(gl: GL2, w: number, h: number, iFmt: number, fmt: number, type: number, linear: boolean): FBO {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, iFmt, w, h, 0, fmt, type, null);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb };
}
function mkPP(gl: GL2, w: number, h: number, iF: number, f: number, t: number, lin: boolean): PP {
  let a = mkFBO(gl, w, h, iF, f, t, lin);
  let b = mkFBO(gl, w, h, iF, f, t, lin);
  return { r: a, w: b, swap() { const x=this.r; this.r=this.w; this.w=x; } };
}

function ul(gl: GL2, p: WebGLProgram, n: string): WebGLUniformLocation {
  return gl.getUniformLocation(p, n)!;
}
function bindTex(gl: GL2, unit: number, tex: WebGLTexture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

// ─── Cytoplasm fluid canvas ───────────────────────────────────────────────────

export interface FluidForce {
  x: number; y: number; dx: number; dy: number;
  strength?: number;
  color?: [number, number, number];
}

interface CytoplasmCanvasProps {
  forceRef: React.MutableRefObject<FluidForce | null>;
  stressIndex: number;
  state: MachineState;
}

export function CytoplasmCanvas({ forceRef, stressIndex, state }: CytoplasmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const stressRef = useRef(stressIndex);
  const stateRef  = useRef(state);

  useEffect(() => { stressRef.current = stressIndex; }, [stressIndex]);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false,
      stencil: false, preserveDrawingBuffer: false,
    }) as GL2 | null;
    if (!gl) return;

    gl.getExtension('EXT_color_buffer_float');
    const SIM = 256, DYE = 512;

    let advP: WebGLProgram, divP: WebGLProgram, jacP: WebGLProgram,
        graP: WebGLProgram, splP: WebGLProgram, disP: WebGLProgram;
    try {
      advP = prog(gl, VERT_SRC, ADVECT);
      divP = prog(gl, VERT_SRC, DIVG);
      jacP = prog(gl, VERT_SRC, JACOBI);
      graP = prog(gl, VERT_SRC, GRAD);
      splP = prog(gl, VERT_SRC, SPLAT_SRC);
      disP = prog(gl, VERT_SRC, DISPLAY_SRC);
    } catch (err) {
      console.error('[CytoplasmCanvas] shader error:', err);
      return;
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1,  1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(advP, 'a_pos');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const HF = gl.HALF_FLOAT;
    const vel = mkPP(gl, SIM, SIM, gl.RG16F,  gl.RG,   HF, true);
    const prs = mkPP(gl, SIM, SIM, gl.R16F,   gl.RED,  HF, false);
    const dye = mkPP(gl, DYE, DYE, gl.RGBA16F, gl.RGBA, HF, true);
    const divFBO = mkFBO(gl, SIM, SIM, gl.R16F, gl.RED, HF, false);

    const txlS = [1/SIM, 1/SIM], txlD = [1/DYE, 1/DYE];

    function blit(fb: WebGLFramebuffer | null, w: number, h: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    }

    function advect(vFBO: FBO, src: FBO, dst: PP, diss: number, isDye: boolean, t: number) {
      gl.useProgram(advP);
      gl.uniform1i(ul(gl,advP,'u_vel'),0); gl.uniform1i(ul(gl,advP,'u_src'),1);
      gl.uniform1f(ul(gl,advP,'u_dt'), 0.016);
      gl.uniform1f(ul(gl,advP,'u_diss'), diss);
      gl.uniform1f(ul(gl,advP,'u_time'), t);
      gl.uniform2fv(ul(gl,advP,'u_txl'), isDye ? txlD : txlS);
      bindTex(gl,0,vFBO.tex); bindTex(gl,1,src.tex);
      blit(dst.w.fb, isDye ? DYE : SIM, isDye ? DYE : SIM);
      dst.swap();
    }

    function diverge() {
      gl.useProgram(divP);
      gl.uniform1i(ul(gl,divP,'u_vel'),0);
      gl.uniform2fv(ul(gl,divP,'u_txl'),txlS);
      bindTex(gl,0,vel.r.tex);
      blit(divFBO.fb, SIM, SIM);
    }

    function jacobi(iters: number) {
      gl.useProgram(jacP);
      gl.uniform1i(ul(gl,jacP,'u_p'),0); gl.uniform1i(ul(gl,jacP,'u_d'),1);
      gl.uniform2fv(ul(gl,jacP,'u_txl'),txlS);
      bindTex(gl,1,divFBO.tex);
      for (let i=0;i<iters;i++) {
        bindTex(gl,0,prs.r.tex);
        blit(prs.w.fb,SIM,SIM);
        prs.swap();
      }
    }

    function gradient() {
      gl.useProgram(graP);
      gl.uniform1i(ul(gl,graP,'u_p'),0); gl.uniform1i(ul(gl,graP,'u_vel'),1);
      gl.uniform2fv(ul(gl,graP,'u_txl'),txlS);
      bindTex(gl,0,prs.r.tex); bindTex(gl,1,vel.r.tex);
      blit(vel.w.fb,SIM,SIM); vel.swap();
    }

    function splat(x: number, y: number, dx: number, dy: number,
                   col: [number,number,number], str = 1.0) {
      const asp = canvas.width / canvas.height;
      gl.useProgram(splP);
      gl.uniform1i(ul(gl,splP,'u_src'),0);
      gl.uniform2f(ul(gl,splP,'u_pt'),x,y);
      gl.uniform1f(ul(gl,splP,'u_aspect'),asp);

      // Velocity splat
      gl.uniform3f(ul(gl,splP,'u_col'),dx*10*str,dy*10*str,0);
      gl.uniform1f(ul(gl,splP,'u_r'),0.0005);
      bindTex(gl,0,vel.r.tex); blit(vel.w.fb,SIM,SIM); vel.swap();

      // Dye splat
      gl.uniform3f(ul(gl,splP,'u_col'),...col);
      gl.uniform1f(ul(gl,splP,'u_r'),0.0007);
      bindTex(gl,0,dye.r.tex); blit(dye.w.fb,DYE,DYE); dye.swap();
    }

    // Cytoplasm palette: teal + aqua + subtle gold
    const PALETTE: [number,number,number][] = [
      [0.0, 0.55, 0.65],
      [0.0, 0.42, 0.72],
      [0.55, 0.72, 0.0],
      [0.0, 0.65, 0.42],
    ];
    let ci = 0;

    // Seed initial flow
    for (let i=0; i<5; i++) {
      const a = i*1.257; const r = 0.12+i*0.06;
      const c = PALETTE[i%4];
      splat(.5+r*Math.cos(a),.5+r*Math.sin(a),Math.cos(a+1.57)*0.03,Math.sin(a+1.57)*0.03,c);
    }

    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize();
    window.addEventListener('resize', resize, { passive:true });

    let ambientT = 0, t0 = performance.now();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const elapsed = (now - t0) * 0.001;

      // Inject external force (from ToolOverlay parameter changes)
      const force = forceRef.current;
      if (force) {
        const col = force.color ?? PALETTE[ci++ % 4];
        splat(force.x, force.y, force.dx, force.dy, col, force.strength ?? 1);
        forceRef.current = null;
      }

      // Autonomous ambient — faster in stress mode
      const ambientInterval = stateRef.current === 'stress_test' ? 600 : 1400;
      if (now - ambientT > ambientInterval) {
        ambientT = now;
        const a = elapsed * 0.4; const r = 0.22;
        const c: [number,number,number] = stateRef.current === 'stress_test'
          ? [0.6, 0.05, 0.05]  // red-tinted in stress
          : PALETTE[ci++ % 4];
        splat(.5+r*Math.cos(a),.5+r*Math.sin(a),
              Math.cos(a+1.57)*.025,Math.sin(a+1.57)*.025, c, 0.6);
      }

      advect(vel.r, vel.r, vel, 0.998, false, elapsed);
      advect(vel.r, dye.r, dye, 0.992, true,  elapsed);
      diverge();
      jacobi(25);
      gradient();

      gl.useProgram(disP);
      gl.uniform1i(ul(gl,disP,'u_dye'),0);
      gl.uniform1f(ul(gl,disP,'u_stressIndex'), stressRef.current);
      bindTex(gl,0,dye.r.tex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.bindVertexArray(null);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []); // intentionally empty — refs handle updates

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:'absolute', inset:0,
        width:'100%', height:'100%',
        display:'block', pointerEvents:'none',
        opacity: 0.28, mixBlendMode:'screen',
      }}
    />
  );
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
  const color   = state === 'stress_test' ? '#F87171' : '#22D3EE';

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
  forceRef, reactionRate, stressIndex, state,
}: FluidSimCanvasProps) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
      {/* Layer 0 — WebGL2 Navier-Stokes cytoplasm fluid */}
      <CytoplasmCanvas forceRef={forceRef} stressIndex={stressIndex} state={state} />

      {/* Layer 1 — R3F metabolite instances */}
      <Canvas
        camera={{ position:[0,0,16], fov:55 }}
        dpr={[1, typeof window !== 'undefined' && window.innerWidth < 1024 ? 1.2 : 1.5]}
        performance={{ min: 0.45 }}   // allows 45 FPS floor on mobile
        gl={{ antialias:false, alpha:true, powerPreference:'high-performance' }}
        style={{ position:'absolute', inset:0, background:'transparent', pointerEvents:'none' }}
      >
        <ambientLight intensity={0.4} color="#1a3050" />
        <pointLight position={[0,0,12]} intensity={1.2} color="#22D3EE" distance={30} decay={2} />
        <pointLight position={[8,-6,8]} intensity={0.6} color="#E879F9" distance={20} decay={2} />
        <MetaboliteMolecules
          reactionRate={reactionRate}
          stressIndex={stressIndex}
          state={state}
        />
      </Canvas>

      {/* Layer 2 — Blueprint grid SVG */}
      <BlueprintGrid state={state} />
    </div>
  );
}
