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
export function simulate({ events, ex, th, gb, t0, t1, mult = {} }) {
  const s = fasting(gb), out = new Float32Array(t1 - t0 + 1), by = new Map();
  for (const ev of events) (by.get(ev.t) || by.set(ev.t, []).get(ev.t)).push(ev);
  for (let t = t0; t <= t1; t++) {
    for (const ev of by.get(t) || []) { const c = ev.c * (mult[ev.slot] ?? 1); s[2] += c * (1 - ev.sl); s[4] += c * ev.sl; }
    out[t - t0] = s[0]; stepMin(s, th, gb, ex[t] || 0);
  }
  return { trace: out, state: s };
}
// state of the simulation at minute t (needed to continue forecasts from "now")
export function stateAt({ events, ex, th, gb, t0, t, mult = {} }) {
  const s = fasting(gb), by = new Map();
  for (const ev of events) (by.get(ev.t) || by.set(ev.t, []).get(ev.t)).push(ev);
  for (let m = t0; m < t; m++) { for (const ev of by.get(m) || []) { const c = ev.c * (mult[ev.slot] ?? 1); s[2] += c * (1 - ev.sl); s[4] += c * ev.sl; } stepMin(s, th, gb, ex[m] || 0); }
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
  let inr = 0, above = 0, below = 0, peak = 0, sum = 0;
  for (const g of trace) { if (g >= 70 && g <= THR) inr++; if (g > THR) above++; if (g < 70) below++; if (g > peak) peak = g; sum += g; }
  const n = trace.length; return { tir: inr / n * 100, above, below, peak, mean: sum / n };
}
const q = (a, p) => { const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))]; };
export function ensemble({ events, ex, base, sd, gb, t0, t1, n = 40, seed = 7 }) {
  const D = draws(base, sd, n, seed), traces = D.map(d => simulate({ events, ex, th: d.th, gb, t0, t1, mult: d.mult }).trace);
  const len = t1 - t0 + 1, p5 = new Float32Array(len), p50 = new Float32Array(len), p95 = new Float32Array(len), col = new Float64Array(n);
  for (let i = 0; i < len; i++) { for (let k = 0; k < n; k++) col[k] = traces[k][i]; p5[i] = q(col, .05); p50[i] = q(col, .5); p95[i] = q(col, .95); }
  return { p5, p50, p95, traces, metrics: traces.map(metrics) };
}
// 2-h forecast from the current state (future meals/activity unknown): median + 5/95 band + P(exceed 180 within the horizon)
export function forecast({ state, base, sd, gb, horizon = 120, n = 30, seed = 3 }) {
  const D = draws(base, sd, n, seed), runs = D.map(d => { const s = Float64Array.from(state), o = new Float32Array(horizon + 1); o[0] = s[0]; for (let i = 1; i <= horizon; i++) { stepMin(s, d.th, gb, 0); o[i] = s[0]; } return o; });
  const p5 = [], p50 = [], p95 = [], col = new Float64Array(n);
  for (let i = 0; i <= horizon; i++) { for (let k = 0; k < n; k++) col[k] = runs[k][i]; p5.push(q(col, .05)); p50.push(q(col, .5)); p95.push(q(col, .95)); }
  return { p5, p50, p95, pExceed: runs.filter(r => r.some(g => g > THR)).length / n };
}
