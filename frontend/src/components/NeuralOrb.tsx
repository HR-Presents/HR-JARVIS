import { useEffect, useRef } from 'react';

/** Deterministic filament sphere; pauses off-screen and respects reduced motion. */
export function NeuralOrb({ active = false }: { active?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, visible = true, time = 0;
    const draw = () => {
      const size = el.clientWidth;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== size * ratio) { el.width = size * ratio; el.height = size * ratio; }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const c = size / 2, r = size * .29;
      const glow = ctx.createRadialGradient(c, c, 0, c, c, size * .48);
      glow.addColorStop(0, '#1376cf22'); glow.addColorStop(.55, '#0779d91b'); glow.addColorStop(1, '#007cff00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
      const rotation = time * .00013;
      for (let strand = 0; strand < 64; strand++) {
        const longitude = strand / 64 * Math.PI * 2;
        ctx.beginPath();
        for (let j = 0; j <= 110; j++) {
          const lat = j / 110 * Math.PI;
          const twist = longitude + .23 * Math.sin(lat * 5 + time * .0005) + rotation;
          const radius = r * (1 + .035 * Math.sin(lat * 13 + longitude * 3 + time * .001));
          const x = Math.sin(lat) * Math.cos(twist), z = Math.sin(lat) * Math.sin(twist);
          const y = Math.cos(lat);
          const px = c + radius * (x * .94 + y * .22), py = c + radius * (y * .92 - x * .2 + z * .16);
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(78,172,255,${.12 + .23 * (1 + Math.sin(longitude + rotation)) / 2})`;
        ctx.lineWidth = .65; ctx.stroke();
      }
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(c, c, r * (1.3 + k * .065), r * (.26 + k * .02), -.5 + k * .17 + rotation * .22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(88,170,245,${.15 - k * .018})`; ctx.lineWidth = .7; ctx.stroke();
      }
      for (let k = 0; k < 100; k++) {
        const a = k * 2.39996 + rotation * .15, distance = size * (.34 + ((k * 37) % 101) / 101 * .12);
        ctx.fillStyle = `rgba(134,203,255,${.12 + (k % 5) * .1})`;
        ctx.beginPath(); ctx.arc(c + Math.cos(a) * distance, c + Math.sin(a) * distance * .75, k % 9 === 0 ? 1.3 : .6, 0, Math.PI * 2); ctx.fill();
      }
    };
    const tick = () => { if (visible && !document.hidden) { time += active ? 28 : 12; draw(); } frame = requestAnimationFrame(tick); };
    const start = () => { cancelAnimationFrame(frame); draw(); if (!reduced.matches) frame = requestAnimationFrame(tick); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(el); reduced.addEventListener('change', start); start();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); reduced.removeEventListener('change', start); };
  }, [active]);
  return <canvas className="neural-orb" ref={canvas} aria-label={active ? 'JARVIS listening' : 'Animated JARVIS intelligence core'} role="img" />;
}
