let AC: AudioContext | null = null;

function ac(): AudioContext {
  if (!AC) AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return AC;
}

/** 过关琶音：按真值谐波顺序奏响 */
export function playChord(harmonics: number[]): void {
  try {
    const a = ac(), t0 = a.currentTime;
    const scale = [262, 330, 392, 523, 659, 784];
    harmonics.slice(0, 6).forEach((_, i) => {
      const f = scale[Math.min(i, scale.length - 1)];
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.09);
      g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 1.4);
      o.connect(g).connect(a.destination);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 1.5);
    });
  } catch { /* 音频不可用则静默 */ }
}

/** 轻响（首次交互解锁 AudioContext） */
export function playTick(): void {
  try {
    const a = ac(), t0 = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.value = 1320;
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + 0.16);
  } catch { /* 静默 */ }
}
