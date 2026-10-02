// 音效：以频率对应的音高构成听觉反馈（k=1..4 恰为谐波列）
let AC: AudioContext | null = null;
let lastTick = 0;

function ac(): AudioContext {
  if (!AC) AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return AC;
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', when = 0): void {
  try {
    const a = ac(), t0 = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* 静默 */ }
}

import { freqDef } from './defs';

/** 塔发射：对应音高的轻响（全局节流，避免满屏嘈杂） */
export function tickFor(k: number): void {
  const now = performance.now();
  if (now - lastTick < 90) return;
  lastTick = now;
  tone(freqDef(k).tone, 0.12, 0.035, 'triangle');
}

/** 击杀：该涌灵各层音高的短琶音 */
export function killChord(ks: number[]): void {
  ks.forEach((k, i) => tone(freqDef(k).tone, 0.35, 0.07, 'triangle', i * 0.06));
}

/** 变奏切换提示 */
export function shiftTrill(): void {
  tone(880, 0.08, 0.04, 'sine');
  tone(660, 0.08, 0.04, 'sine', 0.09);
}

/** 泄漏：低沉闷响 */
export function leakThud(): void {
  tone(110, 0.4, 0.12, 'sawtooth');
  tone(82, 0.5, 0.1, 'sine');
}

/** 建造/升级 */
export function buildSound(): void {
  tone(392, 0.12, 0.06, 'triangle');
  tone(523, 0.14, 0.06, 'triangle', 0.08);
}

/** 过关号角 */
export function winFanfare(): void {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 0.08, 'triangle', i * 0.13));
}

/** 失败低鸣 */
export function loseMoan(): void {
  [330, 262, 196].forEach((f, i) => tone(f, 0.6, 0.08, 'sine', i * 0.2));
}

/** 波次开始鼓点 */
export function waveDrum(): void {
  tone(196, 0.25, 0.1, 'sine');
  tone(98, 0.35, 0.1, 'sine', 0.05);
}

/** 点击 */
export function click(): void {
  tone(1320, 0.06, 0.03, 'sine');
}
