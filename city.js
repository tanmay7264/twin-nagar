// Life layer for Twin Nagar: Asha's day (routes, poses, glucose from the browser-side twin), a live 2-h forecast, HUD chart,
// bystanders, day/night light, and the Twin Lab (compare a usual day with a changed day on the twin before trying it).
import * as THREE from 'three';
import { CITY, WORLD, GRID } from './world.config.js';
import { simulate, stateAt, ensemble, forecast, draws, metrics, slowFrac, THR } from './twin.js';
import { makeFigure, pose, sitY } from './figures.js';
import { buildInteriors } from './interiors.js';

const T0 = 300, T1 = 1740, SIM_SEED = 7, REAL = 5;           // day runs 05:00 -> 05:00; REAL = which posterior draw is "Asha's true body"
const ENT = 4;                                               // sim minutes to walk from the door to her seat (and back)
const hm = (h, m = 0) => h * 60 + m;
const clock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const zoneOf = Object.fromEntries(WORLD.zones.map(z => [z.id, z]));
const ROW = { home: 0, cafe: 0, office: 0, clinic: 1, park: 1, market: 1, gym: 2, lab: 2, ayur: 2 };
const door = id => [zoneOf[id].x, zoneOf[id].z + zoneOf[id].d / 2 + 0.45];
const polyLen = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
function along(poly, u) {                                  // point at fraction u (0..1) of a polyline, plus heading
  const L = polyLen(poly); let d = clamp(u, 0, 1) * L;
  for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l || i === poly.length - 1) { const k = l ? d / l : 0; return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), dx: b[0] - a[0], dz: b[1] - a[1] }; } d -= l; }
}
function route(from, to) {                                  // door -> block-edge sidewalk -> along a vertical street -> sidewalk -> door (never crosses a building)
  const a = door(from), b = door(to), ra = ROW[from], rb = ROW[to], H = GRID.hLines;
  const pts = [a, [a[0], H[ra]]];
  if (ra === rb) pts.push([b[0], H[rb]]);
  else { const vx = GRID.vLines.reduce((best, c) => (Math.abs(a[0] - c) + Math.abs(b[0] - c) < Math.abs(a[0] - best) + Math.abs(b[0] - best) ? c : best)); pts.push([vx, H[ra]], [vx, H[rb]], [b[0], H[rb]]); }
  pts.push(b);
  return pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.01);
}
const LOOPS = {
  park: () => { const d = door('park'); return [d, [28.3, d[1]], [28.3, 19.7], [19.7, 19.7], [19.7, d[1]], d]; },
  market: () => { const d = door('market'), H = GRID.hLines[1]; return [d, [d[0], H], [34.2, H], [34.2, 25], [34.2, H], [d[0], H], d]; },
};
const mealOf = name => { const m = CITY.meals[name]; return { c: m[0], sl: slowFrac(m) }; };

/* ---------- Asha's day for a plan: segments (where she is when), glucose-model inputs (meals + exercise) and chart markers ---------- */
export function buildDay(plan) {
  const blocks = [
    { place: 'home', t: hm(5), pose: 'sleep', label: 'Sleeping' },
    { place: 'home', t: hm(6, 30), pose: 'idle', label: 'Morning routine' },
    { place: 'cafe', t: hm(7, 15), pose: 'idle', label: 'At the café', phases: [{ at: hm(7, 17), min: 25, pose: 'eat', slot: 'breakfast' }] },
    { place: 'office', t: hm(9), pose: 'work', label: 'Desk work' },
    { place: 'market', t: hm(13, 15), pose: 'idle', label: 'Lunch break', phases: [{ at: hm(13, 18), min: 30, pose: 'eat', slot: 'lunch' }, ...(plan.lunchWalk ? [{ at: hm(13, 50), min: 15, loop: 'market' }] : [])] },
    { place: 'office', t: hm(14, 25), pose: 'work', label: 'Desk work', phases: plan.snack ? [{ at: hm(16, 30), min: 10, pose: 'eat', slot: 'snack' }] : [] },
    { place: 'park', t: hm(17, 45), pose: 'idle', label: 'At the park', phases: [{ at: hm(17, 50), min: plan.eveWalk, loop: 'park' }] },
    { place: 'home', t: hm(19, 30), pose: 'idle', label: 'At home', phases: [{ at: hm(20), min: 25, pose: 'eat', slot: 'dinner' }] },
    { place: 'home', t: hm(22, 30), pose: 'sleep', label: 'Sleeping' },
  ];
  const segs = [], events = [], walks = [], ex = new Float32Array(T1 + 2);
  const add = s => segs.push(s);
  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    let legDur = 0, poly = null;
    if (next && next.place !== b.place) { poly = route(b.place, next.place); legDur = Math.max(5, Math.round(polyLen(poly) * CITY.minPerUnit)); }
    const end = next ? next.t - legDur : T1 + 1;
    let cur = b.t;
    for (const ph of (b.phases || []).slice().sort((p, q) => p.at - q.at)) {
      if (ph.at > cur) add({ t0: cur, t1: ph.at, kind: 'stay', place: b.place, pose: b.pose, label: b.label });
      if (ph.loop) { const lp = LOOPS[ph.loop](); add({ t0: ph.at, t1: ph.at + ph.min, kind: 'loop', place: b.place, poly: lp, laps: Math.max(1, Math.round(ph.min / (polyLen(lp) * 0.9))), label: ph.loop === 'park' ? 'Evening walk' : 'Post-lunch walk' }); walks.push([ph.at, ph.at + ph.min]); for (let m = ph.at; m < ph.at + ph.min; m++) ex[m] = 1; }
      else { const name = plan[ph.slot]; if (name) { const ml = mealOf(name); events.push({ t: ph.at, ...ml, slot: ph.slot, name, place: b.place }); add({ t0: ph.at, t1: ph.at + ph.min, kind: 'stay', place: b.place, pose: 'eat', meal: name, slot: ph.slot, label: `Eating ${name}` }); } else add({ t0: ph.at, t1: ph.at + ph.min, kind: 'stay', place: b.place, pose: b.pose, label: b.label }); }
      cur = ph.at + ph.min;
    }
    if (end > cur) add({ t0: cur, t1: end, kind: 'stay', place: b.place, pose: b.pose, label: b.label });
    if (legDur) { add({ t0: end, t1: next.t, kind: 'leg', poly, from: b.place, to: next.place, label: `Walking to ${zoneOf[next.place].name}` }); for (let m = end; m < next.t; m++) ex[m] = 0.6; }
  });
  segs.sort((a, b) => a.t0 - b.t0);
  segs.forEach((sg, i) => { const p = segs[i - 1], n = segs[i + 1]; sg.enter = !(p && p.kind === 'stay' && p.place === sg.place); sg.exit = !(n && n.kind === 'stay' && n.place === sg.place); });
  return { segs, events, walks, ex, plan };
}
const segAt = (day, m) => day.segs.find(s => m >= s.t0 && m < s.t1) || day.segs[day.segs.length - 1];

/* ---------- init ---------- */
export function initCity(ctx) {
  const { scene, camera, controls, at, esc, sun, hemi, select, reduceMotion, objects, lit, getSelected, tween } = ctx;
  const { th, sd, gb } = CITY.twin, $ = s => document.querySelector(s);
  const START = hm(7, 0), SIM = { playing: true, speed: 1, follow: true, m: START, day: 1 };
  const INT = buildInteriors(ctx), openK = Object.fromEntries(Object.keys(objects).map(k => [k, 0]));
  let lastWheel = -1e9; document.querySelector('#scene').addEventListener('wheel', () => { lastWheel = performance.now(); }, { passive: true });
  const REAL_D = draws(th, sd, 40, SIM_SEED)[REAL];
  let fc = null, fcAt = -1;
  let world = null, labState = { plan: { ...CITY.usual }, res: null, timer: 0 };
  const stats = day => { const r = simulate({ events: day.events, ex: day.ex, th: REAL_D.th, gb, t0: T0, t1: T1, mult: REAL_D.mult }); return { trace: r.trace, ...metrics(r.trace) }; };
  const setWorld = plan => { const day = buildDay(plan); world = { plan: { ...plan }, day, ...stats(day) }; fcAt = -1; INT.lab?.props.drawLab?.(world.trace); };
  setWorld(CITY.usual);
  const glucoseAt = m => world.trace[clamp(Math.floor(m) - T0, 0, T1 - T0)];

  // figures: Asha is drawn large (and has a pin + halo) so she is easy to follow; bystanders are a little smaller
  const ASHA_S = 1.4;
  const asha = makeFigure('#D6336C', ASHA_S, '#3A3F55'); scene.add(asha.g);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: '#0F8B8D', transparent: true, opacity: 0.9, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; scene.add(halo);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 14), new THREE.MeshBasicMaterial({ color: '#0F8B8D' })); pin.rotation.x = Math.PI; scene.add(pin);
  const npcs = [], shirts = ['#8A9BB5', '#B5A58A', '#7FA58F', '#A58F9B', '#C9A05A', '#6C8FB0', '#9A7FB0', '#B07F7F'];
  let rs = 5; const rr = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const ids = WORLD.zones.map(z => z.id);
  for (let i = 0; i < 18; i++) {
    const f = makeFigure(shirts[i % shirts.length], 1.0, ['#4A4F63', '#5A4A3A', '#3A4A5A'][i % 3], ['#C68E6A', '#A9714B', '#E0B48E'][i % 3]); scene.add(f.g);
    const at0 = ids[Math.floor(rr() * ids.length)]; npcs.push({ f, at: at0, poly: null, u: 0, wait: rr() * 4, speed: 1.4 + rr() * 0.8, ph: rr() * 6 });
    const d = door(at0); f.g.position.copy(at(d[0] + (rr() - .5), d[1] + 0.4));
  }

  // HUD
  const hud = document.createElement('div'); hud.className = 'card hud'; hud.id = 'hud';
  hud.innerHTML = `<div class="hudtop"><b id="clk">--:--</b><span id="where"></span><span class="sp"></span>
    <button data-sim="play" aria-label="Pause or play">❚❚</button><button data-sim="speed">1×</button><button data-sim="follow" aria-pressed="false">Follow Asha</button><button data-sim="restart">Restart day</button></div>
    <div class="hudmain"><div class="gl" id="glbox"><b id="gl">--</b><small>mg/dL <span id="tr"></span></small><em id="risk"></em></div><canvas id="hudchart" height="118"></canvas></div>
    <div class="hudnote" id="hudnote"></div>`;
  document.body.append(hud);
  const badge = document.createElement('div'); badge.className = 'badge'; $('#labels').append(badge);
  const el = { clk: $('#clk'), where: $('#where'), gl: $('#gl'), tr: $('#tr'), glbox: $('#glbox'), risk: $('#risk'), note: $('#hudnote'), play: hud.querySelector('[data-sim=play]') };
  const zone = g => g < 70 ? '#3B6FD4' : g <= THR ? '#2E9E5B' : g <= 250 ? '#E07A1F' : '#C9372C';

  /* ---- charts ---- */
  function plot(cv, w, h, t0, t1, ymax, drawFn) {
    const r = devicePixelRatio || 1; cv.width = w * r; cv.height = h * r; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.scale(r, r); c.font = '10px Inter, sans-serif';
    const L = 28, R = 6, T = 4, B = 16, X = t => L + (t - t0) / (t1 - t0) * (w - L - R), Y = g => T + (1 - (g - 40) / (ymax - 40)) * (h - T - B);
    c.fillStyle = 'rgba(46,158,91,.09)'; c.fillRect(L, Y(180), w - L - R, Y(70) - Y(180));
    c.strokeStyle = '#E3E6EF'; c.fillStyle = '#6B6880'; c.textAlign = 'right'; for (const g of [70, 180, 250]) { c.beginPath(); c.moveTo(L, Y(g)); c.lineTo(w - R, Y(g)); c.stroke(); c.fillText(g, L - 3, Y(g) + 3); }
    c.textAlign = 'center'; for (let m = Math.ceil(t0 / 180) * 180; m <= t1; m += 180) c.fillText(clock(m), X(m), h - 3);
    c.strokeStyle = '#C9372C'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(L, Y(180)); c.lineTo(w - R, Y(180)); c.stroke(); c.setLineDash([]);
    drawFn(c, X, Y); return { X, Y };
  }
  const band = (c, X, Y, t0, lo, hi, step, fill) => { c.fillStyle = fill; c.beginPath(); for (let i = 0; i < lo.length; i += step) c.lineTo(X(t0 + i), Y(lo[i])); for (let i = lo.length - 1; i >= 0; i -= step) c.lineTo(X(t0 + i), Y(hi[i])); c.fill(); };
  const line = (c, X, Y, t0, a, upto, col, wd = 2, dash = null) => { c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i <= Math.min(upto, a.length - 1); i += 2) c.lineTo(X(t0 + i), Y(a[i])); c.stroke(); c.setLineDash([]); c.lineWidth = 1; };
  const markers = (c, X, Y, day, h) => { for (const [a, b] of day.walks) { c.fillStyle = 'rgba(46,158,91,.55)'; c.fillRect(X(a), h - 24, Math.max(2, X(b) - X(a)), 4); } for (const e of day.events) { c.fillStyle = '#E07A1F'; c.beginPath(); c.arc(X(e.t), h - 21, 3.5, 0, 7); c.fill(); } };
  function drawHud() {
    const cv = $('#hudchart'), w = cv.clientWidth || 400, h = 118, m = SIM.m, upto = Math.floor(m) - T0;
    plot(cv, w, h, T0, T1, Math.max(280, Math.ceil(world.peak / 20) * 20 + 10), (c, X, Y) => {
      markers(c, X, Y, world.day, h);
      if (fc) { band(c, X, Y, Math.floor(m), fc.p5, fc.p95, 2, 'rgba(15,139,141,.22)'); line(c, X, Y, Math.floor(m), fc.p50, 120, '#0F8B8D', 1.5, [4, 3]); }
      line(c, X, Y, T0, world.trace, upto, '#1E1B2E', 2);
      c.strokeStyle = '#66518A'; c.beginPath(); c.moveTo(X(m), 2); c.lineTo(X(m), h - 16); c.stroke();
      const g = glucoseAt(m); c.fillStyle = zone(g); c.beginPath(); c.arc(X(m), Y(g), 4, 0, 7); c.fill();
    });
  }

  /* ---- Twin Lab: compare the usual day with a changed day (same posterior draws, so only the plan differs) ---- */
  const labDay = plan => { const d = buildDay(plan); return { d, ens: ensemble({ events: d.events, ex: d.ex, base: th, sd, gb, t0: T0, t1: T1, n: 40, seed: SIM_SEED }) }; };
  const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const qs = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
  function computeLab() {
    const base = labDay(CITY.usual), plan = labDay(labState.plan);
    const pick = (f, E) => E.ens.metrics.map(f), row = (f, E) => { const v = pick(f, E); return { m: med(v), lo: qs(v, .05), hi: qs(v, .95) }; };
    const dTir = base.ens.metrics.map((b, i) => plan.ens.metrics[i].tir - b.tir), dPeak = base.ens.metrics.map((b, i) => plan.ens.metrics[i].peak - b.peak);
    labState.res = { base, plan, rows: ['tir', 'above', 'peak', 'mean'].map(k => ({ k, b: row(x => x[k], base), p: row(x => x[k], plan) })), better: dTir.filter(d => d > 0.5).length / dTir.length, dTir: med(dTir), dPeak: med(dPeak) };
    drawLab(); fillResults();
  }
  function drawLab() {
    const cv = $('#labchart'); if (!cv || !labState.res) return; const { base, plan } = labState.res, w = cv.clientWidth || 300, h = 170;
    plot(cv, w, h, T0, T1, 300, (c, X, Y) => {
      band(c, X, Y, T0, base.ens.p5, base.ens.p95, 5, 'rgba(110,110,130,.18)'); band(c, X, Y, T0, plan.ens.p5, plan.ens.p95, 5, 'rgba(15,139,141,.25)');
      line(c, X, Y, T0, base.ens.p50, 1e9, '#7B7890', 1.6); line(c, X, Y, T0, plan.ens.p50, 1e9, '#0F8B8D', 2.2); markers(c, X, Y, plan.d, h);
    });
  }
  const labNames = { tir: 'Time in range 70–180', above: 'Minutes above 180', peak: 'Peak glucose', mean: 'Mean glucose' };
  function fillResults() {
    const t = $('#labres'); if (!t || !labState.res) return; const R = labState.res, f = (k, v) => k === 'tir' ? v.toFixed(0) + '%' : Math.round(v);
    t.innerHTML = `<table><tr><th></th><th>Usual day</th><th>Your plan</th></tr>${R.rows.map(r => `<tr><td>${labNames[r.k]}</td><td>${f(r.k, r.b.m)} <small>(${f(r.k, r.b.lo)}–${f(r.k, r.b.hi)})</small></td><td><b>${f(r.k, r.p.m)}</b> <small>(${f(r.k, r.p.lo)}–${f(r.k, r.p.hi)})</small></td></tr>`).join('')}</table>
      <p class="verdict ${R.dTir > 0.5 ? 'good' : R.dTir < -0.5 ? 'bad' : ''}">${Math.abs(R.dTir) < 0.5 && Math.abs(R.dPeak) < 3 ? 'No meaningful change on the twin.' : `Median change: ${R.dTir >= 0 ? '+' : ''}${R.dTir.toFixed(0)} points time-in-range, ${R.dPeak >= 0 ? '+' : ''}${R.dPeak.toFixed(0)} mg/dL peak. The plan beats the usual day in ${Math.round(R.better * 40)} of 40 posterior draws of Asha's body.`}</p>`;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const slotLabel = { breakfast: 'Breakfast (café)', lunch: 'Lunch (bazaar)', snack: '4:30 snack (office)', dinner: 'Dinner (home)' };
  function labHtml() {
    const p = labState.plan;
    return `<small class="kicker" style="color:#66518A">TRY IT ON THE TWIN FIRST</small><h2>Twin Lab</h2>
      <div class="row floors">Floor: ${[0, 1].map(i => `<button data-floor="${i}" class="${(floorSel.lab ?? 0) === i ? 'on' : ''}">${i === 0 ? 'Ground' : i}</button>`).join('')}</div>
      <p>Change Asha's day below. The twin re-simulates all 24 hours, with uncertainty bands, before she tries anything.</p>
      ${Object.keys(slotLabel).map(s => `<label class="fld">${slotLabel[s]}<select data-slot="${s}">${CITY.slots[s].map(n => `<option value="${esc(n ?? '')}" ${((p[s] ?? null) === n) ? 'selected' : ''}>${esc(n ?? 'Skip it')}</option>`).join('')}</select></label>`).join('')}
      <label class="fld chk"><input type="checkbox" data-lunchwalk ${p.lunchWalk ? 'checked' : ''}> 15-min walk after lunch</label>
      <label class="fld">Evening walk<select data-evewalk>${[30, 45, 60].map(m => `<option value="${m}" ${p.eveWalk === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
      <canvas id="labchart" height="170"></canvas><div class="legend"><span><i style="background:#7B7890"></i>usual day</span><span><i style="background:#0F8B8D"></i>your plan</span><span><i style="background:#E07A1F"></i>meal</span><span><i style="background:#2E9E5B"></i>walk</span></div>
      <div id="labres"></div>
      <div class="row"><button class="btn" data-act="adopt">Asha follows this plan</button><button class="btn ghost" data-act="reset">Back to usual</button></div>
      <p class="muted">Simulation on the research twin's ODE, calibrated on a real participant. Carbs are approximate; sleep, stress and yoga are not modelled. Illustrative only, not medical advice.</p>`;
  }
  function zoneHtml(z) {
    const evs = world.day.events.filter(e => e.place === z.id), facts = (z.facts || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
    for (const e of evs) { const g0 = glucoseAt(e.t); let pk = 0; for (let m = e.t; m < e.t + 120; m++) pk = Math.max(pk, glucoseAt(m)); facts.push(`<div><dt>${esc(e.name)}</dt><dd>${Math.round(g0)} → peak ${Math.round(pk)}</dd></div>`); }
    for (const [a, b] of world.day.walks) { const seg = world.day.segs.find(s => s.kind === 'loop' && s.t0 === a); if (seg && seg.place === z.id) facts.push(`<div><dt>Walk ${clock(a)}–${clock(b)}</dt><dd>${Math.round(glucoseAt(a))} → ${Math.round(glucoseAt(b))}</dd></div>`); }
    const now = zoneOf[z.id] && inside === z.id ? `<p class="live">Right now: <b>${esc(segAt(world.day, SIM.m).label)}</b></p>` : '';
    return `<small class="kicker" style="color:${z.color}">${esc(z.kicker)}</small><h2>${esc(z.name)}</h2><p>${esc(z.blurb)}</p>${now}${z.floors > 1 ? `<div class="row floors">Floor: ${Array.from({ length: z.floors }, (_, i) => `<button data-floor="${i}" class="${(floorSel[z.id] ?? 0) === i ? 'on' : ''}">${i === 0 ? 'Ground' : i}</button>`).join('')}</div>` : ''}${z.inside ? `<h3>Inside</h3><ul class="inside">${z.inside.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${facts.length ? `<dl>${facts.join('')}</dl>` : ''}
      ${evs.length ? `<p class="muted">Glucose numbers are Asha's simulated day${same(world.plan, CITY.usual) ? '' : ' (your plan)'}.</p><button class="btn" data-select="lab">Try a change in the Twin Lab</button>` : ''}
      <button class="btn ghost" data-close>Back to overview</button>`;
  }
  function overviewHtml(zones) {
    return `<small class="kicker">WELCOME</small><h2>${esc(WORLD.title)}</h2><p>${esc(WORLD.intro)}</p>
      <p class="persona"><b>${CITY.person.name}, ${CITY.person.age}</b><br><span class="muted">${esc(CITY.person.line)}</span></p>
      <dl><div><dt>Today's time in range</dt><dd>${world.tir.toFixed(0)}%</dd></div><div><dt>Minutes above 180</dt><dd>${world.above}</dd></div><div><dt>Peak</dt><dd>${Math.round(world.peak)} mg/dL</dd></div></dl>
      ${same(world.plan, CITY.usual) ? '' : '<p class="muted">Asha is following the plan from the Twin Lab. <a href="#" data-act="reset">Back to usual</a></p>'}
      <ul>${zones.map(o => `<li><button data-select="${o.id}"><i style="background:${o.color}"></i>${esc(o.name)}</button></li>`).join('')}</ul><p class="muted">Click any building · drag to pan · scroll to zoom · Space pauses</p>`;
  }
  const panel = z => z ? (z.id === 'lab' ? labHtml() : zoneHtml(z)) : overviewHtml(WORLD.zones);
  const afterPanel = id => { if (id === 'lab') { computeLab(); } };
  const refreshPanel = () => ctx.refreshPanel();

  const sc = $('#panel');
  sc.addEventListener('change', e => {
    const t = e.target, p = labState.plan;
    if (t.dataset.slot) p[t.dataset.slot] = t.value || null; if (t.matches('[data-lunchwalk]')) p.lunchWalk = t.checked; if (t.matches('[data-evewalk]')) p.eveWalk = +t.value;
    clearTimeout(labState.timer); labState.timer = setTimeout(computeLab, 60);
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (a) { e.preventDefault(); }
    if (a === 'adopt') { setWorld(labState.plan); SIM.m = START; SIM.day++; SIM.playing = true; refreshHud(); refreshPanel(); }
    if (a === 'reset') { labState.plan = { ...CITY.usual }; setWorld(CITY.usual); SIM.m = START; SIM.playing = true; refreshPanel(); }
    const s = e.target.closest('[data-sim]')?.dataset.sim;
    if (s === 'play') SIM.playing = !SIM.playing;
    if (s === 'speed') SIM.speed = SIM.speed === 1 ? 2 : SIM.speed === 2 ? 4 : 1;
    if (s === 'follow') SIM.follow = !SIM.follow;
    if (s === 'restart') { SIM.m = START; fcAt = -1; }
    if (s) refreshHud();
  });
  addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); SIM.playing = !SIM.playing; refreshHud(); } });
  function refreshHud() { el.play.textContent = SIM.playing ? '❚❚' : '▶'; hud.querySelector('[data-sim=speed]').textContent = SIM.speed + '×'; const f = hud.querySelector('[data-sim=follow]'); f.setAttribute('aria-pressed', SIM.follow); f.classList.toggle('on', SIM.follow); }

  /* ---- per-frame ---- */
  let phA = 0, lastHud = -1, lastLight = -1, tAcc = 0;
  const v = new THREE.Vector3();
  const floorSel = {};
  document.addEventListener('click', e => { const f = e.target.closest('[data-floor]'); if (!f) return; const id = getSelected(); floorSel[id] = +f.dataset.floor; INT[id]?.setFloor(floorSel[id]); refreshPanel(); });
  const ashaPos = new THREE.Vector3(); let ashaMode = 'stand', ashaFace = Math.PI, inside = null, zoomGoal = 2.0;
  const wpos = (id, p) => objects[id].group.position.clone().add(new THREE.Vector3(p.x, p.y, p.z));
  function update(dt, t, w, h) {
    if (SIM.playing) { SIM.m += dt * 20 * SIM.speed; if (SIM.m >= T1) { SIM.m = T0; SIM.day++; fcAt = -1; } }
    const m = SIM.m, seg = segAt(world.day, m), gnow = glucoseAt(m);
    // ---- Asha: along a street / walking loop outside, or inside a building at her station (door -> entrance -> seat, and back out)
    let target, face = ashaFace, mode = 'stand', visible = true, rotX = 0, ins = null, seatY = null, groundY = 0.05;
    if (seg.kind === 'leg' || seg.kind === 'loop') {
      const p = seg.kind === 'leg' ? along(seg.poly, (m - seg.t0) / (seg.t1 - seg.t0)) : along(seg.poly, (((m - seg.t0) / (seg.t1 - seg.t0)) * seg.laps) % 1);
      target = at(p.x, p.z); mode = 'walk'; face = Math.atan2(p.dx, p.dz);
    } else {
      const I = INT[seg.place], dr = door(seg.place), outside = at(dr[0], dr[1]);
      const st = I && (I.stations[seg.pose] || I.stations.idle);
      if (!st) { target = outside; mode = seg.pose === 'eat' ? 'stand' : 'stand'; face = Math.PI; }
      else {
        const u = Math.min(seg.enter ? clamp((m - seg.t0) / ENT, 0, 1) : 1, seg.exit ? clamp((seg.t1 - m) / ENT, 0, 1) : 1);
        const ent = wpos(seg.place, I.entrance), stp = wpos(seg.place, st);
        if (u < 0.35) { target = outside.clone().lerp(ent, u / 0.35); face = Math.atan2(ent.x - outside.x, ent.z - outside.z); mode = 'walk'; }
        else if (u < 0.98) { target = ent.clone().lerp(stp, (u - 0.35) / 0.63); face = Math.atan2(stp.x - ent.x, stp.z - ent.z); mode = 'walk'; }
        else { target = stp; face = st.face; mode = st.mode; if (st.seat != null) seatY = st.seat; if (st.mode === 'lie') rotX = -Math.PI / 2; }
        if (u > 0.15) ins = seg.place;
        groundY = u >= 0.98 ? st.y + 0.03 : lerp(0.07, st.y, clamp((u - 0.35) / 0.63, 0, 1)) + 0.03;
        if (seg.meal) I.setMeal(seg.meal);
        if (seg.place === 'office' && I.props.snack) I.props.snack.visible = seg.slot === 'snack';
        if (seg.place === 'home' && seg.pose !== 'eat') I.setMeal(null);
      }
    }
    inside = ins; if (ins) { const stn = INT[ins].stations[seg.pose] || INT[ins].stations.idle; INT[ins].setFloor(stn.floor); }
    // within-building moves between stations: glide instead of teleporting
    if (seg.kind === 'stay' && ins && ashaPos.distanceTo(target) > 0.05 && ashaPos.distanceTo(target) < 9) { const step = Math.min(1, dt * 7); ashaPos.lerp(target, step); if (ashaPos.distanceTo(target) > 0.25) { mode = 'walk'; seatY = null; rotX = 0; face = Math.atan2(target.x - ashaPos.x, target.z - ashaPos.z); } }
    else ashaPos.copy(target);
    ashaMode = mode;
    phA += dt * (mode === 'walk' ? 5 + 2 * SIM.speed : 2.4) * (SIM.playing ? 1 : 0.25);
    asha.g.visible = visible; asha.g.position.copy(ashaPos); if (seatY != null) asha.g.position.y = objects[seg.place].group.position.y + sitY(asha, seatY);
    asha.g.rotation.set(rotX, face, 0, 'YXZ'); pose(asha, mode, phA);
    halo.visible = true; halo.position.set(ashaPos.x, groundY, ashaPos.z); halo.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    const headY = asha.g.position.y + (rotX ? 1.4 : 2.45); pin.position.set(ashaPos.x, headY + 0.55 + Math.sin(t * 3) * 0.12, ashaPos.z);
    // ---- buildings open when Asha is inside or when selected; their inhabitants animate only while open
    const sel = getSelected();
    for (const id in openK) {
      const goal = id === ins || id === sel ? 1 : 0; const prev = openK[id];
      if (prev !== goal) { openK[id] = clamp(prev + Math.sign(goal - prev) * dt * 2.2, 0, 1); if (Math.abs(openK[id] - goal) < 0.001) openK[id] = goal; objects[id].setOpen(openK[id]); }
      if (id === sel && id !== ins && INT[id]) INT[id].setFloor(floorSel[id] ?? 0);
      if (INT[id] && openK[id] > 0.2) INT[id].tick(dt * (SIM.playing ? 1 : 0.2), t);
    }
    // ---- forecast (twin looks 2 h ahead from now, future meals unknown)
    const k5 = Math.floor(m / 5); if (k5 !== fcAt) { fcAt = k5; const st = stateAt({ events: world.day.events, ex: world.day.ex, th: REAL_D.th, gb, t0: T0, t: Math.floor(m), mult: REAL_D.mult }); fc = forecast({ state: st, base: th, sd, gb }); if (fc) drawHud(); }
    if (k5 !== lastHud) {
      lastHud = k5; el.clk.textContent = `Day ${SIM.day} · ${clock(m)}`; el.where.textContent = `${CITY.person.name}: ${seg.label}${ins ? ' · inside ' + zoneOf[ins].name : ''}`;
      el.gl.textContent = Math.round(gnow); el.gl.style.color = zone(gnow); const d15 = gnow - glucoseAt(m - 15); el.tr.textContent = d15 > 8 ? '↑' : d15 > 3 ? '↗' : d15 < -8 ? '↓' : d15 < -3 ? '↘' : '→';
      el.risk.textContent = fc ? `${Math.round(fc.pExceed * 100)}% chance >180 in 2 h` : ''; el.risk.style.color = fc && fc.pExceed > 0.6 ? '#C9372C' : fc && fc.pExceed > 0.3 ? '#E07A1F' : '#2E9E5B';
      el.note.textContent = `Twin forecast (teal band) assumes no new meals. Orange dots are meals, green bars are walks. ${same(world.plan, CITY.usual) ? 'Usual day.' : 'Following your Twin Lab plan.'}`;
    }
    // ---- day/night: sky, sun, and lit windows
    const hr = (m / 60) % 24, day = sstep(5.5, 7.5, hr) * (1 - sstep(18, 19.8, hr));
    if (Math.abs(day - lastLight) > 0.01) {
      lastLight = day; sun.intensity = 0.3 + 1.8 * day; hemi.intensity = 0.6 + 0.85 * day; for (const mt of lit) mt.emissiveIntensity = (1 - day) * 1.1;
      const c = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), day).getStyle(); document.documentElement.style.setProperty('--sky1', c('#141A33', '#DCE8F5')); document.documentElement.style.setProperty('--sky2', c('#2A2F52', '#EEF1F8'));
    }
    // ---- badge over Asha
    v.set(ashaPos.x, headY + 1.3, ashaPos.z); v.project(camera); const bx = (v.x + 1) / 2 * w, by = (1 - v.y) / 2 * h;
    badge.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) translate(-50%, -100%)`;
    badge.innerHTML = `<b style="color:${zone(gnow)}">${Math.round(gnow)}</b> ${el.tr.textContent}<small>${esc(CITY.person.name)} · ${esc(seg.label.replace(/^Walking to /, '→ '))}</small>`;
    // ---- follow camera: track Asha and zoom in more when she is inside a building (unless the user is zooming)
    if (SIM.follow) {
      const tgt = ashaPos.clone().setY(ins ? ashaPos.y : 0), d = tgt.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 3)); controls.target.add(d); camera.position.add(d);
      zoomGoal = ins ? 3.3 : 2.6; if (performance.now() - lastWheel > 4000 && Math.abs(camera.zoom - zoomGoal) > 0.01) { camera.zoom = lerp(camera.zoom, zoomGoal, Math.min(1, dt * 1.6)); camera.updateProjectionMatrix(); }
    }
    // ---- bystanders walk the sidewalks between buildings
    if (SIM.playing) for (const n of npcs) {
      n.ph += dt * (n.poly ? 6 : 2);
      if (!n.poly) { n.wait -= dt; if (n.wait <= 0) { let to; do { to = ids[Math.floor(rr() * ids.length)]; } while (to === n.at); n.poly = route(n.at, to); n.to = to; n.u = 0; n.len = polyLen(n.poly); } pose(n.f, 'stand', n.ph); }
      else { n.u += dt * n.speed / n.len; if (n.u >= 1) { n.at = n.to; n.poly = null; n.wait = 2 + rr() * 6; } else { const p = along(n.poly, n.u); n.f.g.position.copy(at(p.x + (n.f.g.id % 3 - 1) * 0.2, p.z)); n.f.g.rotation.y = Math.atan2(p.dx, p.dz); pose(n.f, 'walk', n.ph); } }
    }
  }
  const resize = () => { drawHud(); drawLab(); };
  addEventListener('resize', () => setTimeout(resize, 120));
  refreshHud(); setTimeout(drawHud, 50);
  { const d = door('home'); const p = at(d[0], d[1]); controls.target.copy(p).setY(0); camera.position.copy(p).add(new THREE.Vector3(60, 52, 60)); camera.zoom = 2.6; camera.updateProjectionMatrix(); }
  window.twinNagar = { jump: (h, mm = 0, pause = true) => { SIM.m = hm(h, mm); SIM.playing = !pause; fcAt = -1; refreshHud(); } };   // handy for demos and deep links
  return { update, panel, afterPanel, world: () => world, playing: () => SIM.playing };
}
