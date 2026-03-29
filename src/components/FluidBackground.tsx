'use client';
/**
 * Nexus-Bio 2.0 — WebGL2 Navier-Stokes Fluid Background
 *
 * Architecture:
 *   - Standalone <canvas> independent of the main DOM/R3F tree
 *   - WebGL2 context (with WebGL1 graceful fallback to CSS-only)
 *   - Ping-pong FBO pipeline:
 *       Advection → Divergence → Jacobi×25 → Gradient-Sub → Splat → Composite
 *   - FBM noise injection for micro-turbulence in advection pass
 *   - Mouse/touch momentum injected as Navier-Stokes external force
 *   - Input throttled + synced to requestAnimationFrame
 *   - WCAG 2.2 AA: canvas kept at 30% opacity so text contrast ≥ 4.5:1
 *
 * RED LINES enforced:
 *   ✗ No gl_PointSize anywhere in this file
 */

import { useEffect, useRef, useCallback } from 'react';

// ── Shader sources ────────────────────────────────────────────────────

const VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Fractional Brownian Motion helper — injected into advection for micro-turbulence
const FBM_GLSL = `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p); p *= 2.0; a *= 0.5;
  }
  return v;
}`;

// Advection — backtrace + FBM turbulence injection
const ADVECT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform float u_dt;
uniform float u_dissipation;
uniform float u_time;
uniform vec2 u_texelSize;
in vec2 v_uv;
out vec4 fragColor;
${FBM_GLSL}
void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  // FBM noise injected as micro-turbulence on velocity field
  float t = u_time * 0.3;
  vec2 noiseVel = vec2(
    fbm(v_uv * 4.0 + vec2(t, 0.0)) - 0.5,
    fbm(v_uv * 4.0 + vec2(0.0, t + 1.7)) - 0.5
  ) * 0.018;
  vec2 coord = v_uv - (vel + noiseVel) * u_dt;
  coord = clamp(coord, u_texelSize, 1.0 - u_texelSize);
  fragColor = u_dissipation * texture(u_source, coord);
}`;

// Divergence
const DIVERGENCE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float L = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;
  float B = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
  float div = 0.5 * ((R - L) + (T - B));
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

// Jacobi pressure iteration — run 25 times per frame
const JACOBI_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texelSize;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  float d = texture(u_divergence, v_uv).x;
  // alpha = -dx*dy = -1 (unit grid), rBeta = 1/4
  fragColor = vec4((L + R + T + B - d) * 0.25, 0.0, 0.0, 1.0);
}`;

// Gradient subtraction — project velocity to divergence-free
const GRADIENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
  float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
  float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
  float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
  vec2 vel = texture(u_velocity, v_uv).xy;
  vel -= 0.5 * vec2(R - L, T - B);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

// Gaussian splat — inject external force (mouse momentum) into velocity/dye
const SPLAT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;
uniform float u_aspectRatio;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 p = v_uv - u_point;
  p.x *= u_aspectRatio;
  float splat = exp(-dot(p, p) / u_radius);
  vec3 base = texture(u_source, v_uv).xyz;
  fragColor = vec4(base + splat * u_color, 1.0);
}`;

// Display composite — tone-map dye to screen
const DISPLAY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_dye;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec3 dye = texture(u_dye, v_uv).xyz;
  // Tone map + gamma
  dye = pow(max(dye, vec3(0.0)), vec3(0.4545));
  fragColor = vec4(dye, 1.0);
}`;

// ── GL helpers ─────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error:\n${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error:\n${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

interface PingPong { read: FBO; write: FBO; swap: () => void }

function createFBO(gl: WebGL2RenderingContext, w: number, h: number, internalFormat: number, format: number, type: number, linear: boolean): FBO {
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture: tex, fbo, width: w, height: h };
}

function createDoubleFBO(gl: WebGL2RenderingContext, w: number, h: number, iFormat: number, fmt: number, type: number, linear: boolean): PingPong {
  let a = createFBO(gl, w, h, iFormat, fmt, type, linear);
  let b = createFBO(gl, w, h, iFormat, fmt, type, linear);
  return {
    read: a, write: b,
    swap() { const t = this.read; this.read = this.write; this.write = t; },
  };
}

function blit(gl: WebGL2RenderingContext, fbo: WebGLFramebuffer | null, vao: WebGLVertexArrayObject) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
}

function uniformLoc(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string): WebGLUniformLocation {
  return gl.getUniformLocation(prog, name)!;
}

// ── Component ──────────────────────────────────────────────────────────

interface FluidPointer {
  x: number; y: number; dx: number; dy: number; moved: boolean;
}

export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pointerRef = useRef<FluidPointer>({ x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false });
  const lastPointerRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pendingSplatRef = useRef(false);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = 1 - (clientY - rect.top) / rect.height;
    const now = performance.now();
    const last = lastPointerRef.current;
    const dt = Math.max(now - last.t, 1);
    // Velocity in NDC units/ms — clamp to prevent extreme splats
    const dx = Math.min(Math.max((x - last.x) / dt * 14, -0.4), 0.4);
    const dy = Math.min(Math.max((y - last.y) / dt * 14, -0.4), 0.4);
    pointerRef.current = { x, y, dx, dy, moved: true };
    lastPointerRef.current = { x, y, t: now };
    pendingSplatRef.current = true;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Pointer listeners (throttled via pendingSplatRef + RAF) ────────
    const onMouseMove = (e: MouseEvent) => handlePointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    };
    // Passive to not block scroll
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // ── WebGL2 context ─────────────────────────────────────────────────
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      // Graceful degradation — CSS gradient fallback handled in parent
      console.warn('[FluidBackground] WebGL2 unavailable, falling back to CSS.');
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
      };
    }

    // ── Simulation resolution (decoupled from display res for perf) ────
    const SIM_W = 256, SIM_H = 256;
    const DYE_W = 512, DYE_H = 512;

    // ── Compile programs ───────────────────────────────────────────────
    let advectProg: WebGLProgram, divergeProg: WebGLProgram,
        jacobiProg: WebGLProgram, gradientProg: WebGLProgram,
        splatProg: WebGLProgram, displayProg: WebGLProgram;
    try {
      advectProg   = createProgram(gl, VERT, ADVECT_FRAG);
      divergeProg  = createProgram(gl, VERT, DIVERGENCE_FRAG);
      jacobiProg   = createProgram(gl, VERT, JACOBI_FRAG);
      gradientProg = createProgram(gl, VERT, GRADIENT_FRAG);
      splatProg    = createProgram(gl, VERT, SPLAT_FRAG);
      displayProg  = createProgram(gl, VERT, DISPLAY_FRAG);
    } catch (err) {
      console.error('[FluidBackground] Shader compile failed:', err);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
      };
    }

    // ── Full-screen quad VAO ───────────────────────────────────────────
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 1,-1, -1,1,  // triangle 1
       1,-1, 1, 1, -1,1,  // triangle 2
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(advectProg, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // ── FBOs ───────────────────────────────────────────────────────────
    const RG16F = gl.getExtension('EXT_color_buffer_float') ? gl.RG16F : gl.RGBA;
    const RGBA16F = gl.getExtension('EXT_color_buffer_float') ? gl.RGBA16F : gl.RGBA;
    const HALF = gl.HALF_FLOAT;
    const FLOAT = gl.FLOAT;

    const velocity  = createDoubleFBO(gl, SIM_W, SIM_H, RG16F,   gl.RG,   HALF, true);
    const pressure  = createDoubleFBO(gl, SIM_W, SIM_H, gl.R16F ?? gl.R8, gl.RED, HALF, false);
    const dye       = createDoubleFBO(gl, DYE_W, DYE_H, RGBA16F, gl.RGBA, HALF, true);
    const divergeFBO = createFBO(gl, SIM_W, SIM_H, gl.R16F ?? gl.R8, gl.RED, HALF, false);

    // ── Simulation helpers ─────────────────────────────────────────────
    const texelSim = [1 / SIM_W, 1 / SIM_H];
    const texelDye = [1 / DYE_W, 1 / DYE_H];

    function bindTexture(unit: number, tex: WebGLTexture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    }

    function advect(velFBO: FBO, srcFBO: FBO, dstPP: PingPong, dissipation: number, isDye: boolean, time: number) {
      const txl = isDye ? texelDye : texelSim;
      const w = isDye ? DYE_W : SIM_W;
      const h = isDye ? DYE_H : SIM_H;
      gl.useProgram(advectProg);
      gl.uniform1i(uniformLoc(gl, advectProg, 'u_velocity'), 0);
      gl.uniform1i(uniformLoc(gl, advectProg, 'u_source'),   1);
      gl.uniform1f(uniformLoc(gl, advectProg, 'u_dt'),          0.016);
      gl.uniform1f(uniformLoc(gl, advectProg, 'u_dissipation'), dissipation);
      gl.uniform1f(uniformLoc(gl, advectProg, 'u_time'),        time);
      gl.uniform2fv(uniformLoc(gl, advectProg, 'u_texelSize'), txl);
      bindTexture(0, velFBO.texture);
      bindTexture(1, srcFBO.texture);
      gl.viewport(0, 0, w, h);
      blit(gl, dstPP.write.fbo, vao);
      dstPP.swap();
    }

    function computeDivergence() {
      gl.useProgram(divergeProg);
      gl.uniform1i(uniformLoc(gl, divergeProg, 'u_velocity'), 0);
      gl.uniform2fv(uniformLoc(gl, divergeProg, 'u_texelSize'), texelSim);
      bindTexture(0, velocity.read.texture);
      gl.viewport(0, 0, SIM_W, SIM_H);
      blit(gl, divergeFBO.fbo, vao);
    }

    function jacobiSolve(iterations: number) {
      gl.useProgram(jacobiProg);
      gl.uniform1i(uniformLoc(gl, jacobiProg, 'u_pressure'),   0);
      gl.uniform1i(uniformLoc(gl, jacobiProg, 'u_divergence'), 1);
      gl.uniform2fv(uniformLoc(gl, jacobiProg, 'u_texelSize'), texelSim);
      bindTexture(1, divergeFBO.texture);
      gl.viewport(0, 0, SIM_W, SIM_H);
      for (let i = 0; i < iterations; i++) {
        bindTexture(0, pressure.read.texture);
        blit(gl, pressure.write.fbo, vao);
        pressure.swap();
      }
    }

    function subtractGradient() {
      gl.useProgram(gradientProg);
      gl.uniform1i(uniformLoc(gl, gradientProg, 'u_pressure'), 0);
      gl.uniform1i(uniformLoc(gl, gradientProg, 'u_velocity'), 1);
      gl.uniform2fv(uniformLoc(gl, gradientProg, 'u_texelSize'), texelSim);
      bindTexture(0, pressure.read.texture);
      bindTexture(1, velocity.read.texture);
      gl.viewport(0, 0, SIM_W, SIM_H);
      blit(gl, velocity.write.fbo, vao);
      velocity.swap();
    }

    // Palette — cyber cyan, deep magenta, amber (low saturation, high contrast)
    const PALETTE: [number, number, number][] = [
      [0.0, 0.65, 0.75],   // cyan
      [0.55, 0.03, 0.70],  // magenta
      [0.72, 0.42, 0.02],  // amber
      [0.02, 0.60, 0.38],  // emerald (subtle)
    ];
    let colorIdx = 0;

    function splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
      const aspect = canvas.width / canvas.height;

      // Velocity splat
      gl.useProgram(splatProg);
      gl.uniform1i(uniformLoc(gl, splatProg, 'u_source'), 0);
      gl.uniform2f(uniformLoc(gl, splatProg, 'u_point'), x, y);
      gl.uniform3f(uniformLoc(gl, splatProg, 'u_color'), dx * 8.0, dy * 8.0, 0.0);
      gl.uniform1f(uniformLoc(gl, splatProg, 'u_radius'), 0.0004);
      gl.uniform1f(uniformLoc(gl, splatProg, 'u_aspectRatio'), aspect);
      bindTexture(0, velocity.read.texture);
      gl.viewport(0, 0, SIM_W, SIM_H);
      blit(gl, velocity.write.fbo, vao);
      velocity.swap();

      // Dye splat
      gl.uniform3f(uniformLoc(gl, splatProg, 'u_color'), ...color);
      gl.uniform1f(uniformLoc(gl, splatProg, 'u_radius'), 0.0006);
      bindTexture(0, dye.read.texture);
      gl.viewport(0, 0, DYE_W, DYE_H);
      blit(gl, dye.write.fbo, vao);
      dye.swap();
    }

    // Seed a few initial random splats for ambiance
    const seed = () => {
      for (let i = 0; i < 4; i++) {
        const c = PALETTE[i % PALETTE.length];
        const angle = Math.random() * Math.PI * 2;
        splat(
          0.2 + Math.random() * 0.6,
          0.2 + Math.random() * 0.6,
          Math.cos(angle) * 0.04,
          Math.sin(angle) * 0.04,
          [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7],
        );
      }
    };
    seed();

    // ── Resize handling ────────────────────────────────────────────────
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // ── Autonomous ambient splat — keeps fluid alive without user input ─
    let ambientT = 0;
    const injectAmbient = (time: number) => {
      if (time - ambientT < 1200) return;
      ambientT = time;
      const c = PALETTE[colorIdx % PALETTE.length];
      colorIdx++;
      const angle = time * 0.0008;
      splat(
        0.3 + 0.4 * Math.sin(angle),
        0.3 + 0.4 * Math.cos(angle * 0.7),
        Math.cos(angle + Math.PI * 0.5) * 0.02,
        Math.sin(angle + Math.PI * 0.5) * 0.02,
        [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45],
      );
    };

    // ── Render loop ────────────────────────────────────────────────────
    let startTime = performance.now();
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const elapsed = (now - startTime) * 0.001;

      // Inject pending mouse splat (already throttled to RAF)
      if (pendingSplatRef.current) {
        const p = pointerRef.current;
        const c = PALETTE[colorIdx % PALETTE.length];
        colorIdx++;
        splat(p.x, p.y, p.dx, p.dy, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
        pendingSplatRef.current = false;
      }

      // Ambient injection (keeps fluid alive)
      injectAmbient(now);

      // Velocity advection
      advect(velocity.read, velocity.read, velocity, 0.998, false, elapsed);
      // Dye advection
      advect(velocity.read, dye.read, dye, 0.993, true, elapsed);
      // Divergence → Jacobi×25 → Gradient subtraction
      computeDivergence();
      jacobiSolve(25);
      subtractGradient();

      // Composite to screen
      gl.useProgram(displayProg);
      gl.uniform1i(uniformLoc(gl, displayProg, 'u_dye'), 0);
      bindTexture(0, dye.read.texture);
      gl.viewport(0, 0, canvas.width, canvas.height);
      blit(gl, null, vao);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', resize);
    };
  }, [handlePointer]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
        // 30% opacity — preserves WCAG 2.2 AA 4.5:1 text contrast on #0A0D14 bg
        opacity: 0.30,
        // Mix multiply so fluid colours blend into dark bg without washing text
        mixBlendMode: 'screen',
      }}
    />
  );
}
