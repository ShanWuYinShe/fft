// DOM UI：符环卡片（转盘/滑块/探测）、星核 pad、关卡点、覆盖层
import { AMP_MAX, LEVELS, RES_MAX, RING_DEFS, TARGETS, TAU, getSave, store, type RingState } from './game';
import { burst } from './render';
import { playChord, playTick } from './audio';

export interface UiCallbacks {
  scheduleScore(): void;
  loadLevel(): void;
}

let cb: UiCallbacks;
const $ = (id: string) => document.getElementById(id)!;

export function initUI(callbacks: UiCallbacks): void {
  cb = callbacks;

  $('btnStart').addEventListener('click', () => {
    $('ovTitle').classList.remove('show');
    playTick();
  });
  $('btnAtlas').addEventListener('click', openAtlas);
  $('btnCloseAtlas').addEventListener('click', () => $('ovAtlas').classList.remove('show'));
  $('btnNext').addEventListener('click', () => {
    $('ovWin').classList.remove('show');
    if (store.lv < LEVELS.length - 1) {
      store.lv++;
      cb.loadLevel();
    } else {
      setTimeout(openAtlas, 400);
    }
  });

  initCorePad();
  initDots();
}

/* ── 星辉/转盘卡片 ── */
export function buildRingCards(): void {
  const box = $('rings');
  box.innerHTML = '';
  const sv = getSave(store.lv);

  for (const def of RING_DEFS) {
    const card = document.createElement('div');
    const st: RingState | undefined = sv.rings.find(r => r.k === def.k);

    if (!st) {
      card.className = 'ring-card asleep';
      card.innerHTML = '<div class="ring-head"><span class="ring-name">符环 · ' + def.cn + '</span></div><div class="asleep-tag">沉 睡 中</div>';
      box.appendChild(card);
      continue;
    }

    card.className = 'ring-card awake';
    card.innerHTML =
      '<div class="ring-head"><span class="ring-name">符环 · ' + def.cn + '</span>' +
      '<span class="ring-dir ' + (def.k > 0 ? 'cw' : 'ccw') + '">' + def.dir + '·' + def.tag + '</span></div>' +
      '<div class="ring-body">' +
        '<div class="dial" title="拖动定方位 · 滚轮微调 · 双击归零">' +
          '<div class="arm"><div class="ptr"></div></div>' +
          '<div class="hub"></div><div class="notch"></div>' +
        '</div>' +
        '<button class="resonance">探测</button>' +
      '</div>' +
      '<div class="amp-row"><span class="amp-label">星辉</span>' +
      '<input type="range" min="0" max="1000" value="' + Math.round((st.amp / AMP_MAX) * 1000) + '"></div>';

    const range = card.querySelector('input') as HTMLInputElement;
    const dial = card.querySelector('.dial') as HTMLDivElement;
    const arm = card.querySelector('.arm') as HTMLDivElement;

    const setFill = () => range.style.setProperty('--fill', ((st.amp / AMP_MAX) * 100).toFixed(1) + '%');
    const setArm = () => { arm.style.transform = 'rotate(' + (-st.phase * 180) / Math.PI + 'deg)'; };
    setFill();
    setArm();

    range.addEventListener('input', () => {
      st.amp = (Number(range.value) / 1000) * AMP_MAX;
      setFill();
      cb.scheduleScore();
    });

    /* 转盘：拖动 + 滚轮微调 + 双击归零 */
    let dragging = false;
    let lastA = 0;
    const angOf = (e: PointerEvent): number => {
      const r = dial.getBoundingClientRect();
      return Math.atan2(-(e.clientY - (r.top + r.height / 2)), e.clientX - (r.left + r.width / 2));
    };
    dial.addEventListener('pointerdown', e => {
      dragging = true;
      lastA = angOf(e);
      dial.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    dial.addEventListener('pointermove', e => {
      if (!dragging) return;
      const a = angOf(e);
      let d = a - lastA;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      st.phase += d;
      lastA = a;
      setArm();
      cb.scheduleScore();
    });
    const endDrag = () => { dragging = false; };
    dial.addEventListener('pointerup', endDrag);
    dial.addEventListener('pointercancel', endDrag);
    dial.addEventListener('wheel', e => {
      e.preventDefault();
      st.phase -= Math.sign(e.deltaY) * 0.06;
      setArm();
      cb.scheduleScore();
    }, { passive: false });
    dial.addEventListener('dblclick', () => {
      st.phase = 0;
      setArm();
      cb.scheduleScore();
    });

    card.querySelector('.resonance')!.addEventListener('click', () => doResonance(def.k));
    box.appendChild(card);
  }
}

/* ── 星核 pad ── */
function initCorePad(): void {
  const pad = $('corePad'), dot = $('coreDot');
  let padDrag = false;
  const place = () => {
    const c = getSave(store.lv).center;
    dot.style.left = (50 + (c.x / 0.62) * 50) + '%';
    dot.style.top = (50 - (c.y / 0.62) * 50) + '%';
  };
  const move = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, -((e.clientY - r.top) / r.height) * 2 - 1));
    const c = getSave(store.lv).center;
    c.x = nx * 0.62;
    c.y = ny * 0.62;
    place();
    cb.scheduleScore();
  };
  pad.addEventListener('pointerdown', e => { padDrag = true; pad.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (padDrag) move(e); });
  pad.addEventListener('pointerup', () => { padDrag = false; });
  pad.addEventListener('pointercancel', () => { padDrag = false; });
  pad.addEventListener('dblclick', () => {
    const c = getSave(store.lv).center;
    c.x = 0;
    c.y = 0;
    place();
    cb.scheduleScore();
  });
}

/** 把星核圆点摆到当前 center 对应位置（loadLevel 时调用） */
export function placeCoreDot(): void {
  const dot = document.getElementById('coreDot')!;
  const c = getSave(store.lv).center;
  dot.style.left = (50 + (c.x / 0.62) * 50) + '%';
  dot.style.top = (50 - (c.y / 0.62) * 50) + '%';
}

/* ── 共鸣探测（单频分析） ── */
const SECTORS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

function doResonance(k: number): void {
  const sv = getSave(store.lv);
  const log = (html: string) => { $('resonance-log').innerHTML = html; };
  if (sv.resLeft <= 0) {
    log('<span class="mute">星力已竭，本幅星图无法再探测。</span>');
    return;
  }
  sv.resLeft--;
  updateResLeft();
  const tr = TARGETS[store.lv].truth[k];
  const cn = RING_DEFS.find(d => d.k === k)!.cn;
  if (!tr || tr.mag < 0.03) {
    log('符环·' + cn + '：<span class="mute">星辉黯淡，几近沉寂——此环与星图几无共鸣。</span>');
    return;
  }
  const maxMag = Math.max(...Object.values(TARGETS[store.lv].truth).map(v => v.mag));
  const ratio = tr.mag / maxMag;
  const strength = ratio < 0.28 ? '微光闪烁（一格）' : ratio < 0.55 ? '明亮（两格）' : '炽烈（三格）';
  const compass = ((90 - (tr.phase * 180) / Math.PI) % 360 + 360) % 360;
  const sector = SECTORS[Math.round(compass / 45) % 8];
  log('符环·' + cn + '：星辉' + strength + '，其方位指向<b style="color:var(--gold)">' + sector + '</b>。');
  playTick();
}

export function updateResLeft(): void {
  const left = getSave(store.lv).resLeft;
  $('resLeft').textContent = '剩余星力 · ' + '●'.repeat(left) + '○'.repeat(RES_MAX - left);
}

export function logResDefault(): void {
  $('resonance-log').innerHTML = '<span class="mute">点按符环上的「探测」，聆听它与星图的共鸣……</span>';
}

/* ── 关卡点 ── */
function initDots(): void {
  updateDots();
}

export function updateDots(): void {
  const box = $('levelDots');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const d = document.createElement('div');
    const unlocked = i <= store.progress.unlocked;
    d.className = 'ldot' + (unlocked ? '' : ' locked') + ((store.progress.best[i] ?? 0) >= 90 ? ' done' : '') + (i === store.lv ? ' cur' : '');
    d.title = lv.star + ' · ' + lv.name;
    if (unlocked) d.addEventListener('click', () => { store.lv = i; cb.loadLevel(); });
    box.appendChild(d);
  });
}

export function starStr(n: number): string {
  const th = [90, 95, 98];
  let s = '';
  for (let i = 0; i < 3; i++) s += '<span class="' + (n >= th[i] ? '' : 'off') + '">★</span>';
  return s;
}

/* ── 过关演出 ── */
export function showWin(s: number): void {
  const lv = LEVELS[store.lv];
  $('winScore').textContent = String(s);
  $('winStars').innerHTML = starStr(s);
  $('winTitle').textContent = lv.star + ' · 星图重明';
  $('winText').textContent = lv.win;
  $('ovWin').classList.add('show');
  playChord(TARGETS[store.lv].active.map(k => Math.abs(k)));
  burst(getSave(store.lv));
  updateDots();
  $('btnNext').textContent = store.lv < LEVELS.length - 1 ? '继续观测' : '仰望星空';
}

/* ── 星图录 ── */
export function openAtlas(): void {
  const grid = $('atlasGrid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const item = document.createElement('div');
    item.className = 'atlas-item';
    const unlocked = i <= store.progress.unlocked;
    item.innerHTML = '<canvas width="120" height="120"></canvas><div class="nm">' +
      (unlocked ? lv.star + ' ' + starStr(store.progress.best[i] ?? 0) : '？？') + '</div>';
    grid.appendChild(item);
    if (!unlocked) return;
    const c = item.querySelector('canvas')!.getContext('2d')!;
    const pts = TARGETS[i].pts;
    c.strokeStyle = 'rgba(232,198,106,.9)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (let j = 0; j <= pts.length; j++) {
      const p = pts[j % pts.length];
      const x = ((p.x / 1.62) * 0.5 + 0.5) * 120;
      const y = (0.5 - (p.y / 1.62) * 0.5) * 120;
      if (j === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  });
  const allDone = LEVELS.every((_, i) => (store.progress.best[i] ?? 0) >= 90);
  $('truthBox').innerHTML = allDone
    ? '<p><b style="color:var(--gold)">秘仪的真相</b> —— 你早已掌握夜的法则：无论多么繁复的星轨，都只是几枚匀速旋转的圆环叠映而成。环的快慢是它的音，星辉是它的强度，朝向是它的方位。三百年前，一位名叫<b style="color:var(--gold)">傅立叶</b>的星官把这条真理写进书中：任何周期轨迹，都可分解为一组旋转之圆的叠加；而「共鸣探测」，正是他聆听每个圆的方法。你转动符环的每一夜，都在实践他留下的——傅立叶级数。</p>'
    : '<p class="locked-tip">点亮所有七幅星图后，秘仪的真相自会显现……</p>';
  $('ovAtlas').classList.add('show');
}
