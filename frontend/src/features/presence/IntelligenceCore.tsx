import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
export type CoreState = 'standby' | 'listening' | 'transcribing' | 'thinking' | 'synthesizing' | 'speaking' | 'approval' | 'error';
interface Props { state: CoreState; analyser: RefObject<AnalyserNode | null> }

/** The scene is loaded separately; conversation and audio never depend on WebGL. */
export function IntelligenceCore({ state, analyser }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cpu = useRef<HTMLCanvasElement>(null);
  const current = useRef(state);
  useEffect(() => { current.current = state; }, [state]);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    const fallback = async () => {
      const { createCanvasCore } = await import('./coreCanvas');
      if (!disposed && cpu.current) stop = createCanvasCore(cpu.current, () => current.current, analyser);
    };
    void import('./coreScene').then(({ createCoreScene }) => {
      if (disposed || !canvas.current) return;
      try { stop = createCoreScene(canvas.current, () => current.current, analyser); }
      catch { canvas.current.dataset.unavailable = 'true'; void fallback(); }
    }).catch(() => { if (canvas.current) canvas.current.dataset.unavailable = 'true'; void fallback(); });
    return () => { disposed = true; stop?.(); };
  }, [analyser]);
  return <div className={'core-art core-art-' + state}>
    <div className="core-atmosphere" />
    <svg className="core-fallback" viewBox="0 0 600 600" aria-hidden="true">
      <defs><radialGradient id="fallback-glow"><stop stopColor="#67cafa" stopOpacity=".12"/><stop offset="1" stopColor="#67cafa" stopOpacity="0"/></radialGradient></defs>
      <circle cx="300" cy="300" r="220" fill="url(#fallback-glow)"/>
      <g fill="none" stroke="#538eac" strokeWidth=".7" opacity=".55"><circle cx="300" cy="300" r="205"/><ellipse cx="300" cy="300" rx="110" ry="205"/><ellipse cx="300" cy="300" rx="205" ry="75"/><circle cx="300" cy="300" r="35"/></g>
    </svg>
    <canvas ref={canvas} className="core-webgl" aria-hidden="true" />
    <canvas ref={cpu} className="core-cpu" aria-hidden="true" />
  </div>;
}
