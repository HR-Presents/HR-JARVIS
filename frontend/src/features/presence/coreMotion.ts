import type { CoreState } from './IntelligenceCore';
export interface Motion { speed: number; inward: number; spread: number; warmth: number; light: number }
export const profiles: Record<CoreState, Motion> = {
  standby: { speed: .12, inward: 0, spread: 0, warmth: 0, light: .78 },
  listening: { speed: .19, inward: 0, spread: .35, warmth: 0, light: 1 },
  transcribing: { speed: .32, inward: .65, spread: -.12, warmth: 0, light: .95 },
  thinking: { speed: .44, inward: 1, spread: -.18, warmth: 0, light: 1 },
  synthesizing: { speed: .28, inward: .45, spread: .1, warmth: 0, light: .9 },
  speaking: { speed: .2, inward: 0, spread: .25, warmth: 0, light: 1 },
  approval: { speed: .07, inward: 0, spread: 0, warmth: 1, light: .75 },
  error: { speed: .035, inward: 0, spread: -.15, warmth: .65, light: .48 },
};
export function easeMotion(value: Motion, target: Motion, dt: number) {
  const a = 1 - Math.exp(-Math.max(0, dt) * 3.5);
  for (const key of Object.keys(value) as (keyof Motion)[]) value[key] += (target[key] - value[key]) * a;
}
/** Root-mean-square amplitude, only from a live capture/playback analyser. */
export function audioLevel(samples: Uint8Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const value of samples) sum += ((value - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / samples.length) * 3);
}
