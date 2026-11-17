import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioLevel, easeMotion, profiles } from '../src/features/presence/coreMotion.ts';

test('audio meter reports silence and real waveform energy without idle synthesis', () => {
  assert.equal(audioLevel(new Uint8Array(256).fill(128)), 0);
  assert.equal(audioLevel(new Uint8Array()), 0);
  assert.ok(audioLevel(new Uint8Array([100, 156])) > 0);
  assert.equal(audioLevel(new Uint8Array([0, 255])), 1);
});
test('state transitions converge consistently at different frame rates', () => {
  const a = { ...profiles.speaking }, b = { ...profiles.speaking };
  for (let i = 0; i < 30; i++) easeMotion(a, profiles.standby, 1 / 30);
  for (let i = 0; i < 60; i++) easeMotion(b, profiles.standby, 1 / 60);
  for (const key of Object.keys(a) as (keyof typeof a)[]) assert.ok(Math.abs(a[key] - b[key]) < 1e-10);
  assert.ok(a.speed > profiles.standby.speed);
  assert.ok(a.speed < profiles.speaking.speed);
  easeMotion(a, profiles.error, -1);
  assert.ok(Number.isFinite(a.speed));
});
