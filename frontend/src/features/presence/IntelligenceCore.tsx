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
/** Cinematic texture with procedural light layers. Audio displacement uses real samples. */
export function IntelligenceCore({ state, analyser }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    form = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      previous = 0,
      energy = 0,
      width = 0,
      clock = 0;
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
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden || time - previous < (preference.matches ? 180 : 32))
        return;
      const dt = Math.min(time - previous, 100);
      previous = time;
      let sample = 0;
      if ((state === "listening" || state === "speaking") && analyser.current) {
        analyser.current.getByteFrequencyData(bins);
        sample = bins.reduce((a, b) => a + b, 0) / (bins.length * 255);
      }
      energy = energy * 0.8 + sample * 0.2;
      const working = ["thinking", "transcribing", "synthesizing"].includes(
        state,
      );
      if (!preference.matches) clock += dt * 0.00011 * (working ? 1.7 : 1);
      form.current?.style.setProperty("--audio-energy", String(energy));
      form.current?.style.setProperty(
        "--core-angle",
        `${preference.matches ? 0 : Math.sin(clock * 0.32) * 1.8}deg`,
      );
      ctx.clearRect(0, 0, width, width);
      ctx.save();
      ctx.translate(width / 2, width / 2);
      ctx.scale(width / 600, width / 600);
      const rgb =
        state === "error"
          ? "174,146,159"
          : state === "approval"
            ? "211,191,153"
            : "127,218,255";
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 4; k++) {
        const angle = clock * (k % 2 ? -0.68 : 0.55) + k * 1.57,
          r = 249 + k * 3;
        ctx.save();
        ctx.rotate(k * 0.81);
        ctx.scale(1, 0.75 + k * 0.045);
        const gradient = ctx.createLinearGradient(-r, 0, r, 0);
        gradient.addColorStop(0, `rgba(${rgb},0)`);
        gradient.addColorStop(0.7, `rgba(${rgb},${0.18 + energy * 0.5})`);
        gradient.addColorStop(1, `rgba(${rgb},.65)`);
        ctx.beginPath();
        ctx.arc(0, 0, r, angle, angle + 0.57);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        const x = Math.cos(angle + 0.57) * r,
          y = Math.sin(angle + 0.57) * r;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 7 + energy * 8);
        glow.addColorStop(0, `rgba(${rgb},.7)`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - 16, y - 16, 32, 32);
        ctx.restore();
      }
      if (state === "listening" || state === "speaking")
        for (let i = 0; i < 64; i++) {
          const angle = (i * Math.PI * 2) / 64,
            amplitude = bins[i] / 255,
            r = 230;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          ctx.lineTo(
            Math.cos(angle) * (r + amplitude * 22),
            Math.sin(angle) * (r + amplitude * 22),
          );
          ctx.strokeStyle = `rgba(${rgb},${0.04 + amplitude * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      if (working) {
        ctx.beginPath();
        ctx.arc(0, 0, 95, clock * 2, clock * 2 + 0.9);
        ctx.strokeStyle = `rgba(${rgb},.22)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, analyser]);
  return (
    <div ref={form} className={"core-art core-art-" + state}>
      <div className="core-atmosphere" />
      <img
        className="core-image"
        src="/visuals/jarvis-core.webp"
        alt=""
        draggable={false}
      />
      <canvas ref={canvas} className="core-lightfield" aria-hidden="true" />
    </div>
  );
}
