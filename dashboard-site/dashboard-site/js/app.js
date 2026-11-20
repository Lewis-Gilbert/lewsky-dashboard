(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ================= Theme, accent, time-of-day background ================= */
  const TOD = {
    light: [[0,'#C5CEE6'],[5,'#C5CEE6'],[6.5,'#FFD7C0'],[8.5,'#D6EAF8'],[16,'#D6EAF8'],[17.8,'#F9D3AE'],[19.3,'#D2C4E4'],[21,'#C5CEE6'],[24,'#C5CEE6']],
    dark:  [[0,'#141C3D'],[5,'#141C3D'],[6.5,'#3B2535'],[8.5,'#133149'],[16,'#133149'],[17.8,'#3E2D3C'],[19.3,'#2E2850'],[21,'#141C3D'],[24,'#141C3D']]
  };
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function todColor(theme, hour) {
    const k = TOD[theme];
    for (let i = 0; i < k.length - 1; i++) {
      const [h0, c0] = k[i], [h1, c1] = k[i + 1];
      if (hour >= h0 && hour <= h1) {
        const t = (hour - h0) / (h1 - h0), a = hexRgb(c0), b = hexRgb(c1);
        return 'rgb(' + a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',') + ')';
      }
    }
    return k[0][1];
  }
  function applyTod() {
    const d = new Date();
    root.style.setProperty('--tod', todColor(root.dataset.theme === 'dark' ? 'dark' : 'light', d.getHours() + d.getMinutes() / 60));
  }

  const themeBtn = $('#theme');
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    applyTod();
  }
  applyTheme(root.getAttribute('data-theme') || 'light');
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set('dash.theme', next);
  });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onMedia = (e) => { if (!store.get('dash.theme', null)) applyTheme(e.matches ? 'dark' : 'light'); };
  if (media.addEventListener) media.addEventListener('change', onMedia); else if (media.addListener) media.addListener(onMedia);

  const palBtn = $('#palBtn'), palMenu = $('#palMenu');
  const swatches = Array.from(palMenu.querySelectorAll('.swatch'));
  function markAccent(a) { swatches.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.accent === a))); }
  markAccent(root.getAttribute('data-accent') || 'teal');
  function setPal(open) { palMenu.hidden = !open; palBtn.setAttribute('aria-expanded', String(open)); }
  if (!store.get('dash.seenSettings', false) && !reduceMotion.matches) palBtn.classList.add('nudge');
  palBtn.addEventListener('click', () => { palBtn.classList.remove('nudge'); store.set('dash.seenSettings', true); setPal(palMenu.hidden); });
  swatches.forEach((s) => s.addEventListener('click', () => {
    const a = s.dataset.accent;
    if (a === 'teal') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', a);
    store.set('dash.accent', a === 'teal' ? null : a);
    markAccent(a);
    Sync.touch('prefs');
  }));
  document.addEventListener('click', (e) => { if (!palMenu.hidden && !palMenu.contains(e.target) && !palBtn.contains(e.target)) setPal(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !palMenu.hidden) { setPal(false); palBtn.focus(); } });

  /* ================= Clock + greeting ================= */
  const clockMain = $('#clockMain'), clockSec = $('#clockSec');
  const defaultIs12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false;
  let h12Pref = store.get('dash.h12', null);
  const use12 = () => (h12Pref === null ? defaultIs12 : !!h12Pref);
  let timeFmt;
  const makeTimeFmt = () => { timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' }); };
  makeTimeFmt();
  let lastMinute = -1, lastDay = '', iconsReady = false;
  const cleanName = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 30);
  let userName = cleanName(store.get('dash.name', ''));
  function setGreetIcon(h) { const g = $('#greetIco'); if (g) g.innerHTML = svgIcon(h >= 6 && h < 18 ? 'clear' : 'night'); }
  function tick() {
    const d = new Date();
    const parts = timeFmt.formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
    clockMain.textContent = get('hour') + ':' + get('minute');
    const period = get('dayPeriod');
    clockSec.textContent = ':' + pad(d.getSeconds()) + (period ? ' ' + period : '');
    if (d.getMinutes() !== lastMinute) {
      lastMinute = d.getMinutes();
      const h = d.getHours();
      const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      $('#greeting').textContent = userName ? part + ', ' + userName : part;
      $('#welcomeTime').textContent = part;
      if (iconsReady) setGreetIcon(h);
      $('#today').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
      applyTod();
      const day = ymd(d);
      if (lastDay && day !== lastDay && typeof renderTasks === 'function') renderTasks();
      lastDay = day;
    }
  }
  tick();
  setInterval(tick, 1000);

  /* ================= Weather ================= */
  const rays = (cx, cy, r1, r2) => Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    return '<line x1="' + (cx + c * r1).toFixed(1) + '" y1="' + (cy + s * r1).toFixed(1) + '" x2="' + (cx + c * r2).toFixed(1) + '" y2="' + (cy + s * r2).toFixed(1) + '"/>';
  }).join('');
  const SUN = (tf) => '<g transform="' + tf + '"><g class="rays" stroke="#FFD25A" stroke-width="4" stroke-linecap="round">' + rays(32, 32, 19, 27) + '</g><circle class="core" cx="32" cy="32" r="11.5" fill="#FFC72E"/><circle cx="28" cy="28" r="4" fill="#FFE9A3" opacity=".9"/></g>';
  const CLOUD_D = 'M19 47h27a10.5 10.5 0 0 0 1.5-20.9A14.5 14.5 0 0 0 19.6 29 9 9 0 0 0 19 47z';
  const CLOUD = (fill, tf, cls) => '<g transform="' + (tf || '') + '"><g class="cl ' + (cls || '') + '"><path d="' + CLOUD_D + '" fill="' + fill + '"/><path d="M23 41h21" stroke="rgba(110,140,190,.28)" stroke-width="3" stroke-linecap="round" fill="none"/></g></g>';
  const MOON = (tf) => '<g transform="' + tf + '"><path class="moon" d="M38 10A22 22 0 1 0 54 44 17 17 0 0 1 38 10z" fill="#FFF0B3"/></g>';
  const STARS = '<g fill="#fff"><circle class="star" cx="52" cy="14" r="1.9"/><circle class="star s2" cx="58" cy="30" r="1.5"/><circle class="star s3" cx="12" cy="54" r="1.7"/></g>';
  const ICONS = {
    clear: SUN(''),
    night: MOON('') + STARS,
    partly: SUN('translate(-2 -2) scale(.75)') + CLOUD('#FFFFFF', 'translate(8 8) scale(.85)'),
    nightpartly: MOON('translate(-6 -6) scale(.72)') + CLOUD('#FFFFFF', 'translate(8 8) scale(.85)'),
    cloud: CLOUD('rgba(255,255,255,.72)', 'translate(-7 -9) scale(.78)', 'cl2') + CLOUD('#FFFFFF', 'translate(3 3)'),
    fog: '<g fill="#fff"><rect class="fg" x="12" y="20" width="40" height="5" rx="2.5"/><rect class="fg g2" x="8" y="30" width="44" height="5" rx="2.5" opacity=".8"/><rect class="fg g3" x="16" y="40" width="36" height="5" rx="2.5" opacity=".9"/></g>',
    rain: CLOUD('#E6ECF9', 'translate(0 -8)') + '<g stroke="#7CC8FF" stroke-width="3.2" stroke-linecap="round"><path class="drop" d="M24 46l-2 5"/><path class="drop d2" d="M33 47l-2 5"/><path class="drop d3" d="M42 46l-2 5"/></g>',
    snow: CLOUD('#F2F6FF', 'translate(0 -8)') + '<g fill="#fff"><circle class="flake" cx="24" cy="47" r="2.2"/><circle class="flake f2" cx="33" cy="49" r="2.2"/><circle class="flake f3" cx="42" cy="47" r="2.2"/><circle class="flake f4" cx="28" cy="52" r="1.8"/></g>',
    storm: CLOUD('#BAC2DE', 'translate(0 -8)') + '<path class="bolt" d="M35 35l-8 12h6l-3 10 11-14h-6l4-8z" fill="#FFD43B" stroke="#FFB400" stroke-width="1" stroke-linejoin="round"/>'
  };
  // returns [sky key, label, icon key]
  function describe(code, isDay) {
    const night = isDay === false || isDay === 0;
    let r;
    if (code === 0) r = ['clear', 'Clear sky'];
    else if (code === 1) r = ['clear', 'Mostly clear'];
    else if (code === 2) r = ['partly', 'Partly cloudy'];
    else if (code === 3) r = ['cloud', 'Overcast'];
    else if (code === 45 || code === 48) r = ['fog', 'Fog'];
    else if (code >= 51 && code <= 57) r = ['rain', 'Drizzle'];
    else if (code >= 61 && code <= 67) r = ['rain', 'Rain'];
    else if (code >= 71 && code <= 77) r = ['snow', 'Snow'];
    else if (code >= 80 && code <= 82) r = ['rain', 'Rain showers'];
    else if (code === 85 || code === 86) r = ['snow', 'Snow showers'];
    else if (code >= 95) r = ['storm', 'Thunderstorm'];
    else r = ['cloud', 'Cloudy'];
    let icon = r[0];
    if (night && icon === 'clear') icon = 'night';
    if (night && icon === 'partly') icon = 'nightpartly';
    return [r[0], r[1], icon];
  }
  const svgIcon = (k) => '<svg class="wi wi-' + k + '" viewBox="0 0 64 64" aria-hidden="true">' + ICONS[k] + '</svg>';
  iconsReady = true; setGreetIcon(new Date().getHours());
  const welcomeIco = () => { const h = new Date().getHours(); $('#welcomeIco').innerHTML = svgIcon(h >= 6 && h < 18 ? 'clear' : 'night'); };
  welcomeIco();

  /* ----- animated sky ----- */
  const Scene = (function () {
    const canvas = $('#fx');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return { set() {} };
    const SCENES = {
      clear:  { sun: 1,  clouds: 2,  tone: '255,255,255', ca: .35 },
      partly: { sun: .7, clouds: 6,  tone: '255,255,255', ca: .55 },
      cloud:  { clouds: 9, tone: '225,232,240', ca: .6 },
      fog:    { fog: 1, clouds: 4, tone: '230,235,240', ca: .4 },
      rain:   { clouds: 9, tone: '170,185,200', ca: .6, rain: 130 },
      snow:   { clouds: 6, tone: '225,232,240', ca: .5, snow: 80 },
      storm:  { clouds: 10, tone: '120,125,150', ca: .7, rain: 190, bolt: 1 }
    };
    const sprites = {};
    function cloudSprite(rgb) {
      if (sprites[rgb]) return sprites[rgb];
      const c = document.createElement('canvas'); c.width = 320; c.height = 160;
      const x = c.getContext('2d');
      [[160,95,62],[110,105,48],[212,105,50],[145,70,45],[190,78,40],[75,112,34],[250,114,30]].forEach(([cx, cy, r]) => {
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(' + rgb + ',.9)'); g.addColorStop(.6, 'rgba(' + rgb + ',.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
      });
      return (sprites[rgb] = c);
    }
    const moon = (function () {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(252,250,235,.95)'; x.beginPath(); x.arc(32, 32, 22, 0, 6.2832); x.fill();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.arc(41, 26, 19, 0, 6.2832); x.fill();
      return c;
    })();

    let w = 0, h = 0, cfg = null, P = {}, raf = 0, last = 0, t = 0, visible = true, flash = 0, nextBolt = 5;
    const rnd = Math.random;

    function build() {
      P = { clouds: [], rain: [], snow: [], stars: [] };
      if (!cfg || !w) return;
      for (let i = 0; i < (cfg.clouds || 0); i++) {
        const s = .6 + rnd() * 1.1;
        P.clouds.push({ x: rnd() * (w + 400) - 250, y: rnd() * h * .65 - 20, s, v: (5 + rnd() * 12) * s, a: cfg.ca * (.5 + rnd() * .5) });
      }
      for (let i = 0; i < (cfg.rain || 0); i++) P.rain.push({ x: rnd() * (w + 100), y: rnd() * h, l: 10 + rnd() * 14, v: 520 + rnd() * 340 });
      for (let i = 0; i < (cfg.snow || 0); i++) P.snow.push({ x: rnd() * w, y: rnd() * h, r: 1 + rnd() * 2.2, v: 20 + rnd() * 35, ph: rnd() * 6.28, amp: 8 + rnd() * 18 });
      for (let i = 0; i < (cfg.stars || 0); i++) P.stars.push({ x: rnd() * w, y: rnd() * h * .8, r: .3 + rnd() * 1.2, ph: rnd() * 6.28, sp: .8 + rnd() * 1.8 });
    }
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = Math.round(r.width), nh = Math.round(r.height);
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build(); draw();
    }
    function update(dt) {
      P.clouds.forEach((c) => { c.x += c.v * dt; if (c.x > w + 20) c.x = -320 * c.s; });
      P.rain.forEach((d) => { d.y += d.v * dt; d.x -= d.v * .18 * dt; if (d.y > h + 20) { d.y = -20; d.x = rnd() * (w + 100); } });
      P.snow.forEach((f) => { f.y += f.v * dt; if (f.y > h + 5) { f.y = -5; f.x = rnd() * w; } });
      if (cfg.bolt) {
        if (flash > 0) flash = Math.max(0, flash - dt * 3.5);
        nextBolt -= dt;
        if (nextBolt <= 0) { flash = 1; nextBolt = 4 + rnd() * 7; }
      }
    }
    function draw() {
      if (!cfg || !w) return;
      ctx.clearRect(0, 0, w, h);
      // stars
      P.stars.forEach((s) => {
        ctx.globalAlpha = .45 + .5 * Math.sin(t * s.sp + s.ph) * .5 + .05;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // Wide layout: sun/moon sits in the empty lower-left of the hero. Narrow layout: top right.
      const wide = w > 900;
      const cx = wide ? w * .2 : w * .84, cy = wide ? h * .8 : 64;
      if (cfg.sun) {
        const R = Math.min(Math.max(w, h), 760) * .55 * (1 + .03 * Math.sin(t * .5)), i = cfg.sun;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, 'rgba(255,236,170,' + (.75 * i) + ')'); g.addColorStop(.22, 'rgba(255,214,120,' + (.32 * i) + ')'); g.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,248,215,' + (.95 * i) + ')'; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 6.2832); ctx.fill();
      }
      if (cfg.moon) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130);
        g.addColorStop(0, 'rgba(190,210,255,.28)'); g.addColorStop(1, 'rgba(190,210,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(moon, cx - 32, cy - 32);
      }
      if (cfg.fog) {
        const sp = cloudSprite(cfg.tone);
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = .22;
          ctx.drawImage(sp, -200 + Math.sin(t * .12 + i * 2) * 70, h * (.25 + i * .22), w + 400, h * .38);
        }
      }
      P.clouds.forEach((c) => { ctx.globalAlpha = c.a; ctx.drawImage(cloudSprite(cfg.tone), c.x, c.y, 320 * c.s, 160 * c.s); });
      ctx.globalAlpha = 1;
      if (P.rain.length) {
        ctx.strokeStyle = 'rgba(215,232,255,.42)'; ctx.lineWidth = 1.2; ctx.beginPath();
        P.rain.forEach((d) => { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * .18, d.y + d.l); });
        ctx.stroke();
      }
      if (P.snow.length) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        P.snow.forEach((f) => { ctx.beginPath(); ctx.arc(f.x + Math.sin(t * .8 + f.ph) * f.amp, f.y, f.r, 0, 6.2832); ctx.fill(); });
      }
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * .35) + ')'; ctx.fillRect(0, 0, w, h); }
    }
    function frame(ts) {
      raf = 0;
      if (!cfg || reduceMotion.matches || !visible || document.hidden) return;
      const dt = Math.min((ts - last) / 1000 || 0, .05); last = ts; t += dt;
      update(dt); draw();
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (raf || reduceMotion.matches || !visible || document.hidden) return;
      last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function set(sky, isDay) {
      cfg = Object.assign({}, SCENES[sky] || SCENES.clear);
      if (!isDay) {
        cfg.sun = 0;
        if (sky === 'clear' || sky === 'partly') { cfg.stars = sky === 'clear' ? 110 : 50; cfg.moon = 1; }
        cfg.tone = sky === 'storm' ? '90,95,125' : '150,165,195';
        cfg.ca *= .6;
      }
      flash = 0; nextBolt = 3;
      resize(); build(); draw(); start();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement); else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) start(); }).observe(canvas);
    document.addEventListener('visibilitychange', start);
    const rm = () => { if (reduceMotion.matches) { cancelAnimationFrame(raf); raf = 0; draw(); } else start(); };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', rm);
    return { set };
  })();

  let lastRender = null, animateNext = true, countId = 0;
  function countTo(node, target, suffix, animate) {
    const id = ++countId;
    if (!animate || reduceMotion.matches) { node.innerHTML = target + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      if (id !== countId) return;
      const p = Math.min((now - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3);
      node.innerHTML = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    node.innerHTML = '0' + suffix;
    requestAnimationFrame(step);
  }
  const el = {
    sky: $('#sky'), placeName: $('#placeName'), status: $('#status'), now: $('#now'),
    nowIcon: $('#nowIcon'), temp: $('#temp'), cond: $('#cond'), meta: $('#meta'), sun: $('#sun'),
    forecast: $('#forecast'), days: $('#days'), hours: $('#hours'), updated: $('#updated'),
    search: $('#search'), q: $('#q'), changeCity: $('#changeCity'), useGps: $('#useGps'),
    alert: $('#alert'), alertText: $('#alertText')
  };

  let retryFn = null;
  function setStatus(msg, isError, retry) {
    el.status.textContent = msg || '';
    el.status.className = 'status' + (isError ? ' error' : '');
    el.status.hidden = !msg;
    retryFn = retry || null;
    $('#retryBtn').hidden = !retryFn;
    el.sky.classList.toggle('is-empty', !!msg && el.now.hidden);
  }
  $('#retryBtn').addEventListener('click', () => { if (retryFn) retryFn(); });
  function hideWeather() {
    el.now.hidden = true; el.forecast.hidden = true; el.sun.hidden = true;
    el.meta.innerHTML = ''; el.updated.textContent = ''; el.alert.hidden = true;
  }
  function showSearch(show) {
    el.search.hidden = !show;
    el.changeCity.setAttribute('aria-expanded', String(show));
    if (show) el.q.focus();
  }
  let unit = store.get('dash.units', 'c') === 'f' ? 'f' : 'c';
  const cv = (c) => (unit === 'f' ? c * 9 / 5 + 32 : c);
  const fmtTemp = (n) => Math.round(cv(n));
  const wind = (kmh) => (unit === 'f' ? Math.round(kmh * 0.621371) + ' mph' : Math.round(kmh) + ' km/h');
  const fmtHour = (hh) => (use12() ? new Date(2000, 0, 1, hh).toLocaleTimeString([], { hour: 'numeric', hourCycle: 'h12' }) : pad(hh) + ':00');
  function fmtIso(iso) {
    const m = /T(\d\d):(\d\d)/.exec(iso || '');
    return m ? new Date(2000, 0, 1, +m[1], +m[2]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' }) : '';
  }

  function buildAlerts(data, start) {
    const h = data.hourly, out = [];
    if (!h) return out;
    const n = h.time.length;
    let rain = -1, storm = -1;
    for (let i = 0; i < 6 && start + i < n; i++) {
      const idx = start + i, code = h.weather_code[idx], pop = h.precipitation_probability ? h.precipitation_probability[idx] : 0;
      if (code >= 95 && storm < 0) storm = i;
      if ((pop >= 60 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) && rain < 0) rain = i;
    }
    const when = (i) => i === 0 ? 'right now' : 'around ' + fmtHour(+h.time[start + i].slice(11, 13));
    if (storm >= 0) out.push('Thunderstorms are possible ' + when(storm) + '. Plan to stay indoors.');
    else if (rain >= 0) out.push('Rain is likely ' + when(rain) + '. Take an umbrella.');
    let maxT = -99, minT = 99, maxW = 0;
    for (let i = 0; i < 12 && start + i < n; i++) {
      maxT = Math.max(maxT, h.temperature_2m[start + i]);
      minT = Math.min(minT, h.temperature_2m[start + i]);
      if (h.wind_speed_10m) maxW = Math.max(maxW, h.wind_speed_10m[start + i]);
    }
    if (maxT >= 35) out.push('It will be hot today, up to ' + fmtTemp(maxT) + '°' + unit.toUpperCase() + '. Drink water and limit time in direct sun.');
    if (minT <= 0) out.push('Temperatures will drop to ' + fmtTemp(minT) + '°' + unit.toUpperCase() + '. Watch for ice.');
    if (maxW >= 50) out.push('Strong winds are expected, up to ' + wind(maxW) + '.');
    return out.slice(0, 2);
  }

  function render(place, data) {
    lastRender = { place, data };
    const animate = animateNext; animateNext = false;
    Radar.setCenter(place.lat, place.lon);
    const cur = data.current, d = data.daily, hr = data.hourly;
    const isDay = cur.is_day === 1;
    const info = describe(cur.weather_code, isDay);

    el.placeName.textContent = place.name;
    el.sky.setAttribute('data-sky', info[0]);
    el.sky.setAttribute('data-night', isDay ? '0' : '1');
    // Golden hour: clear-ish skies near sunrise or sunset turn warm
    const hm = (s) => { const m = /T(\d\d):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
    const nowM = hm(cur.time), srM = d.sunrise ? hm(d.sunrise[0]) : null, ssM = d.sunset ? hm(d.sunset[0]) : null;
    const golden = isDay && (info[0] === 'clear' || info[0] === 'partly') && nowM !== null &&
      ((srM !== null && Math.abs(nowM - srM) <= 50) || (ssM !== null && Math.abs(nowM - ssM) <= 50));
    el.sky.setAttribute('data-golden', golden ? '1' : '0');
    Scene.set(info[0], isDay);
    el.nowIcon.innerHTML = svgIcon(info[2]);
    countTo(el.temp, fmtTemp(cur.temperature_2m), '<sup>°' + unit.toUpperCase() + '</sup>', animate);
    el.cond.textContent = info[1];

    el.meta.innerHTML = '';
    ['Feels like ' + fmtTemp(cur.apparent_temperature) + '°', 'Humidity ' + Math.round(cur.relative_humidity_2m) + '%', 'Wind ' + wind(cur.wind_speed_10m)]
      .forEach((t, i) => { const li = document.createElement('li'); li.textContent = t; li.style.setProperty('--i', i); el.meta.appendChild(li); });

    if (d.sunrise && d.sunset) {
      $('#sunrise').textContent = fmtIso(d.sunrise[0]);
      $('#sunset').textContent = fmtIso(d.sunset[0]);
      el.sun.hidden = false;
    }

    // Hourly strip
    let start = 0;
    el.hours.innerHTML = '';
    if (hr && hr.time) {
      const key = (cur.time || '').slice(0, 13);
      start = Math.max(0, hr.time.findIndex((t) => t.slice(0, 13) === key));
      for (let i = 0; i < 24 && start + i < hr.time.length; i++) {
        const idx = start + i, hh = +hr.time[idx].slice(11, 13);
        const di = describe(hr.weather_code[idx], hr.is_day ? hr.is_day[idx] === 1 : true);
        const pop = hr.precipitation_probability ? hr.precipitation_probability[idx] : null;
        const li = document.createElement('li');
        if (i === 0) li.className = 'now-h';
        li.style.setProperty('--i', i);
        li.innerHTML = '<span class="t"></span>' + svgIcon(di[2]) + '<span class="v"></span><span class="r"></span>';
        li.querySelector('.t').textContent = i === 0 ? 'Now' : fmtHour(hh);
        li.querySelector('.v').textContent = fmtTemp(i === 0 ? cur.temperature_2m : hr.temperature_2m[idx]) + '°';
        li.querySelector('.r').textContent = pop != null && pop >= 20 ? pop + '%' : '';
        li.setAttribute('aria-label', (i === 0 ? 'Now' : fmtHour(hh)) + ': ' + di[1] + ', ' + fmtTemp(i === 0 ? cur.temperature_2m : hr.temperature_2m[idx]) + ' degrees' + (pop != null && pop >= 20 ? ', ' + pop + ' percent chance of rain' : ''));
        el.hours.appendChild(li);
      }
      el.hours.scrollLeft = 0;
    }

    // 7-day
    const min = Math.min.apply(null, d.temperature_2m_min), max = Math.max.apply(null, d.temperature_2m_max), span = Math.max(max - min, 1);
    el.days.innerHTML = '';
    d.time.forEach((t, i) => {
      const di = describe(d.weather_code[i], true);
      const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
      let left = ((lo - min) / span) * 100;
      const width = Math.max(((hi - lo) / span) * 100, 8);
      if (left + width > 100) left = 100 - width;
      const name = i === 0 ? 'Today' : new Date(t + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
      const pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      const row = document.createElement('div');
      row.className = 'day';
      row.style.setProperty('--i', i);
      row.innerHTML = '<span class="n"></span>' + svgIcon(di[2]) + '<span class="rain"></span><span class="lo"></span>' +
        '<div class="range" aria-hidden="true"><span style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%"></span></div><span class="hi"></span>';
      row.querySelector('.n').textContent = name;
      row.querySelector('.rain').textContent = pop == null ? '' : pop + '%';
      row.querySelector('.lo').textContent = fmtTemp(lo) + '°';
      row.querySelector('.hi').textContent = fmtTemp(hi) + '°';
      row.setAttribute('aria-label', name + ': ' + di[1] + ', low ' + fmtTemp(lo) + ', high ' + fmtTemp(hi) + (pop == null ? '' : ', ' + pop + ' percent chance of rain'));
      el.days.appendChild(row);
    });

    // Alerts
    const alerts = buildAlerts(data, start);
    el.alertText.innerHTML = '';
    alerts.forEach((a) => { const p = document.createElement('p'); p.textContent = a; el.alertText.appendChild(p); });
    el.alert.hidden = alerts.length === 0;

    el.now.hidden = false;
    el.forecast.hidden = false;
    el.sky.classList.remove('is-empty');
    const hb = $('#heroBody');
    hb.classList.remove('enter');
    if (animate && !reduceMotion.matches) { void hb.offsetWidth; hb.classList.add('enter'); }
    el.updated.textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' }) + '. Weather data from Open-Meteo.';
    setStatus('');
  }
  $('#alertX').addEventListener('click', () => { el.alert.hidden = true; });

  const getPosition = () => new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject({ code: 0 }); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 });
  });
  function gpsMessage(err) {
    const c = err && err.code;
    if (c === 1) return 'Location access is blocked. Search for a city instead, or allow location in your browser settings and choose Use my location.';
    if (c === 2) return 'Your device could not work out its location. Search for a city instead.';
    if (c === 3) return 'Finding your location took too long. Try again, or search for a city.';
    return 'Location is not available in this browser. Search for a city instead.';
  }
  const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); });
  // One automatic retry for busy or flaky responses (network errors, 429, 5xx)
  const fetchRetry = (url) => fetchJson(url).catch((e) => {
    if (e.status && e.status < 500 && e.status !== 429) throw e;
    return new Promise((res) => setTimeout(res, 1800)).then(() => fetchJson(url));
  });
  function failReason(e) {
    if (navigator.onLine === false) return 'You appear to be offline.';
    if (e && e.status === 429) return 'The weather service is busy right now. Wait a minute and try again.';
    if (e && e.status) return 'The weather service had a problem (error ' + e.status + ').';
    return 'The weather service did not answer. This can be your connection or a blocker on this browser.';
  }
  function reverseName(lat, lon) {
    return fetchJson('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=en')
      .then((d) => { const parts = [d.city || d.locality, d.principalSubdivision || d.countryName].filter(Boolean); return parts.length ? parts.join(', ') : 'Your location'; })
      .catch(() => 'Your location');
  }

  let loadId = 0;
  function loadWeather(place) {
    const id = ++loadId;
    animateNext = true;
    hideWeather();
    el.placeName.textContent = place.name;
    setStatus('Loading weather…');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      '&timezone=auto&forecast_days=7';
    return fetchRetry(url).then((data) => {
      if (id !== loadId) return;
      store.set('dash.wcache', { place, data, ts: Date.now() });
      render(place, data);
    }).catch((e) => {
      if (id !== loadId) return;
      const retry = () => loadWeather(place);
      const c = store.get('dash.wcache', null);
      if (c && c.data && c.place && Math.abs(c.place.lat - place.lat) < 0.1 && Math.abs(c.place.lon - place.lon) < 0.1) {
        render(place, c.data);
        const at = new Date(c.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' });
        setStatus('Showing saved weather from ' + at + '. ' + failReason(e), false, retry);
        el.updated.textContent = 'Saved copy. Weather data from Open-Meteo.';
      } else {
        setStatus('Weather is unavailable for ' + place.name + '. ' + failReason(e), true, retry);
      }
    });
  }

  function useGps() {
    hideWeather();
    el.placeName.textContent = 'Locating…';
    setStatus('Finding your location…');
    return getPosition().then((pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      return reverseName(lat, lon).then((name) => { showSearch(false); return loadWeather({ lat, lon, name }); });
    }, (err) => {
      const saved = store.get('dash.place', null);
      if (saved) {
        return loadWeather(saved).then(() => { if (!el.now.hidden) setStatus('Showing ' + saved.name + ' because your location could not be used.'); });
      }
      el.placeName.textContent = 'Choose a location';
      setStatus(gpsMessage(err), true);
      showSearch(true);
    });
  }
  el.useGps.addEventListener('click', useGps);
  el.changeCity.addEventListener('click', () => showSearch(el.search.hidden));
  el.search.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = el.q.value.trim();
    if (!q) return;
    setStatus('Searching for ' + q + '…');
    fetchJson('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(q))
      .then((r) => {
        if (!r.results || !r.results.length) { setStatus('No city found for “' + q + '”. Check the spelling or try a nearby larger city.', true); return; }
        const c = r.results[0];
        const place = { lat: c.latitude, lon: c.longitude, name: [c.name, c.admin1 || c.country].filter(Boolean).join(', ') };
        store.set('dash.place', place);
        showSearch(false); el.q.value = '';
        return loadWeather(place);
      })
      .catch((e) => setStatus('Search failed. ' + failReason(e), true, () => el.search.requestSubmit()));
  });
  useGps();

  /* ================= To-do ================= */
  const rawTasks = store.get('dash.tasks', []);
  let tasks = (Array.isArray(rawTasks) ? rawTasks : []).map((t) => ({ id: t.id, text: String(t.text || ''), done: !!t.done, due: t.due || '', pri: t.pri || 'none' }));
  const listEl = $('#tasks'), emptyEl = $('#empty'), footEl = $('#tasksFoot'), leftEl = $('#left'), clearBtn = $('#clearDone');
  const input = $('#newTask'), newDue = $('#newDue'), newPri = $('#newPri');
  document.querySelectorAll('.qd').forEach((b) => b.addEventListener('click', () => {
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.due));
    newDue.value = ymd(d); newDue.dispatchEvent(new Event('change'));
  }));
  newDue.addEventListener('click', () => { try { newDue.showPicker(); } catch (e) {} });
  const saveTasks = () => { store.set('dash.tasks', tasks); Sync.touch('tasks'); };
  const PRI = { high: 'High', med: 'Medium', low: 'Low' };

  function dueInfo(due, done) {
    if (!due) return null;
    const now = new Date(), today = ymd(now);
    const tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const [y, m, dd] = due.split('-').map(Number);
    const short = new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    if (due === today) return { text: 'Due today', cls: 'today' };
    if (due === ymd(tom)) return { text: 'Due tomorrow', cls: '' };
    if (due < today) return { text: done ? 'Was due ' + short : 'Overdue, ' + short, cls: done ? '' : 'overdue' };
    return { text: 'Due ' + short, cls: '' };
  }

  function renderRing() {
    const total = tasks.length, done = tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('#ringBar').setAttribute('stroke-dashoffset', String(169.65 * (1 - (total ? done / total : 0))));
    $('#ringText').textContent = pct + '%';
    document.querySelector('.ring-wrap').hidden = !total;
    $('#ringLabel').textContent = total ? done + ' of ' + total + ' done' : 'No tasks yet';
  }

  function moveTask(id, delta) {
    const i = tasks.findIndex((t) => t.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= tasks.length) return;
    const [t] = tasks.splice(i, 1); tasks.splice(j, 0, t);
    saveTasks(); renderTasks();
    const g = listEl.querySelector('[data-id="' + id + '"] .grip'); if (g) g.focus();
  }

  function startDrag(e, li) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    // Listen on the document, not the handle: moving the row in the DOM would otherwise drop pointer capture mid-drag.
    const handle = document;
    li.classList.add('dragging');
    const move = (ev) => {
      const y = ev.clientY;
      const sibs = Array.from(listEl.children).filter((x) => x !== li);
      let before = null;
      for (const s of sibs) { const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2) { before = s; break; } }
      if (before) { if (li.nextSibling !== before) listEl.insertBefore(li, before); }
      else if (listEl.lastChild !== li) listEl.appendChild(li);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      const order = Array.from(listEl.children).map((x) => Number(x.dataset.id));
      tasks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveTasks(); renderTasks();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function renderTasks() {
    listEl.innerHTML = '';
    tasks.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'task' + (t.done ? ' done' : '');
      li.dataset.id = t.id;

      const grip = document.createElement('button');
      grip.type = 'button'; grip.className = 'grip';
      grip.setAttribute('aria-label', 'Reorder: ' + t.text + '. Drag, or use the up and down arrow keys.');
      grip.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/><circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/><circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/></svg>';
      grip.addEventListener('pointerdown', (e) => startDrag(e, li));
      grip.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); moveTask(t.id, -1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveTask(t.id, 1); }
      });

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = 't' + t.id; cb.checked = t.done;
      cb.addEventListener('change', () => { t.done = cb.checked; saveTasks(); renderTasks(); });

      const body = document.createElement('div'); body.className = 'task-body';
      const lab = document.createElement('label'); lab.htmlFor = cb.id; lab.textContent = t.text;
      const tags = document.createElement('div'); tags.className = 'tags';
      const di = dueInfo(t.due, t.done);
      if (di) { const s = document.createElement('span'); s.className = 'tag ' + di.cls; s.textContent = di.text; tags.appendChild(s); }
      if (PRI[t.pri]) { const s = document.createElement('span'); s.className = 'tag p-' + t.pri; s.textContent = PRI[t.pri] + ' priority'; tags.appendChild(s); }
      body.appendChild(lab); body.appendChild(tags);

      const del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.setAttribute('aria-label', 'Delete task: ' + t.text);
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', () => { tasks = tasks.filter((x) => x.id !== t.id); saveTasks(); renderTasks(); input.focus(); });

      li.appendChild(grip); li.appendChild(cb); li.appendChild(body); li.appendChild(del);
      listEl.appendChild(li);
    });
    const open = tasks.filter((t) => !t.done).length, done = tasks.length - open;
    emptyEl.hidden = tasks.length > 0;
    footEl.hidden = tasks.length === 0;
    leftEl.textContent = open === 0 ? 'All done' : open + (open === 1 ? ' task left' : ' tasks left');
    clearBtn.hidden = done === 0;
    renderRing();
  }
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now() + Math.floor(Math.random() * 1000), text, done: false, due: newDue.value || '', pri: newPri.value });
    saveTasks(); renderTasks();
    input.value = ''; newDue.value = ''; newPri.value = 'none'; input.focus();
  });
  clearBtn.addEventListener('click', () => { tasks = tasks.filter((t) => !t.done); saveTasks(); renderTasks(); });
  renderTasks();

  /* ================= Focus timer ================= */
  const MODES = { focus: { sec: 25 * 60, label: 'Focus' }, short: { sec: 5 * 60, label: 'Short break' }, long: { sec: 15 * 60, label: 'Long break' } };
  const dialTime = $('#dialTime'), dialSub = $('#dialSub'), dialBar = $('#dialBar'), startBtn = $('#dialStart'), live = $('#focusLive');
  const modeBtns = Array.from(document.querySelectorAll('.modes button'));
  const baseTitle = document.title;
  let mode = 'focus', remaining = MODES.focus.sec * 1000, running = false, endAt = 0, timer = 0, audioCtx = null;
  const sessions = () => { const s = store.get('dash.sessions', {}); return s.date === ymd(new Date()) ? s.count : 0; };

  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
  function drawDial() {
    const total = MODES[mode].sec * 1000;
    dialTime.textContent = fmtClock(remaining);
    dialSub.textContent = MODES[mode].label + (running ? '' : remaining < total ? ' (paused)' : '');
    dialBar.setAttribute('stroke-dashoffset', String(339.29 * (1 - remaining / total)));
    startBtn.textContent = running ? 'Pause' : remaining < total ? 'Resume' : 'Start';
    const n = sessions();
    const sk = streak();
    $('#focusCount').textContent = (n ? n + (n === 1 ? ' focus session' : ' focus sessions') + ' finished today' : 'No focus sessions finished today yet.') + (sk > 1 ? ' · ' + sk + '-day streak' : '');
    document.title = running ? fmtClock(remaining) + ' · ' + MODES[mode].label : baseTitle;
    $('#focusCard').classList.toggle('running', running);
  }
  function setMode(m) {
    mode = m; running = false; clearInterval(timer);
    remaining = MODES[m].sec * 1000;
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    drawDial();
  }
  function beep() {
    try {
      if (!audioCtx) return;
      [0, .25, .5].forEach((d) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
        const t0 = audioCtx.currentTime + d;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .2);
        o.start(t0); o.stop(t0 + .22);
      });
    } catch (e) {}
  }
  const streak = () => { const s = store.get('dash.streak', null); if (!s) return 0; const y = new Date(); y.setDate(y.getDate() - 1); return (s.last === ymd(new Date()) || s.last === ymd(y)) ? s.n : 0; };
  function bumpStreak() {
    const s = store.get('dash.streak', null), today = ymd(new Date()), y = new Date(); y.setDate(y.getDate() - 1);
    if (s && s.last === today) return;
    store.set('dash.streak', { last: today, n: s && s.last === ymd(y) ? s.n + 1 : 1 });
  }
  function confetti() {
    if (reduceMotion.matches) return;
    const card = $('#focusCard'), colors = ['#FFC72E', '#3B82E0', '#E5484D', '#12B76A', '#9B6BFF', '#FF8A3D'];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('i'); s.className = 'confetti';
      s.style.cssText = 'left:' + (10 + Math.random() * 80) + '%;background:' + colors[i % colors.length] + ';--dx:' + ((Math.random() - .5) * 160) + 'px;--r:' + (Math.random() * 720 - 360) + 'deg;animation-delay:' + (Math.random() * .25) + 's';
      card.appendChild(s); setTimeout(() => s.remove(), 2200);
    }
  }
  function notify(title, body) {
    try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {}
  }
  function finish() {
    clearInterval(timer); running = false;
    beep();
    let next;
    if (mode === 'focus') {
      const n = sessions() + 1;
      store.set('dash.sessions', { date: ymd(new Date()), count: n });
      bumpStreak(); confetti();
      notify('Focus session finished', 'Nice work. Time for a break.');
      next = n % 4 === 0 ? 'long' : 'short';
      live.textContent = 'Focus session finished. Time for a ' + (next === 'long' ? '15' : '5') + ' minute break.';
    } else {
      next = 'focus';
      live.textContent = 'Break finished. Ready for the next focus session.';
      notify('Break finished', 'Ready for the next focus session?');
    }
    setMode(next);
  }
  function loop() {
    remaining = endAt - Date.now();
    if (remaining <= 0) { remaining = 0; finish(); return; }
    drawDial();
  }
  startBtn.addEventListener('click', () => {
    if (!audioCtx) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } catch (e) {} }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    if (running) { running = false; clearInterval(timer); remaining = Math.max(0, endAt - Date.now()); drawDial(); return; }
    running = true; endAt = Date.now() + remaining;
    clearInterval(timer); timer = setInterval(loop, 250);
    live.textContent = ''; drawDial();
  });
  $('#dialReset').addEventListener('click', () => setMode(mode));
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  drawDial();

  /* ================= Links ================= */
  const DEFAULT_LINKS = [
    { name: 'Gmail', url: 'https://mail.google.com', group: 'Work' },
    { name: 'Calendar', url: 'https://calendar.google.com', group: 'Work' },
    { name: 'Drive', url: 'https://drive.google.com', group: 'Work' },
    { name: 'GitHub', url: 'https://github.com', group: 'Work' },
    { name: 'YouTube', url: 'https://www.youtube.com', group: 'Personal' },
    { name: 'Spotify', url: 'https://open.spotify.com', group: 'Personal' },
    { name: 'News', url: 'https://news.google.com', group: 'Personal' },
    { name: 'Maps', url: 'https://maps.google.com', group: 'Personal' }
  ];
  let savedLinks = store.get('dash.links', null);
  let customised = Array.isArray(savedLinks);
  let links = (customised ? savedLinks : DEFAULT_LINKS).map((l) => ({ name: l.name || '', url: l.url || '', group: l.group || 'Links' }));

  const groupsEl = $('#groups'), editorEl = $('#linksEditor'), viewEl = $('#linksView'), hintEl = $('#linksHint'), editBtn = $('#editLinks');
  const jump = $('#jump'), jumpHint = $('#jumpHint');
  let editing = false;

  const normUrl = (u) => { u = (u || '').trim(); return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u; };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  function saveLinks() { customised = true; store.set('dash.links', links); Sync.touch('links'); }

  function makeBadge(name, u) {
    const b = document.createElement('span'); b.className = 'badge'; b.setAttribute('aria-hidden', 'true');
    const letter = () => { b.classList.add('letter'); b.textContent = (name || hostOf(u) || '?').charAt(0).toUpperCase(); };
    const host = hostOf(u);
    if (!u || !host || host.indexOf('.') < 0) { letter(); return b; }
    const img = new Image();
    img.alt = ''; img.width = 24; img.height = 24; img.loading = 'lazy';
    img.onerror = () => { img.remove(); letter(); };
    img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
    b.appendChild(img);
    return b;
  }

  function renderLinks() {
    groupsEl.innerHTML = '';
    const order = [];
    links.forEach((l, i) => { if (!(l.name || l.url)) return; if (order.indexOf(l.group) < 0) order.push(l.group); });
    order.forEach((g) => {
      const sec = document.createElement('div'); sec.className = 'group';
      const h = document.createElement('h3'); h.textContent = g;
      const ul = document.createElement('ul'); ul.className = 'links';
      links.forEach((l, i) => {
        if (l.group !== g || !(l.name || l.url)) return;
        const u = normUrl(l.url);
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = u || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.i = i;
        const t = document.createElement('span'); t.className = 'link-text';
        const s1 = document.createElement('strong'); s1.textContent = l.name || hostOf(u);
        const s2 = document.createElement('small'); s2.textContent = hostOf(u);
        t.appendChild(s1); t.appendChild(s2);
        a.appendChild(makeBadge(l.name, u)); a.appendChild(t); li.appendChild(a); ul.appendChild(li);
      });
      sec.appendChild(h); sec.appendChild(ul); groupsEl.appendChild(sec);
    });
    hintEl.hidden = customised;
    updateJump();
  }

  // Quick search: jump to a link by name, otherwise search Google
  function matchLink(q) {
    q = q.trim().toLowerCase();
    if (!q) return null;
    return links.find((l) => l.name.trim().toLowerCase() === q) || links.find((l) => l.name.trim().toLowerCase().startsWith(q)) || null;
  }
  function updateJump() {
    const q = jump.value.trim(), m = matchLink(q);
    groupsEl.querySelectorAll('a.match').forEach((a) => a.classList.remove('match'));
    if (m) { const a = groupsEl.querySelector('a[data-i="' + links.indexOf(m) + '"]'); if (a) a.classList.add('match'); }
    jumpHint.textContent = !q ? '' : m ? 'Press Enter to open ' + m.name + '.' : 'Press Enter to search Google for “' + q + '”.';
  }
  jump.addEventListener('input', updateJump);
  $('#jumpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = jump.value.trim();
    if (!q) return;
    const m = matchLink(q), u = m && normUrl(m.url);
    window.open(u || 'https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
    jump.value = ''; updateJump();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'n' && e.key !== 't') || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement, tag = (a && a.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(tag) || (a && a.isContentEditable)) return;
    e.preventDefault();
    if (e.key === 'n') { input.focus(); input.scrollIntoView({ block: 'center' }); } else startBtn.click();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable)) return;
    e.preventDefault(); jump.focus();
  });

  function renderGroupList() {
    const dl = $('#groupList'); dl.innerHTML = '';
    Array.from(new Set(links.map((l) => l.group).filter(Boolean))).forEach((g) => { const o = document.createElement('option'); o.value = g; dl.appendChild(o); });
  }
  function renderEditor() {
    editorEl.innerHTML = '';
    links.forEach((l, i) => {
      const row = document.createElement('div'); row.className = 'edit-row';
      const mk = (cls, val, ph, label) => { const x = document.createElement('input'); x.className = 'field ' + cls; x.type = 'text'; x.value = val; x.placeholder = ph; x.setAttribute('aria-label', 'Link ' + (i + 1) + ' ' + label); return x; };
      const n = mk('', l.name, 'Name', 'name'); n.maxLength = 40;
      const u = mk('url', l.url, 'https://', 'address'); u.inputMode = 'url';
      const g = mk('grp', l.group, 'Group', 'group'); g.maxLength = 24; g.setAttribute('list', 'groupList');
      const d = document.createElement('button'); d.type = 'button'; d.className = 'del';
      d.setAttribute('aria-label', 'Remove link ' + (l.name || i + 1));
      d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      n.addEventListener('input', () => { l.name = n.value; saveLinks(); });
      u.addEventListener('input', () => { l.url = u.value; saveLinks(); });
      g.addEventListener('input', () => { l.group = g.value.trim() || 'Links'; saveLinks(); renderGroupList(); });
      d.addEventListener('click', () => { links.splice(i, 1); saveLinks(); renderEditor(); });
      row.appendChild(n); row.appendChild(u); row.appendChild(g); row.appendChild(d);
      editorEl.appendChild(row);
    });
    const act = document.createElement('div'); act.className = 'edit-actions';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'btn quiet small'; add.textContent = 'Add link';
    add.addEventListener('click', () => {
      links.push({ name: '', url: '', group: (links[links.length - 1] || {}).group || 'Links' }); saveLinks(); renderEditor(); renderGroupList();
      const rows = editorEl.querySelectorAll('.edit-row'); rows[rows.length - 1].querySelector('input').focus();
    });
    act.appendChild(add); editorEl.appendChild(act);
    renderGroupList();
  }
  editBtn.addEventListener('click', () => {
    editing = !editing;
    editBtn.textContent = editing ? 'Done' : 'Edit';
    viewEl.hidden = editing; editorEl.hidden = !editing;
    if (editing) renderEditor();
    else { links = links.filter((l) => l.name.trim() || l.url.trim()); if (customised) { store.set('dash.links', links); Sync.touch('links'); } renderLinks(); }
  });
  renderLinks();

  /* ================= Notes ================= */
  const notes = $('#notes'), noteState = $('#noteState');
  notes.value = store.get('dash.notes', '') || '';
  let noteTimer = 0;
  const noteCount = $('#noteCount');
  const countNotes = () => { const n = notes.value.length; noteCount.textContent = n.toLocaleString() + (n === 1 ? ' character' : ' characters'); };
  countNotes();
  notes.addEventListener('input', () => {
    countNotes();
    noteState.textContent = 'Saving…';
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { store.set('dash.notes', notes.value); noteState.textContent = 'Saved'; noteTimer = 0; Sync.touch('notes'); }, 400);
  });
  $('#noteCopy').addEventListener('click', () => {
    const b = $('#noteCopy'), done = (t) => { b.textContent = t; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
    if (!notes.value) { done('Nothing to copy'); return; }
    const fallback = () => { notes.select(); try { document.execCommand('copy'); done('Copied'); } catch (e) { done('Could not copy'); } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(notes.value).then(() => done('Copied'), fallback); else fallback();
  });
  let clearTimerId = 0;
  $('#noteClear').addEventListener('click', () => {
    const b = $('#noteClear');
    if (!notes.value) return;
    if (!clearTimerId) { b.textContent = 'Tap again to clear'; clearTimerId = setTimeout(() => { b.textContent = 'Clear'; clearTimerId = 0; }, 3000); return; }
    clearTimeout(clearTimerId); clearTimerId = 0; b.textContent = 'Clear';
    notes.value = ''; clearTimeout(noteTimer); noteTimer = 0;
    store.set('dash.notes', ''); Sync.touch('notes'); noteState.textContent = 'Cleared'; countNotes();
  });
  let restoring = false;
  window.addEventListener('beforeunload', () => { if (noteTimer && !restoring) { store.set('dash.notes', notes.value); Sync.touch('notes'); } });

  /* ================= Rain radar ================= */
  const Radar = (function () {
    const card = $('#radarCard'), mapEl = $('#radarMap'), playBtn = $('#radarPlay'), timeEl = $('#radarTime');
    let map = null, marker = null, base = null, frames = [], layers = {}, idx = -1, timer = 0, host = '', fetchedAt = 0, preloaded = false;
    const clockFmt = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' });

    function makeBase() {
      if (base) map.removeLayer(base);
      base = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, className: root.dataset.theme === 'dark' ? 'base-dark' : '',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      base.bringToBack();
    }
    function stop() { clearInterval(timer); timer = 0; playBtn.textContent = 'Play'; }
    function layerFor(i) {
      if (!layers[i]) {
        layers[i] = L.tileLayer(host + frames[i].path + '/512/{z}/{x}/{y}/2/1_1.png', {
          tileSize: 512, zoomOffset: -1, maxNativeZoom: 8, maxZoom: 8, opacity: 0, zIndex: 10, updateWhenZooming: false
        }).addTo(map);
      }
      return layers[i];
    }
    function show(i) {
      const l = layerFor(i);
      Object.keys(layers).forEach((k) => { if (+k !== i) layers[k].setOpacity(0); });
      l.setOpacity(0.7);
      idx = i;
      timeEl.textContent = clockFmt(frames[i].time) + (i === frames.length - 1 ? ' (latest)' : '');
    }
    // Keep requests low: drop the other frames whenever the map moves.
    function prune() {
      stop(); preloaded = false;
      Object.keys(layers).forEach((k) => { if (+k !== idx) { map.removeLayer(layers[k]); delete layers[k]; } });
    }
    function loadFrames() {
      fetchedAt = Date.now();
      timeEl.textContent = 'Loading…';
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((j) => {
          host = j.host || 'https://tilecache.rainviewer.com';
          frames = ((j.radar && j.radar.past) || []).slice(-6);
          if (!frames.length) throw new Error('no frames');
          Object.keys(layers).forEach((k) => { map.removeLayer(layers[k]); delete layers[k]; });
          show(frames.length - 1);
          playBtn.disabled = false;
        })
        .catch(() => { fetchedAt = 0; timeEl.textContent = 'Radar is unavailable right now.'; playBtn.disabled = true; });
    }
    function init(lat, lon) {
      card.hidden = false;
      if (typeof L === 'undefined') {
        mapEl.innerHTML = '<p class="msg">The radar map could not load. Check your connection and reload the page.</p>';
        timeEl.textContent = '';
        return false;
      }
      map = L.map(mapEl, { center: [lat, lon], zoom: 6, minZoom: 3, maxZoom: 8, worldCopyJump: true, zoomAnimation: !reduceMotion.matches });
      makeBase();
      marker = L.circleMarker([lat, lon], { radius: 7, weight: 3, color: '#ffffff', fillColor: '#E5484D', fillOpacity: 1 }).addTo(map);
      map.on('movestart', prune);
      new MutationObserver(makeBase).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      loadFrames();
      return true;
    }
    playBtn.addEventListener('click', () => {
      if (timer) { stop(); return; }
      if (!frames.length) return;
      playBtn.textContent = 'Pause';
      const run = () => {
        let i = 0; show(i);
        timer = setInterval(() => {
          i += 1; show(i);
          if (i >= frames.length - 1) stop();
        }, 700);
      };
      if (!preloaded) {
        preloaded = true;
        frames.forEach((f, i) => layerFor(i));
        timeEl.textContent = 'Loading frames…';
        timer = setTimeout(run, 2200);
      } else run();
    });
    return {
      setCenter(lat, lon) {
        if (typeof lat !== 'number' || typeof lon !== 'number') return;
        if (!map) { if (typeof L === 'undefined' && mapEl.firstChild) return; init(lat, lon); return; }
        map.setView([lat, lon], map.getZoom(), { animate: false });
        marker.setLatLng([lat, lon]);
        if (Date.now() - fetchedAt > 5 * 60 * 1000) loadFrames();
      }
    };
  })();

  /* ================= Settings: units, clock, backup ================= */
  const unitBtns = Array.from(palMenu.querySelectorAll('[data-unit]'));
  const clockBtns = Array.from(palMenu.querySelectorAll('[data-h12]'));
  function markSettings() {
    unitBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
    clockBtns.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.h12 === 'true') === use12())));
  }
  markSettings();
  unitBtns.forEach((b) => b.addEventListener('click', () => {
    unit = b.dataset.unit; store.set('dash.units', unit); markSettings(); Sync.touch('prefs');
    if (lastRender) render(lastRender.place, lastRender.data);
  }));
  clockBtns.forEach((b) => b.addEventListener('click', () => {
    h12Pref = b.dataset.h12 === 'true'; store.set('dash.h12', h12Pref); markSettings(); Sync.touch('prefs');
    makeTimeFmt(); lastMinute = -1; tick();
    if (lastRender) render(lastRender.place, lastRender.data);
  }));

  const BACKUP_KEYS = ['dash.tasks', 'dash.notes', 'dash.links', 'dash.place', 'dash.theme', 'dash.accent', 'dash.units', 'dash.h12', 'dash.sessions', 'dash.streak', 'dash.name'];
  const backupMsg = $('#backupMsg'), restoreAsk = $('#restoreAsk'), importFile = $('#importFile');
  let pendingRestore = null;
  $('#exportBtn').addEventListener('click', () => {
    const data = {};
    BACKUP_KEYS.forEach((k) => { const v = store.get(k, undefined); if (v !== undefined) data[k] = v; });
    data['dash.notes'] = notes.value;
    const blob = new Blob([JSON.stringify({ app: 'dashboard', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'dashboard-backup-' + ymd(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    restoreAsk.hidden = true;
    backupMsg.textContent = 'Backup saved to your downloads folder.';
  });
  $('#importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const f = importFile.files && importFile.files[0];
    importFile.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(String(rd.result));
        if (!o || o.app !== 'dashboard' || !o.data || typeof o.data !== 'object') throw new Error('bad');
        const clean = {};
        BACKUP_KEYS.forEach((k) => { if (k in o.data) clean[k] = o.data[k]; });
        if (('dash.tasks' in clean && !Array.isArray(clean['dash.tasks'])) || ('dash.links' in clean && !Array.isArray(clean['dash.links'])) || ('dash.notes' in clean && typeof clean['dash.notes'] !== 'string')) throw new Error('bad');
        pendingRestore = clean; restoreAsk.hidden = false; backupMsg.textContent = '';
      } catch (e) {
        pendingRestore = null; restoreAsk.hidden = true;
        backupMsg.textContent = 'That file is not a dashboard backup.';
      }
    };
    rd.onerror = () => { backupMsg.textContent = 'Could not read that file. Try again.'; };
    rd.readAsText(f);
  });
  $('#restoreNo').addEventListener('click', () => { pendingRestore = null; restoreAsk.hidden = true; });
  $('#restoreYes').addEventListener('click', () => {
    if (!pendingRestore) return;
    restoring = true;
    const stamp = Date.now();
    store.set('dash.syncMeta', { tasks: stamp, notes: stamp, links: stamp, prefs: stamp });
    BACKUP_KEYS.forEach((k) => {
      if (k in pendingRestore) store.set(k, pendingRestore[k]);
      else { try { localStorage.removeItem(k); } catch (e) {} }
    });
    location.reload();
  });

  /* ================= Welcome screen + name ================= */
  function showName() {
    if (userName) root.removeAttribute('data-welcome'); else root.setAttribute('data-welcome', '');
    $('#nameInput').value = userName;
    lastMinute = -1; tick();
  }
  function setName(n) {
    userName = cleanName(n); store.set('dash.name', userName);
    showName();
  }
  showName();
  if (!userName) setTimeout(() => { try { $('#welcomeName').focus(); } catch (e) {} }, 50);
  $('#welcomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = cleanName($('#welcomeName').value);
    if (!n) { $('#welcomeErr').textContent = 'Please type a name to continue.'; $('#welcomeName').focus(); return; }
    $('#welcomeErr').textContent = ''; setName(n); Sync.touch('prefs');
    window.scrollTo(0, 0);
    if (lastRender) render(lastRender.place, lastRender.data);
  });
  $('#welcomeName').addEventListener('input', () => { $('#welcomeErr').textContent = ''; });
  $('#nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = cleanName($('#nameInput').value);
    if (!n) { $('#nameInput').value = userName; return; }
    setName(n); Sync.touch('prefs');
  });
  $('#signOut').addEventListener('click', () => {
    palMenu.hidden = true; palBtn.setAttribute('aria-expanded', 'false');
    userName = ''; store.set('dash.name', ''); $('#welcomeName').value = '';
    showName(); window.scrollTo(0, 0);
    setTimeout(() => $('#welcomeName').focus(), 50);
  });

  /* ================= Sync (optional, your own Supabase project) ================= */
  const Sync = (function () {
    const SECTIONS = ['tasks', 'notes', 'links', 'prefs'];
    const ACCENTS = ['teal', 'blue', 'violet', 'rose', 'amber'];
    let cfg = store.get('dash.sync', null);
    if (!cfg || !cfg.url || !cfg.key || !cfg.code) cfg = null;
    let meta = store.get('dash.syncMeta', {}) || {};
    let running = false, again = false, pushTimer = 0, pollTimer = 0;
    const ui = {
      offBox: $('#syncOffBox'), onBox: $('#syncOnBox'), status: $('#syncStatus'), msg: $('#syncMsg'),
      url: $('#syncUrl'), key: $('#syncKey'), paste: $('#syncPaste'), code: $('#syncCode')
    };
    const validCfg = (u, k, c) => typeof u === 'string' && /^https:\/\/[^\s/]+\/?$/.test(u) && typeof k === 'string' && k.length > 20 && typeof c === 'string' && /^[a-f0-9]{32,}$/.test(c);
    const clockNow = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hourCycle: use12() ? 'h12' : 'h23' });

    function setStatus(text, bad) { ui.status.textContent = text; ui.status.style.color = bad ? 'var(--danger)' : ''; }
    function showUi() {
      ui.offBox.hidden = !!cfg; ui.onBox.hidden = !cfg;
      if (cfg) ui.code.value = 'dash1.' + btoa(JSON.stringify({ u: cfg.url, k: cfg.key, c: cfg.code }));
    }

    // ----- what this device holds for each section -----
    function getLocal(s) {
      if (s === 'tasks') return tasks;
      if (s === 'notes') return notes.value;
      if (s === 'links') return customised ? links : null;
      return { accent: store.get('dash.accent', null) || 'teal', units: unit, h12: h12Pref, name: userName };
    }
    function hasContent(s) {
      if (s === 'tasks') return tasks.length > 0;
      if (s === 'notes') return notes.value.length > 0;
      if (s === 'links') return customised;
      return !!store.get('dash.accent', null) || unit !== 'c' || h12Pref !== null || !!userName;
    }
    // ----- apply a newer remote section; returns true when applied -----
    function apply(s, v) {
      if (s === 'tasks') {
        if (!Array.isArray(v)) return false;
        tasks = v.map((t) => ({ id: t.id, text: String(t.text || ''), done: !!t.done, due: t.due || '', pri: t.pri || 'none' }));
        store.set('dash.tasks', tasks); renderTasks(); return true;
      }
      if (s === 'notes') {
        if (typeof v !== 'string' || noteTimer) return false;
        if (notes.value !== v) notes.value = v;
        store.set('dash.notes', v); return true;
      }
      if (s === 'links') {
        if (!Array.isArray(v) || editing) return false;
        links = v.map((l) => ({ name: String(l.name || ''), url: String(l.url || ''), group: String(l.group || 'Links') }));
        customised = true; store.set('dash.links', links); renderLinks(); return true;
      }
      if (!v || typeof v !== 'object') return false;
      if ('accent' in v && ACCENTS.indexOf(v.accent) >= 0) {
        if (v.accent === 'teal') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', v.accent);
        store.set('dash.accent', v.accent === 'teal' ? null : v.accent); markAccent(v.accent);
      }
      if (v.units === 'c' || v.units === 'f') { unit = v.units; store.set('dash.units', unit); }
      if (typeof v.h12 === 'boolean' || v.h12 === null) { h12Pref = v.h12; store.set('dash.h12', h12Pref); makeTimeFmt(); lastMinute = -1; tick(); }
      if (typeof v.name === 'string' && cleanName(v.name) && cleanName(v.name) !== userName) setName(v.name);
      markSettings();
      if (lastRender) render(lastRender.place, lastRender.data);
      return true;
    }
    // ----- per-section "newest wins" merge -----
    function merge(remote) {
      const rem = remote && typeof remote === 'object' ? remote : {};
      const doc = {}; let push = false;
      SECTIONS.forEach((s) => {
        const r = rem[s], rt = r && typeof r.t === 'number' ? r.t : -1, lt = meta[s] || 0;
        if (rt > lt) { if (apply(s, r.v)) { meta[s] = rt; doc[s] = r; } else if (r) doc[s] = r; }
        else if (lt > 0 && lt > rt) { doc[s] = { v: getLocal(s), t: lt }; push = true; }
        else if (r) doc[s] = r;
      });
      store.set('dash.syncMeta', meta);
      return { doc, push };
    }

    // ----- network -----
    function rpc(fn, body) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 15000);
      const headers = { 'Content-Type': 'application/json', apikey: cfg.key };
      if (/^eyJ/.test(cfg.key)) headers.Authorization = 'Bearer ' + cfg.key;
      return fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal })
        .then((r) => {
          if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
          return r.status === 204 ? null : r.text().then((t) => (t ? JSON.parse(t) : null));
        })
        .finally(() => clearTimeout(to));
    }
    function failText(e) {
      if (e && (e.status === 401 || e.status === 403)) return 'The sync server rejected the key. Check the public key in settings.';
      if (e && e.status === 404) return 'Sync is not set up in that project yet. Run the setup SQL, then try again.';
      return 'Could not reach the sync server. Your changes are saved on this device and will sync when it is back.';
    }
    async function run() {
      if (!cfg) return;
      if (running) { again = true; return; }
      running = true; setStatus('Syncing…');
      try {
        const remote = await rpc('get_dashboard', { p_code: cfg.code });
        const m = merge(remote);
        if (m.push) await rpc('put_dashboard', { p_code: cfg.code, p_data: m.doc });
        setStatus('Synced at ' + clockNow() + '.');
      } catch (e) {
        setStatus(failText(e), true);
      } finally {
        running = false;
        if (again) { again = false; schedule(300); }
      }
    }
    function schedule(ms) { clearTimeout(pushTimer); pushTimer = setTimeout(run, ms); }
    function startPolling() { clearInterval(pollTimer); pollTimer = setInterval(() => { if (!document.hidden) run(); }, 30000); }

    // ----- turning on / off -----
    function enable(c) {
      cfg = c; store.set('dash.sync', cfg);
      SECTIONS.forEach((s) => { if (!meta[s] && hasContent(s)) meta[s] = 1; });
      store.set('dash.syncMeta', meta);
      showUi(); startPolling(); run();
    }
    function randomCode() { const b = new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b, (x) => pad(x.toString(16)).slice(-2)).join(''); }
    $('#syncTurnOn').addEventListener('click', () => {
      const url = ui.url.value.trim().replace(/\/+$/, ''), key = ui.key.value.trim();
      const code = randomCode();
      if (!validCfg(url, key, code)) { ui.msg.textContent = 'Enter the project URL (starting with https://) and the public key.'; return; }
      ui.msg.textContent = ''; enable({ url, key, code });
    });
    $('#syncJoin').addEventListener('click', () => {
      try {
        const s = ui.paste.value.trim();
        if (s.indexOf('dash1.') !== 0) throw new Error('bad');
        const o = JSON.parse(atob(s.slice(6)));
        if (!validCfg(o.u, o.k, o.c)) throw new Error('bad');
        ui.msg.textContent = ''; ui.paste.value = ''; enable({ url: o.u.replace(/\/+$/, ''), key: o.k, code: o.c });
      } catch (e) { ui.msg.textContent = 'That setup code is not valid. Copy it again from your other device.'; }
    });
    $('#syncNow').addEventListener('click', run);
    $('#syncTurnOff').addEventListener('click', () => {
      cfg = null; store.set('dash.sync', null); clearInterval(pollTimer); clearTimeout(pushTimer);
      ui.msg.textContent = 'Sync is off. Your data stays on this device and on the server.'; showUi();
    });
    $('#syncCopy').addEventListener('click', () => {
      const done = () => setStatus('Setup code copied.');
      const fallback = () => { ui.code.focus(); ui.code.select(); setStatus('Press Ctrl+C or Cmd+C to copy the selected code.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ui.code.value).then(done, fallback); else fallback();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && cfg) run(); });
    window.addEventListener('online', () => { if (cfg) run(); });

    showUi();
    if (cfg) { startPolling(); run(); }
    return {
      touch(s) {
        meta[s] = Date.now(); store.set('dash.syncMeta', meta);
        if (cfg) schedule(1500);
      }
    };
  })();

  /* ================= Daily quote ================= */
  const QUOTES = [
    ['However long the night, the dawn will break.', 'African proverb'],
    ['If you want to go fast, go alone. If you want to go far, go together.', 'African proverb'],
    ['Smooth seas do not make skillful sailors.', 'African proverb'],
    ['Fall seven times, stand up eight.', 'Japanese proverb'],
    ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
    ['The best way out is always through.', 'Robert Frost'],
    ['The only way to do great work is to love what you do.', 'Steve Jobs'],
    ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant'],
    ['Little by little, one travels far.', 'Proverb'],
    ['What stands in the way becomes the way.', 'Marcus Aurelius'],
    ['Knowledge is like a garden: if it is not cultivated, it cannot be harvested.', 'African proverb'],
    ['Well begun is half done.', 'Proverb'],
    ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
    ['When there is no enemy within, the enemies outside cannot hurt you.', 'African proverb']
  ];
  (function () {
    const now = new Date();
    const dayNum = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    const q = QUOTES[dayNum % QUOTES.length];
    $('#quoteText').textContent = '“' + q[0] + '”';
    $('#quoteBy').textContent = q[1];
  })();
})();
