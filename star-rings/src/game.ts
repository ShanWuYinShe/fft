// 核心数据与算法：关卡、符环、目标构建（DFT 截断）、状态、评分
export const TAU = Math.PI * 2;

export interface Vec2 { x: number; y: number }
export interface RingState { k: number; amp: number; phase: number }
export interface LevelSave { rings: RingState[]; center: Vec2; resLeft: number }
export interface Truth { mag: number; phase: number }
export interface Target { pts: Vec2[]; active: number[]; truth: Record<number, Truth>; center: Vec2 }
export interface RingDef { k: number; cn: string; dir: string; tag: string }
export interface LevelDef {
  star: string;
  name: string;
  hint: string;
  win: string;
  curve: (t: number) => Vec2;
}

/** 符环阵容：k 为谐波次数（正=顺行，负=逆行），tag 为转速描述 */
export const RING_DEFS: RingDef[] = [
  { k: 1, cn: '壹', dir: '顺行', tag: '缓' },
  { k: -1, cn: '贰', dir: '逆行', tag: '缓' },
  { k: 2, cn: '叁', dir: '顺行', tag: '疾' },
  { k: -2, cn: '肆', dir: '逆行', tag: '疾' },
  { k: 3, cn: '伍', dir: '顺行', tag: '骤' },
  { k: -3, cn: '陆', dir: '逆行', tag: '骤' },
  { k: 4, cn: '柒', dir: '顺行', tag: '迅' },
  { k: -4, cn: '捌', dir: '逆行', tag: '迅' },
];

export const AMP_MAX = 1.42;      // 星辉滑块上限（≥ 圆关真值 1.38，保证满分可达成）
export const RES_MAX = 2;         // 每关共鸣探测次数
export const VIEW = 1.62;         // 画布视野半径（世界坐标）
export const TARGET_PEAK = 1.38;  // 目标星图归一化峰值半径
const SCORE_DEN = 0.28;           // 评分距离常数：avg=0.09 → ~90 分，avg≈0 → 100

const rot2 = (x: number, y: number, a: number): Vec2 => ({
  x: x * Math.cos(a) - y * Math.sin(a),
  y: x * Math.sin(a) + y * Math.cos(a),
});

export const LEVELS: LevelDef[] = [
  {
    star: '天枢', name: '初醒之环',
    hint: '拉起 <b>符环·壹</b> 的星辉，让光点沿金色星轨画出一个完整的圆。',
    curve: t => ({ x: 1.15 * Math.cos(t), y: 1.15 * Math.sin(t) }),
    win: '夜空中第一个圆，是一切星轨的起点。天枢，醒了。',
  },
  {
    star: '天璇', name: '流转之环',
    hint: '<b>逆行</b>的符环·贰已苏醒。顺逆两环同时调起，圆会被拉成流转的椭圆。',
    curve: t => ({ x: 1.25 * Math.cos(t) + 0.5 * Math.cos(-t), y: 1.25 * Math.sin(t) + 0.5 * Math.sin(-t) }),
    win: '顺行与逆行彼此牵引，圆便成了流转之环。天璇，醒了。',
  },
  {
    star: '天玑', name: '三尖星辉',
    hint: '符环·肆的转速<b>加倍</b>。让缓行的壹与加倍逆行的肆共舞，三道尖辉便会浮现。',
    curve: t => ({ x: 1.05 * Math.cos(t) + 0.42 * Math.cos(-2 * t), y: 1.05 * Math.sin(t) + 0.42 * Math.sin(-2 * t) }),
    win: '一缓一疾，三尖立现。天玑，醒了。',
  },
  {
    star: '心宿二', name: '心宿',
    hint: '拖动面板顶端的<b>星核</b>——整幅轨迹会随之漂移。心宿远离原点，需先定其位。',
    curve: t => rot2(0.62 + 0.68 * Math.cos(t) + 0.42 * Math.cos(2 * t), 0.68 * Math.sin(t) + 0.42 * Math.sin(2 * t), -Math.PI / 2),
    win: '星核既定，双环共舞，赤色星官的心脏重新搏动。心宿，醒了。',
  },
  {
    star: '玉衡', name: '五芒',
    hint: '符环·柒转速<b>极迅</b>。缓行的壹与极迅逆行的柒相叠，五道星芒将破空而出。方位不对？转一转符环的朝向。',
    curve: t => rot2(1.08 * Math.cos(t) + 0.36 * Math.cos(-4 * t), 1.08 * Math.sin(t) + 0.36 * Math.sin(-4 * t), Math.PI / 2),
    win: '一缓一迅，五芒破空。玉衡，醒了。',
  },
  {
    star: '开阳', name: '四瓣花语',
    hint: '三枚符环在此共鸣：<b>壹、贰、陆</b>——一顺两逆，缺一不可。沉睡的符环无需唤醒。',
    curve: t => ({ x: Math.cos(t) + 0.5 * Math.cos(-3 * t) + 0.18 * Math.cos(-t), y: Math.sin(t) + 0.5 * Math.sin(-3 * t) + 0.18 * Math.sin(-t) }),
    win: '三环齐鸣，四瓣绽开。开阳，醒了。',
  },
  {
    star: '摇光', name: '失落星图',
    hint: '最后的星图残缺而繁复：<b>星核与五枚符环</b>交织成窗。善用共鸣探测，凝神细调。',
    curve: t => ({
      x: 0.45 + 0.75 * Math.cos(t + 0.5) + 0.55 * Math.cos(-2 * t + 2.1) + 0.35 * Math.cos(3 * t + 4.0) + 0.28 * Math.cos(-4 * t + 1.2) + 0.2 * Math.cos(2 * t + 5.0),
      y: 0.75 * Math.sin(t + 0.5) + 0.55 * Math.sin(-2 * t + 2.1) + 0.35 * Math.sin(3 * t + 4.0) + 0.28 * Math.sin(-4 * t + 1.2) + 0.2 * Math.sin(2 * t + 5.0),
    }),
    win: '星核归位，五环同辉——失落的星图重明于夜空。七星连珠，秘仪已成。',
  },
];

/** 采样 → DFT 取 |k|<=4 → 峰值归一 → 用截断系数重建目标点列（与符环系统同构，满分可达成） */
export function buildTarget(lv: LevelDef): Target {
  const N = 4096, M = 720;
  const raw: Vec2[] = [];
  for (let j = 0; j < N; j++) raw.push(lv.curve((j / N) * TAU));

  const coef: Record<number, Vec2> = {};
  for (let k = -4; k <= 4; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < N; j++) {
      const a = (-TAU * k * j) / N, p = raw[j];
      re += p.x * Math.cos(a) - p.y * Math.sin(a);
      im += p.x * Math.sin(a) + p.y * Math.cos(a);
    }
    coef[k] = { x: re / N, y: im / N };
  }

  let peak = 0;
  for (let j = 0; j < M; j++) {
    let re = 0, im = 0;
    for (let k = -4; k <= 4; k++) {
      const a = (TAU * k * j) / M, c = coef[k];
      re += c.x * Math.cos(a) - c.y * Math.sin(a);
      im += c.x * Math.sin(a) + c.y * Math.cos(a);
    }
    peak = Math.max(peak, Math.hypot(re, im));
  }
  const s = TARGET_PEAK / peak;
  for (const key of Object.keys(coef)) {
    const k = Number(key);
    coef[k].x *= s;
    coef[k].y *= s;
  }

  const pts: Vec2[] = [];
  for (let j = 0; j < M; j++) {
    let re = 0, im = 0;
    for (let k = -4; k <= 4; k++) {
      const a = (TAU * k * j) / M, c = coef[k];
      re += c.x * Math.cos(a) - c.y * Math.sin(a);
      im += c.x * Math.sin(a) + c.y * Math.cos(a);
    }
    pts.push({ x: re, y: im });
  }

  const active: number[] = [];
  for (const k of [1, -1, 2, -2, 3, -3, 4, -4]) {
    if (Math.hypot(coef[k].x, coef[k].y) > 0.006) active.push(k);
  }
  const truth: Record<number, Truth> = {};
  for (const k of active) {
    truth[k] = { mag: Math.hypot(coef[k].x, coef[k].y), phase: Math.atan2(coef[k].y, coef[k].x) };
  }
  return { pts, active, truth, center: { x: coef[0].x, y: coef[0].y } };
}

export const TARGETS: Target[] = LEVELS.map(buildTarget);

/* ── 进度持久化 ── */
export interface Progress { best: number[]; unlocked: number }
const PROGRESS_KEY = 'epicycle-progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (!Array.isArray(p.best)) p.best = [];
      if (typeof p.unlocked !== 'number') p.unlocked = 0;
      return p;
    }
  } catch { /* 损坏则重置 */ }
  return { best: [], unlocked: 0 };
}

export function saveProgress(p: Progress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* 无痕模式等 */ }
}

/* ── 运行时状态 ── */
export interface GameStore {
  lv: number;
  saves: (LevelSave | null)[];
  showForm: boolean;
  showTarget: boolean;
  paused: boolean;
  slow: boolean;
  progress: Progress;
}

export const store: GameStore = {
  lv: 0,
  saves: LEVELS.map(() => null),
  showForm: true,
  showTarget: true,
  paused: false,
  slow: false,
  progress: loadProgress(),
};

export function freshSave(i: number): LevelSave {
  const t = TARGETS[i];
  return { rings: t.active.map(k => ({ k, amp: 0, phase: 0 })), center: { x: 0, y: 0 }, resLeft: RES_MAX };
}

export function getSave(i: number): LevelSave {
  return store.saves[i] ?? (store.saves[i] = freshSave(i));
}

/** 玩家轨迹：星核 + Σ 符环(幅度·e^{i(k·t+相位)}) */
export function playerZ(t: number, sv: LevelSave): Vec2 {
  let x = sv.center.x, y = sv.center.y;
  for (const r of sv.rings) {
    if (r.amp <= 0) continue;
    const a = r.k * t + r.phase;
    x += r.amp * Math.cos(a);
    y += r.amp * Math.sin(a);
  }
  return { x, y };
}

/** 重合度：与目标点列的双向平均距离 → 0~100 */
export function computeScore(lv: number, sv: LevelSave): number {
  const TP = TARGETS[lv].pts;
  const P = 240, T = TP.length;
  let s1 = 0;
  for (let i = 0; i < P; i++) {
    const p = playerZ((i / P) * TAU, sv);
    let m = Infinity;
    for (let j = 0; j < T; j++) {
      const dx = p.x - TP[j].x, dy = p.y - TP[j].y, d = dx * dx + dy * dy;
      if (d < m) m = d;
    }
    s1 += Math.sqrt(m);
  }
  let s2 = 0;
  for (let j = 0; j < T; j++) {
    const q = TP[j];
    let m = Infinity;
    for (let i = 0; i < P; i++) {
      const p = playerZ((i / P) * TAU, sv);
      const dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
      if (d < m) m = d;
    }
    s2 += Math.sqrt(m);
  }
  const avg = (s1 / P + s2 / T) / 2;
  return Math.round(100 * Math.exp(-((avg / SCORE_DEN) ** 2)));
}
