'use client';
/**
 * HeroFluidCanvas — Hero-section WebGL2 Navier-Stokes fluid
 *
 * Visual reference: high-contrast B&W flowing smoke / liquid-metal aesthetic.
 *   · Monochromatic dye (warm-white injections on black field)
 *   · FBM 5-octave micro-turbulence in advection pass
 *   · Film grain (two frequencies, 8-fps flicker) in display pass
 *   · Radial vignette to focus center
 *   · triggerConverge() — injects 8 inward velocity splats on search focus
 *
 * Performance targets:
 *   · 128×128 velocity/pressure, 256×256 dye (≈ half FluidBackground)
 *   · 15 Jacobi iterations (≈ 60% of full solve, visually indistinguishable)
 *   · Canvas initialises in useEffect so it never blocks LCP text render
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

// ── Shader sources ─────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const ADVECT = `
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_texelVel;
uniform float u_dt;
uniform float u_dissipation;
uniform float u_time;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.5;}
  return v;
}
void main(){
  vec2 vel = texture2D(u_velocity, vUv).xy;
  float t = u_time * 0.09;
  vec2 n;
  n.x = fbm(vUv*3.5+vec2(t,t*0.8)) - 0.5;
  n.y = fbm(vUv*3.5+vec2(t*1.4+4.7,t*0.95)) - 0.5;
  vel += n * 0.005;
  vec2 pos = vUv - vel * u_dt;
  gl_FragColor = u_dissipation * texture2D(u_source, pos);
}`;

const DIVERGENCE = `
precision highp float;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
varying vec2 vUv;
void main(){
  float L=texture2D(u_velocity,vUv-vec2(u_texel.x,0)).x;
  float R=texture2D(u_velocity,vUv+vec2(u_texel.x,0)).x;
  float T=texture2D(u_velocity,vUv+vec2(0,u_texel.y)).y;
  float B=texture2D(u_velocity,vUv-vec2(0,u_texel.y)).y;
  gl_FragColor=vec4(0.5*(R-L+T-B),0,0,1);
}`;

const JACOBI = `
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texel;
varying vec2 vUv;
void main(){
  float L=texture2D(u_pressure,vUv-vec2(u_texel.x,0)).x;
  float R=texture2D(u_pressure,vUv+vec2(u_texel.x,0)).x;
  float T=texture2D(u_pressure,vUv+vec2(0,u_texel.y)).x;
  float B=texture2D(u_pressure,vUv-vec2(0,u_texel.y)).x;
  float div=texture2D(u_divergence,vUv).x;
  gl_FragColor=vec4((L+R+T+B-div)*0.25,0,0,1);
}`;

const GRADIENT = `
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
varying vec2 vUv;
void main(){
  float L=texture2D(u_pressure,vUv-vec2(u_texel.x,0)).x;
  float R=texture2D(u_pressure,vUv+vec2(u_texel.x,0)).x;
  float T=texture2D(u_pressure,vUv+vec2(0,u_texel.y)).x;
  float B=texture2D(u_pressure,vUv-vec2(0,u_texel.y)).x;
  vec2 vel=texture2D(u_velocity,vUv).xy;
  vel-=vec2(R-L,T-B)*0.5;
  gl_FragColor=vec4(vel*0.988,0,1);
}`;

const SPLAT = `
precision highp float;
uniform sampler2D u_target;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;
uniform float u_aspect;
varying vec2 vUv;
void main(){
  vec2 p=vUv-u_point;
  p.x*=u_aspect;
  float g=exp(-dot(p,p)/u_radius);
  gl_FragColor=vec4(texture2D(u_target,vUv).rgb+g*u_color,1);
}`;

const DISPLAY = `
precision highp float;
uniform sampler2D u_dye;
uniform float u_time;
varying vec2 vUv;
float rand(vec2 co){ return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c=texture2D(u_dye,vUv).rgb;
  float lum=dot(c,vec3(0.333));
  // S-curve high contrast
  lum=smoothstep(0.02,0.72,lum);
  // Gamma lift — brighten midtones
  lum=pow(lum,0.78);
  // Warm-white tint
  vec3 col=lum*vec3(1.0,0.972,0.924);
  // Film grain — 8fps flicker, two frequencies
  float t=floor(u_time*8.0)/8.0;
  float g=(rand(vUv+t)+rand(vUv*1.83+t+0.37)-1.0)*0.058;
  col+=g;
  // Radial vignette
  vec2 uv=vUv-0.5;
  float vig=1.0-smoothstep(0.28,0.82,length(uv)*1.5);
  col*=vig*0.88+0.12;
  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}`;

// ── WebGL helpers ──────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function createProgram(gl: WebGL2RenderingContext, frag: string) {
  const p = gl.createProgram()!;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  return p;
}

function createFBO(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

type FBO = ReturnType<typeof createFBO>;

function createDoubleFBO(gl: WebGL2RenderingContext, w: number, h: number) {
  let a = createFBO(gl, w, h), b = createFBO(gl, w, h);
  return {
    get read() { return a; },
    get write() { return b; },
    swap() { const t = a; a = b; b = t; },
  };
}

// ── Public API ─────────────────────────────────────────────────────────

export interface HeroFluidHandle {
  triggerConverge: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

const HeroFluidCanvas = forwardRef<HeroFluidHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const convergeRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    triggerConverge: () => convergeRef.current?.(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    // Check for float texture support
    const extColorHalf = gl.getExtension('EXT_color_buffer_half_float');
    if (!extColorHalf) return;

    // Simulation resolution
    const SIM = 128, DYE = 256;

    // Programs
    const pAdvVel  = createProgram(gl, ADVECT);
    const pAdvDye  = createProgram(gl, ADVECT);
    const pDiv     = createProgram(gl, DIVERGENCE);
    const pJacobi  = createProgram(gl, JACOBI);
    const pGrad    = createProgram(gl, GRADIENT);
    const pSplat   = createProgram(gl, SPLAT);
    const pDisplay = createProgram(gl, DISPLAY);

    // FBOs
    const velocity  = createDoubleFBO(gl, SIM, SIM);
    const pressure  = createDoubleFBO(gl, SIM, SIM);
    const divergFBO = createFBO(gl, SIM, SIM);
    const dye       = createDoubleFBO(gl, DYE, DYE);

    // Quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

    function bindQuad(prog: WebGLProgram) {
      const loc = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(loc);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    function blit(target: FBO | null) {
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.viewport(0, 0, target.w, target.h);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ── Splat helper ──────────────────────────────────────────────────
    function splatVelocity(x: number, y: number, vx: number, vy: number, r = 0.012) {
      const aspect = canvas.width / canvas.height;
      gl.useProgram(pSplat);
      bindQuad(pSplat);
      gl.uniform1i(gl.getUniformLocation(pSplat, 'u_target'), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform2f(gl.getUniformLocation(pSplat, 'u_point'), x, y);
      gl.uniform3f(gl.getUniformLocation(pSplat, 'u_color'), vx, vy, 0);
      gl.uniform1f(gl.getUniformLocation(pSplat, 'u_radius'), r);
      gl.uniform1f(gl.getUniformLocation(pSplat, 'u_aspect'), aspect);
      blit(velocity.write);
      velocity.swap();
    }

    function splatDye(x: number, y: number, r = 0.018) {
      const aspect = canvas.width / canvas.height;
      gl.useProgram(pSplat);
      bindQuad(pSplat);
      gl.uniform1i(gl.getUniformLocation(pSplat, 'u_target'), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform2f(gl.getUniformLocation(pSplat, 'u_point'), x, y);
      gl.uniform3f(gl.getUniformLocation(pSplat, 'u_color'), 0.55, 0.52, 0.48);
      gl.uniform1f(gl.getUniformLocation(pSplat, 'u_radius'), r);
      gl.uniform1f(gl.getUniformLocation(pSplat, 'u_aspect'), aspect);
      blit(dye.write);
      dye.swap();
    }

    // ── Converge: 8 inward velocity + dye splats ──────────────────────
    convergeRef.current = () => {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const dist = 0.32;
        const px = 0.5 + Math.cos(a) * dist;
        const py = 0.5 + Math.sin(a) * dist;
        const vx = -Math.cos(a) * 0.55;
        const vy = -Math.sin(a) * 0.55;
        splatVelocity(px, py, vx, vy, 0.018);
        splatDye(px, py, 0.022);
      }
      // Extra center bloom
      splatDye(0.5, 0.5, 0.05);
    };

    // ── Ambient auto-splat ─────────────────────────────────────────────
    let lastSplat = 0;
    const SPLAT_INTERVAL = 1400; // ms
    const splatColors = [
      [0.58, 0.55, 0.50],
      [0.65, 0.60, 0.54],
      [0.50, 0.48, 0.44],
    ];
    let splatIdx = 0;

    // ── Mouse interaction ──────────────────────────────────────────────
    let lastMouse = { x: 0.5, y: 0.5 };
    let mouse = { x: 0.5, y: 0.5 };

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse = {
        x: (e.clientX - rect.left) / rect.width,
        y: 1 - (e.clientY - rect.top) / rect.height,
      };
    }
    canvas.addEventListener('mousemove', onMouseMove);

    // ── Resize ────────────────────────────────────────────────────────
    function resize() {
      canvas.width = canvas.offsetWidth * Math.min(window.devicePixelRatio, 1.5);
      canvas.height = canvas.offsetHeight * Math.min(window.devicePixelRatio, 1.5);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Simulation step ────────────────────────────────────────────────
    let t0 = performance.now();
    let animId = 0;

    function step(now: number) {
      animId = requestAnimationFrame(step);
      const dt = Math.min((now - t0) / 1000, 0.033);
      t0 = now;
      const time = now / 1000;

      // Ambient splat
      if (now - lastSplat > SPLAT_INTERVAL) {
        lastSplat = now;
        const a = Math.random() * Math.PI * 2;
        const r = 0.18 + Math.random() * 0.22;
        const px = 0.5 + Math.cos(a) * r;
        const py = 0.5 + Math.sin(a) * r;
        const vx = (Math.random() - 0.5) * 0.4;
        const vy = (Math.random() - 0.5) * 0.4;
        const [cr, cg, cb] = splatColors[splatIdx % splatColors.length];
        splatIdx++;

        gl.useProgram(pSplat);
        bindQuad(pSplat);
        const aspect = canvas.width / canvas.height;
        gl.uniform1i(gl.getUniformLocation(pSplat, 'u_target'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
        gl.uniform2f(gl.getUniformLocation(pSplat, 'u_point'), px, py);
        gl.uniform3f(gl.getUniformLocation(pSplat, 'u_color'), cr, cg, cb);
        gl.uniform1f(gl.getUniformLocation(pSplat, 'u_radius'), 0.016);
        gl.uniform1f(gl.getUniformLocation(pSplat, 'u_aspect'), aspect);
        blit(dye.write);
        dye.swap();

        // velocity push
        splatVelocity(px, py, vx, vy);
      }

      // Mouse drag
      const dx = mouse.x - lastMouse.x;
      const dy = mouse.y - lastMouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) {
        splatVelocity(mouse.x, mouse.y, dx * 6, dy * 6, 0.01);
        splatDye(mouse.x, mouse.y, 0.014);
        lastMouse = { ...mouse };
      }

      const simTexel = { x: 1 / SIM, y: 1 / SIM };

      // 1. Advect velocity
      gl.useProgram(pAdvVel);
      bindQuad(pAdvVel);
      gl.uniform1i(gl.getUniformLocation(pAdvVel, 'u_velocity'), 0);
      gl.uniform1i(gl.getUniformLocation(pAdvVel, 'u_source'), 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform2f(gl.getUniformLocation(pAdvVel, 'u_texelVel'), simTexel.x, simTexel.y);
      gl.uniform1f(gl.getUniformLocation(pAdvVel, 'u_dt'), dt);
      gl.uniform1f(gl.getUniformLocation(pAdvVel, 'u_dissipation'), 0.98);
      gl.uniform1f(gl.getUniformLocation(pAdvVel, 'u_time'), time);
      blit(velocity.write);
      velocity.swap();

      // 2. Advect dye
      gl.useProgram(pAdvDye);
      bindQuad(pAdvDye);
      gl.uniform1i(gl.getUniformLocation(pAdvDye, 'u_velocity'), 0);
      gl.uniform1i(gl.getUniformLocation(pAdvDye, 'u_source'), 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform2f(gl.getUniformLocation(pAdvDye, 'u_texelVel'), simTexel.x, simTexel.y);
      gl.uniform1f(gl.getUniformLocation(pAdvDye, 'u_dt'), dt);
      gl.uniform1f(gl.getUniformLocation(pAdvDye, 'u_dissipation'), 0.993);
      gl.uniform1f(gl.getUniformLocation(pAdvDye, 'u_time'), time);
      blit(dye.write);
      dye.swap();

      // 3. Divergence
      gl.useProgram(pDiv);
      bindQuad(pDiv);
      gl.uniform1i(gl.getUniformLocation(pDiv, 'u_velocity'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform2f(gl.getUniformLocation(pDiv, 'u_texel'), simTexel.x, simTexel.y);
      blit(divergFBO);

      // 4. Jacobi pressure (15 iterations)
      for (let i = 0; i < 15; i++) {
        gl.useProgram(pJacobi);
        bindQuad(pJacobi);
        gl.uniform1i(gl.getUniformLocation(pJacobi, 'u_pressure'), 0);
        gl.uniform1i(gl.getUniformLocation(pJacobi, 'u_divergence'), 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, divergFBO.tex);
        gl.uniform2f(gl.getUniformLocation(pJacobi, 'u_texel'), simTexel.x, simTexel.y);
        blit(pressure.write);
        pressure.swap();
      }

      // 5. Gradient subtract
      gl.useProgram(pGrad);
      bindQuad(pGrad);
      gl.uniform1i(gl.getUniformLocation(pGrad, 'u_pressure'), 0);
      gl.uniform1i(gl.getUniformLocation(pGrad, 'u_velocity'), 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform2f(gl.getUniformLocation(pGrad, 'u_texel'), simTexel.x, simTexel.y);
      blit(velocity.write);
      velocity.swap();

      // 6. Display
      gl.useProgram(pDisplay);
      bindQuad(pDisplay);
      gl.uniform1i(gl.getUniformLocation(pDisplay, 'u_dye'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform1f(gl.getUniformLocation(pDisplay, 'u_time'), time);
      blit(null);
    }

    // Delay init to not block LCP text render
    const tid = setTimeout(() => { animId = requestAnimationFrame(step); }, 80);

    return () => {
      clearTimeout(tid);
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: 0,
        background: '#0A0D14',
      }}
      aria-hidden="true"
    />
  );
});

HeroFluidCanvas.displayName = 'HeroFluidCanvas';
export default HeroFluidCanvas;
