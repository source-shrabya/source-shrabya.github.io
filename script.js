const root = document.documentElement;

// ---------- Brightness fader: blends continuously from light (0) to dark (100) ----------
const fader = document.querySelector('.fader input');
const brightness = () => parseFloat(getComputedStyle(root).getPropertyValue('--t')) || 0;
const setBrightness = (value, save) => {
  window.applyBrightness(value);
  fader.value = value;
  fader.setAttribute('aria-valuetext', value < 15 ? 'Light' : value > 85 ? 'Dark' : `${value}% dark`);
  if (save) { try { localStorage.setItem('brightness', value); localStorage.removeItem('theme'); } catch (e) {} }
  root.dispatchEvent(new CustomEvent('brightness'));
};
setBrightness(Math.round(brightness() * 100), false);
fader.addEventListener('input', () => setBrightness(Number(fader.value), true));
// Until someone moves the fader, follow the system setting
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('brightness'); } catch (err) {}
  if (saved === null) { setBrightness(e.matches ? 100 : 0, false); }
});

// ---------- Resistor in the footer: tap to decode ----------
const resistor = document.querySelector('.resistor button');
resistor?.addEventListener('click', () => {
  resistor.setAttribute('aria-expanded', String(resistor.getAttribute('aria-expanded') !== 'true'));
});

// ---------- Onboard LED in the header: tap to show the sketch it's running ----------
const onboard = document.querySelector('.onboard button');
onboard?.addEventListener('click', () => {
  onboard.setAttribute('aria-expanded', String(onboard.getAttribute('aria-expanded') !== 'true'));
});
document.addEventListener('click', (e) => {
  if (onboard && !onboard.parentElement.contains(e.target)) onboard.setAttribute('aria-expanded', 'false');
});

// ---------- Serial Monitor: the contact lines type in once, when it scrolls into view ----------
const serial = document.querySelector('[data-serial]');
if (serial && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  serial.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', i));
  serial.classList.add('is-armed');
  const boot = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { serial.classList.add('is-on'); boot.disconnect(); }
  }, { threshold: 0.4 });
  boot.observe(serial);
}

document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Terminal: press ` anywhere (or the footer button) for a small shell ----------
// Most answers are read from the page itself, so they stay in step with edits to the HTML and the pinout.
const term = document.querySelector('[data-terminal]');
if (term) {
  const log = term.querySelector('.term__log');
  const input = term.querySelector('.term__input');
  const LINKS = {
    email: 'mailto:shrabya.bhattarai@usm.edu',
    linkedin: 'https://www.linkedin.com/in/shrabya-bhattarai',
    github: 'https://github.com/source-shrabya',
    resume: 'assets/Shrabya_Bhattarai_Resume.pdf',
  };
  const SECTIONS = { top: '#top', engineering: '#engineering', experience: '#engineering', research: '#research', personal: '#personal', contact: '#contact' };
  const clean = (el) => (el?.textContent ?? '').trim().replace(/\s+/g, ' ');

  // A line is a string, or a list of parts: strings, { text, cls } spans, or { href, label } links
  const print = (...lines) => {
    lines.forEach((line) => {
      const row = document.createElement('div');
      (Array.isArray(line) ? line : [line]).forEach((part) => {
        if (typeof part === 'string') return row.append(part);
        if (part.href) {
          const a = document.createElement('a');
          a.href = part.href;
          a.textContent = part.label;
          if (/^https?:|\.pdf$/.test(part.href)) { a.target = '_blank'; a.rel = 'noopener'; }
          return row.append(a);
        }
        const span = document.createElement('span');
        span.className = part.cls;
        span.textContent = part.text;
        row.append(span);
      });
      log.append(row);
    });
    log.scrollTop = log.scrollHeight;
  };
  const link = (name) => ({ href: LINKS[name], label: LINKS[name].replace(/^mailto:|^https:\/\/(www\.)?/, '') });

  const COMMANDS = {
    help: { about: 'list commands', run: () => {
      print('');
      Object.entries(COMMANDS).forEach(([name, c]) => c.about && print([{ text: name.padEnd(14), cls: 'hl' }, c.about]));
      print('', { text: 'Tab completes, ↑ and ↓ go through history, Esc closes.', cls: 'dim' }, '');
    } },
    whoami: { about: 'who this is', run: () => print(clean(document.querySelector('h1')), clean(document.querySelector('.lede'))) },
    ls: { about: 'list what is here', run: () => print('experience/  research/  personal/  contact/  resume.pdf') },
    experience: { about: 'work and school', run: () => {
      document.querySelectorAll('#engineering .entry').forEach((e) => print([{ text: clean(e.querySelector('.entry__when')).padEnd(22), cls: 'dim' }, clean(e.querySelector('h4'))]));
    } },
    research: { about: 'what I am researching', run: () => {
      const f = document.querySelector('#research .feature');
      print(clean(f.querySelector('h3')), { text: clean(f.querySelector('.feature__status')), cls: 'dim' });
    } },
    now: { about: 'what I am up to right now', run: () => {
      document.querySelectorAll('.now dl > div:not([hidden])').forEach((d) => print([{ text: clean(d.querySelector('dt')).padEnd(16), cls: 'dim' }, clean(d.querySelector('dd'))]));
    } },
    pinout: { about: 'skills, as chip pins', run: () => {
      [...document.querySelectorAll('.chip__pin')]
        .map((b) => ({ n: +clean(b.querySelector('.chip__num')), sig: clean(b.querySelector('.chip__sig')), name: clean(b.querySelector('.chip__name')) }))
        .sort((a, b) => a.n - b.n)
        .forEach((p) => print([{ text: String(p.n).padStart(2) + '  ', cls: 'dim' }, { text: p.sig.padEnd(5), cls: 'hl' }, p.name]));
    } },
    contact: { about: 'how to reach me', run: () => ['email', 'linkedin', 'github'].forEach((n) => print([{ text: n.padEnd(10), cls: 'dim' }, link(n)])) },
    open: { about: 'open email | linkedin | github | resume', args: Object.keys(LINKS), run: ([what]) => {
      if (!LINKS[what]) return print({ text: 'usage: open email | linkedin | github | resume', cls: 'err' });
      print(['opening ', link(what)]);
      if (what === 'email') location.href = LINKS.email; else window.open(LINKS[what], '_blank', 'noopener');
    } },
    cd: { about: 'jump to a section', args: Object.keys(SECTIONS), run: ([where = 'top']) => {
      const hash = SECTIONS[where.replace(/\/$/, '')];
      if (!hash) return print({ text: `cd: no such section: ${where}`, cls: 'err' });
      term.close();
      location.hash = hash;
    } },
    theme: { about: 'light | dark', args: ['light', 'dark'], run: ([mode]) => {
      if (mode !== 'light' && mode !== 'dark') return print({ text: 'usage: theme light | dark', cls: 'err' });
      setBrightness(mode === 'dark' ? 100 : 0, true);
      print(`theme set to ${mode}`);
    } },
    clear: { about: 'clear the screen', run: () => { log.textContent = ''; } },
    exit: { about: 'close the terminal', run: () => term.close() },
    // Not listed in help
    sudo: { run: (args) => {
      if (args.join(' ') === 'hire-me') print('[sudo] password for guest: ********', { text: 'Access granted.', cls: 'ps' }, ['Best next step: ', link('email')]);
      else print({ text: 'guest is not in the sudoers file. This incident will be reported.', cls: 'err' });
    } },
    echo: { run: (args) => print(args.join(' ')) },
    cat: { run: ([file]) => (file === 'resume.pdf' || file === 'resume' ? COMMANDS.open.run(['resume']) : print({ text: `cat: ${file ?? ''}: not a file here. Try ls.`, cls: 'err' })) },
    hello: { run: () => print('Hi! Type help to see what I can do.') },
    rm: { run: () => print({ text: 'Not on my site.', cls: 'err' }) },
  };
  COMMANDS.hi = COMMANDS.hello;
  COMMANDS.skills = { run: COMMANDS.pinout.run };

  const history = [];
  let back = 0;
  const run = (line) => {
    print([{ text: 'guest@sb16-ce:~$ ', cls: 'ps' }, line]);
    const [name, ...args] = line.trim().split(/\s+/);
    if (!name) return;
    history.push(line);
    const cmd = COMMANDS[name.toLowerCase()];
    if (cmd) cmd.run(args.map((a) => a.toLowerCase()));
    else print({ text: `command not found: ${name}. Type help.`, cls: 'err' });
  };

  term.querySelector('.term__form').addEventListener('submit', (e) => {
    e.preventDefault();
    run(input.value);
    input.value = '';
    back = 0;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      back = Math.min(Math.max(back + (e.key === 'ArrowUp' ? 1 : -1), 0), history.length);
      input.value = back ? history[history.length - back] : '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const [name, ...rest] = input.value.split(' ');
      const options = rest.length ? (COMMANDS[name]?.args ?? []) : Object.keys(COMMANDS).filter((c) => COMMANDS[c].about);
      const word = rest.length ? rest[rest.length - 1] : name;
      const hits = options.filter((o) => o.startsWith(word.toLowerCase()));
      if (hits.length === 1) input.value = rest.length ? `${name} ${hits[0]} ` : `${hits[0]} `;
      else if (hits.length > 1) print({ text: hits.join('  '), cls: 'dim' });
    }
  });

  const openTerm = () => {
    if (term.open) return;
    term.showModal();
    if (!log.childElementCount) print({ text: 'SB16-CE shell. Type help to see the commands.', cls: 'dim' }, '');
    input.focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    openTerm();
  });
  document.querySelector('[data-terminal-open]')?.addEventListener('click', openTerm);
  term.querySelector('.term__close').addEventListener('click', () => term.close());
  term.addEventListener('click', (e) => { if (e.target === term) term.close(); });   // click on the backdrop
  log.addEventListener('click', (e) => { if (!e.target.closest('a') && !getSelection().toString()) input.focus(); });
}

// ---------- Scrollspy: mark the nav link for the section in view ----------
const navLinks = [...document.querySelectorAll('.nav-list a')];
const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${entry.target.id}`)));
  });
}, { rootMargin: '-40% 0px -55% 0px' });
navLinks.forEach((a) => { const s = document.querySelector(a.hash); if (s) spy.observe(s); });

// ---------- Logic analyzer ----------
// Channels follow the resistor color code order: 1 brown, 2 red, 3 orange, 4 yellow, 5 green, 6 blue.
// Dates are 'YYYY-MM'. `to: null` means still going.
const CHANNELS = [
  { name: 'Embedded', color: '--c-brown', pulses: [
    { from: '2021-12', to: '2022-03', label: 'Sugam Engineering', title: 'Embedded Systems Developer Intern at Sugam Engineering', detail: 'C firmware for a microcontroller sensor project.', href: '#exp-sugam' },
  ] },
  { name: 'Software', color: '--c-red', pulses: [
    { from: '2023-05', to: '2024-08', label: 'TechMatrix', title: 'Junior Software Engineer Intern at TechMatrix', detail: 'Backend APIs in Python and Flask.', href: '#exp-techmatrix' },
  ] },
  { name: 'Education', color: '--c-orange', pulses: [
    { from: '2024-08', to: '2028-05', label: 'B.S. Computer Engineering, USM', title: 'B.S. Computer Engineering at the University of Southern Mississippi', detail: 'Expected May 2028. GPA 3.91.', href: '#exp-usm' },
  ] },
  { name: 'Research', color: '--c-yellow', pulses: [
    { from: '2026-01', to: null, label: 'WildfireWatch', title: 'WildfireWatch research', detail: 'Onboard AI for detecting wildfires from drones.', href: '#research' },
  ] },
  { name: 'Community', color: '--c-green', pulses: [
    { from: '2026-03', to: null, label: 'Open Source Community', title: 'Co-founder of the USM Open Source Community', detail: 'Grown past 200 student members.', href: '#personal' },
  ] },
  { name: 'Data', color: '--c-blue', pulses: [
    { from: '2026-05', to: '2026-08', label: '4th Dimension', title: 'Data Analyst Intern at 4th Dimension Marketing Solutions', detail: 'Automated sales data collection and weekly reporting.', href: '#exp-4d' },
  ] },
];

const analyzer = document.querySelector('[data-analyzer]');
if (analyzer) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const toIndex = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
  const fmt = (i) => `${MONTHS[i % 12]} ${Math.floor(i / 12)}`;

  const today = new Date();
  const now = today.getFullYear() * 12 + today.getMonth();
  const start = toIndex('2021-07');
  const end = Math.max(toIndex('2027-07'), now + 9);   // leave some room after "now"
  const pct = (i) => `${((Math.min(Math.max(i, start), end) - start) / (end - start)) * 100}%`;

  const names = analyzer.querySelector('.la__names');
  const rows = analyzer.querySelector('.la__rows');
  const axis = analyzer.querySelector('.la__axis');
  const plot = analyzer.querySelector('.la__plot');
  const readout = analyzer.querySelector('.la__readout');

  // Year ticks and gridlines
  for (let y = Math.ceil(start / 12); y * 12 < end; y++) {
    const tick = document.createElement('span');
    tick.className = 'la__tick';
    tick.style.left = pct(y * 12);
    tick.textContent = y;
    axis.append(tick);
    const grid = document.createElement('div');
    grid.className = 'la__grid';
    grid.style.left = pct(y * 12);
    grid.setAttribute('aria-hidden', 'true');
    plot.append(grid);
  }

  const pulseEls = [];
  CHANNELS.forEach((ch) => {
    const name = document.createElement('li');
    name.style.setProperty('--c', `var(${ch.color})`);
    name.innerHTML = `<i></i>${ch.name}`;
    names.append(name);

    const row = document.createElement('li');
    row.style.setProperty('--c', `var(${ch.color})`);
    ch.pulses.forEach((p) => {
      const from = toIndex(p.from);
      const to = p.to ? toIndex(p.to) + 1 : now + 1;   // inclusive end month
      const when = `${fmt(from)} to ${p.to ? fmt(to - 1) : 'now'}`;
      const a = document.createElement('a');
      a.className = 'la__pulse' + (p.to ? '' : ' la__pulse--open');
      a.href = p.href;
      a.style.left = pct(from);
      a.style.width = `calc(${pct(to)} - ${pct(from)})`;
      a.setAttribute('aria-label', `${ch.name}: ${p.title}, ${when}`);
      a.innerHTML = `<span>${p.label}</span>`;
      a._info = { ...p, color: ch.color, when };
      row.append(a);
      pulseEls.push(a);
    });
    rows.append(row);
  });

  // "Now" cursor and the not-yet-captured region after it
  const nowPos = pct(now + 0.5);
  analyzer.querySelector('.la__cursor').style.left = nowPos;
  analyzer.querySelector('.la__future').style.left = nowPos;

  // Readout: by default, decode what is high at the cursor
  const active = CHANNELS.flatMap((ch) => ch.pulses
    .filter((p) => toIndex(p.from) <= now && (!p.to || toIndex(p.to) >= now))
    .map((p) => ({ ...p, color: ch.color })));
  const showNow = () => {
    readout.innerHTML = `<span class="when">${fmt(now)}</span><span><strong>Right now:</strong> ${
      active.map((p) => `<span class="item"><span class="swatch" style="--c: var(${p.color})"></span>${p.label}</span>`).join(', ')
    }</span>`;
    pulseEls.forEach((el) => el.classList.remove('is-active'));
  };
  const showPulse = (el) => {
    const p = el._info;
    readout.innerHTML = `<span class="when">${p.when}</span><span><span class="swatch" style="--c: var(${p.color})"></span><strong>${p.title}.</strong> ${p.detail}</span>`;
    pulseEls.forEach((x) => x.classList.toggle('is-active', x === el));
  };
  pulseEls.forEach((el) => {
    el.addEventListener('pointerenter', () => showPulse(el));
    el.addEventListener('focus', () => showPulse(el));
    el.addEventListener('pointerleave', showNow);
    el.addEventListener('blur', showNow);
  });
  showNow();

  // Labels that don't fit inside a short pulse sit next to it instead,
  // on whichever side has more room.
  const placeLabels = () => {
    pulseEls.forEach((el) => {
      el.classList.remove('is-narrow', 'label-left');
      const span = el.firstElementChild;
      if (span.scrollWidth > el.clientWidth - 16) {
        el.classList.add('is-narrow');
        const mid = (el.offsetLeft + el.offsetWidth / 2) / el.parentElement.clientWidth;
        if (mid > 0.6) el.classList.add('label-left');
      }
    });
  };
  placeLabels();
  new ResizeObserver(placeLabels).observe(rows);
  document.fonts?.ready.then(placeLabels);

  // Play the capture sweep once, when the analyzer first comes into view
  const sweep = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { analyzer.classList.add('is-capturing'); sweep.disconnect(); }
  }, { threshold: 0.3 });
  sweep.observe(analyzer);
}

// ---------- Pinout: skills as a 16-pin DIP ----------
// DIP numbering runs down the left side (1 to 8), then up the right side (9 to 16).
const chip = document.querySelector('[data-chip]');
if (chip) {
  const PINS = [
    { sig: 'C', name: 'Embedded C', detail: 'Microcontroller firmware at Sugam Engineering, and onboard code for WildfireWatch.' },
    { sig: 'PY', name: 'Python', detail: 'Sales data scripts at 4th Dimension, Flask APIs at TechMatrix, and model testing for WildfireWatch.' },
    { sig: 'SQL', name: 'SQL', detail: 'Kept the team CRM up to date at 4th Dimension.' },
    { sig: 'API', name: 'Flask', detail: 'Backend APIs at TechMatrix.' },
    { sig: 'CV', name: 'OpenCV', detail: 'Image processing for wildfire detection from drones.' },
    { sig: 'TFL', name: 'TensorFlow Lite', detail: 'Running models on resource-constrained onboard hardware.' },
    { sig: 'MCU', name: 'Microcontrollers', detail: 'Helped with C firmware for a microcontroller sensor project at Sugam Engineering.' },
    { sig: 'GND', name: 'Ground', detail: 'Grounded in Kathmandu, where I grew up.' },
    { sig: 'NC', name: 'Not connected', detail: 'Reserved for whatever I learn next.' },
    { sig: 'DSA', name: 'Data structures', detail: 'Coursework at USM.' },
    { sig: 'EMB', name: 'Embedded systems', detail: 'Coursework at USM.' },
    { sig: 'OS', name: 'Operating systems', detail: 'Coursework at USM.' },
    { sig: 'NET', name: 'Computer networks', detail: 'Coursework at USM.' },
    { sig: 'DIG', name: 'Digital electronics', detail: 'Coursework at USM.' },
    { sig: 'ETL', name: 'Data pipelines', detail: 'Weekly reporting pipelines built from raw campaign records.' },
    { sig: 'VCC', name: 'Supply', detail: 'Recharges on writing music and hiking.' },
  ];
  const readout = chip.querySelector('.chip__readout');
  const idle = () => { readout.classList.remove('is-shown'); };
  const pinEls = PINS.map((p, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip__pin';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="chip__name">${p.name}</span><span class="chip__sig">${p.sig}</span><span class="chip__num">${i + 1}</span><i aria-hidden="true"></i>`;
    btn.setAttribute('aria-label', `Pin ${i + 1}, ${p.name}`);
    const show = () => {
      readout.innerHTML = `<span class="chip__at">Pin ${i + 1} · ${p.sig}</span> <strong>${p.name}.</strong> ${p.detail}`;
      readout.classList.add('is-shown');
      pinEls.forEach((b) => b.classList.toggle('is-active', b === btn));
    };
    const reset = () => {
      const held = pinEls.find((b) => b.getAttribute('aria-pressed') === 'true');
      if (held) held._show(); else { idle(); pinEls.forEach((b) => b.classList.remove('is-active')); }
    };
    btn._show = show;
    btn.addEventListener('pointerenter', show);
    btn.addEventListener('focus', show);
    btn.addEventListener('pointerleave', reset);
    btn.addEventListener('blur', reset);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      pinEls.forEach((b) => b.setAttribute('aria-pressed', String(on && b === btn)));
      if (on) show(); else reset();
    });
    li.append(btn);
    return { li, btn };
  }).map(({ li, btn }, i) => {
    // Left side top to bottom is 1..8; right side top to bottom is 16..9
    if (i < 8) chip.querySelector('.chip__pins--left').append(li);
    return btn;
  });
  const right = chip.querySelector('.chip__pins--right');
  for (let i = 15; i >= 8; i--) right.append(pinEls[i].parentElement);
  idle();
}

// ---------- Now strip: latest public GitHub activity ----------
const ghSlot = document.querySelector('[data-github]');
if (ghSlot) {
  const USER = 'source-shrabya';
  const ago = (date) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const s = (new Date(date) - Date.now()) / 1000;
    for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
    }
    return 'just now';
  };
  const show = (ev) => {
    if (!ev) return;
    const repo = ev.repo.name;
    const verb = ev.type === 'PushEvent' ? 'pushed to' : 'active in';
    ghSlot.querySelector('dd').innerHTML =
      `${verb} <a href="https://github.com/${repo}" target="_blank" rel="noopener">${repo.split('/')[1]}</a>, ${ago(ev.created_at)}`;
    ghSlot.hidden = false;
  };
  // Cache for 10 minutes; unauthenticated GitHub API calls are rate limited
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem('gh-event')); } catch (e) {}
  if (cached && Date.now() - cached.at < 600000) show(cached.ev);
  else {
    fetch(`https://api.github.com/users/${USER}/events/public?per_page=30`)
      .then((r) => (r.ok ? r.json() : []))
      .then((events) => {
        const ev = events.find((e) => e.type === 'PushEvent') || events[0];
        if (!ev) return;
        const slim = { type: ev.type, repo: ev.repo, created_at: ev.created_at };
        try { sessionStorage.setItem('gh-event', JSON.stringify({ at: Date.now(), ev: slim })); } catch (e) {}
        show(slim);
      })
      .catch(() => {});   // no network or rate limited: the line just stays hidden
  }
}

// ---------- Hiking map: contour lines around the Kathmandu valley ----------
const hikes = document.querySelector('[data-hikes]');
if (hikes) {
  // Approximate summit coordinates and elevations
  const HOME = { name: 'Kathmandu', lat: 27.7172, lon: 85.3240, elev: 1400 };
  const PEAKS = [
    { name: 'Shivapuri', lat: 27.8167, lon: 85.3867, elev: 2732, note: 'The high point of the northern rim, inside Shivapuri Nagarjun National Park.' },
    { name: 'Nagarkot', lat: 27.7156, lon: 85.5206, elev: 2195, note: 'On the eastern rim, best known for sunrise over the Himalaya.', side: 'left' },
    { name: 'Phulchoki', lat: 27.5706, lon: 85.4036, elev: 2782, note: 'The highest hill around the valley, on the southeastern rim.' },
    { name: 'Chandragiri', lat: 27.6536, lon: 85.2008, elev: 2551, note: 'On the southwestern rim, looking back across the whole valley.' },
  ];

  const W = 744, H = 620, K = 2000, LON0 = 85.15, LAT1 = 27.85;
  const px = (p) => [(p.lon - LON0) * K * Math.cos(27.7 * Math.PI / 180), (LAT1 - p.lat) * K];

  // A made-up but plausible height field: a bowl for the valley, a bump for each summit, a little noise
  const [cx, cy] = px({ lat: 27.70, lon: 85.33 });
  const smooth = (t) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
  const base = (x, y) => 1300 + 650 * smooth((Math.hypot(x - cx, (y - cy) * 1.15) - 150) / 230)
    + 45 * Math.sin(x / 37) * Math.cos(y / 53) + 30 * Math.sin((x + y) / 29);
  const bumps = PEAKS.map((p) => { const [x, y] = px(p); return { x, y, h: p.elev - base(x, y) }; });
  const height = (x, y) => bumps.reduce((h, b) => h + b.h * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / 9800), base(x, y));

  // Marching squares: one path of line segments per contour level
  const STEP = 6, nx = Math.ceil(W / STEP) + 1, ny = Math.ceil(H / STEP) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = height(i * STEP, j * STEP);
  const CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
    [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
  const contour = (L) => {
    let d = '';
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], e = v[(j + 1) * nx + i];
      const k = (a > L) << 3 | (b > L) << 2 | (c > L) << 1 | (e > L);
      if (!k || k === 15) continue;
      const x0 = i * STEP, y0 = j * STEP, t = (p, q) => (L - p) / (q - p) * STEP;
      const edge = [[x0 + t(a, b), y0], [x0 + STEP, y0 + t(b, c)], [x0 + t(e, c), y0 + STEP], [x0, y0 + t(a, e)]];
      for (const [m, n] of CASES[k]) d += `M${edge[m][0].toFixed(1)} ${edge[m][1].toFixed(1)}L${edge[n][0].toFixed(1)} ${edge[n][1].toFixed(1)}`;
    }
    return d;
  };
  const NS = 'http://www.w3.org/2000/svg';
  const g = hikes.querySelector('.hikes__contours');
  for (let L = 1400; L <= 2700; L += 100) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', contour(L));
    if (L % 500 === 0) path.classList.add('is-index');
    g.append(path);
  }

  // Markers: the city, then a button for each summit
  const map = hikes.querySelector('.hikes__map');
  const at = (el, p) => { const [x, y] = px(p); el.style.left = `${x / W * 100}%`; el.style.top = `${y / H * 100}%`; };
  const home = document.createElement('span');
  home.className = 'hikes__home';
  home.innerHTML = '<i></i>Kathmandu';
  at(home, HOME);
  map.append(home);

  const R = 6371, rad = (d) => d * Math.PI / 180;
  const distance = (p) => {
    const a = Math.sin(rad(p.lat - HOME.lat) / 2) ** 2 + Math.cos(rad(HOME.lat)) * Math.cos(rad(p.lat)) * Math.sin(rad(p.lon - HOME.lon) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  const bearing = (p) => {
    const y = Math.sin(rad(p.lon - HOME.lon)) * Math.cos(rad(p.lat));
    const x = Math.cos(rad(HOME.lat)) * Math.sin(rad(p.lat)) - Math.sin(rad(HOME.lat)) * Math.cos(rad(p.lat)) * Math.cos(rad(p.lon - HOME.lon));
    const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(deg / 45) % 8];
  };

  const card = hikes.querySelector('.hikes__card');
  const trail = hikes.querySelector('.hikes__trail');
  const fmtM = (m) => `${m.toLocaleString('en-US')} m`;
  const showIntro = () => {
    const top = PEAKS.reduce((a, b) => (b.elev > a.elev ? b : a));
    card.innerHTML = `<p class="hikes__eyebrow">The valley rim</p><h4>${PEAKS.length} hills, one city in the middle</h4>
      <p>The valley floor sits around ${fmtM(HOME.elev)}. The highest of these, ${top.name}, climbs to ${fmtM(top.elev)}.</p>`;
  };
  const buttons = PEAKS.map((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hikes__peak' + (p.side === 'left' ? ' is-left' : '');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 12 10"><path d="M6 0 12 10H0z"/></svg><span>${p.name}<small>${fmtM(p.elev)}</small></span>`;
    at(btn, p);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(on && b === btn)));
      if (!on) { showIntro(); trail.classList.remove('is-walking'); return; }
      const [x1, y1] = px(HOME), [x2, y2] = px(p);
      // Bend the trail a little so it reads as a path rather than a ruler line
      const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18, my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
      trail.setAttribute('d', `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`);
      trail.classList.remove('is-walking'); void trail.getBoundingClientRect(); trail.classList.add('is-walking');
      card.innerHTML = `<p class="hikes__eyebrow">${distance(p).toFixed(1)} km ${bearing(p)} of Kathmandu</p>
        <h4>${p.name}</h4><p class="hikes__elev">${fmtM(p.elev)}, about ${fmtM(Math.round((p.elev - HOME.elev) / 10) * 10)} above the city</p><p>${p.note}</p>`;
    });
    map.append(btn);
    return btn;
  });
  showIntro();

  // Contours spread out from the city the first time the map scrolls into view
  const reveal = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { hikes.classList.add('is-drawn'); reveal.disconnect(); }
  }, { threshold: 0.25 });
  reveal.observe(map);
}

// ---------- Oscilloscope trace behind the intro ----------
// Flat when nothing happens. Moving the mouse puts energy into the signal:
// speed sets the amplitude, height in the intro sets the frequency.
const scope = document.querySelector('.scope');
if (scope) {
  const intro = scope.parentElement;
  const ctx = scope.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none)');   // no cursor: run a slow idle wave instead
  let w = 0, h = 0, dpr = 1, baseY = 0, colors = {};
  let energy = 0, freq = 4, targetFreq = 4, phase = 0;
  let running = false, visible = false, last = 0, prev = null;

  // Light: faint ink on a pale grid. Dark: glowing phosphor green. In between: a blend.
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = ([r, g, b, a]) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a.toFixed(2)})`;
  const readColors = () => {
    const t = brightness();
    const cs = getComputedStyle(root);
    const tb = parseFloat(cs.getPropertyValue('--tb')) || 0, m = parseFloat(cs.getPropertyValue('--m')) || 0;
    const grid = mix([214, 220, 229, .6], [40, 53, 75, .5], tb);
    grid[3] *= 1 - .6 * m;   // the grid shows up more on the grey middle backgrounds, so fade it there
    colors = {
      trace: rgba(mix([15, 27, 45, .3], [98, 207, 128, .6], t)),
      grid: rgba(grid),
      glow: 10 * t * t,   // the glow only really shows up near the dark end
    };
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Graticule, lined up so one horizontal division sits on the trace
    const DIV = 48;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (w / 2) % DIV; x < w; x += DIV) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
    for (let y = baseY % DIV; y < h; y += DIV) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();

    const idle = reduce.matches ? 5 : touch.matches ? 7 : 1.5;
    const amp = idle + energy * 42;
    const k = (freq * 2 * Math.PI) / w;
    ctx.strokeStyle = colors.trace;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = colors.trace;
    ctx.shadowBlur = colors.glow;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = baseY - amp * (Math.sin(k * x - phase) + .35 * Math.sin(2.7 * k * x - phase * 1.6)) / 1.35;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    energy *= Math.exp(-dt * 1.8);
    freq += (targetFreq - freq) * Math.min(dt * 4, 1);
    phase += dt * (touch.matches ? 1.2 : 2 + energy * 14);
    draw();
    if (visible && (touch.matches || energy > .005)) requestAnimationFrame(frame);
    else { running = false; energy = 0; draw(); }
  };
  const start = () => {
    if (running || !visible || reduce.matches) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    w = scope.clientWidth; h = scope.clientHeight;
    scope.width = Math.round(w * dpr); scope.height = Math.round(h * dpr);
    const name = intro.querySelector('h1').getBoundingClientRect();
    baseY = name.top - intro.getBoundingClientRect().top + name.height / 2;   // trace runs through the name
    draw();
  };

  window.addEventListener('pointermove', (e) => {
    if (!visible || e.pointerType !== 'mouse') return;
    const t = performance.now();
    if (prev) {
      const speed = Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / Math.max(t - prev.t, 1);   // px per ms
      energy = Math.min(1, energy + speed * .012);
    }
    prev = { x: e.clientX, y: e.clientY, t };
    const r = intro.getBoundingClientRect();
    targetFreq = 2 + 8 * Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    start();
  }, { passive: true });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && touch.matches) start();
  }).observe(intro);

  // Follow the brightness fader and system theme changes
  const recolor = () => { readColors(); draw(); };
  root.addEventListener('brightness', recolor);
  reduce.addEventListener('change', recolor);

  readColors();
  new ResizeObserver(resize).observe(intro);
  document.fonts?.ready.then(resize);
}
