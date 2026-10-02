// 装配：屏幕流转、输入、主循环
import './style.css';
import { CELL, FIELD_H, FIELD_W, START_LIVES, TOWER_COST } from './defs';
import { ALL_LEVELS, endlessWave, type Wave } from './levels';
import { tableFromPoints } from './shapes';
import { Session, type Tower } from './state';
import { renderFrame } from './render';
import * as UI from './ui';
import * as sfx from './audio';

const $ = (id: string) => document.getElementById(id)!;
const cv = $('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

let progress = UI.loadProgress();
let session: Session | null = null;
let mode: { type: 'level'; idx: number } | { type: 'endless' } | { type: 'draw' } | null = null;
let userShapeTable: Float64Array | null = null;
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
  const isDraw = mode!.type === 'draw';
  const level = (isEndless || isDraw) ? endlessLevel() : ALL_LEVELS[lvlIdx];
  const drawProvider = (n: number) => {
    // 画影秘境：第一涌是你的形影本体，随后两涌是它碎裂出的杂流
    if (n === 1) return { groups: [{ kind: 'shapeUser', count: 1, gap: 1, delay: 0 }], reward: 60 };
    if (n === 2) return { groups: [{ kind: 'ripple', count: 10, gap: 0.8 }, { kind: 'ripple2', count: 8, gap: 0.9, delay: 3 }], reward: 50 };
    return { groups: [{ kind: 'ripple2', count: 10, gap: 0.7 }, { kind: 'twin', count: 3, gap: 2.2, delay: 3 }], reward: 60 };
  };
  unlockedKs = level.unlockedTowerKs;
  session = new Session({
    level,
    waveProvider: isDraw ? drawProvider : isEndless ? endlessWave : n => level.waves[n - 1],
    totalWaves: isDraw ? 3 : isEndless ? Infinity : level.waves.length,
    lives: START_LIVES,
    pearls: isEndless ? 170 : 150,
    onEvent: () => {},
    userShape: userShapeTable ?? undefined,
  });
  wireEvents(session);
  placingK = null;
  selectedTower = null;
  UI.showScreen('scrBattle');
  UI.resetHudCache();
  UI.buildCards(unlockedKs, null, session.pearls, onCardSelect);
  UI.hideTowerPanel();
  fitBattle();
  if (isDraw) {
    UI.showIntro(
      { name: '画影秘境 · 你的形影', text: '这就是你画出的涌灵。它已被拆成几缕涌律——看它头顶的彩色血条，用对应瓣数的音叉塔逐层削平它。', waves: '共 3 涌 · 守住即成' },
      () => { /* 关闭引子进入准备期 */ },
    );
  } else if (isEndless) {
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
  if (mode!.type === 'draw') {
    UI.showWin(-1, 3,
      () => { UI.hideOverlay('ovWin'); openMap(); },
      () => { UI.hideOverlay('ovWin'); openMap(); },
      '画影秘境 · 归于平静');
  } else if (mode!.type === 'level') {
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
  } else if (mode!.type === 'draw') {
    UI.showLose(session!.waveNumber,
      () => { UI.hideOverlay('ovLose'); startBattle(); },
      () => { UI.hideOverlay('ovLose'); openMap(); });
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

/* ── 画影秘境 ── */
let drawPoints: [number, number][] = [];
let drawing = false;

function openDrawRealm(): void {
  UI.showScreen('scrMap');
  drawPoints = [];
  const pad = $('drawPad') as HTMLCanvasElement;
  const g = pad.getContext('2d')!;
  g.clearRect(0, 0, 320, 320);
  $('btnDrawFight').setAttribute('disabled', '');
  $('drawTip').textContent = '一笔画完闭合图形，松开即成。';
  $('ovDraw').classList.add('show');
}

function drawStroke(): void {
  const pad = $('drawPad') as HTMLCanvasElement;
  const g = pad.getContext('2d')!;
  g.clearRect(0, 0, 320, 320);
  if (drawPoints.length < 2) return;
  g.strokeStyle = '#8be9ff';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  drawPoints.forEach((p, i) => {
    if (i === 0) g.moveTo(p[0], p[1]);
    else g.lineTo(p[0], p[1]);
  });
  g.stroke();
}

function padPoint(e: PointerEvent): [number, number] {
  const r = ($('drawPad') as HTMLCanvasElement).getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 320, ((e.clientY - r.top) / r.height) * 320];
}

function initDrawRealm(): void {
  $('btnDrawRealm').addEventListener('click', () => { sfx.click(); openDrawRealm(); });
  $('btnDrawClose').addEventListener('click', () => $('ovDraw').classList.remove('show'));
  $('btnDrawClear').addEventListener('click', () => openDrawRealm());
  const pad = $('drawPad') as HTMLCanvasElement;
  pad.addEventListener('pointerdown', e => {
    drawing = true;
    drawPoints = [padPoint(e)];
    pad.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = padPoint(e);
    const last = drawPoints[drawPoints.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) {
      drawPoints.push(p);
      drawStroke();
    }
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    drawStroke();
    const table = tableFromPoints(drawPoints);
    if (table) {
      userShapeTable = table;
      $('btnDrawFight').removeAttribute('disabled');
      $('drawTip').textContent = '成形了！点「化为涌灵」迎战它。';
    } else {
      $('drawTip').textContent = '这缕影没有闭合——要一笔画回起点哦。';
    }
  };
  pad.addEventListener('pointerup', finish);
  pad.addEventListener('pointercancel', finish);
  $('btnDrawFight').addEventListener('click', () => {
    if (!userShapeTable) return;
    $('ovDraw').classList.remove('show');
    mode = { type: 'draw' };
    startBattle();
  });
}

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
initDrawRealm();
UI.showScreen('scrTitle');
syncEndlessLock();
fitBattle();
requestAnimationFrame(frame);
