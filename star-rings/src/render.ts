// 画布渲染：星空背景、目标星图、符环结构、玩家轨迹、笔尖与粒子
import { TAU, TARGETS, VIEW, getSave, playerZ, type LevelSave, type Vec2 } from './game';

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number }
export const particles: Particle[] = [];

export function burst(sv: LevelSave): void {
  for (let i = 0; i < 70; i++) {
    const t = Math.random() * TAU, p = playerZ(t, sv);
    const ang = Math.random() * TAU, v = 0.15 + Math.random() * 0.9;
    particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 1, r: 1 + Math.random() * 2.2 });
  }
}

/* 星空背景（离屏预渲染） */
const bg = document.createElement('canvas');
let bgReady = false;
function paintBG(): void {
  bg.width = 900;
  bg.height = 900;
  const g = bg.getContext('2d')!;
  const grad = g.createRadialGradient(450, 330, 40, 450, 450, 620);
  grad.addColorStop(0, '#141b3d');
  grad.addColorStop(0.55, '#0a0e24');
  grad.addColorStop(1, '#05070f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 900, 900);
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 900, y = Math.random() * 900, r = Math.random();
    g.globalAlpha = 0.18 + Math.random() * 0.5;
    g.fillStyle = Math.random() < 0.12 ? '#cfe4ff' : '#8f9bd0';
    g.beginPath();
    g.arc(x, y, r * r * 1.5 + 0.3, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  bgReady = true;
}

/* 目标星尘闪烁相位 */
const twinkle = Array.from({ length: 720 }, () => Math.random() * TAU);

export interface FrameOpts {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  now: number;
  tAnim: number;
  drawnT: number;
  showForm: boolean;
  showTarget: boolean;
  paused: boolean;
}

/** 嵌套符环结构的逐环圆心（从星核向外） */
function chainCenters(sv: LevelSave, tAnim: number): Vec2[] {
  const arr: Vec2[] = [{ x: sv.center.x, y: sv.center.y }];
  const sorted = [...sv.rings].sort((a, b) => Math.abs(a.k) - Math.abs(b.k));
  for (const r of sorted) {
    const p = arr[arr.length - 1], a = r.k * tAnim + r.phase;
    arr.push({ x: p.x + r.amp * Math.cos(a), y: p.y + r.amp * Math.sin(a) });
  }
  return arr;
}

export function renderFrame(o: FrameOpts): void {
  const { ctx, w, h, now } = o;
  if (!bgReady) paintBG();

  const sv = getSave(storeLv);
  const tp = TARGETS[storeLv];
  const wx = (x: number) => (x / VIEW * 0.5 + 0.5) * w;
  const wy = (y: number) => (0.5 - y / VIEW * 0.5) * h;

  /* 目标星图 */
  if (o.showTarget) {
    const step = 4;
    for (let j = 0; j < tp.pts.length; j += step) {
      const p = tp.pts[j];
      const tw = 0.55 + 0.45 * Math.sin(now * 0.002 + twinkle[j]);
      ctx.globalAlpha = 0.25 + 0.55 * tw;
      ctx.fillStyle = '#e8c66a';
      ctx.beginPath();
      ctx.arc(wx(p.x), wy(p.y), 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* 符环结构 */
  if (o.showForm) {
    const chain = chainCenters(sv, o.tAnim);
    const sorted = [...sv.rings].sort((a, b) => Math.abs(a.k) - Math.abs(b.k));
    ctx.lineWidth = 1;
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i], c0 = chain[i], c1 = chain[i + 1];
      const rad = r.amp * (w / (2 * VIEW));
      const active = r.amp > 0.001;
      ctx.strokeStyle = active ? 'rgba(139,233,255,.28)' : 'rgba(120,135,190,.12)';
      ctx.beginPath();
      ctx.arc(wx(c0.x), wy(c0.y), Math.max(rad, 0.01), 0, TAU);
      ctx.stroke();
      if (active) {
        ctx.strokeStyle = 'rgba(139,233,255,.35)';
        ctx.beginPath();
        ctx.moveTo(wx(c0.x), wy(c0.y));
        ctx.lineTo(wx(c1.x), wy(c1.y));
        ctx.stroke();
      }
      ctx.fillStyle = active ? 'rgba(139,233,255,.9)' : 'rgba(120,135,190,.3)';
      ctx.beginPath();
      ctx.arc(wx(c1.x), wy(c1.y), 2, 0, TAU);
      ctx.fill();
    }
  }

  /* 玩家轨迹（生长动画） */
  const STEPS = 540;
  ctx.strokeStyle = 'rgba(139,233,255,.9)';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(139,233,255,.8)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  const nDraw = Math.max(2, Math.floor((STEPS * o.drawnT) / TAU));
  for (let i = 0; i <= nDraw; i++) {
    const p = playerZ((i / STEPS) * TAU, sv);
    if (i === 0) ctx.moveTo(wx(p.x), wy(p.y));
    else ctx.lineTo(wx(p.x), wy(p.y));
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* 笔尖辉光 */
  const tip = playerZ(o.tAnim, sv);
  const tg = ctx.createRadialGradient(wx(tip.x), wy(tip.y), 0, wx(tip.x), wy(tip.y), 14);
  tg.addColorStop(0, 'rgba(230,250,255,1)');
  tg.addColorStop(0.3, 'rgba(139,233,255,.5)');
  tg.addColorStop(1, 'rgba(139,233,255,0)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.arc(wx(tip.x), wy(tip.y), 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(wx(tip.x), wy(tip.y), 2.4, 0, TAU);
  ctx.fill();

  /* 粒子 */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    if (!o.paused) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.vy -= 0.0006;
      p.life -= 0.012;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = '#f7e3ad';
    ctx.beginPath();
    ctx.arc(wx(p.x), wy(p.y), p.r * p.life, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 当前关卡索引由 main 每帧同步（避免 render ↔ game 循环依赖） */
let storeLv = 0;
export function setRenderLevel(lv: number): void {
  storeLv = lv;
}
