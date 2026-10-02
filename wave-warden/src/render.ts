// 战场渲染：水道、涌灵花影、音叉塔、净波弹道与特效
import { CELL, FIELD_H, FIELD_W, FREQ_COLOR, TOWER_LEVELS, TAU, freqDef } from './defs';
import type { Session, Tower } from './state';

export interface View {
  time: number;
  hover: { gx: number; gy: number } | null;
  placingK: number | null;      // 正在放置的塔频率
  selected: Tower | null;       // 选中（升级面板打开）的塔
}

let bgCache: HTMLCanvasElement | null = null;

function paintBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FIELD_W;
  c.height = FIELD_H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, FIELD_H);
  grad.addColorStop(0, '#0a1026');
  grad.addColorStop(1, '#070b1a');
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD_W, FIELD_H);
  for (let i = 0; i < 130; i++) {
    g.globalAlpha = 0.06 + Math.random() * 0.14;
    g.fillStyle = Math.random() < 0.5 ? '#8fa8d8' : '#cfe4ff';
    g.beginPath();
    g.arc(Math.random() * FIELD_W, Math.random() * FIELD_H, Math.random() * 1.3 + 0.3, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

function drawPath(ctx: CanvasRenderingContext2D, s: Session, time: number): void {
  const pts = s.level.path;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 水道外描
  ctx.strokeStyle = 'rgba(70, 100, 160, 0.35)';
  ctx.lineWidth = 40;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  // 水道内芯
  ctx.strokeStyle = 'rgba(38, 58, 108, 0.8)';
  ctx.lineWidth = 32;
  ctx.stroke();
  // 流动虚线
  ctx.strokeStyle = 'rgba(150, 190, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = -time * 30;
  ctx.stroke();
  ctx.setLineDash([]);
  // 湖口（终点）警戒环
  const end = s.path.posAt(s.path.total - 26);
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.strokeStyle = 'rgba(255, 130, 130, ' + (0.25 + 0.3 * pulse) + ')';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 16 + pulse * 5, 0, TAU);
  ctx.stroke();
}

function drawTower(ctx: CanvasRenderingContext2D, t: Tower, selected: boolean, time: number): void {
  const color = FREQ_COLOR[t.k] ?? '#fff';
  const lv = TOWER_LEVELS[t.level - 1];
  if (selected) {
    ctx.strokeStyle = 'rgba(255, 235, 180, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, lv.range, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 底座
  ctx.fillStyle = 'rgba(20, 30, 60, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 14, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // 音叉齿：k 根短针
  for (let i = 0; i < t.k; i++) {
    const a = (i / t.k) * TAU + time * 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x + Math.cos(a) * 6, t.y + Math.sin(a) * 6);
    ctx.lineTo(t.x + Math.cos(a) * 11, t.y + Math.sin(a) * 11);
    ctx.stroke();
  }
  // 等级珠
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(t.x - 6 + i * 6, t.y + 19, 2, 0, TAU);
    ctx.fill();
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, s: Session, time: number): void {
  for (const e of s.enemies) {
    const isBoss = e.kind.boss;
    const baseR = isBoss ? 20 : 12;
    // 花影：每层一道 r(θ)=R + a·sin(kθ+ωt)
    for (const layer of e.layers) {
      if (layer.amp <= 0) continue;
      const ratio = layer.amp / layer.maxAmp;
      const a = 3 + 9 * ratio;
      const R = baseR * (1 + 0.12 * (e.layers.length - 1));
      const color = FREQ_COLOR[layer.k] ?? '#fff';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35 + 0.6 * ratio;
      ctx.lineWidth = isBoss ? 2 : 1.6;
      ctx.beginPath();
      const w = time * (1.4 + layer.k * 0.35) + e.seed;
      for (let i = 0; i <= 40; i++) {
        const th = (i / 40) * TAU;
        const r = R + a * Math.sin(layer.k * th + w);
        const x = e.x + Math.cos(th) * r;
        const y = e.y + Math.sin(th) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    // 核心光珠
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, baseR * 0.8);
    g.addColorStop(0, e.hitFlash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(200, 225, 255, 0.9)');
    g.addColorStop(1, 'rgba(120, 160, 230, 0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, baseR * 0.8, 0, TAU);
    ctx.fill();
    // 每层血条
    const alive = e.layers.filter(l => l.amp > 0);
    if (alive.length) {
      const bw = isBoss ? 52 : 26;
      alive.forEach((l, i) => {
        const y = e.y - baseR - 10 - (alive.length - 1 - i) * 5;
        ctx.fillStyle = 'rgba(10, 16, 34, 0.8)';
        ctx.fillRect(e.x - bw / 2, y, bw, 3);
        ctx.fillStyle = FREQ_COLOR[l.k] ?? '#fff';
        ctx.fillRect(e.x - bw / 2, y, (bw * l.amp) / l.maxAmp, 3);
      });
    }
    if (e.hitFlash > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + e.hitFlash * 0.5 + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, baseR + 4, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawShots(ctx: CanvasRenderingContext2D, s: Session, time: number): void {
  for (const sh of s.shots) {
    const color = FREQ_COLOR[sh.k] ?? '#fff';
    const pulse = 1 + 0.25 * Math.sin(time * 18 + sh.phase);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, 6 * pulse, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, 2.6, 0, TAU);
    ctx.fill();
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, s: Session, v: View): void {
  if (!bgCache) bgCache = paintBackground();
  ctx.save();
  if (s.shake > 0) {
    ctx.translate((Math.random() - 0.5) * s.shake * 8, (Math.random() - 0.5) * s.shake * 8);
  }
  ctx.drawImage(bgCache, 0, 0);

  // 网格
  ctx.strokeStyle = 'rgba(120, 150, 220, 0.05)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= FIELD_W / CELL; gx++) {
    ctx.beginPath();
    ctx.moveTo(gx * CELL, 0);
    ctx.lineTo(gx * CELL, FIELD_H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= FIELD_H / CELL; gy++) {
    ctx.beginPath();
    ctx.moveTo(0, gy * CELL);
    ctx.lineTo(FIELD_W, gy * CELL);
    ctx.stroke();
  }

  drawPath(ctx, s, v.time);
  for (const t of s.towers) drawTower(ctx, t, v.selected?.id === t.id, v.time);
  drawEnemy(ctx, s, v.time);
  drawShots(ctx, s, v.time);

  // 放置预览
  if (v.hover && v.placingK !== null) {
    const ok = s.canPlace(v.hover.gx, v.hover.gy) && s.pearls >= 50;
    const cx = v.hover.gx * CELL + CELL / 2, cy = v.hover.gy * CELL + CELL / 2;
    ctx.fillStyle = ok ? 'rgba(94, 230, 168, 0.12)' : 'rgba(255, 110, 110, 0.15)';
    ctx.strokeStyle = ok ? 'rgba(94, 230, 168, 0.6)' : 'rgba(255, 110, 110, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, TOWER_LEVELS[0].range, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const color = FREQ_COLOR[v.placingK] ?? '#fff';
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, TAU);
    ctx.stroke();
    const k = v.placingK;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + v.time;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      ctx.lineTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
      ctx.stroke();
    }
  }
  if (v.hover && v.placingK === null && !v.selected) {
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.hover.gx * CELL + 1, v.hover.gy * CELL + 1, CELL - 2, CELL - 2);
  }

  // 粒子
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 浮字
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  for (const f of s.floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 频率图例角标（帮助记忆颜色↔瓣数）
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  {
    let x = 10;
    for (const f of [freqDef(1), freqDef(2), freqDef(3), freqDef(4)]) {
      ctx.fillStyle = FREQ_COLOR[f.k];
      ctx.beginPath();
      ctx.arc(x + 5, FIELD_H - 12, 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(200, 215, 245, 0.75)';
      ctx.fillText(f.name + ' · ' + f.k + '瓣', x + 13, FIELD_H - 8);
      x += 78;
    }
  }
}
