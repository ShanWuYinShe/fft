// 常量与定义：频率、塔、敌人、经济数值
export const TAU = Math.PI * 2;

/** 画布逻辑尺寸（战场区域） */
export const FIELD_W = 828;
export const FIELD_H = 460;
export const CELL = 46;
export const COLS = FIELD_W / CELL;   // 18
export const ROWS = FIELD_H / CELL;   // 10

/** 四种涌律（频率）。名称对玩家只呈现"缓/行/疾/骤" + 瓣数图标 */
export interface FreqDef { k: number; name: string; tone: number }
export const FREQS: FreqDef[] = [
  { k: 1, name: '缓涌', tone: 130.81 },  // C3
  { k: 2, name: '行涌', tone: 261.63 },  // C4
  { k: 3, name: '疾涌', tone: 392.00 },  // G4
  { k: 4, name: '骤涌', tone: 523.25 },  // C5
];
export const freqDef = (k: number): FreqDef => FREQS.find(f => f.k === k) ?? FREQS[0];

/** 每种频率的主题色（敌人花影与塔同色，玩家按颜色配对） */
export const FREQ_COLOR: Record<number, string> = {
  1: '#5ee6a8',
  2: '#5eb8ff',
  3: '#c79bff',
  4: '#ffb27d',
  5: '#ff8fa8',
  6: '#ffe27d',
};

/** 塔 */
export interface TowerLevel { damage: number; rate: number; range: number }
export const TOWER_COST = 50;
export const TOWER_UP_COST = [60, 100];
export const TOWER_LEVELS: TowerLevel[] = [
  { damage: 7, rate: 0.5, range: 126 },
  { damage: 11, rate: 0.5, range: 128 },
  { damage: 19, rate: 0.45, range: 140 },
];
export const SELL_RATIO = 0.7;

/** 敌人原型 */
export interface EnemyKind {
  key: string;
  name: string;
  ks: number[];          // 携带的涌律层（单频 1 层；精英多层）
  shape?: string;        // 形影灵：轮廓 key（SHAPES）或 'user'/'blob'，血层由轮廓 DFT 生成
  ampPerLayer: number;   // 每层振幅（=该层血量；形影灵为全部血层总血量）
  speed: number;         // px/s
  leak: number;          // 漏进静心湖扣的平静度
  bounty: number;        // 潮珠赏金
  shift?: [number, number]; // 变奏灵：在两个频率间切换
  boss?: boolean;
}

export const ENEMY_KINDS: Record<string, EnemyKind> = {
  ripple:  { key: 'ripple',  name: '涟灵',   ks: [1], ampPerLayer: 20, speed: 32, leak: 1, bounty: 6 },
  ripple2: { key: 'ripple2', name: '疾涟',   ks: [2], ampPerLayer: 20, speed: 40, leak: 1, bounty: 6 },
  ripple3: { key: 'ripple3', name: '骤涟',   ks: [3], ampPerLayer: 22, speed: 50, leak: 1, bounty: 6 },
  ripple4: { key: 'ripple4', name: '惊涟',   ks: [4], ampPerLayer: 20, speed: 58, leak: 1, bounty: 6 },
  twin:    { key: 'twin',    name: '双涌灵', ks: [1, 2], ampPerLayer: 30, speed: 32, leak: 2, bounty: 12 },
  treble:  { key: 'treble',  name: '叠涌灵', ks: [2, 3], ampPerLayer: 28, speed: 34, leak: 2, bounty: 12 },
  shifter: { key: 'shifter', name: '变奏灵', ks: [2], ampPerLayer: 40, speed: 40, leak: 2, bounty: 14, shift: [2, 4] },
  boss:    { key: 'boss',    name: '百澜',   ks: [1, 2, 3, 4], ampPerLayer: 90, speed: 20, leak: 4, bounty: 60, boss: true },
  // 形影灵：任意轮廓经 DFT 拆解为血层，削哪层形状就塌哪块
  shapeHeart: { key: 'shapeHeart', name: '心之形影', ks: [], shape: 'heart', ampPerLayer: 60, speed: 30, leak: 2, bounty: 16 },
  shapeStar:  { key: 'shapeStar',  name: '五芒形影', ks: [], shape: 'star5',  ampPerLayer: 64, speed: 30, leak: 2, bounty: 16 },
  shapeCrown: { key: 'shapeCrown', name: '王冠形影', ks: [], shape: 'crown',  ampPerLayer: 72, speed: 28, leak: 2, bounty: 18 },
  shapeBat:   { key: 'shapeBat',   name: '翼影',     ks: [], shape: 'bat',   ampPerLayer: 62, speed: 34, leak: 2, bounty: 16 },
  shapeGear:  { key: 'shapeGear',  name: '齿影',     ks: [], shape: 'gear',  ampPerLayer: 72, speed: 30, leak: 2, bounty: 18 },
  shapeBlob:  { key: 'shapeBlob',  name: '无名形影', ks: [], shape: 'blob',  ampPerLayer: 60, speed: 30, leak: 2, bounty: 15 },
  shapeUser:  { key: 'shapeUser',  name: '你的形影', ks: [], shape: 'user',  ampPerLayer: 76, speed: 28, leak: 2, bounty: 25 },
};

/** 击杀赏金结算 */
export const killBounty = (kind: EnemyKind): number => kind.bounty;

/** 提前召唤奖励：每提前 1 秒 +2 潮珠 */
export const EARLY_BONUS_PER_S = 2;
export const PREP_TIME = 14;

/** 平静度 */
export const START_LIVES = 10;
export const START_PEARLS = 140;
