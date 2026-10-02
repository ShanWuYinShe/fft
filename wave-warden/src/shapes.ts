// 形影系统：任意轮廓 → 极坐标 DFT 分解为频率分量层；以及剩余分量的形状重建
export const TAU = Math.PI * 2;

/** 形状定义：参数方程采样成极坐标半径表 r(θ)（归一化在 1 附近） */
export interface ShapeDef {
  key: string;
  name: string;
  hint: string;
  table: Float64Array;   // 256 项：r((i/256)·2π)
}

const N = 256;

/** 参数方程 → 极坐标表 */
function fromParam(f: (t: number) => [number, number]): Float64Array {
  const M = 720;
  const pts: [number, number][] = [];
  for (let i = 0; i < M; i++) pts.push(f((i / M) * TAU));
  // 质心
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= M; cy /= M;
  // 极坐标化：θ 桶平均
  const buckets = new Array(N).fill(0);
  const counts = new Array(N).fill(0);
  for (const [x, y] of pts) {
    const dx = x - cx, dy = y - cy;
    let th = Math.atan2(dy, dx);
    if (th < 0) th += TAU;
    const b = Math.floor((th / TAU) * N) % N;
    buckets[b] += Math.hypot(dx, dy);
    counts[b]++;
  }
  const table = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) {
    table[i] = counts[i] ? buckets[i] / counts[i] : 0;
    mean += table[i];
  }
  mean /= N;
  // 空桶用邻值填补，再归一到均值 1
  for (let i = 0; i < N; i++) if (!table[i]) table[i] = table[(i + N - 1) % N];
  for (let i = 0; i < N; i++) table[i] /= mean || 1;
  return table;
}

/** 从点列（用户手绘）构造极坐标表；不闭合/点太少返回 null */
export function tableFromPoints(raw: [number, number][]): Float64Array | null {
  if (raw.length < 12) return null;
  let cx = 0, cy = 0;
  for (const [x, y] of raw) { cx += x; cy += y; }
  cx /= raw.length; cy /= raw.length;
  const items: { th: number; r: number }[] = [];
  for (const [x, y] of raw) {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 4) continue;                       // 忽略质心附近的抖动
    let th = Math.atan2(dy, dx);
    if (th < 0) th += TAU;
    items.push({ th, r });
  }
  if (items.length < 12) return null;
  items.sort((a, b) => a.th - b.th);
  // 检查闭合性：最大角度缺口
  let maxGap = 0;
  for (let i = 0; i < items.length; i++) {
    const next = items[(i + 1) % items.length];
    let gap = next.th - items[i].th;
    if (i === items.length - 1) gap += TAU;
    maxGap = Math.max(maxGap, gap);
  }
  if (maxGap > (120 / 360) * TAU) return null;
  // 均匀 θ 线性插值
  const table = new Float64Array(N);
  const maxR = Math.max(...items.map(i => i.r));
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    // 找到 th 左右的采样点
    let lo = 0;
    while (lo < items.length && items[lo].th < th) lo++;
    const a = items[(lo + items.length - 1) % items.length];
    const b = items[lo % items.length];
    let span = b.th - a.th;
    if (span <= 0) span += TAU;
    let off = th - a.th;
    if (off < 0) off += TAU;
    const f = Math.min(1, Math.max(0, off / span));
    table[i] = (a.r * (1 - f) + b.r * f) / (maxR || 1);
  }
  // 平滑两次（窗口 5）
  for (let pass = 0; pass < 2; pass++) {
    const t2 = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let acc = 0;
      for (let d = -2; d <= 2; d++) acc += table[(i + d + N) % N];
      t2[i] = acc / 5;
    }
    table.set(t2);
  }
  // 归一均值 1
  let mean = 0;
  for (let i = 0; i < N; i++) mean += table[i];
  mean /= N;
  for (let i = 0; i < N; i++) table[i] /= mean || 1;
  return table;
}

/* ── 内置形状库 ── */
export const SHAPES: Record<string, ShapeDef> = {
  heart: {
    key: 'heart', name: '心之形影', hint: '圆滑的轮廓只含低频成分。',
    table: fromParam(t => {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return [x, -y] as [number, number];
    }),
  },
  star5: {
    key: 'star5', name: '五芒形影', hint: '尖角林立——高频成分很盛。',
    table: fromParam(t => {
      // 交替半径的十边形（5 尖）
      const seg = (t / TAU) * 10;
      const i = Math.floor(seg);
      const f = seg - i;
      const rOut = 1.25, rIn = 0.55;
      const r = i % 2 === 0 ? rOut + (rIn - rOut) * f : rIn + (rOut - rOut) * f;
      return [r * Math.cos(t - Math.PI / 2), r * Math.sin(t - Math.PI / 2)] as [number, number];
    }),
  },
  crown: {
    key: 'crown', name: '王冠形影', hint: '三尖一底，高低频混杂。',
    table: fromParam(t => {
      // 底边 + 三尖的多边形
      const pts: [number, number][] = [
        [-1.2, 0.5], [-1.2, -0.4], [-0.8, 0.15], [-0.4, -0.9], [0, 0.1], [0.4, -0.9], [0.8, 0.15], [1.2, -0.4], [1.2, 0.5],
      ];
      // 沿多边形周长均匀采样
      const per: number[] = [0];
      for (let i = 1; i <= pts.length; i++) {
        const a = pts[i - 1], b = pts[i % pts.length];
        per.push(per[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      const total = per[pts.length];
      const d = (t / TAU) * total;
      let i = 0;
      while (i < pts.length && per[i + 1] < d) i++;
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
      const f = (d - per[i]) / (per[i + 1] - per[i] || 1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as [number, number];
    }),
  },
  bat: {
    key: 'bat', name: '翼影', hint: '不对称的翅膀富含高频。',
    table: fromParam(t => {
      const wing = Math.abs(Math.cos(t));
      const r = 0.65 + 0.55 * Math.pow(wing, 1.6) * (1 + 0.25 * Math.sin(6 * t));
      return [r * Math.cos(t + Math.PI), r * Math.sin(t + Math.PI)] as [number, number];
    }),
  },
  gear: {
    key: 'gear', name: '齿影', hint: '密齿高频密集——骤涌塔的盛宴。',
    table: fromParam(t => [Math.cos(t) * (0.85 + 0.15 * Math.tanh(4 * Math.cos(9 * t))), Math.sin(t) * (0.85 + 0.15 * Math.tanh(4 * Math.cos(9 * t)))] as [number, number]),
  },
};

/** 随机平滑形状（本身就是若干低频正弦之和——分解结果天然吻合） */
export function randomBlobTable(seed: number): Float64Array {
  const rand = (n: number) => {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const terms: { k: number; A: number; p: number }[] = [];
  for (let k = 1; k <= 5; k++) terms.push({ k, A: (rand(k) * 0.5 + 0.2) / k, p: rand(k + 10) * TAU });
  return fromParam(t => {
    let r = 1;
    for (const { k, A, p } of terms) r += A * Math.sin(k * t + p);
    return [r * Math.cos(t), r * Math.sin(t)] as [number, number];
  });
}

/* ── DFT 分解 ── */
export interface ShapeComp { k: number; A: number; phase: number }

/**
 * 对半径表做 DFT，取 |k|=1..6 中显著的分量。
 * r(θ) 为实函数，正负频率共轭成对：A = 2|c_k|，相位 = arg(c_k)。
 */
export function decompose(table: Float64Array): { c0: number; comps: ShapeComp[] } {
  let c0 = 0;
  for (let i = 0; i < N; i++) c0 += table[i];
  c0 /= N;
  const comps: ShapeComp[] = [];
  // 只取 k=1..4：音叉塔的频率范围（更高频分量截断，形状重建同口径）
  for (let k = 1; k <= 4; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      const a = -(k * i / N) * TAU;
      re += table[i] * Math.cos(a);
      im += table[i] * Math.sin(a);
    }
    const mag = (2 * Math.hypot(re, im)) / N;
    comps.push({ k, A: mag, phase: Math.atan2(im / N, re / N) });
  }
  return { c0, comps };
}

export interface ShapeBuild {
  c0: number;
  baseR: number;
  layers: { k: number; amp: number; maxAmp: number; phase: number }[];  // maxAmp=该层视觉振幅
}

/**
 * 把形状构建为敌人血层：显著分量逐层归一到总血量。
 * 弱分量（< 峰值的 14%）丢弃；不足 2 层时并入最强层。
 */
export function buildShape(table: Float64Array, baseR: number, totalAmp: number): ShapeBuild {
  const { c0, comps } = decompose(table);
  const peak = Math.max(...comps.map(c => c.A));
  let kept = comps.filter(c => c.A > peak * 0.14);
  if (kept.length === 0) kept = [comps.reduce((a, b) => (b.A > a.A ? b : a))];
  if (kept.length > 5) kept = kept.sort((a, b) => b.A - a.A).slice(0, 5);
  const sum = kept.reduce((acc, c) => acc + c.A, 0);
  const layers = kept
    .sort((a, b) => a.k - b.k)
    .map(c => ({ k: c.k, amp: (c.A / sum) * totalAmp, maxAmp: (c.A / sum) * totalAmp, phase: c.phase }));
  return { c0, baseR, layers };
}
