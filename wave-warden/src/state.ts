// 战斗模拟核心：波次状态机、敌人/塔/弹、经济与胜负
import {
  ENEMY_KINDS, FIELD_W, FIELD_H, PREP_TIME, SELL_RATIO, TOWER_COST, TOWER_LEVELS, TOWER_UP_COST, TAU,
  type EnemyKind,
} from './defs';
import type { LevelDef, Pt, Wave } from './levels';

export interface EnemyLayer { k: number; amp: number; maxAmp: number }
export interface Enemy {
  id: number;
  kind: EnemyKind;
  layers: EnemyLayer[];
  s: number;            // 沿路径行进距离
  x: number; y: number;
  shiftT: number;       // 变奏灵切换倒计时（非变奏灵为 Infinity）
  hitFlash: number;
  seed: number;         // 视觉随机相位
}
export interface Tower { id: number; k: number; level: number; x: number; y: number; cool: number; invested: number; shots: number; hits: number }
export interface Shot { x: number; y: number; targetId: number; k: number; dmg: number; phase: number; dead: boolean }
export interface FloatText { x: number; y: number; text: string; life: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }

export type SessionStatus = 'prep' | 'wave' | 'won' | 'lost';

interface SpawnItem { at: number; kind: EnemyKind; ampScale: number }

/** 折线累计长度与定位 */
export class PathRun {
  pts: Pt[];
  cum: number[] = [];
  total: number;
  constructor(pts: Pt[]) {
    this.pts = pts;
    let acc = 0;
    this.cum.push(0);
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      this.cum.push(acc);
    }
    this.total = acc;
  }
  posAt(s: number): Pt {
    const t = Math.max(0, Math.min(this.total, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < t) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const f = (t - this.cum[i - 1]) / seg;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
}

/** 路径占据的格子集合（不可建塔） */
export function blockedCells(pts: Pt[]): Set<number> {
  const set = new Set<number>();
  const CELL = 46;
  const mark = (x: number, y: number) => {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx >= 0 && gx < FIELD_W / CELL && gy >= 0 && gy < FIELD_H / CELL) set.add(gy * 1000 + gx);
  };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(len / 6);
    for (let j = 0; j <= steps; j++) mark(a.x + ((b.x - a.x) * j) / steps, a.y + ((b.y - a.y) * j) / steps);
  }
  return set;
}

export interface SessionOpts {
  level: LevelDef;
  waveProvider: (n: number) => Wave;
  totalWaves: number;             // Infinity 表示无尽
  lives: number;
  pearls: number;
  onEvent: (e: SessionEvent) => void;
}

export type SessionEvent =
  | { type: 'waveStart'; n: number }
  | { type: 'waveClear'; n: number; reward: number }
  | { type: 'win' }
  | { type: 'lose' }
  | { type: 'leak'; dmg: number }
  | { type: 'kill'; kind: EnemyKind }
  | { type: 'shot'; k: number }
  | { type: 'shift' }
  | { type: 'pearl'; amount: number };

export class Session {
  path: PathRun;
  blocked: Set<number>;
  level: LevelDef;
  waveProvider: (n: number) => Wave;
  totalWaves: number;
  onEvent: (e: SessionEvent) => void;

  lives: number;
  pearls: number;
  waveIdx = 0;             // 已完成的波数
  status: SessionStatus = 'prep';
  prepLeft = PREP_TIME;
  waveTime = 0;
  spawnQueue: SpawnItem[] = [];
  speed = 1;
  paused = false;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  shots: Shot[] = [];
  floats: FloatText[] = [];
  particles: Particle[] = [];
  shake = 0;

  killed = 0;
  leakedCount = 0;

  private nextId = 1;

  constructor(o: SessionOpts) {
    this.level = o.level;
    this.waveProvider = o.waveProvider;
    this.totalWaves = o.totalWaves;
    this.onEvent = o.onEvent;
    this.lives = o.lives;
    this.pearls = o.pearls;
    this.path = new PathRun(o.level.path);
    this.blocked = blockedCells(o.level.path);
  }

  get waveNumber(): number { return this.waveIdx + 1; }
  get isEndless(): boolean { return !isFinite(this.totalWaves); }

  /** 提前召唤的奖励潮珠 */
  startWave(): void {
    if (this.status !== 'prep') return;
    if (this.prepLeft > 0) {
      const bonus = Math.floor(this.prepLeft * 2);
      if (bonus > 0) {
        this.pearls += bonus;
        this.onEvent({ type: 'pearl', amount: bonus });
      }
    }
    this.spawnWave();
  }

  private spawnWave(): void {
    const wave = this.waveProvider(this.waveNumber);
    this.spawnQueue = [];
    for (const gr of wave.groups) {
      const kind = ENEMY_KINDS[gr.kind];
      for (let i = 0; i < gr.count; i++) {
        this.spawnQueue.push({ at: (gr.delay ?? 0) + i * gr.gap, kind, ampScale: gr.ampScale ?? 1 });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.waveTime = 0;
    this.status = 'wave';
    this.onEvent({ type: 'waveStart', n: this.waveNumber });
  }

  update(dtRaw: number): void {
    if (this.paused || this.status === 'won' || this.status === 'lost') return;
    const dt = Math.min(dtRaw, 0.05) * this.speed;
    this.shake = Math.max(0, this.shake - dt * 3);

    if (this.status === 'prep') {
      this.prepLeft -= dt;
      if (this.prepLeft <= 0) this.spawnWave();
    }

    if (this.status === 'wave') {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) {
        const item = this.spawnQueue.shift()!;
        this.spawnEnemy(item.kind, item.ampScale);
      }
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateShots(dt);
    this.updateFx(dt);

    if (this.status === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      const wave = this.waveProvider(this.waveNumber);
      this.pearls += wave.reward;
      this.waveIdx++;
      this.onEvent({ type: 'waveClear', n: this.waveNumber - 1, reward: wave.reward });
      if (this.waveIdx >= this.totalWaves) {
        this.status = 'won';
        this.onEvent({ type: 'win' });
      } else {
        this.status = 'prep';
        this.prepLeft = PREP_TIME;
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, ampScale: number): void {
    const layers: EnemyLayer[] = kind.ks.map(k => ({ k, amp: kind.ampPerLayer * ampScale, maxAmp: kind.ampPerLayer * ampScale }));
    const p = this.path.posAt(0);
    this.enemies.push({
      id: this.nextId++,
      kind,
      layers,
      s: 0,
      x: p.x, y: p.y,
      shiftT: kind.shift ? 3 : Infinity,
      hitFlash: 0,
      seed: Math.random() * TAU,
    });
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.s += e.kind.speed * dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
      if (e.kind.shift) {
        e.shiftT -= dt;
        if (e.shiftT <= 0) {
          const cur = e.layers[0].k;
          const [a, b] = e.kind.shift;
          e.layers[0].k = cur === a ? b : a;
          e.shiftT = 3;
          this.onEvent({ type: 'shift' });
        }
      }
      const p = this.path.posAt(e.s);
      e.x = p.x; e.y = p.y;
      if (e.s >= this.path.total) {
        this.lives -= e.kind.leak;
        this.leakedCount++;
        this.shake = 1;
        this.onEvent({ type: 'leak', dmg: e.kind.leak });
        this.enemies.splice(i, 1);
        if (this.lives <= 0) {
          this.lives = 0;
          this.status = 'lost';
          this.onEvent({ type: 'lose' });
          return;
        }
      }
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.cool -= dt;
      if (t.cool > 0) continue;
      const lv = TOWER_LEVELS[t.level - 1];
      let best: Enemy | null = null;
      for (const e of this.enemies) {
        if (!e.layers.some(l => l.k === t.k && l.amp > 0)) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= lv.range && (!best || e.s > best.s)) best = e;
      }
      if (best) {
        t.cool = lv.rate;
        t.shots++;
        this.onEvent({ type: 'shot', k: t.k });
        this.shots.push({ x: t.x, y: t.y, targetId: best.id, k: t.k, dmg: lv.damage, phase: Math.random() * TAU, dead: false });
      }
    }
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      const target = this.enemies.find(e => e.id === sh.targetId);
      if (!target) { this.shots.splice(i, 1); continue; }
      const dx = target.x - sh.x, dy = target.y - sh.y;
      const d = Math.hypot(dx, dy);
      const step = 300 * dt;
      if (d <= step + 8) {
        const tw = this.towers.find(x => x.k === sh.k);
        if (tw) tw.hits++;
        this.hitEnemy(target, sh.k, sh.dmg);
        this.shots.splice(i, 1);
      } else {
        sh.x += (dx / d) * step;
        sh.y += (dy / d) * step;
        sh.phase += dt * 10;
      }
    }
  }

  private hitEnemy(e: Enemy, k: number, dmg: number): void {
    const layer = e.layers.find(l => l.k === k && l.amp > 0);
    if (!layer) return;
    layer.amp = Math.max(0, layer.amp - dmg);
    e.hitFlash = 1;
    if (e.layers.every(l => l.amp <= 0)) {
      this.pearls += e.kind.bounty;
      this.killed++;
      this.floats.push({ x: e.x, y: e.y - 16, text: '+' + e.kind.bounty, life: 1, color: '#ffe9b0' });
      for (let j = 0; j < 14; j++) {
        const a = Math.random() * TAU, v = 20 + Math.random() * 70;
        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, color: '#bfe9ff', r: 1.5 + Math.random() * 2 });
      }
      this.enemies.splice(this.enemies.indexOf(e), 1);
      this.onEvent({ type: 'kill', kind: e.kind });
    } else {
      this.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.4, max: 0.4, color: '#dff4ff', r: 1.5 });
    }
  }

  private updateFx(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 26;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  /* ── 建造 ── */
  canPlace(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= FIELD_W / 46 || gy >= FIELD_H / 46) return false;
    if (this.blocked.has(gy * 1000 + gx)) return false;
    return !this.towers.some(t => Math.floor(t.x / 46) === gx && Math.floor(t.y / 46) === gy);
  }

  placeTower(k: number, gx: number, gy: number): Tower | null {
    if (this.pearls < TOWER_COST || !this.canPlace(gx, gy)) return null;
    this.pearls -= TOWER_COST;
    const t: Tower = { id: this.nextId++, k, level: 1, x: gx * 46 + 23, y: gy * 46 + 23, cool: 0, invested: TOWER_COST, shots: 0, hits: 0 };
    this.towers.push(t);
    return t;
  }

  towerAt(gx: number, gy: number): Tower | null {
    return this.towers.find(t => Math.floor(t.x / 46) === gx && Math.floor(t.y / 46) === gy) ?? null;
  }

  upgradeCost(t: Tower): number | null {
    return t.level < TOWER_LEVELS.length ? TOWER_UP_COST[t.level - 1] : null;
  }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (cost === null || this.pearls < cost) return false;
    this.pearls -= cost;
    t.invested += cost;
    t.level++;
    return true;
  }

  debug(): unknown {
    return {
      status: this.status,
      waveIdx: this.waveIdx,
      waveTime: Math.round(this.waveTime * 10) / 10,
      lives: this.lives,
      pearls: this.pearls,
      enemies: this.enemies.map(e => ({ s: Math.round(e.s), x: Math.round(e.x), y: Math.round(e.y), k: e.layers.map(l => l.k), amp: e.layers.map(l => Math.round(l.amp)), speed: e.kind.speed })),
      towers: this.towers.map(t => ({ k: t.k, lv: t.level, x: Math.round(t.x), y: Math.round(t.y), shots: t.shots, hits: t.hits })),
      queue: this.spawnQueue.length,
    };
  }

  sell(t: Tower): void {
    const back = Math.floor(t.invested * SELL_RATIO);
    this.pearls += back;
    this.towers.splice(this.towers.indexOf(t), 1);
    this.floats.push({ x: t.x, y: t.y - 14, text: '+' + back, life: 1, color: '#ffe9b0' });
  }
}
