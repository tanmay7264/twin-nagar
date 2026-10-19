// Life layer for Twin Nagar: Asha's day (routes, poses, glucose from the browser-side twin), a live 2-h forecast, HUD chart,
// bystanders, day/night light, and the Twin Lab (compare a usual day with a changed day on the twin before trying it).
import * as THREE from 'three';
import { CITY, WORLD, GRID } from './world.config.js';
import { simulate, stateAt, ensemble, forecast, draws, metrics, slowFrac, THR, DANGER, SEVERE, beliefTrace, detect } from './twin.js';
import { makeFigure, pose, sitY } from './figures.js';
import { buildInteriors } from './interiors.js';

const T0 = 300, T1 = 1740, SIM_SEED = 7, REAL = 5;           // day runs 05:00 -> 05:00; REAL = which posterior draw is "Asha's true body"
const ENT = 4;                                               // sim minutes to walk from the door to her seat (and back)
const hm = (h, m = 0) => h * 60 + m;
const clock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const zoneOf = Object.fromEntries(WORLD.zones.map(z => [z.id, z]));
const ROW = { home: 0, cafe: 0, pharmacy: 0, office: 0, clinic: 1, park: 1, mart: 1, market: 1, gym: 2, lab: 2, ayur: 2, chaat: 2, hospital: 3, temple: 3, bakery: 3, cinema: 3 };
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
const sideLoop = (id, xs) => () => { const d = door(id), H = GRID.hLines[ROW[id]]; return [d, [d[0], H], ...xs.map(x => [x, H]), [d[0], H], d]; };   // out-and-back along the block's sidewalk
const LOOPS = {
  park: () => { const d = door('park'); return [d, [28.3, d[1]], [28.3, 19.7], [19.7, 19.7], [19.7, d[1]], d]; },
  market: () => { const d = door('market'), H = GRID.hLines[1]; return [d, [d[0], H], [50.2, H], [50.2, 25], [50.2, H], [d[0], H], d]; },
  home: sideLoop('home', [3.4, 13.8]),
  office: sideLoop('office', [50.2, 60.4]),
  temple: sideLoop('temple', [18.2, 29.8]),
  bakery: sideLoop('bakery', [34.2, 45.8]),
  cinema: sideLoop('cinema', [50.2, 61.4]),
};
const mealOf = name => { const m = CITY.meals[name]; return { c: m[0], sl: slowFrac(m) }; };
const legInfo = (a, b) => { const poly = route(a, b), L = polyLen(poly), auto = L > 30; return { poly, auto, dur: Math.max(5, Math.round(L * (auto ? 0.2 : CITY.minPerUnit))) }; };
const ACT_LABEL = { yoga: 'Morning yoga', run: 'Gym workout', shop: 'Shopping' };

/* ---------- Asha's day for a plan: blocks (where, when, what) -> segments, glucose-model inputs (meals + exercise) and chart markers ----------
   A block has a place and either a fixed arrival time or follows the previous block (arrival = leave + travel). It leaves at arr + dur, at leaveAt,
   or (open-ended) in time to reach the next fixed block. Phases are things she does there; exercise intensity ex (0..1) feeds the ODE. */
export function buildDay(plan0) {
  const inc = new Set(plan0.incidents || []), mit = plan0.mitigate || {}, P = { ...plan0 };
  const wk = P.dayType === 'weekend', B = [], por = { lunch: 1, dinner: 1, movie: 1 };
  const sickHome = !wk && inc.has('sick') && mit.drift != null, sickEarly = sickHome && mit.drift < hm(12, 30), sickLate = sickHome && !sickEarly && mit.drift < hm(14, 20), sickMorning = sickHome && mit.drift < hm(8, 50);
  if (!wk) {
    if (inc.has('doubleLunch')) { P.lunch = 'Festival thali (2 servings)'; if (mit.heavyLunch) { por.lunch = 0.6; P.lunchWalk = true; P.snack = null; } }
    if (inc.has('lateDinner')) { P.dinner = 'Veg biryani (1 plate)'; P.dessert = 'Sweets x2 (mithai)'; if (mit.heavyDinner) { por.dinner = 0.5; P.dessert = null; } }
    if (inc.has('cake')) { P.cake = 'Office party cake and cola'; if (mit.cake != null) P.snack = null; }
    if (inc.has('prasad')) P.prasad = 'Festival prasad (laddus)';
    if (inc.has('pastry')) P.pastry = 'Pastry and fruit juice';
    if (inc.has('movie')) { P.movie = 'Large popcorn + cola'; P.dinner = null; if (mit.heavyMovie) por.movie = 0.5; }
    if (inc.has('stress') && mit.drift != null && !inc.has('sick')) P.snack = null;
    if (inc.has('stuck') && mit.stuck == null) P.reassured = 'Sweets x2 (mithai)';
    if (inc.has('sensor') && !mit.sensor) P.juice = 'Juice (treating a false low)';
    if (sickHome) { if (sickEarly) P.lunch = 'Moong dal chilla x2'; P.dinner = 'Moong dal chilla x2'; if (sickEarly || mit.drift < hm(16, 30)) P.snack = null; P.yoga = false; P.gym = 0; P.eveWalk = 0; P.groceries = false; P.lunchWalk = sickEarly ? false : P.lunchWalk; P.stroll = false; por.dinner = 1; }
  }
  const home = (t, extra = {}) => B.push({ place: 'home', fixed: t, pose: 'idle', label: 'At home', ...extra });
  if (!wk) {
    B.push({ place: 'home', fixed: hm(5), pose: 'sleep', label: 'Sleeping' });
    if (P.yoga) B.push({ place: 'ayur', fixed: hm(6, 30), dur: 45, pose: 'yoga', label: 'At the yoga centre', phases: [{ off: 5, min: 35, pose: 'yoga', ex: 0.35, label: 'Morning yoga' }] });
    else B.push({ place: 'home', fixed: hm(6, 30), pose: 'morning', label: 'Morning routine' });
    B.push({ place: 'cafe', fixed: hm(7, 40), ...(sickMorning ? { dur: 55 } : {}), pose: 'idle', label: 'At the café', phases: [{ off: 2, min: 25, pose: 'eat', slot: 'breakfast' }] });
    if (!sickMorning) B.push({ place: 'office', fixed: hm(9), ...(sickEarly ? { leaveAt: mit.drift } : {}), pose: 'work', label: 'Desk work' });
    if (!sickEarly) {
      B.push({ place: 'market', fixed: hm(13, 15), ...(sickLate ? { dur: 65 } : {}), pose: 'idle', label: 'Lunch break', phases: [{ off: 3, min: 30, pose: 'eat', slot: 'lunch' }, ...(P.lunchWalk ? [{ off: 36, min: inc.has('doubleLunch') && mit.heavyLunch ? 25 : 15, loop: 'market', label: mit.heavyLunch ? 'Twin-advised walk' : 'Post-lunch walk' }] : [])] });
      const off2 = [];
      if (!sickLate) {
      if (P.snack) off2.push({ atAbs: hm(16, 30), min: 10, pose: 'eat', slot: 'snack' });
      if (P.cake) { off2.push({ atAbs: hm(15, 30), min: 8, pose: 'eat', slot: 'cake', hidden: true }); if (mit.cake != null) off2.push({ atAbs: Math.max(mit.cake + 2, hm(15, 38)), min: 30, loop: 'office', label: 'Twin-advised walk', ex: 1 }); }
      if (P.reassured) off2.push({ atAbs: hm(15, 40), min: 6, pose: 'eat', slot: 'reassured' });
      if (mit.stuck != null) off2.push({ atAbs: Math.max(mit.stuck + 8, hm(14, 45)), min: 20, loop: 'office', label: 'Twin-advised walk (after a fingerstick)', ex: 1 });
      if (inc.has('stress') && !inc.has('sick') && mit.drift != null) off2.push({ atAbs: Math.max(mit.drift + 3, hm(15, 0)), min: 15, loop: 'office', label: 'Twin-advised break: a walk', ex: 1 });
      B.push({ place: 'office', fixed: hm(14, 40), leaveAt: sickHome ? Math.max(mit.drift, hm(14, 50)) : hm(17, 15), pose: 'work', label: 'Desk work', phases: off2 });
      }
      if (P.pastry && !sickHome) B.push({ place: 'bakery', dur: mit.pastry != null ? 50 : 22, pose: 'idle', label: 'At the bakery', phases: [{ off: 3, min: 10, pose: 'eat', slot: 'pastry', underlog: true }, ...(mit.pastry != null ? [{ atAbs: mit.pastry + 2, min: 20, loop: 'bakery', label: 'Twin-advised walk', ex: 1 }] : [])] });
      if (P.prasad && !sickHome) B.push({ place: 'temple', dur: mit.prasad != null ? 55 : 35, pose: 'idle', label: 'At the temple', phases: [{ off: 8, min: 8, pose: 'eat', slot: 'prasad', hidden: true }, ...(mit.prasad != null ? [{ atAbs: mit.prasad + 2, min: 20, loop: 'temple', label: 'Twin-advised walk (parikrama)', ex: 1 }] : [])] });
      if (P.gym && !sickHome) B.push({ place: 'gym', dur: P.gym + 8, pose: 'run', label: 'At the gym', phases: [{ off: 4, min: P.gym, pose: 'run', ex: 0.7, label: 'Gym workout' }] });
      if (P.eveWalk && !sickHome) B.push({ place: 'park', dur: P.eveWalk + 8, pose: 'idle', label: 'At the park', phases: [{ off: 4, min: P.eveWalk, loop: 'park', label: 'Evening walk' }] });
      if (P.groceries && !sickHome) B.push({ place: 'mart', dur: 25, pose: 'shop', label: 'Grocery shopping', phases: [{ off: 3, min: 18, pose: 'shop', ex: 0.4, label: 'Shopping' }] });
    }
  } else {
    B.push({ place: 'home', fixed: hm(5), pose: 'sleep', label: 'Sleeping' });
    B.push({ place: 'home', fixed: hm(7, 30), pose: 'morning', label: 'Slow morning' });
    B.push({ place: 'cafe', fixed: hm(9, 30), dur: 55, pose: 'idle', label: 'At the café', phases: [{ off: 2, min: 30, pose: 'eat', slot: 'breakfast' }] });
    B.push({ place: 'clinic', dur: 45, pose: 'idle', label: 'Check-up: CGM patch and labs' });
    B.push({ place: 'pharmacy', dur: 18, pose: 'idle', label: 'Refilling medicines' });
    B.push({ place: 'market', fixed: hm(13, 10), pose: 'idle', label: 'Lunch', phases: [{ off: 3, min: 35, pose: 'eat', slot: 'lunch' }, ...(P.lunchWalk ? [{ off: 42, min: 15, loop: 'market', label: 'Post-lunch walk' }] : [])], dur: P.lunchWalk ? 62 : 48 });
    if (P.groceries) B.push({ place: 'mart', dur: 30, pose: 'shop', label: 'Grocery shopping', phases: [{ off: 3, min: 22, pose: 'shop', ex: 0.4, label: 'Shopping' }] });
    if (P.snack) B.push({ place: 'chaat', dur: 22, pose: 'idle', label: 'Snack stop', phases: [{ off: 3, min: 14, pose: 'eat', slot: 'snack' }] });
    B.push({ place: 'home', pose: 'idle', label: 'Afternoon at home' });
    if (P.gym) B.push({ place: 'gym', fixed: hm(16, 30), dur: P.gym + 8, pose: 'run', label: 'At the gym', phases: [{ off: 4, min: P.gym, pose: 'run', ex: 0.7, label: 'Gym workout' }] });
    if (P.eveWalk) B.push({ place: 'park', fixed: hm(17, 45), dur: P.eveWalk + 8, pose: 'idle', label: 'At the park', phases: [{ off: 4, min: P.eveWalk, loop: 'park', label: 'Evening walk' }] });
  }
  if (!wk && P.movie && !sickHome) B.push({ place: 'cinema', fixed: hm(19, 45), dur: 140, pose: 'idle', label: 'At the movie', phases: [{ off: 15, min: 25, pose: 'eat', slot: 'movie' }, ...(mit.heavyMovie ? [{ atAbs: hm(21, 10), min: 10, loop: 'cinema', label: 'Twin-advised walk (intermission)', ex: 0.9 }] : [])] });
  const dinnerAt = wk ? hm(20, 30) : inc.has('lateDinner') ? hm(21, 50) : hm(20);
  home(0, { fixed: null, pose: 'idle', label: sickHome ? 'Resting at home' : 'At home' });
  const hb = B[B.length - 1]; hb.phases = [...(sickEarly ? [{ atAbs: hm(13, 15), min: 25, pose: 'eat', slot: 'lunch', minOff: 5 }] : []), { atAbs: dinnerAt, min: 25, pose: 'eat', slot: 'dinner', minOff: 8 },
    ...(inc.has('lateDinner') && P.dessert ? [{ atAbs: dinnerAt + 25, min: 6, pose: 'eat', slot: 'dessert' }] : []),
    ...(inc.has('lateDinner') && mit.heavyDinner ? [{ atAbs: dinnerAt + 27, min: 20, loop: 'home', label: 'Twin-advised stroll', ex: 0.9 }] : []),
    ...(P.stroll ? [{ atAbs: dinnerAt + 35, min: 15, loop: 'home', label: 'After-dinner stroll', minOff: 40 }] : [])];
  B.push({ place: 'home', fixed: wk ? hm(23) : hm(22, 30), pose: 'sleep', label: 'Sleeping', phases: inc.has('sensor') && P.juice ? [{ atAbs: 1578, min: 8, pose: 'eat', slot: 'juice' }] : [] });
  // pass 1: arrival / leave times
  for (let i = 0; i < B.length; i++) {
    const b = B[i], p = B[i - 1], leg = p && p.place !== b.place ? legInfo(p.place, b.place) : null; b.leg = leg;
    if (p) {
      const need = (p.leave ?? -1) + (leg ? leg.dur : 0);
      if (b.fixed != null) { if (p.leave == null) { p.leave = b.fixed - (leg ? leg.dur : 0); } b.arr = Math.max(b.fixed, p.leave + (leg ? leg.dur : 0)); }
      else b.arr = need;
    } else b.arr = b.fixed;
    b.leave = b.leaveAt ?? (b.dur != null ? b.arr + b.dur : null);
    if (i === B.length - 1) b.leave = T1 + 1;
  }
  // pass 2: segments
  const segs = [], events = [], acts = [], ex = new Float32Array(T1 + 2);
  const add = s => segs.push(s), phaseT = (b, ph) => ph.atAbs != null ? Math.max(ph.atAbs, b.arr + (ph.minOff ?? 0)) : b.arr + ph.off;
  B.forEach((b, i) => {
    const next = B[i + 1];
    let cur = b.arr;
    for (const ph of (b.phases || []).slice().sort((p, q) => phaseT(b, p) - phaseT(b, q))) {
      const at = phaseT(b, ph); if (at < cur) continue;
      if (at > cur) add({ t0: cur, t1: at, kind: 'stay', place: b.place, pose: b.pose, label: b.label });
      if (ph.loop) { const lp = LOOPS[ph.loop](); add({ t0: at, t1: at + ph.min, kind: 'loop', place: b.place, poly: lp, laps: Math.max(1, Math.round(ph.min / (polyLen(lp) * 0.9))), label: ph.label || 'Walk' }); acts.push([at, at + ph.min, ph.label || 'Walk']); for (let m = at; m < at + ph.min; m++) ex[m] = Math.max(ex[m], ph.ex ?? 1); }
      else if (ph.slot) { const name = P[ph.slot]; if (name) { const ml = mealOf(name); events.push({ t: at, ...ml, c: ph.underlog ? 35 : ml.c * (por[ph.slot] ?? 1), ...(ph.underlog ? { cr: ml.c } : {}), slot: ph.slot, name, place: b.place, hidden: !!ph.hidden }); add({ t0: at, t1: at + ph.min, kind: 'stay', place: b.place, pose: 'eat', meal: name, slot: ph.slot, label: ph.slot === 'reassured' ? `Eating ${name} (the frozen sensor reads "fine")` : ph.hidden ? `Eating ${name} (not logged)` : ph.underlog ? `Eating ${name} (logged as a small one)` : ph.slot === 'juice' ? 'Woken by a low alarm: drinking juice' : `Eating ${name}` }); } else add({ t0: at, t1: at + ph.min, kind: 'stay', place: b.place, pose: b.pose, label: b.label }); }
      else { add({ t0: at, t1: at + ph.min, kind: 'stay', place: b.place, pose: ph.pose, label: ph.label || b.label }); acts.push([at, at + ph.min, ph.label]); for (let m = at; m < at + ph.min; m++) ex[m] = Math.max(ex[m], ph.ex ?? 0.3); }
      cur = at + ph.min;
    }
    const legDur = next && next.leg ? next.leg.dur : 0, end = next ? (next.arr - legDur) : T1 + 1;
    if (end > cur) add({ t0: cur, t1: end, kind: 'stay', place: b.place, pose: b.pose, label: b.label });
    if (legDur) { add({ t0: end, t1: next.arr, kind: 'leg', poly: next.leg.poly, auto: next.leg.auto, from: b.place, to: next.place, label: `${next.leg.auto ? 'Auto ride' : 'Walking'} to ${zoneOf[next.place].name}` }); for (let m = end; m < next.arr; m++) ex[m] = Math.max(ex[m], next.leg.auto ? 0.05 : 0.6); }
  });
  segs.sort((a, b) => a.t0 - b.t0);
  segs.forEach((sg, i) => { const p = segs[i - 1], n = segs[i + 1]; sg.enter = !(p && p.kind === 'stay' && p.place === sg.place); sg.exit = !(n && n.kind === 'stay' && n.place === sg.place); });
  const walks = acts.map(a => [a[0], a[1]]);
  const sickF = t => 1 - 0.5 * sstep(hm(5, 30), hm(6, 30), t), stressF = t => 1 - 0.55 * sstep(hm(13, 30), hm(14, 30), t) * (1 - sstep(hm(18), hm(19), t));
  const siFn = !wk && (inc.has('sick') || inc.has('stress')) ? (t => (inc.has('sick') ? sickF(t) : 1) * (inc.has('stress') ? stressF(t) : 1)) : null;
  const artifact = [...(inc.has('sensor') ? [{ type: 'drop', t0: 1570, t1: 1592, drop: 72 }] : []), ...(inc.has('stuck') ? [{ type: 'freeze', t0: hm(12, 40), t1: hm(15) }] : [])];
  return { segs, events, walks, acts, ex, plan: plan0, blocks: B, siFn, artifact: artifact.length ? artifact : null };
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
  let fc = null, fcAt = -1, lastState = null; const alertLog = []; let lastAlert = -1e9, alertUntil = -1;
  let world = null, labState = { plan: { ...CITY.usualFor('weekday') }, res: null, timer: 0, explore: null };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), isUsual = p => same(p, CITY.usualFor(p.dayType)), usual = () => CITY.usualFor(labState.plan.dayType);
  const riskState = { incidents: [], guard: true }, INCIDENTS = { cake: ['🍰', 'Unlogged office-party cake'], sick: ['🤒', 'Sick day (woke up unwell, insulin sensitivity drops)'], lateDinner: ['🍛', 'Heavy late dinner + dessert'], doubleLunch: ['🥘', 'Festival lunch (double thali)'], sensor: ['📟', 'False low from a sensor glitch'],
    prasad: ['🛕', 'Festival prasad at the temple (unlogged sweets)'], movie: ['🎬', 'Movie night: large popcorn + cola'], pastry: ['🥐', 'Pastry and juice, under-logged'], stuck: ['🧊', 'CGM freezes at a normal-looking number'], stress: ['😰', 'Stressful deadline (stress hormones raise glucose)'] };
  const readingOf = (trace, day) => { if (!day.artifact) return trace; const R = Float32Array.from(trace); for (const { type, t0, t1, drop } of day.artifact) { if (type === 'drop') for (let t = t0; t <= t1; t++) R[t - T0] -= drop * clamp(Math.min((t - t0) / 4, (t1 - t) / 4), 0, 1); else { const v = trace[t0 - T0]; for (let t = t0; t <= t1; t++) R[t - T0] = v + Math.sin(t) * 0.4; } } return R; };
  const evalDay = plan => { const day = buildDay(plan), r = simulate({ events: day.events, ex: day.ex, th: REAL_D.th, gb, t0: T0, t1: T1, mult: REAL_D.mult, siFn: day.siFn }); return { day, trace: r.trace, reading: readingOf(r.trace, day), ...metrics(r.trace) }; };
  const mitigationFrom = (det, events) => { const m = {}; for (const d of det) {
      if (d.type === 'unlogged') { const h = events.filter(e => e.hidden && e.t <= d.t && d.t - e.t < 120).sort((a, b) => b.t - a.t)[0]; if (h) m[h.slot] = d.t; }
      if (d.type === 'underlog' && d.slot === 'pastry') m.pastry = d.t;
      if (d.type === 'drift') m.drift = d.t; if (d.type === 'sensor') m.sensor = true; if (d.type === 'stuck') m.stuck = d.t;
      if (d.type === 'heavy') m[d.slot === 'dinner' ? 'heavyDinner' : d.slot === 'movie' ? 'heavyMovie' : 'heavyLunch'] = true; } return m; };
  const protectedRun = (base, guard) => {       // the day as it unfolds with nothing watching, the twin's alerts for it, and the day with the twin acting on them
    const un = evalDay(base), belief = beliefTrace({ events: un.day.events, ex: un.day.ex, th, gb, t0: T0, t1: T1 });
    const det = (base.incidents && base.incidents.length) ? detect({ reading: un.reading, belief, events: un.day.events, t0: T0 }) : [];
    const pr = guard && det.length ? evalDay({ ...base, mitigate: mitigationFrom(det, un.day.events) }) : un;
    return { un, pr, det };
  };
  const setWorld = plan => {
    const base = { ...plan, ...(riskState.incidents.length ? { incidents: [...riskState.incidents], dayType: 'weekday' } : {}) };
    const { un, pr, det } = protectedRun(base, riskState.guard); const day = pr.day;
    world = { plan: { ...plan }, ...pr, unprot: un, det, risky: riskState.incidents.length > 0 }; fcAt = -1; fired = 0; INT.lab?.props.drawLab?.(world.trace);
    const n = T1 - T0 + 1; world.cumSteps = new Float32Array(n + 1); world.cumSit = new Float32Array(n + 1); world.cumCarbs = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) { const m = T0 + i, sg = segAt(day, m); world.cumSteps[i + 1] = world.cumSteps[i] + (day.ex[m] || 0) * 100; world.cumSit[i + 1] = world.cumSit[i] + (sg.kind === 'stay' && (sg.pose === 'work' || sg.pose === 'eat') ? 1 : 0); world.cumCarbs[i + 1] = world.cumCarbs[i] + day.events.filter(e => e.t === m).reduce((a, e) => a + e.c, 0); }
    alertLog.length = 0; lastAlert = -1e9; alertUntil = -1;
  };
  let fired = 0;
  const reportCache = {};
  const safetyReport = () => Object.keys(INCIDENTS).map(k => {
    if (!reportCache[k]) { const base = { ...CITY.usualFor('weekday'), incidents: [k] }, { un, pr, det } = protectedRun(base, true), a = det[0]; let first = -1; for (let i = 0; i < un.trace.length; i++) if (un.trace[i] > DANGER) { first = T0 + i; break; } const from = { cake: hm(15), sick: hm(7, 30), lateDinner: hm(21, 50), doubleLunch: hm(13), sensor: 1560, prasad: hm(17, 30), movie: hm(19, 45), pastry: hm(17), stuck: hm(12, 30), stress: hm(14) }[k] - T0, pk = tr => { let m = 0; for (let i = from; i < tr.length; i++) m = Math.max(m, tr[i]); return m; };
      reportCache[k] = { k, un, pr, alertT: a?.t ?? null, lead: a && first >= 0 && first > a.t ? first - a.t : null, first, pkUn: pk(un.trace), pkPr: pk(pr.trace) }; }
    return reportCache[k];
  });
  setWorld(CITY.usualFor('weekday'));
  const glucoseAt = m => world.trace[clamp(Math.floor(m) - T0, 0, T1 - T0)];
  const readingAt = m => world.reading[clamp(Math.floor(m) - T0, 0, T1 - T0)];

  // figures: Asha is drawn large (and has a pin + halo) so she is easy to follow; bystanders are a little smaller
  const ASHA_S = 1.4;
  const asha = makeFigure('#D6336C', ASHA_S, '#3A3F55'); scene.add(asha.g);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: '#0F8B8D', transparent: true, opacity: 0.9, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; scene.add(halo);
  const auto = new THREE.Group(); { const m = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r }), bx = (w, h, d, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); o.position.set(x, y, z); o.castShadow = true; auto.add(o); return o; };
    bx(1.5, 0.6, 2.3, '#F2C230', 0, 0.62, -0.1); bx(1.5, 0.1, 1.5, '#1F2937', 0, 2.05, -0.5); bx(0.08, 1.2, 0.08, '#1F2937', -0.7, 1.45, 0.15); bx(0.08, 1.2, 0.08, '#1F2937', 0.7, 1.45, 0.15); bx(0.7, 0.5, 0.5, '#1F2937', 0, 0.9, 0.95); bx(1.4, 0.5, 0.5, '#2D6A4F', 0, 1.0, -1.15);
    for (const [x, z] of [[-0.7, -0.9], [0.7, -0.9], [0, 1.0]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), m('#111827')); wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.28, z); auto.add(wh); } auto.visible = false; scene.add(auto); }
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
    <button data-sim="play" aria-label="Pause or play">❚❚</button><button data-sim="speed">1×</button><button data-sim="follow" aria-pressed="false">Follow Asha</button><button data-sim="restart">Restart day</button><button data-sim="daytype">Weekday</button><button data-sim="guard" class="on">🛡 Guard ON</button></div>
    <div class="hudmain"><div class="gl" id="glbox"><b id="gl">--</b><small>mg/dL <span id="tr"></span></small><em id="risk"></em></div><canvas id="hudchart" height="118"></canvas></div>
    <div class="chips" id="chips"></div><div class="hudnote" id="hudnote"></div>`;
  document.body.append(hud);
  const alertsBox = document.createElement('div'); alertsBox.id = 'alerts'; const toasts = document.createElement('div'); toasts.id = 'toasts'; alertsBox.append(toasts); document.body.append(alertsBox);
  const badge = document.createElement('div'); badge.className = 'badge'; $('#labels').append(badge);
  const el = { clk: $('#clk'), where: $('#where'), gl: $('#gl'), tr: $('#tr'), glbox: $('#glbox'), risk: $('#risk'), note: $('#hudnote'), play: hud.querySelector('[data-sim=play]') };
  const zone = g => g < 70 ? '#3B6FD4' : g <= THR ? '#2E9E5B' : g <= 250 ? '#E07A1F' : '#C9372C';

  /* ---- charts ---- */
  function plot(cv, w, h, t0, t1, ymax, drawFn) {
    const r = devicePixelRatio || 1; cv.width = w * r; cv.height = h * r; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.scale(r, r); c.font = '10px Inter, sans-serif';
    const L = 28, R = 6, T = 4, B = 16, X = t => L + (t - t0) / (t1 - t0) * (w - L - R), Y = g => T + (1 - (g - 40) / (ymax - 40)) * (h - T - B);
    c.fillStyle = 'rgba(46,158,91,.09)'; c.fillRect(L, Y(180), w - L - R, Y(70) - Y(180));
    c.strokeStyle = '#E3E6EF'; c.fillStyle = '#6B6880'; c.textAlign = 'right'; for (const g of [70, 180, 250]) { c.beginPath(); c.moveTo(L, Y(g)); c.lineTo(w - R, Y(g)); c.stroke(); c.fillText(g, L - 3, Y(g) + 3); }
    c.textAlign = 'center'; { const per = (w - L - R) / ((t1 - t0) / 180), step = per < 22 ? 720 : per < 40 ? 360 : 180; for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) c.fillText(clock(m), X(m), h - 3); }
    c.strokeStyle = '#C9372C'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(L, Y(180)); c.lineTo(w - R, Y(180)); c.stroke(); if (ymax > 260) { c.strokeStyle = 'rgba(201,55,44,.35)'; c.beginPath(); c.moveTo(L, Y(250)); c.lineTo(w - R, Y(250)); c.stroke(); } c.setLineDash([]);
    drawFn(c, X, Y); return { X, Y };
  }
  const band = (c, X, Y, t0, lo, hi, step, fill) => { c.fillStyle = fill; c.beginPath(); for (let i = 0; i < lo.length; i += step) c.lineTo(X(t0 + i), Y(lo[i])); for (let i = lo.length - 1; i >= 0; i -= step) c.lineTo(X(t0 + i), Y(hi[i])); c.fill(); };
  const line = (c, X, Y, t0, a, upto, col, wd = 2, dash = null) => { c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i <= Math.min(upto, a.length - 1); i += 2) c.lineTo(X(t0 + i), Y(a[i])); c.stroke(); c.setLineDash([]); c.lineWidth = 1; };
  const markers = (c, X, Y, day, h) => { for (const [a, b] of day.walks) { c.fillStyle = 'rgba(46,158,91,.55)'; c.fillRect(X(a), h - 24, Math.max(2, X(b) - X(a)), 4); } for (const e of day.events) { c.beginPath(); c.arc(X(e.t), h - 21, 3.5, 0, 7); if (e.hidden) { c.strokeStyle = '#C9372C'; c.lineWidth = 2; c.stroke(); c.lineWidth = 1; } else { c.fillStyle = '#E07A1F'; c.fill(); } } };
  function drawHud() {
    const cv = $('#hudchart'), w = cv.clientWidth || 400, h = 118, m = SIM.m, upto = Math.floor(m) - T0;
    plot(cv, w, h, T0, T1, Math.max(280, Math.ceil(Math.max(world.peak, world.unprot.peak) / 20) * 20 + 10), (c, X, Y) => {
      markers(c, X, Y, world.day, h);
      if (fc) { band(c, X, Y, Math.floor(m), fc.p5, fc.p95, 2, 'rgba(15,139,141,.22)'); line(c, X, Y, Math.floor(m), fc.p50, 120, '#0F8B8D', 1.5, [4, 3]); }
      if (world.guarded) line(c, X, Y, T0, world.unprot.reading, upto, 'rgba(201,55,44,.55)', 1.6, [3, 3]);
      line(c, X, Y, T0, world.reading, upto, '#1E1B2E', 2);
      c.strokeStyle = '#66518A'; c.beginPath(); c.moveTo(X(m), 2); c.lineTo(X(m), h - 16); c.stroke();
      const g = readingAt(m); c.fillStyle = zone(g); c.beginPath(); c.arc(X(m), Y(g), 4, 0, 7); c.fill();
    });
  }

  /* ---- Twin Lab: compare the usual day with a changed day (same posterior draws, so only the plan differs) ---- */
  const labDay = (plan, n = 40) => { const d = buildDay(plan); return { d, ens: ensemble({ events: d.events, ex: d.ex, base: th, sd, gb, t0: T0, t1: T1, n, seed: SIM_SEED }) }; };
  const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const qs = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
  function computeLab() {
    const base = labDay(usual()), plan = labDay(labState.plan);
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
  const slotLabel = { breakfast: 'Breakfast (café)', lunch: 'Lunch (bazaar)', snack: 'Snack', dinner: 'Dinner (home)' };
  const PATCH_LABEL = { lunchWalk: '15-min walk after lunch', yoga: 'Morning yoga (35 min)', stroll: '15-min after-dinner stroll', groceries: 'Grocery trip (light activity)' };
  const sel = (attr, opts, cur) => `<select ${attr}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  function labHtml() {
    const p = labState.plan, ex = labState.explore;
    return `<small class="kicker" style="color:#66518A">TRY IT ON THE TWIN FIRST</small><h2>Twin Lab</h2>
      <div class="row floors">Floor: ${[0, 1].map(i => `<button data-floor="${i}" class="${(floorSel.lab ?? 0) === i ? 'on' : ''}">${i === 0 ? 'Ground' : i}</button>`).join('')}</div>
      <p>Change Asha's day below. The twin re-simulates all 24 hours, with uncertainty bands, before she tries anything.</p>
      <label class="fld">Kind of day${sel('data-daytype', [['weekday', 'Weekday (office)'], ['weekend', 'Weekend (check-up, errands)']], p.dayType)}</label>
      ${Object.keys(slotLabel).map(s => `<label class="fld">${slotLabel[s]}${sel(`data-slot="${s}"`, CITY.slots[s].map(n => [n ?? '', n ?? 'Skip it']), p[s] ?? '')}</label>`).join('')}
      <div class="two"><label class="fld chk"><input type="checkbox" data-flag="lunchWalk" ${p.lunchWalk ? 'checked' : ''}> ${PATCH_LABEL.lunchWalk}</label>
      <label class="fld chk"><input type="checkbox" data-flag="stroll" ${p.stroll ? 'checked' : ''}> ${PATCH_LABEL.stroll}</label>
      ${p.dayType === 'weekday' ? `<label class="fld chk"><input type="checkbox" data-flag="yoga" ${p.yoga ? 'checked' : ''}> ${PATCH_LABEL.yoga}</label>` : ''}
      <label class="fld chk"><input type="checkbox" data-flag="groceries" ${p.groceries ? 'checked' : ''}> ${PATCH_LABEL.groceries}</label></div>
      <div class="two"><label class="fld">Evening walk${sel('data-num="eveWalk"', [[0, 'None'], [30, '30 min'], [45, '45 min'], [60, '60 min']], p.eveWalk)}</label>
      <label class="fld">Gym workout${sel('data-num="gym"', [[0, 'None'], [30, '30 min'], [45, '45 min']], p.gym)}</label></div>
      <canvas id="labchart" height="170"></canvas><div class="legend"><span><i style="background:#7B7890"></i>usual day</span><span><i style="background:#0F8B8D"></i>your plan</span><span><i style="background:#E07A1F"></i>meal</span><span><i style="background:#2E9E5B"></i>activity</span></div>
      <div id="labres"></div>
      <div class="row"><button class="btn" data-act="adopt">Asha follows this plan</button><button class="btn ghost" data-act="reset">Back to usual</button></div>
      <h3>Let the twin suggest</h3><button class="btn ghost" data-act="explore">Rank the best single changes</button>
      <div id="explore">${ex ? exploreHtml(ex) : ''}</div>
      <h3>What could go wrong today?</h3>
      <p class="muted">Tick incidents, then play the day. The twin's guard compares what the CGM shows with what it expects from the logged meals, and acts. Switch the guard off to see what happens when nothing is watching.</p>
      ${Object.entries(INCIDENTS).map(([k, [e, l]]) => `<label class="fld chk"><input type="checkbox" data-risk="${k}" ${riskState.incidents.includes(k) ? 'checked' : ''}> ${e} ${l}</label>`).join('')}
      <label class="fld chk"><input type="checkbox" data-guard ${riskState.guard ? 'checked' : ''}> 🛡 Twin guard on</label>
      <button class="btn" data-act="playrisk">Play this risky day</button>
      <div id="safety">${safetyHtml()}</div>
      <p class="muted">Simulation on the research twin's ODE, calibrated on a real participant. Carbs are approximate; gym and yoga are mapped to assumed exercise intensities; sleep, stress and medication are not modelled. Illustrative only, not medical advice.</p>`;
  }
  const hh = m => clock(m);
  function safetyHtml() {
    const rows = safetyReport(), tot = rows.reduce((a, r) => ({ un: a.un + r.un.a250, pr: a.pr + r.pr.a250 }), { un: 0, pr: 0 });
    return `<table class="safe"><tr><th>If this happens…</th><th>Twin alert</th><th>Minutes above 250<br><small>no twin → twin</small></th><th>Peak after it<br><small>no twin → twin</small></th></tr>${rows.map(r => `<tr><td>${INCIDENTS[r.k][0]} ${esc(INCIDENTS[r.k][1])}</td><td>${r.alertT != null ? hh(r.alertT) + (r.lead != null && r.lead > 0 ? `<br><small>${r.lead} min before danger</small>` : '') : '–'}</td><td>${r.un.a250} → <b>${r.pr.a250}</b></td><td>${Math.round(r.pkUn)} → <b>${Math.round(r.pkPr)}</b></td></tr>`).join('')}</table>
      <p class="verdict good">Across these ${rows.length} incidents the twin cut time in the danger zone (above 250 mg/dL) from ${tot.un} to ${tot.pr} minutes.</p><p class="muted">The false-low case is about avoiding a needless treatment: the risk there is the sugar spike after juice, not the dip.</p>`;
  }
  function exploreHtml(ex) {
    return `<ol class="rank">${ex.list.map((r, i) => `<li><button data-apply="${i}"><b>${esc(r.label)}</b><small>${r.dTir >= 0 ? '+' : ''}${r.dTir.toFixed(0)} pts in range · ${r.dPeak >= 0 ? '+' : ''}${r.dPeak.toFixed(0)} mg/dL peak</small></button></li>`).join('')}</ol>
      <button class="btn" data-act="combine">Combine the top 3 (different areas)</button>`;
  }
  function computeExplore() {
    const u = usual(), base = labDay(u, 14), c = [];
    for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) for (const item of CITY.slots[slot]) if ((item ?? null) !== (u[slot] ?? null)) c.push({ key: slot, patch: { [slot]: item }, label: `${slotLabel[slot].replace(/ \(.*\)/, '')}: ${item ?? 'skip it'}` });
    if (!u.lunchWalk) c.push({ key: 'lunchWalk', patch: { lunchWalk: true }, label: PATCH_LABEL.lunchWalk });
    if (!u.stroll) c.push({ key: 'stroll', patch: { stroll: true }, label: PATCH_LABEL.stroll });
    if (u.dayType === 'weekday' && !u.yoga) c.push({ key: 'yoga', patch: { yoga: true }, label: PATCH_LABEL.yoga });
    for (const m of [30, 45]) if (!u.gym) c.push({ key: 'gym', patch: { gym: m }, label: `Gym workout, ${m} min` });
    for (const m of [45, 60]) if (u.eveWalk !== m) c.push({ key: 'eveWalk', patch: { eveWalk: m }, label: `Evening walk, ${m} min` });
    const out = c.map(x => { const e = labDay({ ...u, ...x.patch }, 14), dT = base.ens.metrics.map((b, i) => e.ens.metrics[i].tir - b.tir), dP = base.ens.metrics.map((b, i) => e.ens.metrics[i].peak - b.peak); return { ...x, dTir: med(dT), dPeak: med(dP) }; });
    out.sort((a, b) => b.dTir - a.dTir || a.dPeak - b.dPeak);
    labState.explore = { list: out.slice(0, 6) };
  }
  const exploreEl = () => { const e = $('#explore'); if (e) e.innerHTML = labState.explore ? exploreHtml(labState.explore) : ''; };
  function zoneHtml(z) {
    const evs = world.day.events.filter(e => e.place === z.id), facts = (z.facts || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
    for (const e of evs) { const g0 = glucoseAt(e.t); let pk = 0; for (let m = e.t; m < e.t + 120; m++) pk = Math.max(pk, glucoseAt(m)); facts.push(`<div><dt>${esc(e.name)}</dt><dd>${Math.round(g0)} → peak ${Math.round(pk)}</dd></div>`); }
    for (const [a, b, nm] of world.day.acts) { const seg = world.day.segs.find(s => s.t0 === a && s.place === z.id && s.kind !== 'leg'); if (seg) facts.push(`<div><dt>${esc(nm || 'Activity')} ${clock(a)}–${clock(b)}</dt><dd>${Math.round(glucoseAt(a))} → ${Math.round(glucoseAt(b))}</dd></div>`); }
    const now = zoneOf[z.id] && inside === z.id ? `<p class="live">Right now: <b>${esc(segAt(world.day, SIM.m).label)}</b></p>` : '';
    return `<small class="kicker" style="color:${z.color}">${esc(z.kicker)}</small><h2>${esc(z.name)}</h2><p>${esc(z.blurb)}</p>${now}${z.floors > 1 ? `<div class="row floors">Floor: ${Array.from({ length: z.floors }, (_, i) => `<button data-floor="${i}" class="${(floorSel[z.id] ?? 0) === i ? 'on' : ''}">${i === 0 ? 'Ground' : i}</button>`).join('')}</div>` : ''}${z.inside ? `<h3>Inside</h3><ul class="inside">${z.inside.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${facts.length ? `<dl>${facts.join('')}</dl>` : ''}
      ${evs.length ? `<p class="muted">Glucose numbers are Asha's simulated day${isUsual(world.plan) ? '' : ' (your plan)'}.</p><button class="btn" data-select="lab">Try a change in the Twin Lab</button>` : ''}
      <button class="btn ghost" data-close>Back to overview</button>`;
  }
  function overviewHtml(zones) {
    return `<small class="kicker">WELCOME</small><h2>${esc(WORLD.title)}</h2><p>${esc(WORLD.intro)}</p>
      <p class="persona"><b>${CITY.person.name}, ${CITY.person.age}</b><br><span class="muted">${esc(CITY.person.line)}</span></p>
      <dl><div><dt>Today's time in range</dt><dd>${world.tir.toFixed(0)}%</dd></div><div><dt>Minutes above 180</dt><dd>${world.above}</dd></div><div><dt>Peak</dt><dd>${Math.round(world.peak)} mg/dL</dd></div></dl>
      ${isUsual(world.plan) ? '' : '<p class="muted">Asha is following the plan from the Twin Lab. <a href="#" data-act="reset">Back to usual</a></p>'}
      <ul>${zones.map(o => `<li><button data-select="${o.id}"><i style="background:${o.color}"></i>${esc(o.name)}</button></li>`).join('')}</ul><p class="muted">Click any building · drag to pan · scroll to zoom · Space pauses</p>`;
  }
  const panel = z => z ? (z.id === 'lab' ? labHtml() : zoneHtml(z)) : overviewHtml(WORLD.zones);
  const pt = document.getElementById('ptoggle'), panelEl = document.getElementById('panel'), setCollapsed = on => { panelEl.classList.toggle('collapsed', on); document.body.classList.toggle('pcollapsed', on); pt.textContent = on ? 'Show panel' : 'Hide panel'; };
  pt.addEventListener('click', () => setCollapsed(!panelEl.classList.contains('collapsed')));
  const afterPanel = id => { if (id) setCollapsed(false); if (id === 'lab') { computeLab(); } };
  const refreshPanel = () => ctx.refreshPanel();

  const sc = $('#panel');
  sc.addEventListener('change', e => {
    const t = e.target, p = labState.plan;
    if (t.dataset.risk) { const k = t.dataset.risk, i = riskState.incidents.indexOf(k); if (t.checked && i < 0) riskState.incidents.push(k); if (!t.checked && i >= 0) riskState.incidents.splice(i, 1); return; }
    if (t.matches('[data-guard]')) { riskState.guard = t.checked; return; }
    if (t.dataset.daytype) { labState.plan = { ...CITY.usualFor(t.value) }; labState.explore = null; refreshPanel(); return; }
    if (t.dataset.slot) p[t.dataset.slot] = t.value || null; if (t.dataset.flag) p[t.dataset.flag] = t.checked; if (t.dataset.num) p[t.dataset.num] = +t.value;
    clearTimeout(labState.timer); labState.timer = setTimeout(computeLab, 60);
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (a) { e.preventDefault(); }
    if (a === 'adopt') { setWorld(labState.plan); SIM.m = START; SIM.day++; SIM.playing = true; refreshHud(); refreshPanel(); }
    if (a === 'playrisk') { riskState.guard = !!document.querySelector('[data-guard]')?.checked; labState.plan = { ...CITY.usualFor('weekday') }; setWorld(labState.plan); SIM.m = START; SIM.playing = true; SIM.follow = true; refreshHud(); refreshPanel(); }
    if (a === 'explore') { const b = e.target.closest('[data-act]'); b.textContent = 'Simulating…'; setTimeout(() => { computeExplore(); exploreEl(); b.textContent = 'Rank the best single changes'; }, 30); }
    if (a === 'combine' && labState.explore) { const used = new Set(); for (const r of labState.explore.list) { if (used.size >= 3 || used.has(r.key) || r.dTir <= 0) continue; used.add(r.key); Object.assign(labState.plan, r.patch); } refreshPanel(); }
    const ap = e.target.closest('[data-apply]'); if (ap && labState.explore) { Object.assign(labState.plan, labState.explore.list[+ap.dataset.apply].patch); refreshPanel(); }
    if (a === 'reset') { riskState.incidents = []; labState.plan = { ...CITY.usualFor(world.plan.dayType) }; setWorld(labState.plan); SIM.m = START; SIM.playing = true; refreshPanel(); }
    const s = e.target.closest('[data-sim]')?.dataset.sim;
    if (s === 'play') SIM.playing = !SIM.playing;
    if (s === 'speed') SIM.speed = SIM.speed === 1 ? 2 : SIM.speed === 2 ? 4 : 1;
    if (s === 'follow') SIM.follow = !SIM.follow;
    if (s === 'restart') { SIM.m = START; fcAt = -1; }
    if (s === 'guard') { riskState.guard = !riskState.guard; setWorld(world.plan); refreshPanel(); }
    if (s === 'daytype') { const k = world.plan.dayType === 'weekday' ? 'weekend' : 'weekday'; labState.plan = { ...CITY.usualFor(k) }; labState.explore = null; setWorld(labState.plan); SIM.m = START; SIM.playing = true; refreshPanel(); }
    if (s) refreshHud();
  });
  addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); SIM.playing = !SIM.playing; refreshHud(); } });
  function refreshHud() { { const g = hud.querySelector('[data-sim=guard]'); g.textContent = riskState.guard ? '🛡 Guard ON' : 'Guard OFF'; g.classList.toggle('on', riskState.guard); g.style.display = world.risky ? '' : 'none'; } hud.querySelector('[data-sim=daytype]').textContent = world.plan.dayType === 'weekend' ? 'Weekend' : 'Weekday'; el.play.textContent = SIM.playing ? '❚❚' : '▶'; hud.querySelector('[data-sim=speed]').textContent = SIM.speed + '×'; const f = hud.querySelector('[data-sim=follow]'); f.setAttribute('aria-pressed', SIM.follow); f.classList.toggle('on', SIM.follow); }

  /* ---- per-frame ---- */
  let phA = 0, lastHud = -1, lastLight = -1, tAcc = 0, lastM = 0;
  const banner = document.createElement('div'); banner.id = 'banner'; alertsBox.prepend(banner);
  const toast = (msg, cls = '') => { const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = msg; toasts.append(d); setTimeout(() => d.classList.add('out'), 11000); setTimeout(() => d.remove(), 11800); };
  const detMsg = d => d.type === 'unlogged' ? `🛡 Twin guard ${clock(d.t)}: glucose is rising ~${Math.round(d.excess)} mg/dL faster than the logged meals explain, so there is probably unlogged carbohydrate (a snack, sweets or prasad). Plan: log it and take a 20-minute walk now.`
    : d.type === 'drift' ? `🛡 Twin guard ${clock(d.t)}: after eating, Asha's glucose is running ~${Math.round(d.excess)} mg/dL above what her meals explain, so her insulin sensitivity looks much lower than usual (illness, infection or stress?). The twin has re-tuned itself. Plan: go home, hydrate, eat light. If it stays above 250 or she feels very unwell, call the doctor; above 300 or with vomiting or drowsiness, go to the City Hospital.`
    : d.type === 'stuck' ? `🛡 Twin guard ${clock(d.t)}: the CGM has been flat at about ${Math.round(d.reading)} for 40 minutes while the twin expects a big swing (about ${Math.round(d.expected)}), so the sensor is probably frozen. Plan: do a fingerstick now; if it reads above 250 act on it, and go to the City Hospital if above 300 persists or she feels very unwell.`
    : d.type === 'underlog' ? `🛡 Twin guard ${clock(d.t)}: after the ${d.name} Asha's glucose is rising as if she ate about ${Math.round(d.estimate)} g, not the ${Math.round(d.logged)} g she logged. Plan: correct the log and take a 20-minute walk now.`
    : d.type === 'sensor' ? `🛡 Twin guard ${clock(d.t)}: the CGM reads ${Math.round(d.reading)} but the twin expected about ${Math.round(d.expected)} and the drop was abrupt, so this is probably a sensor artifact (lying on the arm). Plan: re-check with a fingerstick before treating; no juice needed.`
    : `🛡 Twin guard ${clock(d.t)}: ${d.name} (about ${Math.round(d.c)} g carbs) is forecast to push glucose into the danger zone. Plan: halve the portion, skip the dessert, take a short walk afterwards.`;
  const v = new THREE.Vector3();
  function maybeAlert(m, gnow) {
    if (!SIM.playing || !fc || fc.pExceed < 0.6 || gnow > THR || m - lastAlert < 150) return;
    lastAlert = m; alertUntil = m + 12;
    const walk = new Float32Array(121); for (let i = 0; i < 15; i++) walk[i] = 1;
    const w = forecast({ state: lastState, base: th, sd, gb, ex: walk }), pk = a => Math.max(...a), gain = pk(fc.p50) - pk(w.p50);
    const msg = `Twin alert ${clock(m)}: ${Math.round(fc.pExceed * 100)}% chance Asha's glucose passes 180 within 2 h (now ${Math.round(gnow)}).` + (gain > 4 ? ` A 15-minute walk now would lower the 2-h peak by about ${Math.round(gain)} mg/dL.` : ' A short walk would barely help this time.');
    alertLog.push({ m, p: fc.pExceed, msg });
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = '⚠ ' + msg; toasts.append(d); setTimeout(() => d.classList.add('out'), 8500); setTimeout(() => d.remove(), 9200);
  }
  const floorSel = {};
  document.addEventListener('click', e => { const f = e.target.closest('[data-floor]'); if (!f) return; const id = getSelected(); floorSel[id] = +f.dataset.floor; INT[id]?.setFloor(floorSel[id]); refreshPanel(); });
  const ashaPos = new THREE.Vector3(); let ashaMode = 'stand', ashaFace = Math.PI, inside = null, zoomGoal = 2.0;
  const wpos = (id, p) => objects[id].group.position.clone().add(new THREE.Vector3(p.x, p.y, p.z));
  function update(dt, t, w, h) {
    if (SIM.playing) { SIM.m += dt * 20 * SIM.speed; if (SIM.m >= T1) { if (world.risky) toast(`Day complete. Minutes above 250 mg/dL: ${world.unprot.a250} with nothing watching, ${world.a250} with the twin guard${riskState.guard ? '' : ' (guard is off, so this run is the unprotected one)'}.`, 'guard'); SIM.m = T0; SIM.day++; fcAt = -1; fired = 0; } }
    const m = SIM.m, seg = segAt(world.day, m), gnow = readingAt(m);
    if (m < lastM - 1) fired = world.det.filter(d => d.t <= m).length; lastM = m;
    // ---- Asha: along a street / walking loop outside, or inside a building at her station (door -> entrance -> seat, and back out)
    let target, face = ashaFace, mode = 'stand', visible = true, rotX = 0, ins = null, seatY = null, groundY = 0.05;
    auto.visible = false;
    if (seg.kind === 'leg' || seg.kind === 'loop') {
      const p = seg.kind === 'leg' ? along(seg.poly, (m - seg.t0) / (seg.t1 - seg.t0)) : along(seg.poly, (((m - seg.t0) / (seg.t1 - seg.t0)) * seg.laps) % 1);
      target = at(p.x, p.z); mode = 'walk'; face = Math.atan2(p.dx, p.dz);
      if (seg.auto) { mode = 'sit'; seatY = 0.95; auto.visible = true; auto.position.set(target.x, 0, target.z); auto.rotation.y = face; target = target.clone().add(new THREE.Vector3(0, 0, 0)); }
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
    asha.g.visible = visible; asha.g.position.copy(ashaPos); if (seatY != null) asha.g.position.y = (seg.place ? objects[seg.place].group.position.y : 0) + sitY(asha, seatY);
    asha.g.rotation.set(rotX, face, 0, 'YXZ'); pose(asha, mode, phA);
    halo.material.color.set(m < alertUntil ? '#C9372C' : '#0F8B8D'); halo.visible = true; halo.position.set(ashaPos.x, groundY, ashaPos.z); halo.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    const headY = asha.g.position.y + (rotX ? 1.4 : 2.45); pin.position.set(ashaPos.x, headY + 0.55 + Math.sin(t * 3) * 0.12, ashaPos.z);
    // ---- buildings open when Asha is inside or when selected; their inhabitants animate only while open
    const sel = getSelected();
    for (const id in openK) {
      const goal = id === ins || id === sel ? 1 : 0; const prev = openK[id];
      if (prev !== goal) { openK[id] = clamp(prev + Math.sign(goal - prev) * dt * 2.2, 0, 1); if (Math.abs(openK[id] - goal) < 0.001) openK[id] = goal; objects[id].setOpen(openK[id]); }
      if (id === sel && id !== ins && INT[id]) INT[id].setFloor(floorSel[id] ?? 0);
      if (INT[id] && openK[id] > 0.2) INT[id].tick(dt * (SIM.playing ? 1 : 0.2), t);
    }
    // ---- incident alerts from the twin's guard, danger banner, and screen vignette
    if (world.risky && riskState.guard && SIM.playing) while (fired < world.det.length && world.det[fired].t <= m) { const d = world.det[fired++]; toast(detMsg(d), 'guard'); alertLog.push({ m: d.t, msg: detMsg(d) }); alertUntil = m + 15; }
    { let msg = '', cls = ''; if (world.risky) { if (gnow > DANGER && !riskState.guard) { cls = 'bad'; msg = `⚠ ${gnow > SEVERE ? 'DANGEROUSLY HIGH' : 'VERY HIGH'}: ${Math.round(gnow)} mg/dL. Nothing is watching Asha's glucose.`; } else if (gnow > DANGER) { cls = 'warn'; msg = `Glucose ${Math.round(gnow)} mg/dL is in the danger zone. The twin guard has already acted and warned; keep following its plan.`; } else if (riskState.guard) { cls = 'ok'; msg = `🛡 Twin guard is on: ${world.det.filter(d => d.t <= m).length} warning${world.det.filter(d => d.t <= m).length === 1 ? '' : 's'} so far.`; } }
      if (banner.textContent !== msg || banner.className !== cls) { banner.textContent = msg; banner.className = cls; } document.body.classList.toggle('danger', cls === 'bad'); }
    // ---- forecast (twin looks 2 h ahead from now, future meals unknown)
    const k5 = Math.floor(m / 5); if (k5 !== fcAt) { fcAt = k5; const st = stateAt({ events: world.day.events, ex: world.day.ex, th: REAL_D.th, gb, t0: T0, t: Math.floor(m), mult: REAL_D.mult }); fc = forecast({ state: st, base: th, sd, gb }); lastState = st; if (fc) { drawHud(); maybeAlert(m, gnow); } }
    if (k5 !== lastHud) {
      lastHud = k5; el.clk.textContent = `Day ${SIM.day} · ${clock(m)}`; el.where.textContent = `${CITY.person.name}: ${seg.label}${ins ? ' · inside ' + zoneOf[ins].name : ''}`;
      el.gl.textContent = Math.round(gnow); el.gl.style.color = zone(gnow); const d15 = gnow - readingAt(m - 15); el.tr.textContent = d15 > 8 ? '↑' : d15 > 3 ? '↗' : d15 < -8 ? '↓' : d15 < -3 ? '↘' : '→';
      el.risk.textContent = fc ? `${Math.round(fc.pExceed * 100)}% chance >180 in 2 h` : ''; el.risk.style.color = fc && fc.pExceed > 0.6 ? '#C9372C' : fc && fc.pExceed > 0.3 ? '#E07A1F' : '#2E9E5B';
      { const i = clamp(Math.floor(m) - T0, 0, T1 - T0), tr = world.trace; let ok = 0; for (let k = 0; k <= i; k++) if (tr[k] >= 70 && tr[k] <= THR) ok++; const sit = world.cumSit[i]; $('#chips').innerHTML = `<span>🚶 ${Math.round(world.cumSteps[i]).toLocaleString()} steps</span><span>🪑 sitting ${Math.floor(sit / 60)}h${String(Math.round(sit % 60)).padStart(2, '0')}</span><span>🍚 ${Math.round(world.cumCarbs[i])} g carbs</span><span>🎯 in range ${(ok / (i + 1) * 100).toFixed(0)}%</span>${world.risky ? `<span>☠ ${(() => { let d = 0; for (let k = 0; k <= i; k++) if (world.reading[k] > DANGER) d++; return d; })()} min above 250</span>` : ''}<span>⚠ ${alertLog.length} alert${alertLog.length === 1 ? '' : 's'}</span>`; }
      el.note.textContent = `Twin forecast (teal band) assumes no new meals. Orange dots are meals, green bars are walks. ${isUsual(world.plan) ? 'Usual day.' : 'Following your Twin Lab plan.'}`;
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
  window.twinNagar = { world: () => world, safety: safetyReport, jump: (h, mm = 0, pause = true) => { SIM.m = hm(h, mm); SIM.playing = !pause; fcAt = -1; refreshHud(); } };   // handy for demos and deep links
  return { update, panel, afterPanel, world: () => world, playing: () => SIM.playing };
}
