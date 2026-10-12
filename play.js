// The site as a circuit board. You drive a spark along the traces. Each part it reaches powers up
// and shows a section of the portfolio. The words on the cards are read from index.html, so they
// stay in step with the site.
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const $ = (sel) => document.querySelector(sel);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const W = 2600, H = 1700;   // the board, in its own units
const txt = (d, sel) => (d.querySelector(sel)?.textContent ?? '').trim().replace(/\s+/g, ' ');
const entry = (id) => (d) => ({
  title: txt(d, `#${id} h4`),
  meta: `${txt(d, `#${id} .entry__when`)}, ${txt(d, `#${id} .entry__where`)}`,
  body: txt(d, `#${id} div > p:not(.entry__where)`),
});

// `read` pulls a part's card out of the parsed index.html
const PARTS = [
  { id: 'about', ref: 'U0', name: 'START', kind: 'chip', mark: 'SB16-CE', x: 1300, y: 850, w: 230, h: 130, href: 'index.html',
    read: (d) => ({ title: txt(d, 'h1'), body: txt(d, '.lede') }) },
  { id: '4d', ref: 'U1', name: '4TH DIMENSION', kind: 'chip', mark: 'DATA', x: 560, y: 380, w: 170, h: 100, href: 'index.html#exp-4d', read: entry('exp-4d') },
  { id: 'techmatrix', ref: 'U2', name: 'TECHMATRIX', kind: 'chip', mark: 'IOT', x: 1300, y: 250, w: 170, h: 100, href: 'index.html#exp-techmatrix', read: entry('exp-techmatrix') },
  { id: 'usm', ref: 'U3', name: 'USM', kind: 'chip', mark: 'USM 2028', x: 2040, y: 380, w: 190, h: 100, href: 'index.html#exp-usm', read: entry('exp-usm') },
  { id: 'research', ref: 'CAM1', name: 'RESEARCH', kind: 'cam', x: 2230, y: 850, w: 130, h: 130, href: 'index.html#research',
    read: (d) => ({ title: txt(d, '#research .feature h3'), meta: txt(d, '#research .feature__status'), body: txt(d, '#research .feature h3 + p') }) },
  { id: 'osc', ref: 'ANT1', name: 'OPEN SOURCE', kind: 'ant', x: 2040, y: 1320, w: 150, h: 110, href: 'index.html#personal',
    read: (d) => ({ title: txt(d, '.personal article:nth-of-type(1) h3'), body: txt(d, '.personal article:nth-of-type(1) p') }) },
  { id: 'music', ref: 'SP1', name: 'MUSIC', kind: 'spk', x: 1300, y: 1450, w: 130, h: 130, href: 'index.html#personal',
    read: (d) => ({ title: txt(d, '.personal article:nth-of-type(2) h3'), body: txt(d, '.personal article:nth-of-type(2) p') }) },
  { id: 'hiking', ref: 'GPS1', name: 'HIKING', kind: 'gps', x: 560, y: 1320, w: 150, h: 110, href: 'index.html#personal',
    read: (d) => ({ title: txt(d, '.hikes__head h3'), body: txt(d, '.hikes__head p').replace(/\s*Pick a peak.*$/, '') }) },   // that last sentence is about the map on the site
  { id: 'contact', ref: 'J1', name: 'CONTACT', kind: 'hdr', x: 370, y: 850, w: 90, h: 170, href: 'index.html#contact',
    read: (d) => ({
      title: d.querySelector('#contact h2')?.lastChild?.textContent.trim() ?? '', body: txt(d, '#contact > p'),
      links: [...d.querySelectorAll('.serial__out a')].map((a) => ({ href: a.getAttribute('href'), label: a.textContent.trim() })),
    }) },
];
const HUB = PARTS[0];
const LCD = { x: 1650, y: 515, w: 340, h: 116 };   // a 16x2 character display that reports progress
PARTS.forEach((p) => { p.card = { title: p.name[0] + p.name.slice(1).toLowerCase() }; p.boot = 9; p.zone = Math.max(p.w, p.h) / 2 + 55; });
fetch('index.html').then((r) => r.text()).then((html) => {
  const d = new DOMParser().parseFromString(html, 'text/html');
  PARTS.forEach((p) => { const c = p.read(d); if (c.title) p.card = c; });
  shown = null;   // redraw the open card with the real words
}).catch(() => {});   // opened as a file: the cards keep their short names

// ---------- Traces: from the hub out to each part, one straight run and one 45 degree run ----------
const route = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, diag = Math.min(Math.abs(dx), Math.abs(dy));
  const mid = Math.abs(dx) > Math.abs(dy) ? { x: a.x + Math.sign(dx) * (Math.abs(dx) - diag), y: a.y } : { x: a.x, y: a.y + Math.sign(dy) * (Math.abs(dy) - diag) };
  return [a, mid, b].filter((p, i, all) => !i || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) > 1);
};
const SEGS = [];    // every stretch of main trace, for the speed boost
const DOTS = [];    // charge to pick up along the way
PARTS.slice(1).forEach((part) => {
  part.trace = route(HUB, part);
  let run = 0;
  for (let i = 1; i < part.trace.length; i++) {
    const a = part.trace[i - 1], b = part.trace[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    SEGS.push({ a, b });
    for (let s = 44 - (run % 44); s < len; s += 44) {
      const x = a.x + (b.x - a.x) * s / len, y = a.y + (b.y - a.y) * s / len;
      if (Math.hypot(x - HUB.x, y - HUB.y) > 150 && Math.hypot(x - part.x, y - part.y) > part.zone + 10) DOTS.push({ x, y, hx: x, hy: y });
    }
    run += len;
  }
});
const toSeg = (p, s) => {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const k = Math.min(Math.max(((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy), 0), 1);
  return Math.hypot(p.x - (s.a.x + dx * k), p.y - (s.a.y + dy * k));
};

// ---------- Scenery: thin traces, vias and small parts, the same on every visit ----------
let seed = 16;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clear = (x, y, gap) => PARTS.every((p) => Math.hypot(x - p.x, y - p.y) > gap);
const DECOR = [], SMALL = [];
for (let i = 0; i < 90; i++) {
  let x = 90 + rnd() * (W - 180), y = 90 + rnd() * (H - 180);
  const line = [{ x, y }];
  for (let j = 0, n = 2 + (rnd() * 3 | 0); j < n; j++) {
    const dir = (rnd() * 8 | 0) * Math.PI / 4, len = 50 + rnd() * 220;
    x = Math.min(Math.max(x + Math.cos(dir) * len, 70), W - 70); y = Math.min(Math.max(y + Math.sin(dir) * len, 70), H - 70);
    line.push({ x, y });
  }
  if (line.every((p) => clear(p.x, p.y, 150))) DECOR.push(line);
}
for (let i = 0; i < 60; i++) {
  const x = 90 + rnd() * (W - 180), y = 90 + rnd() * (H - 180);
  if (clear(x, y, 170) && SEGS.every((s) => toSeg({ x, y }, s) > 40)) SMALL.push({ x, y, turn: rnd() < .5, kind: rnd() < .55 ? 'r' : rnd() < .6 ? 'c' : 'led', hue: ['#f47171', '#62cf80', '#74adff', '#f0c94a'][rnd() * 4 | 0] });
}
// Bugs live next to the traces. Driving over one fixes it.
const BUGS = Array.from({ length: 10 }, (unused, i) => {
  const far = SEGS.filter((seg) => Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) > 300);   // the long runs, away from the hub
  const s = far[i % far.length], k = .45 + rnd() * .4, side = rnd() < .5 ? -1 : 1;
  const nx = -(s.b.y - s.a.y), ny = s.b.x - s.a.x, n = Math.hypot(nx, ny);
  const x = s.a.x + (s.b.x - s.a.x) * k + nx / n * 70 * side, y = s.a.y + (s.b.y - s.a.y) * k + ny / n * 70 * side;
  return { x, y, hx: x, hy: y, dir: rnd() * 6.28 };
});

// ---------- Progress, kept between visits ----------
let save = { on: ['about'], dots: [], bugs: [], mute: false };
try { save = { ...save, ...JSON.parse(localStorage.getItem('board') ?? '{}') }; } catch (e) {}
const on = new Set(save.on), gotDots = new Set(save.dots), gotBugs = new Set(save.bugs);
let dirty = false, lastSave = 0;
const store = () => {
  try { localStorage.setItem('board', JSON.stringify({ on: [...on], dots: [...gotDots], bugs: [...gotBugs], mute: save.mute })); } catch (e) {}
  dirty = false;
};
const stat = (name, n, total) => { const b = $(`[data-${name}]`); b.textContent = `${n}/${total}`; b.classList.toggle('is-full', n === total); };
const stats = () => { stat('parts', on.size, PARTS.length); stat('dots', gotDots.size, DOTS.length); stat('bugs', gotBugs.size, BUGS.length); };

// ---------- Sound: a few oscillators, nothing to download ----------
let ac = null;
const tone = (freq, dur = .09, type = 'triangle', vol = .06, wait = 0, slide = 0) => {
  if (save.mute) return;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + wait;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + .02);
  } catch (e) {}
};
const chord = () => [392, 523, 659, 784].forEach((f, i) => tone(f, .22, 'triangle', .07, i * .07));
const beat = () => {   // the speaker plays two bars when it powers up
  for (let i = 0; i < 8; i++) {
    tone(150, .18, 'sine', .3, i * .25, 40);
    tone(5200, .03, 'square', .015, i * .25 + .125);
    if (i % 2) tone(1900, .07, 'square', .03, i * .25);
    tone([98, 98, 117, 98, 131, 117, 98, 87][i], .2, 'sawtooth', .05, i * .25);
  }
};

// ---------- The spark ----------
const spark = { x: HUB.x, y: HUB.y + 120, vx: 0, vy: 0 };
const trail = [];
let sparks = [], words = [];
let boosted = false, combo = 0, comboAt = 0, shake = 0, time = 0, moved = false;
let full = on.size === PARTS.length ? 1 : 0;   // rises to 1 once every part has power, and the board lights up
const burst = (x, y, color, n = 14, speed = 220) => {
  for (let i = 0; i < (calm ? n / 3 : n); i++) {
    const a = Math.random() * 6.28, v = speed * (.3 + Math.random());
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .4 + Math.random() * .5, color });
  }
};

const keys = new Set();
let steer = null;   // where the mouse or finger is held, in screen pixels
const MOVE = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('button, a')) return;
  const k = e.key.toLowerCase();
  if (MOVE[k]) { e.preventDefault(); keys.add(k); }
  else if (k === 'm') $('[data-mute]').click();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); steer = null; });
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); steer = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointermove', (e) => { if (steer) steer = { x: e.clientX, y: e.clientY }; });
['pointerup', 'pointercancel'].forEach((type) => canvas.addEventListener(type, () => { steer = null; }));

// ---------- Camera ----------
let vw = 0, vh = 0, dpr = 1, zoom = 1;
const cam = { x: spark.x, y: spark.y };
const resize = () => {
  dpr = Math.min(devicePixelRatio || 1, 2);
  vw = innerWidth; vh = innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  zoom = Math.min(Math.max(Math.min(vw, vh) / 760, .58), 1.15);
};
addEventListener('resize', resize);
resize();
const toScreen = (p) => ({ x: (p.x - cam.x) * zoom + vw / 2, y: (p.y - cam.y) * zoom + vh / 2 });

// ---------- Cards ----------
let shown = null;
const card = $('.card');
const showCard = (part) => {
  if (part === shown) return;
  shown = part;
  card.classList.toggle('is-shown', !!part);
  if (!part) return;
  const c = part.card;
  card.querySelector('.card__ref').textContent = part.ref;
  card.querySelector('h1').textContent = c.title;
  card.querySelector('.card__meta').textContent = c.meta ?? '';
  card.querySelector('.card__body').textContent = c.body ?? '';
  const links = card.querySelector('.card__links');
  links.textContent = '';
  [...(c.links ?? []), { href: part.href, label: 'See it on the site' }].forEach((l) => {
    const a = document.createElement('a');
    a.href = l.href; a.textContent = l.label;
    if (/^https?:|\.pdf$/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
    links.append(a);
  });
};

// ---------- One step of the world ----------
const update = (dt) => {
  time += dt;
  let ix = 0, iy = 0;
  keys.forEach((k) => { ix += MOVE[k][0]; iy += MOVE[k][1]; });
  if (!ix && !iy && steer) {
    const s = toScreen(spark), dx = steer.x - s.x, dy = steer.y - s.y;
    if (Math.hypot(dx, dy) > 14) { ix = dx; iy = dy; }
  }
  const mag = Math.hypot(ix, iy);
  if (mag && !moved) { moved = true; $('.hint').classList.add('is-gone'); }

  // Main traces carry the spark faster than bare board
  boosted = SEGS.some((s) => toSeg(spark, s) < 20);
  const top = boosted ? 620 : 400;
  if (mag) { spark.vx += ix / mag * 3200 * dt; spark.vy += iy / mag * 3200 * dt; }
  const drag = Math.exp(-(mag ? 2.2 : 7) * dt);
  spark.vx *= drag; spark.vy *= drag;
  const v = Math.hypot(spark.vx, spark.vy);
  if (v > top) { const k = 1 - (1 - top / v) * Math.min(1, 10 * dt); spark.vx *= k; spark.vy *= k; }
  spark.x = Math.min(Math.max(spark.x + spark.vx * dt, 50), W - 50);
  spark.y = Math.min(Math.max(spark.y + spark.vy * dt, 50), H - 50);
  trail.push({ x: spark.x, y: spark.y });
  if (trail.length > 26) trail.shift();

  // Charge is pulled in when the spark gets close
  if (time - comboAt > 1) combo = 0;
  DOTS.forEach((d, i) => {
    if (gotDots.has(i)) return;
    const gap = Math.hypot(d.x - spark.x, d.y - spark.y);
    if (gap < 90) { const pull = Math.min(1, 14 * dt); d.x += (spark.x - d.x) * pull; d.y += (spark.y - d.y) * pull; }
    if (gap < 22) {
      gotDots.add(i);
      combo++; comboAt = time;
      tone(440 * 2 ** (Math.min(combo, 30) / 12), .08, 'triangle', .05);
      burst(d.x, d.y, '#f5d76e', 5, 120);
      dirty = true; stats();
    }
  });

  let here = null;
  PARTS.forEach((p) => {
    p.boot += dt;
    const gap = Math.hypot(p.x - spark.x, p.y - spark.y);
    if (gap > p.zone) return;
    here = p;
    if (on.has(p.id)) return;
    on.add(p.id);
    p.boot = 0;
    shake = 9;
    burst(p.x, p.y, '#f5d76e', 40, 420);
    if (p.kind === 'spk') beat(); else chord();
    dirty = true; stats();
    if (on.size === PARTS.length) [262, 392].forEach((f, i) => tone(f, 1.4, 'sine', .07, .5 + i * .25));   // a low hum as the whole board comes up
  });
  showCard(here);

  BUGS.forEach((b, i) => {
    if (gotBugs.has(i)) return;
    b.dir += (Math.random() - .5) * 4 * dt;
    if (Math.hypot(b.x - b.hx, b.y - b.hy) > 90) b.dir = Math.atan2(b.hy - b.y, b.hx - b.x);
    b.x += Math.cos(b.dir) * 34 * dt; b.y += Math.sin(b.dir) * 34 * dt;
    if (Math.hypot(b.x - spark.x, b.y - spark.y) < 26) {
      gotBugs.add(i);
      shake = 5;
      burst(b.x, b.y, '#f47171', 18, 260);
      words.push({ x: b.x, y: b.y - 20, text: 'bug fixed', age: 0 });
      tone(320, .16, 'sawtooth', .07, 0, 60);
      dirty = true; stats();
    }
  });

  sparks.forEach((s) => { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 2.5 * dt; s.vy *= 1 - 2.5 * dt; });
  sparks = sparks.filter((s) => s.life > 0);
  words.forEach((w) => { w.age += dt; w.y -= 30 * dt; });
  words = words.filter((w) => w.age < 1.3);
  shake *= Math.exp(-9 * dt);
  if (on.size === PARTS.length) full = Math.min(1, full + dt / 2.5);

  cam.x += (spark.x + spark.vx * .22 - cam.x) * Math.min(1, 5 * dt);
  cam.y += (spark.y + spark.vy * .22 - cam.y) * Math.min(1, 5 * dt);
  // Keep the view on the board, with a little of the desk showing at the edges
  const mx = vw / 2 / zoom - 70, my = vh / 2 / zoom - 70;
  cam.x = mx * 2 > W ? W / 2 : Math.min(Math.max(cam.x, mx), W - mx);
  cam.y = my * 2 > H ? H / 2 : Math.min(Math.max(cam.y, my), H - my);
  if (dirty && time - lastSave > 1) { lastSave = time; store(); }
};

// ---------- Drawing ----------
const line = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
const box = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const glow = (x, y, r, color) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
};

const drawPart = (p) => {
  const lit = on.has(p.id), wake = Math.min(p.boot / .7, 1);   // 0 to 1 over the power-up
  const { x, y, w, h } = p, l = x - w / 2, t = y - h / 2;
  ctx.textAlign = 'center';

  if (p.kind === 'chip') {
    // Legs along the long sides light one after another on power-up
    const n = Math.round(w / 24);
    for (let i = 0; i < n; i++) {
      const lx = l + (i + .5) * w / n - 5;
      ctx.fillStyle = lit && i / n <= wake ? '#f5d76e' : '#9aa3ad';
      ctx.fillRect(lx, t - 12, 10, 14); ctx.fillRect(lx, t + h - 2, 10, 14);
    }
    ctx.fillStyle = '#15181d'; box(l, t, w, h, 6); ctx.fill();
    ctx.fillStyle = '#0a0c0f'; ctx.beginPath(); ctx.arc(l + 14, t + h - 14, 5, 0, 7); ctx.fill();
    ctx.fillStyle = lit ? '#e8edf3' : '#6c7480';
    ctx.font = `500 ${p === HUB ? 30 : 22}px ${MONO}`;
    ctx.fillText(p.mark, x, y + 8);
  } else if (p.kind === 'cam') {
    ctx.fillStyle = '#1b2f55'; box(l, t, w, h, 8); ctx.fill();
    ctx.fillStyle = '#0a0c0f'; ctx.beginPath(); ctx.arc(x, y, w * .36, 0, 7); ctx.fill();
    ctx.fillStyle = lit ? '#2c6fd6' : '#1c2533'; ctx.beginPath(); ctx.arc(x, y, w * .24, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .5)'; ctx.beginPath(); ctx.arc(x - 10, y - 10, 6, 0, 7); ctx.fill();
    if (lit) {   // the lens looks around
      const a = time * .9;
      ctx.fillStyle = '#0a0c0f'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 8, y + Math.sin(a * 1.3) * 8, w * .1, 0, 7); ctx.fill();
    }
  } else if (p.kind === 'ant') {
    ctx.strokeStyle = lit ? '#f5d76e' : '#c9a227'; ctx.lineWidth = 7; ctx.lineJoin = 'miter';
    const zig = [];
    for (let i = 0; i <= 8; i++) zig.push({ x: l + i * w / 8, y: i % 2 ? t + 14 : t + h - 14 });
    line(zig);
    if (lit) for (let i = 0; i < 3; i++) {   // it broadcasts
      const r = ((time * .6 + i / 3) % 1) * 150;
      ctx.strokeStyle = `rgba(98, 207, 128, ${.7 * (1 - r / 150)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 50 + r, 0, 7); ctx.stroke();
    }
  } else if (p.kind === 'spk') {
    const thump = lit ? 1 + .05 * Math.max(0, Math.sin(time * 12.56)) ** 6 : 1;
    ctx.fillStyle = '#15181d'; ctx.beginPath(); ctx.arc(x, y, w / 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2f37'; ctx.beginPath(); ctx.arc(x, y, w * .4 * thump, 0, 7); ctx.fill();
    ctx.fillStyle = lit ? '#f5a524' : '#4a515c'; ctx.beginPath(); ctx.arc(x, y, w * .16 * thump, 0, 7); ctx.fill();
  } else if (p.kind === 'gps') {
    ctx.fillStyle = '#c8ccd2'; box(l, t, w, h, 5); ctx.fill();
    ctx.strokeStyle = '#8d949e'; ctx.lineWidth = 2; box(l + 6, t + 6, w - 12, h - 12, 3); ctx.stroke();
    ctx.fillStyle = lit ? '#2e7d32' : '#6f7780';   // two peaks
    ctx.beginPath(); ctx.moveTo(l + 22, t + h - 22); ctx.lineTo(x - 14, t + 26); ctx.lineTo(x + 8, t + h - 44); ctx.lineTo(x + 26, t + 40); ctx.lineTo(l + w - 22, t + h - 22); ctx.fill();
  } else if (p.kind === 'hdr') {
    ctx.fillStyle = '#15181d'; box(l, t, w, h, 5); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const px = l + 26 + (i % 2) * 38, py = t + 26 + (i >> 1) * 39;
      ctx.fillStyle = lit && i / 8 <= wake ? '#f5d76e' : '#c9a227';
      ctx.fillRect(px - 9, py - 9, 18, 18);
    }
  }

  // Each part has a power LED and its name printed next to it
  const ledX = l - 26, ledY = t + h + 14;
  if (lit) glow(ledX, ledY, 26 + 4 * Math.sin(time * 5), 'rgba(98, 207, 128, .55)');
  ctx.fillStyle = lit ? '#8ff5a6' : '#254a35'; ctx.beginPath(); ctx.arc(ledX, ledY, 7, 0, 7); ctx.fill();
  ctx.fillStyle = lit ? 'rgba(255, 255, 255, .92)' : 'rgba(255, 255, 255, .5)';
  ctx.font = `500 19px ${MONO}`;
  ctx.fillText(`${p.ref}  ${p.name}`, x, t + h + 46);
  if (lit && p.boot < .7) {   // a ring spreads out as it powers up
    ctx.strokeStyle = `rgba(245, 215, 110, ${1 - wake})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x, y, p.zone + wake * 160, 0, 7); ctx.stroke();
  }
};

const draw = () => {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#070b12';
  ctx.fillRect(0, 0, vw, vh);
  const jx = calm ? 0 : (Math.random() - .5) * shake, jy = calm ? 0 : (Math.random() - .5) * shake;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (vw / 2 - cam.x * zoom + jx), dpr * (vh / 2 - cam.y * zoom + jy));

  // The board, with a mounting hole in each corner
  ctx.fillStyle = '#0c4434'; box(0, 0, W, H, 46); ctx.fill();
  ctx.strokeStyle = full ? `rgba(${15 + 83 * full | 0}, ${90 + 117 * full | 0}, ${68 + 60 * full | 0}, 1)` : '#0f5a44'; ctx.lineWidth = 6;
  if (full) { ctx.shadowColor = `rgba(98, 207, 128, ${full * .8})`; ctx.shadowBlur = 24; }
  box(14, 14, W - 28, H - 28, 36); ctx.stroke();
  ctx.shadowBlur = 0;
  [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]].forEach(([hx, hy]) => {
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(hx, hy, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#070b12'; ctx.beginPath(); ctx.arc(hx, hy, 15, 0, 7); ctx.fill();
  });

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#11583f'; ctx.lineWidth = 5;
  DECOR.forEach((pts) => {
    line(pts);
    const end = pts[pts.length - 1];
    ctx.fillStyle = '#0f6a4b'; ctx.beginPath(); ctx.arc(end.x, end.y, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#083226'; ctx.beginPath(); ctx.arc(end.x, end.y, 3.5, 0, 7); ctx.fill();
  });
  SMALL.forEach((s) => {
    ctx.save(); ctx.translate(s.x, s.y); if (s.turn) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#b9bfc7'; ctx.fillRect(-17, -7, 34, 14);
    if (s.kind === 'led') { ctx.fillStyle = full ? s.hue : '#3d4640'; ctx.globalAlpha = 1 - full * (.25 + .25 * Math.sin(time * 2 + s.x)); }
    else ctx.fillStyle = s.kind === 'r' ? '#16181c' : '#a8794a';
    ctx.fillRect(-10, -7, 20, 14);
    ctx.restore();
    if (s.kind === 'led' && full) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = full * .5; glow(s.x, s.y, 44, s.hue); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  });

  // Printed on the board
  ctx.textAlign = 'center';
  ctx.font = "800 64px 'Archivo', system-ui, sans-serif";
  if (full) {   // the name is backlit once the board is fully powered
    ctx.shadowColor = `rgba(143, 245, 166, ${full})`; ctx.shadowBlur = 28 + 8 * Math.sin(time * 1.6);
  }
  ctx.fillStyle = `rgba(${255 - 60 * full | 0}, 255, ${255 - 50 * full | 0}, ${.8 + .2 * full})`;
  ctx.fillText('SHRABYA BHATTARAI', HUB.x, HUB.y - 195);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, .4)';
  ctx.font = `500 20px ${MONO}`;
  ctx.fillText('SB16-CE  REV 2026', HUB.x, HUB.y - 155);

  // Status LEDs: one per part, amber as each gets power. With all of them on they turn green and a pulse runs along the row.
  PARTS.forEach((p, i) => {
    const lx = HUB.x + (i - (PARTS.length - 1) / 2) * 36, ly = HUB.y - 118, lit = on.has(p.id);
    const chase = full * (.5 + .5 * Math.sin(time * 5 - i * .7));
    ctx.fillStyle = '#b9bfc7'; ctx.fillRect(lx - 11, ly - 6, 22, 12);
    if (lit) { ctx.globalCompositeOperation = 'lighter'; glow(lx, ly, 20 + 14 * chase, full ? `rgba(98, 207, 128, ${.5 + .4 * chase})` : 'rgba(245, 165, 36, .55)'); ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = !lit ? '#3d4640' : full ? '#8ff5a6' : '#f5a524';
    ctx.fillRect(lx - 6, ly - 6, 12, 12);
  });

  // The display: two rows of 16 characters. Its backlight comes up when the whole board has power.
  {
    const l = LCD.x - LCD.w / 2, t = LCD.y - LCD.h / 2, cell = 18;
    ctx.fillStyle = '#123a63'; box(l, t, LCD.w, LCD.h, 6); ctx.fill();
    ctx.fillStyle = '#0a0c0f'; box(l + 12, t + 10, LCD.w - 24, LCD.h - 20, 4); ctx.fill();
    if (full) { ctx.shadowColor = `rgba(190, 240, 90, ${full})`; ctx.shadowBlur = 36; }
    ctx.fillStyle = `rgb(${88 + 90 * full | 0}, ${112 + 108 * full | 0}, ${44 + 36 * full | 0})`;
    ctx.fillRect(l + 22, t + 18, LCD.w - 44, LCD.h - 36);
    ctx.shadowBlur = 0;
    const rows = full > .5
      ? ['    YOU WIN!' + (time % 1 < .5 ? '\u2588' : ''), ` ${PARTS.length}/${PARTS.length} PARTS ON`]
      : [`POWER ${on.size}/${PARTS.length}`, `BUGS  ${gotBugs.size}/${BUGS.length}`];
    ctx.font = `500 26px ${MONO}`;
    rows.forEach((row, r) => {
      for (let c = 0; c < 16; c++) {
        const cx = l + 26 + c * cell, cy = t + 22 + r * 38;
        ctx.fillStyle = 'rgba(20, 40, 10, .1)'; ctx.fillRect(cx, cy, cell - 2, 34);   // each character has its own cell
        if (row[c] && row[c] !== ' ') { ctx.fillStyle = '#15240b'; ctx.fillText(row[c], cx + cell / 2 - 1, cy + 27); }
      }
    });
    ctx.fillStyle = 'rgba(255, 255, 255, .5)';
    ctx.font = `500 19px ${MONO}`;
    ctx.fillText('LCD1', LCD.x, t - 14);
  }

  // Main traces. A powered one carries current, shown as dashes running outward.
  PARTS.slice(1).forEach((p) => {
    const lit = on.has(p.id);
    ctx.setLineDash([]);
    ctx.strokeStyle = lit ? '#2aa873' : '#17704f'; ctx.lineWidth = 16;
    line(p.trace);
    if (lit) {
      ctx.strokeStyle = 'rgba(245, 215, 110, .85)'; ctx.lineWidth = 4;
      ctx.setLineDash([14, 30]); ctx.lineDashOffset = -time * 140;
      line(p.trace);
      ctx.setLineDash([]);
    }
  });
  DOTS.forEach((d, i) => {
    if (gotDots.has(i)) return;
    const r = 6 + 1.5 * Math.sin(time * 4 + i);
    ctx.fillStyle = '#f5d76e'; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
  });

  PARTS.forEach(drawPart);

  BUGS.forEach((b, i) => {
    if (gotBugs.has(i)) return;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.dir);
    ctx.strokeStyle = '#1a0d0d'; ctx.lineWidth = 2.5;
    for (let k = -1; k <= 1; k++) {   // six legs, walking
      const wig = Math.sin(time * 16 + k * 2 + i) * 4;
      ctx.beginPath(); ctx.moveTo(k * 7, 0); ctx.lineTo(k * 9 + wig, -15); ctx.moveTo(k * 7, 0); ctx.lineTo(k * 9 - wig, 15); ctx.stroke();
    }
    ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a0d0d'; ctx.beginPath(); ctx.arc(13, 0, 5.5, 0, 7); ctx.fill();
    ctx.restore();
  });

  // The spark and what it leaves behind
  ctx.globalCompositeOperation = 'lighter';
  trail.forEach((p, i) => {
    const k = i / trail.length;
    ctx.fillStyle = boosted ? `rgba(245, 215, 110, ${k * .5})` : `rgba(116, 173, 255, ${k * .45})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 + k * 9, 0, 7); ctx.fill();
  });
  sparks.forEach((s) => {
    ctx.globalAlpha = Math.min(1, s.life * 2.5);
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
  glow(spark.x, spark.y, 46 + 5 * Math.sin(time * 9), boosted ? 'rgba(245, 190, 60, .75)' : 'rgba(116, 173, 255, .7)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(spark.x, spark.y, 9, 0, 7); ctx.fill();

  ctx.font = `500 20px ${MONO}`;
  words.forEach((w) => { ctx.fillStyle = `rgba(255, 255, 255, ${1 - w.age / 1.3})`; ctx.fillText(w.text, w.x, w.y); });

  // Arrows at the edge of the screen point to parts that still need power
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const point = (p, rgb) => {
    const s = toScreen(p), pad = 34;
    if (s.x > 0 && s.x < vw && s.y > 0 && s.y < vh) return;
    const a = Math.atan2(s.y - vh / 2, s.x - vw / 2);
    const k = Math.min((vw / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), (vh / 2 - pad) / Math.abs(Math.sin(a) || 1e-6));
    ctx.save(); ctx.translate(vw / 2 + Math.cos(a) * k, vh / 2 + Math.sin(a) * k); ctx.rotate(a);
    ctx.fillStyle = `rgba(${rgb}, ${.6 + .3 * Math.sin(time * 4)})`;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-9, -10); ctx.lineTo(-9, 10); ctx.fill();
    ctx.restore();
  };
  PARTS.forEach((p) => { if (!on.has(p.id)) point(p, '245, 165, 36'); });
  if (full) point(LCD, '190, 240, 90');   // with everything powered, a green arrow leads back to the display
};

// ---------- Buttons ----------
const muteBtn = $('[data-mute]');
const showMute = () => { muteBtn.textContent = save.mute ? 'Sound off' : 'Sound on'; };
muteBtn.addEventListener('click', () => { save.mute = !save.mute; showMute(); store(); });
showMute();
const resetBtn = $('[data-reset]');
let armed = 0, wiped = false;
resetBtn.addEventListener('click', () => {
  if (!armed) {   // a second press within three seconds clears the progress
    resetBtn.textContent = 'Press again to clear';
    armed = setTimeout(() => { armed = 0; resetBtn.textContent = 'Start over'; }, 3000);
    return;
  }
  wiped = true;
  try { localStorage.removeItem('board'); } catch (e) {}
  location.reload();
});
addEventListener('pagehide', () => { if (!wiped) store(); });

stats();
let last = performance.now();
const frame = (now) => {
  update(Math.min((now - last) / 1000, .05));
  last = now;
  draw();
  requestAnimationFrame(frame);
};
document.fonts?.ready.then(() => requestAnimationFrame(frame)) ?? requestAnimationFrame(frame);
