import * as THREE from 'three';
import type { RefObject } from 'react';
import type { CoreState } from './IntelligenceCore';
import { audioLevel, easeMotion, profiles } from './coreMotion';

const vertex = `
uniform float uTime, uEnergy, uSpread;
varying vec3 vPoint;
void main(){
 vec3 p=position;
 float wave=sin(p.y*5.0+uTime*1.4)+sin(p.z*6.0-uTime*.7);
 p*=1.0+wave*(.006+uEnergy*.022)+uSpread*.025;
 vPoint=p;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const fragment = `
uniform float uTime,uEnergy,uInward,uLight,uWarmth,uLayer;
varying vec3 vPoint;
void main(){
 float front=smoothstep(-1.1,1.1,vPoint.z);
 float pulse=pow(.5+.5*sin(length(vPoint)*25.0+uTime*3.5),10.0)*uInward;
 float threads=.55+.45*sin(vPoint.y*9.0+vPoint.x*4.0+uTime*.3);
 vec3 cold=mix(vec3(.10,.29,.46),vec3(.40,.76,.94),front);
 vec3 color=mix(cold,vec3(.57,.49,.34),uWarmth*.65);
 float a=(.10+front*.8+threads*.12+pulse*.5+uEnergy*.3)*uLight*uLayer;
 gl_FragColor=vec4(color,a);
}`;

/** GPU lines are real 3D geometry. Motion is decorative; amplitude is live audio. */
export function createCoreScene(canvas: HTMLCanvasElement, state: () => CoreState, analyser: RefObject<AnalyserNode | null>) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 30);
  camera.position.set(0, .05, 4.7);
  const globe = new THREE.Group(); scene.add(globe);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.ShaderMaterial[] = [];
  const uniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uSpread: { value: 0 }, uInward: { value: 0 }, uLight: { value: .78 }, uWarmth: { value: 0 } };
  function line(points: THREE.Vector3[], parent: THREE.Group, layer = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points); geometries.push(geometry);
    const material = new THREE.ShaderMaterial({ uniforms: { ...uniforms, uLayer: { value: layer } }, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    materials.push(material); const mesh = new THREE.Line(geometry, material); parent.add(mesh); return mesh;
  }
  // Flowing meridians: smooth, separated strands preserve a readable silhouette.
  for (let j = 0; j < 44; j++) {
    const phase = j / 44 * Math.PI * 2;
    const points = Array.from({ length: 151 }, (_, i) => {
      const t = .04 + i / 150 * (Math.PI - .08);
      const twist = phase + .19 * Math.sin(t * 3 + phase * 2) + .12 * Math.cos(t * 5 - phase);
      const radius = 1 + .018 * Math.sin(t * 6 + phase * 3);
      return new THREE.Vector3(Math.sin(t) * Math.cos(twist) * radius, Math.cos(t) * radius, Math.sin(t) * Math.sin(twist) * radius);
    });
    line(points, globe, j % 4 === 0 ? 1.1 : .58);
  }
  // Sparse cross sections and a separately turning inner lattice supply depth.
  for (let j = 1; j < 15; j++) {
    const theta = j / 15 * Math.PI;
    line(Array.from({ length: 193 }, (_, i) => {
      const t = i / 192 * Math.PI * 2;
      const r = Math.sin(theta) * (1 + .012 * Math.sin(t * 7 + theta));
      return new THREE.Vector3(r * Math.cos(t), Math.cos(theta), r * Math.sin(t));
    }), globe, j % 3 === 0 ? .62 : .28);
  }
  const inner = new THREE.Group(); globe.add(inner);
  for (let j = 0; j < 12; j++) {
    const phase = j / 12 * Math.PI * 2;
    line(Array.from({ length: 180 }, (_, i) => {
      const t = i / 179 * Math.PI * 2;
      const r = .47 + .11 * Math.cos(t * 3 + phase);
      return new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * Math.cos(phase) * r, Math.sin(t) * Math.sin(phase) * r);
    }), inner, .45);
  }
  const orbits: THREE.Group[] = [];
  for (let j = 0; j < 3; j++) {
    const orbit = new THREE.Group(); orbit.rotation.set(.55 + j * .71, j * .9, .35); scene.add(orbit); orbits.push(orbit);
    for (let k = 0; k < 2; k++) {
      const r = 1.15 + j * .045 + k * .012;
      line(Array.from({ length: 161 }, (_, i) => {
        const t = i / 160 * (j === 1 ? 3.9 : 2.2) + j * 2.1;
        return new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0);
      }), orbit, k ? .18 : .65);
    }
  }
  // A small additive nucleus, generated in the fragment shader (no texture).
  const glowGeometry = new THREE.PlaneGeometry(.85, .85); geometries.push(glowGeometry);
  const glowMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: `varying vec2 vUv; uniform float uEnergy,uLight,uWarmth; void main(){float d=length(vUv-.5)*2.; float a=exp(-d*9.)*.9+exp(-d*d*18.)*.12; vec3 c=mix(vec3(.3,.7,.95),vec3(.7,.55,.35),uWarmth*.6);gl_FragColor=vec4(c,a*(uLight+uEnergy));}`, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.push(glowMaterial); scene.add(new THREE.Mesh(glowGeometry, glowMaterial));
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = { ...profiles.standby };
  let raf = 0, last = 0, rendered = 0, clock = 0, angle = 0, level = 0, lost = false;
  const bins = new Uint8Array(256);
  const resize = () => { const size = Math.max(1, canvas.clientWidth); renderer.setSize(size, size, false); };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function contextLost(event: Event) { event.preventDefault(); lost = true; canvas.dataset.unavailable = 'true'; }
  function contextRestored() { lost = false; delete canvas.dataset.unavailable; last = 0; }
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  function render(now: number) {
    raf = requestAnimationFrame(render);
    if (document.hidden || lost) { last = now; return; }
    if (now - rendered < (preference.matches ? 120 : 32)) return;
    const dt = last ? Math.min((now - last) / 1000, .1) : 0; last = now; rendered = now;
    const mode = state(); easeMotion(motion, profiles[mode], dt);
    let target = 0;
    if ((mode === 'listening' || mode === 'speaking') && analyser.current) {
      analyser.current.getByteTimeDomainData(bins); target = audioLevel(bins);
    }
    level += (target - level) * (1 - Math.exp(-dt * (target > level ? 14 : 5)));
    if (!preference.matches) { clock += dt; angle += dt * motion.speed; }
    uniforms.uTime.value = clock; uniforms.uEnergy.value = preference.matches ? level * .35 : level;
    uniforms.uInward.value = motion.inward; uniforms.uSpread.value = motion.spread; uniforms.uLight.value = motion.light; uniforms.uWarmth.value = motion.warmth;
    globe.rotation.set(.2 + Math.sin(clock * .11) * .07, angle, -.16);
    globe.scale.setScalar(1 + (preference.matches ? 0 : Math.sin(clock * .8) * .008 + level * .035));
    inner.rotation.set(angle * -.7, angle * .3, .4);
    orbits.forEach((orbit, j) => { orbit.rotation.z = .35 + angle * (j % 2 ? -.75 : .6); });
    renderer.render(scene, camera); canvas.dataset.ready = 'true';
  }
  raf = requestAnimationFrame(render);
  return () => { cancelAnimationFrame(raf); observer.disconnect(); canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.forceContextLoss(); };
}
