// DOM UI：屏幕切换、守护图、HUD、卡槽、塔面板、覆盖层
import { ALL_LEVELS, CHAPTERS } from './levels';
import { FREQ_COLOR, TOWER_COST, TOWER_LEVELS, TOWER_UP_COST, freqDef } from './defs';
import type { Session, Tower } from './state';

const $ = (id: string) => document.getElementById(id)!;

export interface Progress {
  unlocked: number;                 // 已解锁到的关卡索引（0 基）
  stars: Record<number, number>;    // 各关卡星级
  endlessBest: number;              // 无尽最佳波数
}

export const loadProgress = (): Progress => {
  try {
    const raw = localStorage.getItem('wave-warden-progress');
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      p.unlocked ??= 0;
      p.stars ??= {};
      p.endlessBest ??= 0;
      return p;
    }
  } catch { /* 重置 */ }
  return { unlocked: 0, stars: {}, endlessBest: 0 };
};
export const saveProgress = (p: Progress): void => {
  try { localStorage.setItem('wave-warden-progress', JSON.stringify(p)); } catch { /* 忽略 */ }
};

export function showScreen(id: string): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  $(id).classList.add('show');
}

/* ── 守护图 ── */
export function buildMap(progress: Progress, onPlay: (idx: number) => void, onEndless: () => void): void {
  const box = $('mapChapters');
  box.innerHTML = '';
  let idx = 0;
  CHAPTERS.forEach((ch, ci) => {
    const chap = document.createElement('div');
    chap.className = 'chapter';
    chap.innerHTML = '<div class="chapter-name">' + '一二三四'[ci] + ' · ' + ch.name + '</div>';
    const row = document.createElement('div');
    row.className = 'level-row';
    ch.levels.forEach(lv => {
      const myIdx = idx++;   // 逐节点捕获，避免闭包共享计数器
      const node = document.createElement('button');
      const canPlay = myIdx <= progress.unlocked;
      node.className = 'lv-node' + (canPlay ? '' : ' locked') + (myIdx === progress.unlocked ? ' next' : '');
      const stars = progress.stars[myIdx] ?? 0;
      node.innerHTML = '<span class="lv-name">' + lv.name + '</span>' +
        '<span class="lv-stars">' + (canPlay ? '★'.repeat(stars) + '<span class="off">' + '★'.repeat(3 - stars) + '</span>' : '🔒') + '</span>';
      if (canPlay) node.addEventListener('click', () => onPlay(myIdx));
      row.appendChild(node);
    });
    chap.appendChild(row);
    box.appendChild(chap);
  });
  // 无尽入口
  const endlessLocked = progress.unlocked < 8;
  const endless = document.createElement('div');
  endless.className = 'endless-row';
  endless.innerHTML = '<button class="big-btn' + (endlessLocked ? ' ghost' : '') + '" id="btnEndlessMap">' +
    (endlessLocked ? '无尽冲分 · 通关八幅后开启' : '无尽冲分 · 最佳 ' + progress.endlessBest + ' 涌') + '</button>';
  box.appendChild(endless);
  if (!endlessLocked) endless.querySelector('button')!.addEventListener('click', onEndless);
}

/* ── HUD ── */
let hudCache = { lives: -1, pearls: -1, wave: -1, total: -1, prep: -1 };

export function syncHUD(s: Session): void {
  if (s.lives !== hudCache.lives) {
    hudCache.lives = s.lives;
    $('hudLives').textContent = String(s.lives);
    $('hudLives').classList.toggle('danger', s.lives <= 3);
  }
  if (s.pearls !== hudCache.pearls) {
    hudCache.pearls = s.pearls;
    $('hudPearls').textContent = String(s.pearls);
  }
  if (s.waveNumber !== hudCache.wave) {
    hudCache.wave = s.waveNumber;
    $('hudWave').textContent = String(s.waveNumber);
  }
  const total = s.isEndless ? Infinity : s.totalWaves;
  const totalText = s.isEndless ? '∞' : String(s.totalWaves);
  if (s.totalWaves !== hudCache.total) {
    hudCache.total = s.totalWaves;
    $('hudWaveTotal').textContent = totalText;
  }
  void total;
  const call = $('btnCall');
  if (s.status === 'prep') {
    call.classList.remove('hidden');
    const secs = Math.ceil(s.prepLeft);
    $('callBonus').textContent = secs > 0 ? '+' + Math.floor(s.prepLeft * 2) : '';
    call.textContent = '';
    call.append('唤醒下一涌 ' + secs + 's ');
    const span = document.createElement('span');
    span.id = 'callBonus';
    span.textContent = $('callBonus').textContent;
    call.appendChild(span);
  } else {
    call.classList.add('hidden');
  }
}

export function resetHudCache(): void {
  hudCache = { lives: -1, pearls: -1, wave: -1, total: -1, prep: -1 };
}

/* ── 塔卡槽 ── */
export function buildCards(unlockedKs: number[], selectedK: number | null, pearls: number, onSelect: (k: number | null) => void): void {
  const bar = $('cardBar');
  bar.innerHTML = '';
  unlockedKs.forEach((k, i) => {
    const def = freqDef(k);
    const card = document.createElement('button');
    card.className = 'tcard' + (selectedK === k ? ' sel' : '') + (pearls < TOWER_COST ? ' poor' : '');
    card.innerHTML =
      '<canvas class="ticon" width="44" height="44" data-k="' + k + '"></canvas>' +
      '<span class="tname">' + def.name + '</span>' +
      '<span class="tcost">◍ ' + TOWER_COST + '</span>' +
      '<span class="tkey">' + (i + 1) + '</span>';
    card.title = def.name + '：迎击 ' + k + ' 瓣涌灵（快捷键 ' + (i + 1) + '）';
    card.addEventListener('click', () => onSelect(selectedK === k ? null : k));
    bar.appendChild(card);
    drawIcon(card.querySelector('canvas') as HTMLCanvasElement, k);
  });
}

function drawIcon(c: HTMLCanvasElement, k: number): void {
  const g = c.getContext('2d')!;
  const color = FREQ_COLOR[k];
  g.strokeStyle = color;
  g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    const r = 13 + 4.5 * Math.sin(k * th);
    const x = 22 + Math.cos(th) * r, y = 22 + Math.sin(th) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
  g.fillStyle = 'rgba(200,225,255,.8)';
  g.beginPath();
  g.arc(22, 22, 3, 0, Math.PI * 2);
  g.fill();
}

export function refreshCardAfford(pearls: number): void {
  document.querySelectorAll('.tcard').forEach(el => el.classList.toggle('poor', pearls < TOWER_COST));
}

/* ── 塔面板 ── */
export function showTowerPanel(t: Tower, s: Session, onUpgrade: () => void, onSell: () => void, onClose: () => void): void {
  const panel = $('towerPanel');
  panel.classList.remove('hidden');
  const def = freqDef(t.k);
  $('tpName').textContent = def.name + '音叉 · ' + '一二三'[t.level - 1] + '阶（伤 ' + TOWER_LEVELS[t.level - 1].damage + '）';
  const up = $('btnUpgrade') as HTMLButtonElement;
  const cost = t.level < TOWER_LEVELS.length ? TOWER_UP_COST[t.level - 1] : null;
  if (cost === null) {
    up.textContent = '已至满阶';
    up.disabled = true;
  } else {
    up.textContent = '升阶 ◍' + cost;
    up.disabled = s.pearls < cost;
  }
  up.onclick = onUpgrade;
  $('btnSell').textContent = '拆除 +' + Math.floor(t.invested * 0.7);
  $('btnSell').onclick = onSell;
  $('btnClosePanel').onclick = onClose;
}

export function hideTowerPanel(): void {
  $('towerPanel').classList.add('hidden');
}

/* ── 覆盖层 ── */
export function showIntro(opts: { name: string; text: string; waves: string }, onStart: () => void): void {
  $('introName').textContent = opts.name;
  $('introText').textContent = opts.text;
  $('introWaves').textContent = opts.waves;
  $('ovIntro').classList.add('show');
  $('btnStartWave').onclick = () => {
    $('ovIntro').classList.remove('show');
    onStart();
  };
}

export function hideIntro(): void {
  $('ovIntro').classList.remove('show');
}

export function showWin(levelIdx: number, stars: number, onNext: () => void, onMap: () => void): void {
  const lv = ALL_LEVELS[levelIdx];
  $('winName').textContent = lv.name + ' · 澜平水静';
  $('winStars').innerHTML = '★'.repeat(stars) + '<span class="off">' + '★'.repeat(3 - stars) + '</span>';
  $('winText').textContent = stars === 3 ? '静水无痕，perfect 守护。' : stars === 2 ? '湖面微澜，守护尚稳。' : '险险守住，再布精些。';
  $('ovWin').classList.add('show');
  $('btnWinNext').onclick = onNext;
  $('btnWinMap').onclick = onMap;
}

export function showLose(wave: number, onRetry: () => void, onMap: () => void): void {
  $('loseText').textContent = '第 ' + wave + ' 涌时乱流涌入静心湖。看清瓣数，再试一次。';
  $('ovLose').classList.add('show');
  $('btnLoseRetry').onclick = onRetry;
  $('btnLoseMap').onclick = onMap;
}

export function showEndlessOver(waves: number, best: number, isRecord: boolean, onRetry: () => void, onTitle: () => void): void {
  $('endlessText').innerHTML = '本次守到 <b>' + (waves - 1) + '</b> 涌' +
    (isRecord ? '——新的最佳！' : ' · 历史最佳 ' + best + ' 涌');
  $('ovEndless').classList.add('show');
  $('btnEndRetry').onclick = onRetry;
  $('btnEndMap').onclick = onTitle;
}

export function hideOverlay(id: string): void {
  $(id).classList.remove('show');
}
