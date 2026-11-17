import { useCallback, useEffect, useRef } from "react";

/** Audio graph: microphone is never connected to speakers; playback is. */
export function useAudioReactivity() {
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const source = useRef<AudioNode | null>(null);
  const mediaSources = useRef(
    new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>(),
  );
  const ensure = useCallback(() => {
    if (!context.current || context.current.state === "closed") {
      context.current = new AudioContext();
      analyser.current = context.current.createAnalyser();
      analyser.current.fftSize = 256;
      analyser.current.smoothingTimeConstant = 0.72;
    }
    return context.current;
  }, []);
  const unlock = useCallback(async () => {
    try {
      await ensure().resume();
    } catch {
      /* The recorder/player can still operate without visual metering. */
    }
  }, [ensure]);
  const detach = useCallback(() => {
    try {
      source.current?.disconnect();
    } catch {}
    source.current = null;
  }, []);
  const microphone = useCallback(
    async (stream: MediaStream) => {
      try {
        const ctx = ensure();
        await ctx.resume();
        detach();
        const src = ctx.createMediaStreamSource(stream);
        src.connect(analyser.current!);
        source.current = src;
      } catch {
        detach();
      }
    },
    [ensure, detach],
  );
  const playback = useCallback(
    async (element: HTMLAudioElement) => {
      try {
        const ctx = ensure();
        await ctx.resume();
        detach();
        let src = mediaSources.current.get(element);
        if (!src) {
          src = ctx.createMediaElementSource(element);
          mediaSources.current.set(element, src);
        }
        src.connect(analyser.current!);
        src.connect(ctx.destination);
        source.current = src;
      } catch {
        detach();
      }
    },
    [ensure, detach],
  );
  useEffect(
    () => () => {
      detach();
      void context.current?.close();
    },
    [detach],
  );
  return { analyser, unlock, microphone, playback, detach };
}
