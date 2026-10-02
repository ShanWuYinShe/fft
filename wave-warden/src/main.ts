// 装配：屏幕流转、输入、主循环
import './style.css';
import { CELL, FIELD_H, FIELD_W, START_LIVES, TOWER_COST } from './defs';
import { ALL_LEVELS, endlessWave, type Wave } from './levels';
import { Session, type Tower } from './state';
import { renderFrame } from './render';
import * as UI from './ui';
import * as sfx from './audio';

const $ = (id: string) => document.getElementById(id)!;
const cv = $('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

let progress = UI.loadProgress();
let session: Session | null = null;
let mode: { type: 'level'; idx: number } | { type: 'endless' } | null = null;
let placingK: number | null = null;
let selectedTower: Tower | null = null;
let hover: { gx: number; gy: number } | null = null;
let unlockedKs: number[] = [1, 2];
let time = 0;

/* ── 屏幕流转 ── */
function openMap(): void {
  session = null;
  UI.showScreen('scrMap');
  UI.buildMap(progress, playLevel, playEndless);
}

function playLevel(idx: number): void {
  mode = { type: 'level', idx };
  startBattle();
}

function playEndless(): void {
  mode = { type: 'endless' };
  startBattle();
}

function endlessLevel() {
  // 无尽用第一章蜿蜒路径，波次由 endlessWave 生成；四种音叉塔全部开放
  const base = ALL_LEVELS[0];
  return { ...base, name: '无尽乱流', waves: [] as Wave[], unlockedTowerKs: [1, 2, 3, 4] };
}

function startBattle(): void {
  const isEndless = mode!.type === 'endless';
  const lvlIdx = mode!.type === 'level' ? mode!.idx : 0;
  const level = isEndless ? endlessLevel() : ALL_LEVELS[lvlIdx];
  unlockedKs = level.unlockedTowerKs;
  session = new Session({
    level,
    waveProvider: isEndless ? endlessWave : n => level.waves[n - 1],
    totalWaves: isEndless ? Infinity : level.waves.length,
    lives: START_LIVES,
    pearls: isEndless ? 170 : 140,
    onEvent: () => {},
  });
  wireEvents(session);
  placingK = null;
  selectedTower = null;
  UI.showScreen('scrBattle');
  UI.resetHudCache();
  UI.buildCards(unlockedKs, null, session.pearls, onCardSelect);
  UI.hideTowerPanel();
  fitBattle();
  if (isEndless) {
    UI.showIntro(
      { name: '无尽乱流', text: '乱流一波强过一波，守到守不住为止。瓣数会越来越多、越来越快。', waves: '最佳纪录 · ' + progress.endlessBest + ' 涌' },
      () => { /* 引子关闭即开始准备期 */ },
    );
  } else {
    const lv = ALL_LEVELS[lvlIdx];
    const chap = ['静水湖', '风啸峡', '钟鸣谷', '万流归海'][lv.chapter - 1];
    UI.showIntro(
      { name: chap + ' · ' + lv.name, text: lv.intro, waves: '共 ' + lv.waves.length + ' 涌 · 初始平静 ' + START_LIVES },
      () => { /* 关闭引子，进入准备期 */ },
    );
  }
}

function onCardSelect(k: number | null): void {
  placingK = k;
  selectedTower = null;
  UI.hideTowerPanel();
  UI.buildCards(unlockedKs, k, session?.pearls ?? 0, onCardSelect);
  if (k !== null) sfx.click();
}

/* ── 会话事件 → 音效与状态 ── */
function wireEvents(s: Session): void {
  s.onEvent = ev => {
    switch (ev.type) {
      case 'waveStart': sfx.waveDrum(); break;
      case 'kill': sfx.killChord(ev.kind.ks); break;
      case 'shot': sfx.tickFor(ev.k); break;
      case 'shift': sfx.shiftTrill(); break;
      case 'leak': sfx.leakThud(); break;
      case 'pearl': break;
      case 'waveClear': break;
      case 'win': onWin(); break;
      case 'lose': onLose(); break;
    }
  };
}

function starsFor(lives: number): number {
  return lives >= 9 ? 3 : lives >= 6 ? 2 : 1;
}

function onWin(): void {
  sfx.winFanfare();
  if (mode!.type === 'level') {
    const idx = mode!.idx;
    const stars = starsFor(session!.lives);
    progress.unlocked = Math.max(progress.unlocked, idx + 1);
    progress.stars[idx] = Math.max(progress.stars[idx] ?? 0, stars);
    UI.saveProgress(progress);
    const hasNext = idx + 1 < ALL_LEVELS.length;
    UI.showWin(idx, stars,
      () => { UI.hideOverlay('ovWin'); if (hasNext) playLevel(idx + 1); else openMap(); },
      () => { UI.hideOverlay('ovWin'); openMap(); });
  }
}

function onLose(): void {
  sfx.loseMoan();
  if (mode!.type === 'endless') {
    const cleared = session!.waveIdx;
    const isRecord = cleared > progress.endlessBest;
    if (isRecord) {
      progress.endlessBest = cleared;
      UI.saveProgress(progress);
    }
    UI.showEndlessOver(cleared + 1, progress.endlessBest, isRecord,
      () => { UI.hideOverlay('ovEndless'); playEndless(); },
      () => { UI.hideOverlay('ovEndless'); UI.showScreen('scrTitle'); });
  } else {
    UI.showLose(session!.waveNumber,
      () => { UI.hideOverlay('ovLose'); startBattle(); },
      () => { UI.hideOverlay('ovLose'); openMap(); });
  }
}

/* ── 输入 ── */
function canvasCell(e: PointerEvent): { gx: number; gy: number } | null {
  const r = cv.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * FIELD_W;
  const y = ((e.clientY - r.top) / r.height) * FIELD_H;
  if (x < 0 || y < 0 || x >= FIELD_W || y >= FIELD_H) return null;
  return { gx: Math.floor(x / CELL), gy: Math.floor(y / CELL) };
}

cv.addEventListener('pointermove', e => {
  hover = canvasCell(e);
});

cv.addEventListener('pointerdown', e => {
  if (!session || session.status === 'won' || session.status === 'lost') return;
  const cell = canvasCell(e);
  if (!cell) return;
  if (placingK !== null) {
    if (session.pearls < TOWER_COST) { placingK = null; UI.buildCards(unlockedKs, null, session.pearls, onCardSelect); return; }
    const t = session.placeTower(placingK, cell.gx, cell.gy);
    if (t) {
      sfx.buildSound();
      if (session.pearls < TOWER_COST) {
        placingK = null;
        UI.buildCards(unlockedKs, null, session.pearls, onCardSelect);
      }
    }
    return;
  }
  const t = session.towerAt(cell.gx, cell.gy);
  if (t) {
    selectedTower = t;
    UI.showTowerPanel(t, session,
      () => { if (session!.upgrade(t)) { sfx.buildSound(); UI.showTowerPanel(t, session!, () => {}, () => {}, () => {}); } },
      () => { session!.sell(t); selectedTower = null; UI.hideTowerPanel(); },
      () => { selectedTower = null; UI.hideTowerPanel(); });
  } else {
    selectedTower = null;
    UI.hideTowerPanel();
  }
});

cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  placingK = null;
  selectedTower = null;
  UI.hideTowerPanel();
  UI.buildCards(unlockedKs, null, session?.pearls ?? 0, onCardSelect);
});

window.addEventListener('keydown', e => {
  if (!session) return;
  if (e.code === 'Escape') {
    placingK = null;
    selectedTower = null;
    UI.hideTowerPanel();
    UI.buildCards(unlockedKs, null, session.pearls, onCardSelect);
  } else if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  } else if (e.code === 'KeyN') {
    session.startWave();
  } else if (e.code === 'KeyF') {
    toggleSpeed();
  } else if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= unlockedKs.length) onCardSelect(placingK === unlockedKs[n - 1] ? null : unlockedKs[n - 1]);
  }
});

/* ── HUD 按钮 ── */
$('btnCall').addEventListener('click', () => session?.startWave());
$('btnSpeed').addEventListener('click', toggleSpeed);
$('btnPause').addEventListener('click', togglePause);

function toggleSpeed(): void {
  if (!session) return;
  session.speed = session.speed === 1 ? 2 : 1;
  $('btnSpeed').textContent = '×' + session.speed;
}

function togglePause(): void {
  if (!session) return;
  session.paused = !session.paused;
  $('btnPause').textContent = session.paused ? '继续' : '暂停';
}

/* ── 缩放适配 ── */
function fitBattle(): void {
  const wrap = $('battleWrap') as HTMLElement;
  const w = window.innerWidth - 20;
  const h = window.innerHeight - 20;
  const scale = Math.min(1, w / 828, h / 598);
  wrap.style.transform = 'scale(' + scale + ')';
}

window.addEventListener('resize', fitBattle);

/* ── 标题/地图按钮 ── */
$('btnPlay').addEventListener('click', () => { sfx.click(); syncEndlessLock(); openMap(); });
$('btnEndlessTitle').addEventListener('click', () => {
  if (progress.unlocked < 8) return;
  sfx.click();
  playEndless();
});
$('btnMapBack').addEventListener('click', () => { syncEndlessLock(); UI.showScreen('scrTitle'); });

function syncEndlessLock(): void {
  const locked = progress.unlocked < 8;
  $('btnEndlessTitle').classList.toggle('ghost', locked);
  $('endlessLockTip').textContent = locked ? '通关八幅后开启无尽冲分（已通关 ' + Math.min(progress.unlocked, 8) + ' 幅）' : '最佳纪录 · ' + progress.endlessBest + ' 涌';
}


/* ── 主循环 ── */
let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!session) return;
  time = now / 1000;
  session.update(dt);
  renderFrame(ctx, session, { time, hover, placingK, selected: selectedTower });
  const cur = session;
  (window as unknown as { __dbgSession: () => unknown }).__dbgSession = () => cur.debug();
  UI.syncHUD(session);
  UI.refreshCardAfford(session.pearls);
}

/* 启动 */
(window as unknown as { __dbg: () => unknown }).__dbg = () => ({
  levels: ALL_LEVELS.length,
  first: ALL_LEVELS[0] ? ALL_LEVELS[0].name : null,
  mode: mode,
});
UI.showScreen('scrTitle');
syncEndlessLock();
fitBattle();
requestAnimationFrame(frame);
