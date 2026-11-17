import { useEffect, useRef } from "react";
import type { RefObject } from "react";
export type CoreState =
  | "standby"
  | "listening"
  | "transcribing"
  | "thinking"
  | "synthesizing"
  | "speaking"
  | "approval"
  | "error";
interface Props {
  state: CoreState;
  analyser: RefObject<AnalyserNode | null>;
}
const TAU = Math.PI * 2;
/** Procedural geometry is decoration; audio displacement reads real analyser samples only. */
export function IntelligenceCore({ state, analyser }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      previous = 0,
      energy = 0;
    const bins = new Uint8Array(128);
    let width = 0;
    const resize = () => {
      width = element.clientWidth;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      element.width = width * dpr;
      element.height = width * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || time - previous < (motion.matches ? 160 : 30))
        return;
      previous = time;
      let sample = 0;
      if ((state === "listening" || state === "speaking") && analyser.current) {
        analyser.current.getByteFrequencyData(bins);
        sample = bins.reduce((a, b) => a + b, 0) / (bins.length * 255);
      }
      energy = energy * 0.78 + sample * 0.22;
      const t = motion.matches
          ? 0
          : time *
            0.00018 *
            (["thinking", "transcribing", "synthesizing"].includes(state)
              ? 1.8
              : 1),
        scale = width / 600,
        c = width / 2;
      const rgb =
        state === "approval"
          ? "245,190,107"
          : state === "error"
            ? "235,136,149"
            : "107,224,244";
      ctx.clearRect(0, 0, width, width);
      ctx.save();
      ctx.translate(c, c);
      ctx.scale(scale, scale);
      const halo = ctx.createRadialGradient(0, 0, 65, 0, 0, 280);
      halo.addColorStop(0, `rgba(${rgb},${0.08 + energy * 0.25})`);
      halo.addColorStop(0.6, `rgba(${rgb},.025)`);
      halo.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(-300, -300, 600, 600);
      // Precision ticks and segmented orbital rings.
      for (let i = 0; i < 120; i++) {
        const a = (i * TAU) / 120;
        const r = 260;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(
          Math.cos(a) * (r + (i % 10 === 0 ? 9 : 3)),
          Math.sin(a) * (r + (i % 10 === 0 ? 9 : 3)),
        );
        ctx.strokeStyle = `rgba(${rgb},${i % 10 === 0 ? 0.55 : 0.16})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const rings = [
        { r: 246, d: 1 },
        { r: 223, d: -1 },
        { r: 199, d: 0.7 },
      ];
      for (const { r, d } of rings) {
        ctx.strokeStyle = `rgba(${rgb},.20)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const a = t * d + (k * TAU) / 3;
          ctx.strokeStyle = `rgba(${rgb},${0.48 + k * 0.15})`;
          ctx.lineWidth = k === 0 ? 1.8 : 0.8;
          ctx.beginPath();
          ctx.arc(0, 0, r, a, a + 0.5 + (k === 0 ? 0.5 : 0));
          ctx.stroke();
        }
      }
      // Latitude mesh rotates through a projected sphere, with depth-based opacity.
      const radius = 158 + energy * 30;
      const rotation = t * 0.65;
      for (let lat = 0; lat < 15; lat++) {
        const phi = (Math.PI * (lat + 1)) / 16;
        const y = Math.cos(phi) * radius;
        const rr = Math.sin(phi) * radius;
        ctx.beginPath();
        for (let j = 0; j <= 90; j++) {
          const theta = (j / 90) * TAU + rotation;
          const x = Math.cos(theta) * rr,
            z = Math.sin(theta) * rr;
          const tilt = 0.28;
          const py = y * Math.cos(tilt) - z * Math.sin(tilt);
          const depth = (z + radius) / (radius * 2);
          const distortion = energy * Math.sin(j * 0.42 + lat) * 5;
          const px = x * (0.9 + depth * 0.12) + distortion;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(${rgb},${0.14 + Math.sin(phi) * 0.28 + energy * 0.18})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let lon = 0; lon < 20; lon++) {
        const theta = (lon * TAU) / 20 + rotation;
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const phi = (k / 48) * Math.PI;
          const x = Math.cos(theta) * Math.sin(phi) * radius,
            z = Math.sin(theta) * Math.sin(phi) * radius,
            y = Math.cos(phi) * radius;
          const py = y * 0.96 - z * 0.27;
          if (k === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        ctx.strokeStyle = `rgba(${rgb},${0.1 + (Math.sin(theta) + 1) * 0.1})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      for (let i = 0; i < 110; i++) {
        const y = 1 - (i / 109) * 2,
          rad = Math.sqrt(1 - y * y),
          a = i * 2.399963 + rotation;
        const z = Math.sin(a) * rad;
        const x = Math.cos(a) * rad;
        const r = radius + 3;
        ctx.beginPath();
        ctx.arc(x * r, y * r * 0.96 - z * r * 0.27, z > 0 ? 1.3 : 0.7, 0, TAU);
        ctx.fillStyle = `rgba(${rgb},${0.22 + (z + 1) * 0.32})`;
        ctx.fill();
      }
      // Only the live recording/playback states show an audio spectrum.
      if (state === "listening" || state === "speaking") {
        for (let i = 0; i < 64; i++) {
          const a = (i * TAU) / 64;
          const amp = bins[i] / 255;
          const r = 184;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(
            Math.cos(a) * (r + amp * 27),
            Math.sin(a) * (r + amp * 27),
          );
          ctx.strokeStyle = `rgba(${rgb},${0.15 + amp * 0.7})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, analyser]);
  return <canvas ref={canvas} className="presence-canvas" aria-hidden="true" />;
}
