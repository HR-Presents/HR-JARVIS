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

/** Quiet procedural form; displacement reads real audio, never synthetic levels. */
export function IntelligenceCore({ state, analyser }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      previous = 0,
      energy = 0,
      width = 0;
    const bins = new Uint8Array(128);
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
      if (document.hidden || time - previous < (reduced.matches ? 180 : 32))
        return;
      previous = time;
      let sample = 0;
      if ((state === "listening" || state === "speaking") && analyser.current) {
        analyser.current.getByteFrequencyData(bins);
        sample = bins.reduce((a, b) => a + b, 0) / (bins.length * 255);
      }
      energy = energy * 0.82 + sample * 0.18;
      const t = reduced.matches ? 0 : time * 0.00015;
      const active = state === "listening" || state === "speaking";
      const processing = ["transcribing", "thinking", "synthesizing"].includes(
        state,
      );
      const rgb =
        state === "error"
          ? "177,153,155"
          : state === "approval"
            ? "193,175,144"
            : active
              ? "151,196,201"
              : "168,184,193";
      ctx.clearRect(0, 0, width, width);
      ctx.save();
      ctx.translate(width / 2, width / 2);
      ctx.scale(width / 500, width / 500);
      const radius = 161 + energy * 15;
      const aura = ctx.createRadialGradient(0, 0, 120, 0, 0, 230);
      aura.addColorStop(0, `rgba(${rgb},${0.035 + energy * 0.1})`);
      aura.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = aura;
      ctx.fillRect(-250, -250, 500, 500);
      const sphere = ctx.createRadialGradient(-60, -74, 4, 0, 0, radius);
      sphere.addColorStop(0, "#233138");
      sphere.addColorStop(0.4, "#172127");
      sphere.addColorStop(0.78, "#0f171d");
      sphere.addColorStop(0.96, "#17252c");
      sphere.addColorStop(1, "#4b626b");
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphere;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius - 0.6, 0, Math.PI * 2);
      ctx.clip();
      // Silk-like contours give the dark glass form depth without HUD ornament.
      for (let i = 0; i < 48; i++) {
        const y = -radius + (i * radius * 2) / 47;
        const span = Math.sqrt(Math.max(0, radius * radius - y * y));
        ctx.beginPath();
        for (let j = 0; j <= 70; j++) {
          const x = -span + (j / 70) * span * 2;
          const falloff = Math.sin((j / 70) * Math.PI);
          const bend =
            Math.sin(x * 0.014 + t + i * 0.105) * falloff * (14 + energy * 60);
          const py = y + bend;
          if (j === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        const depth = 1 - Math.abs(y) / radius;
        ctx.strokeStyle = `rgba(${rgb},${0.025 + depth * 0.09 + energy * 0.13})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      const sheen = ctx.createLinearGradient(-radius, -radius, radius, radius);
      sheen.addColorStop(0, "rgba(219,235,238,.12)");
      sheen.addColorStop(0.45, "rgba(198,218,225,0)");
      sheen.addColorStop(1, "rgba(168,203,211,.025)");
      ctx.fillStyle = sheen;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
      // A single moving specular edge indicates processing; no invented telemetry.
      const a = processing ? t * 2.8 : t * 0.35 - 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 0.2, a, a + 0.8);
      ctx.strokeStyle = `rgba(${rgb},${processing ? 0.7 : 0.38 + energy * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, analyser]);
  return <canvas ref={canvas} className="quiet-core" aria-hidden="true" />;
}
