// Browser port of the glucose twin's mechanistic core (twin/model.py): Bergman-style minimal model + two-pool gut.
// State s = [G, X, F1, F2, S1, S2]. One Euler step = 1 minute (identical to the Python model's 5 sub-steps per 5-min grid step).
export const K = { P2: 0.02, CG: 7.6, KEX: 0.012, KSLOW: 0.4 };   // same ASSUMED constants as twin/model.py
export const THR = 180;

export function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
export const slowFrac = ([carbs, protein, fat, fiber]) => { const x = fat + protein + 3 * fiber; return Math.min(0.8, Math.max(0.05, (x / (carbs + x) - 0.15) * 2)); };

export function stepMin(s, th, gb, e) {                // in place
  const [SI, SG, k] = th, ks = K.KSLOW * k, [G, X, F1, F2, S1, S2] = s;
  const ra = k * F2 + ks * S2;
  s[0] = G + (-(SG + K.KEX * e + X) * (G - gb) + K.CG * ra);
  s[1] = X + (-K.P2 * X + K.P2 * SI * Math.max(G - gb, 0));
  s[2] = F1 - k * F1; s[3] = F2 + k * (F1 - F2); s[4] = S1 - ks * S1; s[5] = S2 + ks * (S1 - S2);
}
export const fasting = gb => Float64Array.of(gb, 0, 0, 0, 0, 0);

// events: [{t (minute), c (g carbs), sl (slow fraction), slot, m (portion multiplier, default 1)}]; ex[t] = exercise intensity 0..1
export function simulate({ events, ex, th, gb, t0, t1, mult = {}, siFn = null }) {
  const s = fasting(gb), out = new Float32Array(t1 - t0 + 1), by = new Map();
  for (const ev of events) (by.get(ev.t) || by.set(ev.t, []).get(ev.t)).push(ev);
  for (let t = t0; t <= t1; t++) {
    for (const ev of by.get(t) || []) { const c = (ev.cr ?? ev.c) * (mult[ev.slot] ?? 1); s[2] += c * (1 - ev.sl); s[4] += c * ev.sl; }
    out[t - t0] = s[0]; stepMin(s, siFn ? [th[0] * siFn(t), th[1], th[2]] : th, gb, ex[t] || 0);
  }
  return { trace: out, state: s };
}
// state of the simulation at minute t (needed to continue forecasts from "now")
export function stateAt({ events, ex, th, gb, t0, t, mult = {}, siFn = null }) {
  const s = fasting(gb), by = new Map();
  for (const ev of events) (by.get(ev.t) || by.set(ev.t, []).get(ev.t)).push(ev);
  for (let m = t0; m < t; m++) { for (const ev of by.get(m) || []) { const c = (ev.cr ?? ev.c) * (mult[ev.slot] ?? 1); s[2] += c * (1 - ev.sl); s[4] += c * ev.sl; } stepMin(s, siFn ? [th[0] * siFn(m), th[1], th[2]] : th, gb, ex[m] || 0); }
  return s;
}

// parameter draws from the calibrated posterior (log-normal), plus ~20% portion-size noise per meal slot
export function draws(base, sd, n, seed, cap = 0.7) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const th = base.map((b, j) => i === 0 ? b : b * Math.exp(gauss(r) * Math.min(sd[j], cap)));
    const mult = {}; for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) mult[slot] = i === 0 ? 1 : Math.exp(gauss(r) * 0.2);
    out.push({ th, mult });
  }
  return out;
}
export function metrics(trace) {
  let inr = 0, above = 0, below = 0, peak = 0, sum = 0, a250 = 0, a300 = 0;
  for (const g of trace) { if (g >= 70 && g <= THR) inr++; if (g > THR) above++; if (g > 250) a250++; if (g > 300) a300++; if (g < 70) below++; if (g > peak) peak = g; sum += g; }
  const n = trace.length; return { tir: inr / n * 100, above, below, peak, mean: sum / n, a250, a300 };
}
const q = (a, p) => { const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))]; };
export function ensemble({ events, ex, base, sd, gb, t0, t1, n = 40, seed = 7 }) {
  const D = draws(base, sd, n, seed), traces = D.map(d => simulate({ events, ex, th: d.th, gb, t0, t1, mult: d.mult }).trace);
  const len = t1 - t0 + 1, p5 = new Float32Array(len), p50 = new Float32Array(len), p95 = new Float32Array(len), col = new Float64Array(n);
  for (let i = 0; i < len; i++) { for (let k = 0; k < n; k++) col[k] = traces[k][i]; p5[i] = q(col, .05); p50[i] = q(col, .5); p95[i] = q(col, .95); }
  return { p5, p50, p95, traces, metrics: traces.map(metrics) };
}
// 2-h forecast from the current state (future meals/activity unknown): median + 5/95 band + P(exceed 180 within the horizon)
export function forecast({ state, base, sd, gb, horizon = 120, n = 30, seed = 3, ex = null }) {
  const D = draws(base, sd, n, seed), runs = D.map(d => { const s = Float64Array.from(state), o = new Float32Array(horizon + 1); o[0] = s[0]; for (let i = 1; i <= horizon; i++) { stepMin(s, d.th, gb, ex ? ex[i - 1] || 0 : 0); o[i] = s[0]; } return o; });
  const p5 = [], p50 = [], p95 = [], col = new Float64Array(n);
  for (let i = 0; i <= horizon; i++) { for (let k = 0; k < n; k++) col[k] = runs[k][i]; p5.push(q(col, .05)); p50.push(q(col, .5)); p95.push(q(col, .95)); }
  return { p5, p50, p95, pExceed: runs.filter(r => r.some(g => g > THR)).length / n };
}

// ---- the twin's safeguards: compare what the CGM reads with what the twin expects from the LOGGED meals and activity
export const DANGER = 250, SEVERE = 300;
// beliefTrace: the twin's own expectation (logged events only, usual body parameters)
export function beliefTrace({ events, ex, th, gb, t0, t1 }) { return simulate({ events: events.filter(e => !e.hidden).map(e => ({ ...e, cr: undefined })), ex, th, gb, t0, t1 }).trace; }
// detect: returns alerts [{t, type, ...}] in time order. reading = what the CGM shows; belief = beliefTrace.
export function detect({ reading, belief, events, t0 }) {
  const n = reading.length, r = i => reading[i] - belief[i], out = [], at = i => t0 + i;
  let sensorT = -1e9, driftDone = false, unlogT = -1e9;
  for (let i = 15; i < n; i++) {
    const res = r(i);
    // (1) sensor artifact: abrupt drop the twin cannot explain
    if (at(i) - sensorT > 240 && reading[i] - reading[i - 15] < -40 && belief[i] - reading[i] > 45) { sensorT = at(i); out.push({ t: at(i), type: 'sensor', reading: reading[i], expected: belief[i] }); }
    // (2) unlogged carbohydrate: fast unexplained rise, no logged meal in the last 90 minutes
    const recentMeal = events.some(e => !e.hidden && at(i) - e.t >= 0 && at(i) - e.t < 90);
    if (at(i) - unlogT > 120 && !recentMeal && res > 28 && res - r(i - 10) > 12) { unlogT = at(i); out.push({ t: at(i), type: 'unlogged', excess: res }); }
  }
  const heavyT = []; { const lg = events.filter(e => !e.hidden).sort((a, b) => a.t - b.t); for (let k = 0; k < lg.length; k++) { let c = lg[k].c, j = k + 1; while (j < lg.length && lg[j].t - lg[k].t < 40) c += lg[j++].c; if (c >= 100) heavyT.push(lg[k].t); } }
  // (2b) frozen sensor: the reading does not move for 40 minutes while the twin expects a big swing
  for (let i = 40; i < n; i++) { let mx = -1e9, mn = 1e9; for (let k = i - 40; k <= i; k++) { mx = Math.max(mx, reading[k]); mn = Math.min(mn, reading[k]); } if (mx - mn < 3 && Math.abs(belief[i] - belief[i - 40]) > 35 && at(i) - sensorT > 240 && !out.some(o => o.type === 'stuck')) { out.push({ t: at(i), type: 'stuck', reading: reading[i], expected: belief[i] }); } }
  // (2c) under-logged meal: soon after a logged meal the reading sits far above the twin's expected rise
  for (const e of events.filter(e => !e.hidden && e.c >= 20)) { const i0 = e.t - t0; if (i0 < 1) continue; const pre = r(i0 - 1); for (let i = i0 + 15; i <= i0 + 50 && i < n; i++) { const rise = belief[i] - belief[i0 - 1], res = r(i) - pre; if (rise > 15 && res > 25 && res / rise > 0.35) { out.push({ t: at(i), type: 'underlog', name: e.name, slot: e.slot, logged: e.c, estimate: e.c * (1 + res / rise), ev: e.t }); break; } } }
  // (3) drift: unexplained excess that persists for 20 minutes (the body is only visible to the twin after meals, when insulin acts) (the body is responding differently)
  for (let i = 20; i < n && !driftDone; i++) { let mn = 1e9, sum = 0; for (let k = i - 20; k <= i; k++) { const v = r(k); mn = Math.min(mn, v); sum += v; } if (mn > 10 && sum / 21 > 22 && !heavyT.some(h => at(i) >= h && at(i) - h < 180) && !out.some(o => ['unlogged', 'underlog', 'stuck'].includes(o.type) && at(i) - o.t < 240 && at(i) >= o.t)) { driftDone = true; out.push({ t: at(i), type: 'drift', excess: sum / 21 }); } }
  // (4) heavy meal: a logged meal whose forecast crosses the danger line
  const logged = events.filter(e => !e.hidden).sort((a, b) => a.t - b.t);   // clusters of meals within 40 minutes count together
  for (let k = 0; k < logged.length; k++) { let c = logged[k].c, j = k + 1; if (k && logged[k].t - logged[k - 1].t < 40) continue; while (j < logged.length && logged[j].t - logged[k].t < 40) c += logged[j++].c; if (c >= 100) out.push({ t: logged[k].t, type: 'heavy', c, name: logged[k].name + (j - k > 1 ? ' + dessert' : ''), slot: logged[k].slot }); }
  return out.sort((a, b) => a.t - b.t);
}
