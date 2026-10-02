// 章节、关卡、路径与波次表
import { ENEMY_KINDS, type EnemyKind } from './defs';

export interface Pt { x: number; y: number }

export interface SpawnGroup {
  kind: string;      // ENEMY_KINDS key
  count: number;
  gap: number;       // 秒
  delay?: number;    // 组内起始延迟（秒）
  ampScale?: number; // 本组血量倍率
}

export interface Wave {
  groups: SpawnGroup[];
  reward: number;    // 波次完成奖励
}

export interface LevelDef {
  chapter: number;
  name: string;
  intro: string;     // 新机制一句话提示
  path: Pt[];        // 战场像素坐标折线
  waves: Wave[];
  unlockedTowerKs: number[]; // 本关卡槽提供的频率（渐进解锁）
}

/** 格子坐标 → 像素中心 */
const c = (gx: number, gy: number): Pt => ({ x: gx * 46 + 23, y: gy * 46 + 23 });

/* ── 路径库 ── */
const PATH_S_CURVE: Pt[] = [c(-1, 2), c(4, 2), c(4, 7), c(9, 7), c(9, 2), c(14, 2), c(14, 7), c(18, 7)];
const PATH_ZIGZAG: Pt[] = [c(-1, 5), c(3, 5), c(3, 1), c(8, 1), c(8, 8), c(13, 8), c(13, 3), c(18, 3)];
const PATH_SPIRAL: Pt[] = [c(-1, 1), c(15, 1), c(15, 8), c(3, 8), c(3, 4), c(11, 4), c(11, 6), c(18, 6)];
const PATH_LONG: Pt[] = [c(-1, 8), c(1, 8), c(1, 1), c(5, 1), c(5, 8), c(9, 8), c(9, 1), c(13, 1), c(13, 8), c(17, 8), c(17, 4), c(18, 4)];
const PATH_BOSS: Pt[] = [c(-1, 5), c(2, 5), c(2, 2), c(7, 2), c(7, 8), c(12, 8), c(12, 2), c(16, 2), c(16, 5), c(18, 5)];

/** 波次生成辅助 */
const g = (kind: string, count: number, gap: number, delay = 0, ampScale = 1): SpawnGroup =>
  ({ kind, count, gap, delay, ampScale });
const W = (reward: number, ...groups: SpawnGroup[]): Wave => ({ groups, reward });

/* ── 第一章 · 静水湖：单频敌人，学会按瓣数配塔 ── */
const CH1: LevelDef[] = [
  {
    chapter: 1, name: '初澜', intro: '涌灵花瓣有几瓣，就要用同色的音叉塔迎击。',
    path: PATH_S_CURVE, unlockedTowerKs: [1, 2],
    waves: [
      W(30, g('ripple', 5, 1.5)),
      W(32, g('ripple', 7, 1.2)),
      W(34, g('ripple', 5, 1.0), g('ripple2', 5, 1.0, 4)),
      W(36, g('ripple', 6, 0.9), g('ripple2', 8, 0.9, 3)),
      W(40, g('ripple2', 8, 0.8), g('ripple', 8, 0.8, 3), g('ripple2', 6, 0.8, 8)),
    ],
  },
  {
    chapter: 1, name: '叠浪', intro: '潮珠会随击杀累积——及时升级音叉塔，或多建几座。',
    path: PATH_S_CURVE, unlockedTowerKs: [1, 2],
    waves: [
      W(32, g('ripple', 8, 0.8), g('ripple2', 8, 0.8, 3)),
      W(34, g('ripple', 10, 0.7, 0, 1.15), g('ripple2', 6, 0.9, 5)),
      W(36, g('ripple2', 12, 0.7, 0, 1.1)),
      W(38, g('ripple', 12, 0.65, 0, 1.2), g('ripple2', 10, 0.7, 4, 1.2)),
      W(44, g('ripple', 10, 0.6, 0, 1.3), g('ripple2', 12, 0.6, 3, 1.3)),
    ],
  },
];

/* ── 第二章 · 风啸峡：双涌精英，学习"分层剥平" ── */
const CH2: LevelDef[] = [
  {
    chapter: 2, name: '双涌', intro: '双涌灵身负两道瓣影——两种同色音叉塔各削各的层。',
    path: PATH_ZIGZAG, unlockedTowerKs: [1, 2, 3],
    waves: [
      W(34, g('twin', 2, 3.0), g('ripple3', 4, 1.0, 6)),
      W(36, g('ripple3', 6, 0.9), g('twin', 3, 2.6, 4)),
      W(38, g('twin', 4, 2.4), g('ripple', 6, 0.8, 2), g('ripple3', 6, 0.9, 6)),
      W(40, g('ripple3', 8, 0.8, 0, 1.15), g('twin', 5, 2.2, 3)),
      W(46, g('twin', 6, 2.0), g('ripple3', 10, 0.7, 2, 1.2), g('twin', 3, 2.2, 9)),
    ],
  },
  {
    chapter: 2, name: '峡湾', intro: '提前唤醒下一波，可按剩余准备时间获得潮珠。',
    path: PATH_SPIRAL, unlockedTowerKs: [1, 2, 3],
    waves: [
      W(36, g('ripple', 8, 0.7), g('ripple3', 8, 0.8, 3), g('twin', 3, 2.4, 7)),
      W(38, g('twin', 5, 2.2, 0, 1.15), g('ripple3', 8, 0.8, 4)),
      W(40, g('ripple', 12, 0.6, 0, 1.2), g('twin', 5, 2.2, 4, 1.2)),
      W(42, g('ripple3', 12, 0.65, 0, 1.25), g('twin', 6, 2.0, 3, 1.2)),
      W(50, g('twin', 8, 1.8), g('ripple3', 12, 0.6, 2, 1.3), g('twin', 4, 2.0, 10, 1.3)),
    ],
  },
];

/* ── 第三章 · 钟鸣谷：变奏灵与骤涌 ── */
const CH3: LevelDef[] = [
  {
    chapter: 3, name: '变奏', intro: '变奏灵行进中会改换瓣数——用两种音叉塔封住它的两面。',
    path: PATH_LONG, unlockedTowerKs: [1, 2, 3, 4],
    waves: [
      W(36, g('ripple4', 5, 1.1), g('shifter', 2, 3.0, 4)),
      W(38, g('shifter', 3, 2.6), g('ripple3', 6, 0.9, 3), g('ripple4', 6, 0.9, 6)),
      W(40, g('twin', 4, 2.2), g('shifter', 3, 2.6, 4), g('ripple4', 6, 0.9, 8)),
      W(42, g('ripple4', 10, 0.8, 0, 1.15), g('shifter', 4, 2.4, 3), g('treble', 3, 2.4, 7)),
      W(48, g('shifter', 5, 2.2), g('twin', 5, 2.0, 2, 1.2), g('ripple4', 12, 0.7, 5, 1.2)),
    ],
  },
  {
    chapter: 3, name: '谷底', intro: '叠涌灵的花影更繁复——沉住气，一层层剥平。',
    path: PATH_ZIGZAG, unlockedTowerKs: [1, 2, 3, 4],
    waves: [
      W(38, g('shapeHeart', 1, 1, 0), g('treble', 3, 2.4, 3), g('ripple4', 8, 0.8, 6)),
      W(40, g('shifter', 4, 2.4), g('treble', 3, 2.4, 4), g('ripple3', 8, 0.8, 8)),
      W(42, g('treble', 5, 2.2, 0, 1.15), g('ripple4', 10, 0.7, 3, 1.2)),
      W(44, g('shapeStar', 1, 1, 0), g('shifter', 4, 2.2, 3, 1.15), g('treble', 4, 2.0, 6, 1.2)),
      W(52, g('treble', 7, 1.8), g('shifter', 5, 2.2, 3, 1.25), g('ripple4', 12, 0.6, 6, 1.3)),
    ],
  },
];

/* ── 第四章 · 万流归海：终局 ── */
const CH4: LevelDef[] = [
  {
    chapter: 4, name: '万流', intro: '所有的涌灵都在提速——阵型与升级时机是关键。',
    path: PATH_SPIRAL, unlockedTowerKs: [1, 2, 3, 4],
    waves: [
      W(40, g('twin', 5, 2.0, 0, 1.25), g('ripple4', 10, 0.7, 3, 1.2)),
      W(42, g('treble', 5, 2.0, 0, 1.2), g('shifter', 4, 2.2, 4, 1.15)),
      W(44, g('ripple4', 14, 0.6, 0, 1.3), g('twin', 6, 1.9, 4, 1.3)),
      W(46, g('shapeCrown', 1, 1, 0), g('treble', 5, 1.9, 3, 1.25), g('shifter', 4, 2.0, 6, 1.2)),
      W(50, g('twin', 7, 1.7, 0, 1.35), g('treble', 6, 1.9, 3, 1.3), g('shifter', 5, 2.0, 8, 1.3)),
    ],
  },
  {
    chapter: 4, name: '百澜', intro: '终潮将至——百澜身负四道瓣影，剥尽方息。',
    path: PATH_BOSS, unlockedTowerKs: [1, 2, 3, 4],
    waves: [
      W(44, g('treble', 5, 2.0, 0, 1.25), g('shifter', 4, 2.2, 4)),
      W(46, g('ripple4', 14, 0.55, 0, 1.3), g('twin', 6, 1.8, 4, 1.3)),
      W(48, g('treble', 7, 1.8, 0, 1.3), g('shifter', 5, 2.0, 3, 1.3)),
      W(50, g('shapeBat', 1, 1, 0), g('shapeGear', 1, 1, 5), g('treble', 5, 1.9, 9, 1.3)),
      W(80, g('boss', 1, 1, 0, 1), g('shapeCrown', 1, 1, 6, 1.2), g('twin', 6, 2.2, 6, 1.3), g('ripple4', 12, 0.7, 12, 1.3), g('boss', 1, 1, 22, 1.1)),
    ],
  },
];

export const CHAPTERS: { name: string; levels: LevelDef[] }[] = [
  { name: '静水湖', levels: CH1 },
  { name: '风啸峡', levels: CH2 },
  { name: '钟鸣谷', levels: CH3 },
  { name: '万流归海', levels: CH4 },
];

export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap(c => c.levels);

/** 关卡敌人种类预览（用于 HUD 提示） */
export const kindOf = (key: string): EnemyKind => ENEMY_KINDS[key];

/* ── 无尽模式 ── */
export function endlessWave(n: number): Wave {
  const pool = ['ripple', 'ripple2', 'ripple3', 'ripple4'];
  const groups: SpawnGroup[] = [];
  const scale = Math.pow(1.09, n - 1);
  // 基础涌灵潮
  const base = pool[Math.min(Math.floor(n / 2), 3)];
  groups.push(g(base, 8 + Math.min(n * 2, 26), Math.max(0.45, 0.9 - n * 0.02), 0, scale));
  // 混入副频
  if (n >= 2) groups.push(g(pool[(n + 1) % 4], 6 + Math.min(n, 16), Math.max(0.5, 0.9 - n * 0.02), 2.5, scale));
  // 精英
  if (n >= 4) groups.push(g('twin', 2 + Math.floor(n / 3), 2.0, 3, scale));
  if (n >= 7) groups.push(g('shifter', 1 + Math.floor(n / 4), 2.2, 4, scale));
  if (n >= 9) groups.push(g('treble', 1 + Math.floor(n / 4), 2.2, 5, scale));
  if (n >= 6 && n % 3 === 0) {
    const shapes = ['shapeHeart', 'shapeStar', 'shapeBat', 'shapeGear', 'shapeBlob'];
    groups.push(g(shapes[Math.floor(n / 3) % shapes.length], 1, 1, 7, scale));
  }
  // 每 10 波一个百澜
  if (n % 10 === 0) groups.push(g('boss', Math.floor(n / 10), 4, 6, scale * 0.9));
  return { groups, reward: 30 + n * 4 };
}
