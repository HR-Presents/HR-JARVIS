import { Canvas, useFrame } from "@react-three/fiber";
import { Component, useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, PointsMaterial } from "three";
import type { ReactNode } from "react";

type Mode = "idle" | "listening" | "thinking" | "speaking";

function Filaments({ state }: { state: Mode }) {
  const group = useRef<Group>(null);
  const filaments = useMemo(() => {
    const vertices: number[] = [];
    const strands = 330;
    const steps = 82;
    for (let i = 0; i < strands; i++) {
      const seed = i * 2.399963229728653;
      const elevation = Math.acos(1 - 2 * (i + 0.5) / strands);
      const offset = (i % 17) / 17;
      let prev: [number, number, number] | null = null;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const phi = seed + t * (3.0 + 1.8 * offset) + Math.sin(t * 6.28 + seed) * .17;
        const theta = elevation + .30 * Math.sin(t * Math.PI * 2 + seed * .7);
        const r = 1.16 + .12 * Math.sin(t * 11 + seed) + .12 * Math.sin(t * Math.PI);
        const point: [number, number, number] = [
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi),
        ];
        if (prev) vertices.push(...prev, ...point);
        prev = point;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    return geometry;
  }, []);
  const outer = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < 110; i++) {
      const tilt = (i / 110) * Math.PI * 2;
      const radius = 1.38 + .17 * Math.sin(i * 1.9);
      let last: [number, number, number] | null = null;
      for (let j = 0; j <= 96; j++) {
        const t = j / 96 * Math.PI * 2;
        const x = radius * Math.cos(t);
        const y = radius * Math.sin(t) * .77;
        const p: [number, number, number] = [x * Math.cos(tilt) - y * Math.sin(tilt) * .24, y * Math.cos(tilt) * .55 + x * Math.sin(tilt) * .2, x * Math.sin(tilt) * .72 + y * Math.cos(tilt) * .5];
        if (last) vertices.push(...last, ...p);
        last = p;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    return g;
  }, []);
  const dust = useMemo(() => {
    const arr = new Float32Array(540 * 3);
    for (let i = 0; i < 540; i++) {
      const a = i * 2.39996323;
      const z = 1 - 2 * (i + .5) / 540;
      const r = Math.sqrt(1 - z * z) * (1.4 + .55 * ((i * 17 % 97) / 97));
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.sin(a) * r;
      arr[i * 3 + 2] = z * (1.4 + .55 * ((i * 17 % 97) / 97));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const lineMaterial = useMemo(() => new LineBasicMaterial({ color: new Color("#60b8ed"), transparent: true, opacity: .38, blending: AdditiveBlending, depthWrite: false }), []);
  const outerMaterial = useMemo(() => new LineBasicMaterial({ color: new Color("#236eae"), transparent: true, opacity: .11, blending: AdditiveBlending, depthWrite: false }), []);
  const pointsMaterial = useMemo(() => new PointsMaterial({ color: "#87dcff", size: .012, sizeAttenuation: true, transparent: true, opacity: .52, blending: AdditiveBlending, depthWrite: false }), []);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const intensity = state === "thinking" ? 1.9 : state === "listening" ? 1.55 : state === "speaking" ? 1.35 : 1;
    if (group.current) {
      group.current.rotation.y += Math.min(delta, .06) * .085 * intensity;
      group.current.rotation.x = Math.sin(t * .13) * .11;
      group.current.rotation.z = Math.sin(t * .09) * .07;
      const pulse = 1 + Math.sin(t * (state === "listening" ? 3.6 : 1.1)) * (state === "listening" ? .026 : .012);
      group.current.scale.setScalar(pulse);
    }
    lineMaterial.opacity = .35 + Math.sin(t * .8) * .055 + (state === "thinking" ? .12 : 0);
    outerMaterial.opacity = .10 + (state === "listening" ? .11 : 0);
  });
  return <group ref={group}>
    <lineSegments geometry={outer} material={outerMaterial} rotation={[.25, .6, .1]} />
    <lineSegments geometry={filaments} material={lineMaterial} />
    <points geometry={dust} material={pointsMaterial} />
    <mesh scale={.78}><sphereGeometry args={[1, 48, 32]} /><meshBasicMaterial color="#071d33" transparent opacity={.32} depthWrite={false} /></mesh>
    <mesh scale={.39}><sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color="#1c679b" transparent opacity={.12} depthWrite={false} /></mesh>
  </group>;
}

class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="jarvis-3d-fallback">J.A.R.V.I.S.</div> : this.props.children; }
}

export default function JarvisOrb({ state = "idle" }: { state?: Mode }) {
  return <div className={`jarvis-3d jarvis-3d--${state}`} role="img" aria-label={`J.A.R.V.I.S. core ${state}`}>
    <div className="jarvis-3d-aura" />
    <Boundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5.4], fov: 43 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} fallback={<div className="jarvis-3d-fallback">3D unavailable</div>}>
      <Filaments state={state} />
    </Canvas></Boundary>
    <div className="jarvis-3d-status"><span />{state === "listening" ? "LISTENING" : state === "thinking" ? "PROCESSING" : state === "speaking" ? "SPEAKING" : "AWAITING COMMAND"}</div>
  </div>;
}
