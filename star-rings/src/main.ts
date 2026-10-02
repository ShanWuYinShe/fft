// 入口：装配、主循环、评分调度、工具按钮与快捷键
import './style.css';
import {
  LEVELS, TAU, computeScore, freshSave, getSave, saveProgress, store,
} from './game';
import { renderFrame, setRenderLevel } from './render';
import {
  buildRingCards, initUI, logResDefault, openAtlas, placeCoreDot,
  showWin, updateDots, updateResLeft,
} from './ui';
import { playTick } from './audio';

const $ = (id: string) => document.getElementById(id)!;
const cv = $('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

let W = 0, H = 0, DPR = 1;
function resize(): void {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const rect = $('cv-box').getBoundingClientRect();
  W = Math.max(200, rect.width);
  H = Math.max(200, rect.height);
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
}

let tAnim = 0;
let drawnT = 0;
let passed = false;

/* ── 评分：输入后 120ms 防抖即时计算 ── */
let scoreTimer: number | undefined;
function scheduleScore(): void {
  if (scoreTimer !== undefined) window.clearTimeout(scoreTimer);
  scoreTimer = window.setTimeout(() => {
    scoreTimer = undefined;
    const sv = getSave(store.lv);
    const s = computeScore(store.lv, sv);
    $('scoreNow').textContent = String(s);
    const p = store.progress;
    if (!passed && s >= 90) {
      passed = true;
      p.best[store.lv] = Math.max(p.best[store.lv] ?? 0, s);
      if (store.lv + 1 > p.unlocked) p.unlocked = Math.min(store.lv + 1, LEVELS.length - 1);
      saveProgress(p);
      showWin(s);
    } else if (s > (p.best[store.lv] ?? 0)) {
      p.best[store.lv] = s;
      saveProgress(p);
    }
  }, 120);
}

function loadLevel(): void {
  const lv = LEVELS[store.lv];
  $('lvName').textContent = '第' + '一二三四五六七'[store.lv] + '幅 · ' + lv.name;
  $('lvStar').textContent = '「' + lv.star + '」';
  $('hint').innerHTML = lv.hint;
  $('scoreNow').textContent = '0';
  tAnim = 0;
  drawnT = 0;
  passed = false;
  buildRingCards();
  updateDots();
  updateResLeft();
  logResDefault();
  placeCoreDot();
  syncTools();
  scheduleScore();
}

/* ── 主循环 ── */
function frame(now: number): void {
  if (!W) return;
  if (!store.paused) {
    const step = (TAU / 720) * (store.slow ? 0.3 : 1);
    tAnim = (tAnim + step) % TAU;
    drawnT = Math.min(drawnT + step, TAU);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  renderFrame({
    ctx, w: W, h: H, now, tAnim, drawnT,
    showForm: store.showForm,
    showTarget: store.showTarget,
    paused: store.paused,
  });
}

/* ── 工具按钮 ── */
function syncTools(): void {
  const on = (id: string, v: boolean) => $(id).classList.toggle('on', v);
  on('btnForm', store.showForm);
  on('btnTarget', !store.showTarget);
  on('btnSlow', store.slow);
  on('btnPause', store.paused);
  $('btnTarget').textContent = store.showTarget ? '隐去星图' : '显现星图';
  $('btnPause').textContent = store.paused ? '流 转' : '凝 神';
}

function initTools(): void {
  $('btnForm').addEventListener('click', () => { store.showForm = !store.showForm; syncTools(); });
  $('btnTarget').addEventListener('click', () => { store.showTarget = !store.showTarget; syncTools(); });
  $('btnSlow').addEventListener('click', () => { store.slow = !store.slow; syncTools(); });
  $('btnPause').addEventListener('click', () => { store.paused = !store.paused; syncTools(); });
  $('btnReset').addEventListener('click', resetLevel);
  $('btnSkip').addEventListener('click', skipLevel);

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      store.paused = !store.paused;
      syncTools();
    } else if (e.code === 'KeyR') {
      resetLevel();
    } else if (e.code === 'KeyF') {
      store.showForm = !store.showForm;
      syncTools();
    }
  });
}

function resetLevel(): void {
  store.saves[store.lv] = freshSave(store.lv);
  loadLevel();
}

/** 卡关兜底：以 90 分点亮本关并进入下一幅 */
function skipLevel(): void {
  const p = store.progress;
  p.best[store.lv] = Math.max(p.best[store.lv] ?? 0, 90);
  if (store.lv + 1 > p.unlocked) p.unlocked = Math.min(store.lv + 1, LEVELS.length - 1);
  saveProgress(p);
  playTick();
  if (store.lv < LEVELS.length - 1) {
    store.lv++;
    loadLevel();
  } else {
    openAtlas();
  }
  updateDots();
}

/* ── 装配 ── */
initUI({ scheduleScore, loadLevel });
initTools();
window.addEventListener('resize', resize);

resize();
loadLevel();
setRenderLevel(0);
// 每帧同步当前关卡索引给渲染层
const origFrame = frame;
requestAnimationFrame(function loop(now: number) {
  setRenderLevel(store.lv);
  origFrame(now);
  requestAnimationFrame(loop);
});
