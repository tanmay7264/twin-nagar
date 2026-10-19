// Cutaway interiors: when Asha walks in (or you click a building) the roof lifts away and the rooms show what is happening inside.
// Local coordinates: origin at the footprint centre, +z = front (door side), floor f top surface at y = f * FH + 0.07.
import * as THREE from 'three';
import { makeFigure, pose, sitY } from './figures.js';
import { FH } from './cityscape.js';
import { WORLD, CITY } from './world.config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mc = new Map(); const M = c => (mc.has(c) || mc.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })), mc.get(c));
const B = c => new THREE.MeshBasicMaterial({ color: c });
const Y0 = f => f * FH + 0.07;

function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { t, c, g }; }
const FOOD = [[/white rice|curd rice|biryani/i, '#F4F0E6'], [/brown rice/i, '#B79A6E'], [/ragi/i, '#6B4A3A'], [/jowar|roti|paratha|chilla/i, '#D9A760'], [/dosa/i, '#E3B25B'], [/idli|upma|poha/i, '#F3E7C2'], [/biscuit/i, '#C98E4B'], [/banana/i, '#F2D04A'], [/sprout/i, '#9CC06A'], [/sweet/i, '#E07A3A']];
export const foodColour = name => (FOOD.find(([r]) => r.test(name)) || [0, '#E8C47A'])[1];

export function buildInteriors(ctx) {
  const { objects, pickables } = ctx, out = {};
  for (const z of WORLD.zones) {
    if (z.open) continue;
    const o = objects[z.id], { w, d, floors } = z, cut = o.cut;
    const P = (parent, ww, hh, dd, col, x, y, zc, basic = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), basic ? B(col) : M(col)); m.position.set(x, y + hh / 2, zc); m.castShadow = !basic; m.receiveShadow = true; parent.add(m); return m; };
    const fl = Array.from({ length: floors }, (_, f) => { const gr = new THREE.Group(); cut.add(gr); return gr; });
    const actors = [], stations = {}, props = {}, ticks = [];
    const addActor = (f, mode, x, y, zc, face, seatH = null, speed = 1) => { const fig = makeFigure(...f); fig.g.position.set(x, seatH != null ? sitY(fig, seatH) : y, zc); fig.g.rotation.y = face; fl[clamp(Math.round((y - 0.07) / FH), 0, floors - 1)].add(fig.g); actors.push({ fig, mode, ph: Math.random() * 6, speed }); return fig; };
    const SK = ['#C68E6A', '#A9714B', '#E0B48E'];
    const person = (shirt, k = 0, sc = 1) => [shirt, sc, ['#3A3F55', '#5A4A3A', '#3A4A5A'][k % 3], SK[k % 3]];
    // shell: floor slabs, back walls (-z, -x), low front curbs (+z, +x), stairs for multi-storey buildings
    const paint = z.wall || '#EFE9DD';
    for (let f = 0; f < floors; f++) {
      P(fl[f], w, 0.14, d, f ? '#CBBFAE' : '#B9AF9F', 0, f * FH - 0.07, 0);
      P(fl[f], w, FH, 0.2, paint, 0, f * FH, -d / 2 + 0.1); P(fl[f], 0.2, FH, d, paint, -w / 2 + 0.1, f * FH, 0);
      P(fl[f], w, 0.4, 0.14, z.color, 0, f * FH, d / 2 - 0.07); P(fl[f], 0.14, 0.4, d, z.color, w / 2 - 0.07, f * FH, 0);
      P(fl[f], w - 0.6, 0.04, 0.02, '#FFFFFF', 0, f * FH + 1.2, -d / 2 + 0.21, true).material.color.set('#E6F1F8');
      for (let k = -1; k <= 1; k += 1) P(fl[f], 1.5, 1.0, 0.02, '#BFDDF0', k * (w / 3), f * FH + 1.0, -d / 2 + 0.215, true);   // painted windows on the back wall
    }
    if (floors > 1) for (let f = 0; f < floors - 1; f++) for (let i = 0; i < 7; i++) P(fl[f], 0.9, (i + 1) * (FH / 7), 0.4, '#9B8F7E', w / 2 - 0.9, f * FH, d / 2 - 0.5 - i * 0.42 + 2.2 - 0.2);
    const entrance = { x: 0, y: Y0(0), z: d / 2 - 0.5 };
    const desk = (parent, x, y, zc, ww = 1.6, dd = 0.8) => { P(parent, ww, 0.06, dd, '#B88A5A', x, y + 0.72, zc); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(parent, 0.06, 0.72, 0.06, '#6B5638', x + sx * (ww / 2 - 0.06), y, zc + sz * (dd / 2 - 0.06)); };
    const chair = (parent, x, y, zc, col = '#4A5568') => { P(parent, 0.5, 0.06, 0.5, col, x, y + 0.42, zc); P(parent, 0.06, 0.42, 0.06, '#2D3748', x, y, zc); };
    const plant = (parent, x, y, zc) => { P(parent, 0.4, 0.4, 0.4, '#8A5A3C', x, y, zc); const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), M('#5E9A3E')); s.position.set(x, y + 0.75, zc); parent.add(s); };
    const plate = (parent, x, y, zc, col = '#E8C47A') => { P(parent, 0.5, 0.03, 0.5, '#FFFFFF', x, y, zc); const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })); f.scale.y = 0.5; f.position.set(x, y + 0.08, zc); parent.add(f); return f; };

    if (z.id === 'home') {
      const g0 = fl[0], g1 = fl[1], a = Y0(0), b = Y0(1);
      P(g0, 2.6, 0.5, 0.4, '#4A3B2E', -1.5, a, -d / 2 + 0.45); const tv = P(g0, 1.7, 0.95, 0.08, '#15171C', -1.5, a + 0.75, -d / 2 + 0.45); const scr = P(g0, 1.5, 0.78, 0.02, '#5AA0D8', -1.5, a + 0.83, -d / 2 + 0.5, true);
      ticks.push((dt, t) => scr.material.color.setHSL(0.58 + 0.05 * Math.sin(t * 1.3), 0.5, 0.45 + 0.1 * Math.sin(t * 5)));
      P(g0, 2.3, 0.45, 0.95, '#C0504D', -1.5, a, -0.5); P(g0, 2.3, 0.6, 0.22, '#A8423F', -1.5, a + 0.3, 0.0); P(g0, 1.2, 0.3, 0.6, '#8B6B4A', -1.5, a, -1.6);
      P(g0, 0.7, 0.92, 3.0, '#E9E4D8', -w / 2 + 0.55, a, 0.2); P(g0, 0.7, 0.05, 3.0, '#6B7280', -w / 2 + 0.55, a + 0.92, 0.2); const flame = P(g0, 0.3, 0.05, 0.3, '#E0501E', -w / 2 + 0.55, a + 0.95, -0.6, true); ticks.push((dt, t) => flame.material.color.setHSL(0.05 + 0.02 * Math.sin(t * 9), 1, 0.5)); P(g0, 0.8, 1.9, 0.8, '#DDE3EA', -w / 2 + 0.6, a, 2.3);
      desk(g0, 1.8, a, 1.3, 1.7, 1.0); for (const [cx, cz] of [[1.4, 0.55], [2.2, 0.55], [1.4, 2.05], [2.2, 2.05]]) chair(g0, cx, a, cz, '#7A5A3E'); props.plate = plate(g0, 1.4, a + 0.78, 1.45); plant(g0, 3.4, a, -2.6);
      P(g1, 1.7, 0.4, 2.3, '#8B6B4A', -1.6, b, -d / 2 + 1.25); P(g1, 1.6, 0.2, 2.2, '#F2EFE9', -1.6, b + 0.4, -d / 2 + 1.25); P(g1, 0.9, 0.12, 0.4, '#FFFFFF', -1.6, b + 0.6, -d / 2 + 0.55); P(g1, 1.62, 0.1, 1.3, '#6B8FC4', -1.6, b + 0.6, -d / 2 + 1.9);
      P(g1, 0.5, 0.5, 0.5, '#9A7B5B', -0.4, b, -d / 2 + 0.5); const gm = P(g1, 0.16, 0.05, 0.1, '#33D17A', -0.4, b + 0.52, -d / 2 + 0.5, true); ticks.push((dt, t) => gm.material.color.setHSL(0.38, 0.8, 0.45 + 0.15 * Math.sin(t * 2)));
      P(g1, 0.6, 2.0, 1.6, '#9A7B5B', -w / 2 + 0.5, b, 1.3); desk(g1, 2.4, b, -1.8, 1.3, 0.6); P(g1, 0.5, 0.03, 0.35, '#2D3748', 2.4, b + 0.78, -1.8);
      Object.assign(stations, {
        morning: { x: -2.7, y: a, z: 0.2, face: -Math.PI / 2, mode: 'cook' }, idle: { x: -1.5, y: a, z: -0.5, face: Math.PI, mode: 'sit', seat: a + 0.46 },
        eat: { x: 1.4, y: a, z: 2.05, face: Math.PI, mode: 'sit-eat', seat: a + 0.46 }, sleep: { x: -1.6, y: b + 0.64, z: -1.05, face: 0, mode: 'lie' },
      });
    }
    if (z.id === 'cafe') {
      const a = Y0(0), g = fl[0];
      P(g, 5.2, 1.0, 0.8, '#8A5A3C', 0, a, -d / 2 + 0.65); P(g, 5.4, 0.06, 0.95, '#E8D9BF', 0, a + 1.0, -d / 2 + 0.65);
      P(g, 0.9, 0.6, 0.7, '#B8BEC8', -1.8, a + 1.06, -d / 2 + 0.65); P(g, 1.1, 0.06, 0.7, '#2A2A2A', 0.5, a + 1.06, -d / 2 + 0.65);
      const steam = [0, 1, 2].map(i => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6 })); g.add(s); return s; });
      ticks.push((dt, t) => steam.forEach((s, i) => { const u = (t * 0.5 + i / 3) % 1; s.position.set(-1.8 + Math.sin(u * 6 + i) * 0.1, a + 1.7 + u * 0.9, -d / 2 + 0.65); s.material.opacity = 0.6 * (1 - u); s.scale.setScalar(0.7 + u); }));
      addActor(person('#F2F2F0', 0), 'cook', -0.6, a, -d / 2 + 0.2, 0);
      const menu = canvasTex(256, 128, (c, ww, hh) => { c.fillStyle = '#2B3A2E'; c.fillRect(0, 0, ww, hh); c.fillStyle = '#F4E9C8'; c.font = 'bold 20px Inter,Arial'; c.fillText('UDUPI CAFÉ', 70, 28); c.font = '16px Inter,Arial'; ['Idli x3   ₹40', 'Masala dosa ₹70', 'Poha   ₹35', 'Filter coffee ₹20'].forEach((s, i) => c.fillText(s, 28, 56 + i * 20)); });
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshBasicMaterial({ map: menu.t })); mp.position.set(-w / 2 + 0.22, a + 1.8, 0.2); mp.rotation.y = Math.PI / 2; g.add(mp);
      for (const [tx, tz] of [[1.8, 0.9], [-1.9, 1.2]]) { desk(g, tx, a, tz, 1.0, 1.0); }
      chair(g, 1.8, a, 1.75); chair(g, 1.8, a, 0.05); chair(g, -1.9, a, 0.35); chair(g, -1.9, a, 2.05);
      addActor(person('#8A5CB1', 1), 'sit-eat', 1.8, a, 0.05, 0, a + 0.46); addActor(person('#4E8B6A', 2), 'sit-eat', -1.9, a, 0.35, 0, a + 0.46); addActor(person('#C97B4A', 1), 'sit-eat', -1.9, a, 2.05, Math.PI, a + 0.46);
      props.plate = plate(g, 1.8, a + 0.78, 1.15);
      Object.assign(stations, { eat: { x: 1.8, y: a, z: 1.75, face: Math.PI, mode: 'sit-eat', seat: a + 0.46 }, idle: { x: 1.8, y: a, z: 1.75, face: Math.PI, mode: 'sit', seat: a + 0.46 } });
    }
    if (z.id === 'office') {
      const g0 = fl[0], g1 = fl[1], g2 = fl[2], a = Y0(0), b = Y0(1), c = Y0(2);
      desk(g0, 0, a, -d / 2 + 1.3, 3.2, 0.8); addActor(person('#3E7CB1', 0), 'sit-work', 0, a, -d / 2 + 0.55, 0, a + 0.46); P(g0, 2.2, 0.45, 0.9, '#6B7280', -2.8, a, 0.6); P(g0, 2.2, 0.45, 0.9, '#6B7280', 2.2, a, 0.6); plant(g0, -w / 2 + 0.7, a, -d / 2 + 0.7);
      const logo = canvasTex(256, 64, (cc, ww, hh) => { cc.fillStyle = '#3E7CB1'; cc.fillRect(0, 0, ww, hh); cc.fillStyle = '#fff'; cc.font = 'bold 30px Inter,Arial'; cc.fillText('TECH OFFICE', 30, 42); }); const lp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: logo.t })); lp.position.set(2.0, a + 1.6, -d / 2 + 0.22); g0.add(lp);
      const monitors = [];
      for (const [dx, dz, who] of [[-2.8, 0.8, 'asha'], [0.4, 0.8, 1], [3.2, 0.8, 2], [-2.8, -2.2, 3], [0.4, -2.2, 4], [3.2, -2.2, 5]]) {
        desk(g1, dx, b, dz, 1.6, 0.8); const mon = P(g1, 0.7, 0.45, 0.05, '#101216', dx, b + 0.8, dz - 0.25); const sc = P(g1, 0.62, 0.37, 0.02, '#6EC1E4', dx, b + 0.84, dz - 0.22, true); monitors.push(sc);
        chair(g1, dx, b, dz + 0.75);
        if (who !== 'asha') addActor(person(['#8A5CB1', '#4E8B6A', '#C97B4A', '#6C8FB0', '#B07F7F'][who % 5], who, 1), 'sit-work', dx, b, dz + 0.75, Math.PI, b + 0.46, 1 + who * 0.1);
      }
      ticks.push((dt, t) => monitors.forEach((m, i) => m.material.color.setHSL(0.55 + 0.03 * Math.sin(t * 0.7 + i), 0.5, 0.55 + 0.08 * Math.sin(t * 3 + i * 2))));
      const snack = new THREE.Group(); P(snack, 0.25, 0.22, 0.25, '#FFFFFF', 0, 0, 0); P(snack, 0.35, 0.04, 0.3, '#C98E4B', 0.4, 0, 0.1); snack.position.set(-2.4, b + 0.78, 0.7); snack.visible = false; g1.add(snack); props.snack = snack;
      P(g1, 0.1, 0.5, 0.5, '#FFFFFF', -w / 2 + 0.25, b + 1.5, -d / 2 + 0.6, true).material.color.set('#E8E8E8');
      const clock = canvasTex(64, 64, (cc, ww, hh) => { cc.fillStyle = '#fff'; cc.beginPath(); cc.arc(32, 32, 30, 0, 7); cc.fill(); cc.strokeStyle = '#222'; cc.lineWidth = 3; cc.stroke(); cc.beginPath(); cc.moveTo(32, 32); cc.lineTo(32, 12); cc.moveTo(32, 32); cc.lineTo(46, 38); cc.stroke(); }); const cl = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ map: clock.t })); cl.position.set(-0.5, b + 1.9, -d / 2 + 0.22); g1.add(cl);
      P(g2, 4.0, 0.9, 0.7, '#E9E4D8', 0, c, -d / 2 + 0.7); P(g2, 0.5, 0.5, 0.4, '#2F3640', 1.2, c + 0.9, -d / 2 + 0.7); P(g2, 0.7, 1.8, 0.7, '#DDE3EA', -2.6, c, -d / 2 + 0.7);
      desk(g2, 0.2, c, 0.9, 3.0, 1.2); for (const cx of [-0.8, 0.2, 1.2]) { chair(g2, cx, c, 0.2); chair(g2, cx, c, 1.6); }
      addActor(person('#8A5CB1', 1), 'stand', 2.4, c, -0.6, Math.PI, null); addActor(person('#4E8B6A', 2), 'stand', 3.2, c, -0.2, Math.PI * 1.2, null);
      Object.assign(stations, { work: { x: -2.8, y: b, z: 1.55, face: Math.PI, mode: 'sit-work', seat: b + 0.46 }, eat: { x: -2.8, y: b, z: 1.55, face: Math.PI, mode: 'sit-eat', seat: b + 0.46 }, idle: { x: -2.8, y: b, z: 1.55, face: Math.PI, mode: 'sit', seat: b + 0.46 } });
    }
    if (z.id === 'market') {
      const g = fl[0], a = Y0(0), cols = ['#C9372C', '#E0A92E', '#2F9E8F'];
      [-3, 0, 3].forEach((sx, i) => {
        P(g, 2.2, 0.95, 0.8, '#8A5A3C', sx, a, -d / 2 + 0.9); P(g, 2.4, 0.1, 1.1, cols[i], sx, a + 2.0, -d / 2 + 1.0); for (const k of [-1, 1]) P(g, 0.06, 2.0, 0.06, '#5A4A3A', sx + k * 1.1, a, -d / 2 + 1.4);
        [-0.7, 0, 0.7].forEach((kx, j) => P(g, 0.4, 0.2, 0.4, ['#F4C542', '#7CB56A', '#E07A3A', '#F4F0E6'][(i + j) % 4], sx + kx, a + 0.95, -d / 2 + 0.9));
        addActor(person(['#F2F2F0', '#B03A2E', '#2F6FB1'][i], i), 'cook', sx, a, -d / 2 + 0.2, 0);
      });
      const tab = (x, zc) => { P(g, 3.4, 0.06, 0.9, '#C9A27A', x, a + 0.72, zc); P(g, 3.2, 0.4, 0.4, '#8A5A3C', x, a, zc - 0.85); P(g, 3.2, 0.4, 0.4, '#8A5A3C', x, a, zc + 0.85); };
      tab(2.2, 1.1); tab(-2.2, 1.1);
      props.plate = plate(g, 2.2, a + 0.78, 1.2); const dal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#F0B429')); dal.position.set(2.45, a + 0.82, 1.2); g.add(dal);
      addActor(person('#8A5CB1', 1), 'sit-eat', -2.7, a, 1.95, Math.PI, a + 0.46); addActor(person('#4E8B6A', 2), 'sit-eat', -1.5, a, 0.25, 0, a + 0.46); addActor(person('#C97B4A', 0), 'sit-eat', 3.2, a, 0.25, 0, a + 0.46);
      Object.assign(stations, { eat: { x: 2.2, y: a, z: 1.95, face: Math.PI, mode: 'sit-eat', seat: a + 0.46 }, idle: { x: 2.2, y: a, z: 1.95, face: Math.PI, mode: 'sit', seat: a + 0.46 } });
    }
    if (z.id === 'clinic') {
      const g0 = fl[0], g1 = fl[1], a = Y0(0), b = Y0(1);
      P(g0, 3.0, 1.0, 0.7, '#E9E4D8', 1, a, -d / 2 + 0.8); addActor(person('#2F9E8F', 0), 'stand', 1, a, -d / 2 + 0.2, 0);
      for (const cx of [-3.0, -2.2, -1.4]) chair(g0, cx, a, 1.9, '#2F9E8F'); addActor(person('#8A5CB1', 1), 'sit', -3.0, a, 1.9, Math.PI, a + 0.46); addActor(person('#C97B4A', 2), 'sit', -1.4, a, 1.9, Math.PI, a + 0.46);
      P(g0, 1.4, 0.9, 0.7, '#DDE3EA', -2.8, a, -1.5); const an = P(g0, 0.7, 0.3, 0.4, '#2F3640', -2.8, a + 0.9, -1.5); const led = P(g0, 0.3, 0.06, 0.02, '#33D17A', -2.8, a + 1.05, -1.28, true); ticks.push((dt, t) => led.material.color.setHSL(0.38, 0.8, 0.45 + 0.2 * Math.sin(t * 3)));
      const cgm = canvasTex(256, 128, (cc, ww, hh) => { cc.fillStyle = '#0D1B2A'; cc.fillRect(0, 0, ww, hh); cc.strokeStyle = '#4FD1C5'; cc.lineWidth = 3; cc.beginPath(); for (let i = 0; i < 256; i += 4) cc.lineTo(i, 80 - 25 * Math.sin(i / 25) - 10 * Math.sin(i / 8)); cc.stroke(); cc.fillStyle = '#fff'; cc.font = 'bold 16px Inter,Arial'; cc.fillText('CGM reader  14-day patch', 10, 18); });
      desk(g1, 1.4, b, -1.1, 2.0, 0.9); const rd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: cgm.t })); rd.position.set(1.4, b + 1.15, -1.55); g1.add(rd);
      addActor(person('#FFFFFF', 0), 'sit-work', 1.4, b, -1.5, 0, b + 0.46); chair(g1, 1.4, b, -1.5); chair(g1, 1.4, b, -0.1); addActor(person('#8A5CB1', 1), 'stand', 3.1, b, 0.4, Math.PI * 1.2, null);
      P(g1, 1.0, 0.5, 2.0, '#DDE3EA', -2.4, b, 0.6); P(g1, 1.0, 0.1, 2.0, '#2F9E8F', -2.4, b + 0.5, 0.6); addActor(person('#2F9E8F', 2), 'stand', -1.2, b, 0.6, -Math.PI / 2, null);
      P(g1, 0.6, 0.9, 3.0, '#E9E4D8', -w / 2 + 0.5, b, -0.2); const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16), M('#9AA3B0')); cf.position.set(-w / 2 + 0.5, b + 1.0, -0.2); g1.add(cf); ticks.push((dt, t) => { cf.rotation.y = t * 6; });
      Object.assign(stations, { idle: { x: 1.4, y: b, z: -0.1, face: Math.PI, mode: 'sit', seat: b + 0.46 } });
    }
    if (z.id === 'gym') {
      const g = fl[0], a = Y0(0); P(g, w, 0.04, d, '#3A3F4A', 0, 0.02, 0);
      const belts = [];
      [-2.5, 0, 2.5].forEach((sx, i) => { P(g, 0.9, 0.2, 1.8, '#2E3440', sx, a, -d / 2 + 1.5); P(g, 0.7, 1.0, 0.15, '#4A505C', sx, a, -d / 2 + 0.7); belts.push(P(g, 0.7, 0.02, 1.5, '#1B1E24', sx, a + 0.2, -d / 2 + 1.55));
        if (i < 2) addActor(person(['#E0501E', '#2F6FB1'][i], i), 'run', sx, a + 0.2, -d / 2 + 1.6, 0, null, 1.2); });
      P(g, 1.6, 0.4, 0.5, '#2A2E36', -2.5, a, 1.4); P(g, 1.6, 0.08, 0.08, '#B8BEC8', -2.5, a + 0.9, 1.4); const mir = P(g, 0.04, 1.8, d - 1, '#BFDDF0', -w / 2 + 0.3, a, 0, true); mir.material.color.set('#CFE6F5');
      for (const kx of [0, 0.5, 1.0]) { const kb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M('#2A2E36')); kb.position.set(1.6 + kx, a + 0.15, 1.8); g.add(kb); }
      addActor(person('#8D63B8', 2), 'stand', 3.0, a, 1.2, Math.PI * 1.1, null);
      ticks.push((dt, t) => belts.forEach(b => { b.material.color.setHSL(0, 0, 0.1 + 0.03 * Math.sin(t * 12)); }));
      Object.assign(stations, { run: { x: 2.5, y: a + 0.2, z: -d / 2 + 1.6, face: 0, mode: 'run' }, idle: { x: 2.5, y: a + 0.2, z: -d / 2 + 1.6, face: 0, mode: 'run' } });
    }
    if (z.id === 'lab') {
      const g0 = fl[0], g1 = fl[1], a = Y0(0), b = Y0(1);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.9, 28), M('#2F3340')); base.position.set(0, a + 0.45, 0.4); g0.add(base);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 28), B('#5AE0E8')); disc.position.set(0, a + 0.93, 0.4); g0.add(disc);
      const holo = canvasTex(512, 256, () => {}); const hp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: holo.t, transparent: true, side: THREE.DoubleSide, depthWrite: false })); hp.position.set(0, a + 1.95, 0.4); hp.rotation.y = Math.PI / 4; g0.add(hp);
      ticks.push((dt, t) => { disc.material.color.setHSL(0.5 + 0.02 * Math.sin(t * 2), 0.8, 0.55 + 0.1 * Math.sin(t * 3)); hp.position.y = a + 1.95 + Math.sin(t * 1.5) * 0.05; });
      props.drawLab = (trace, T0, markers) => { const c = holo.g, ww = 512, hh = 256; c.clearRect(0, 0, ww, hh); c.fillStyle = 'rgba(10,40,60,.55)'; c.fillRect(0, 0, ww, hh); c.strokeStyle = '#E8F7FF'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < trace.length; i += 6) { const x = 10 + i / trace.length * (ww - 20), y = hh - 20 - (trace[i] - 60) / 220 * (hh - 50); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([6, 4]); c.strokeStyle = '#FF7A7A'; const y180 = hh - 20 - 120 / 220 * (hh - 50); c.beginPath(); c.moveTo(10, y180); c.lineTo(ww - 10, y180); c.stroke(); c.setLineDash([]); c.fillStyle = '#E8F7FF'; c.font = 'bold 18px Inter,Arial'; c.fillText("Asha's day on the twin", 14, 22); holo.t.needsUpdate = true; };
      addActor(person('#FFFFFF', 0), 'stand', -1.8, a, 1.6, Math.PI * 1.25, null); addActor(person('#66518A', 2), 'stand', 1.9, a, 1.5, Math.PI * 0.8, null);
      for (let i = 0; i < 3; i++) { const sc = canvasTex(128, 64, (c, ww, hh) => { c.fillStyle = '#0D1B2A'; c.fillRect(0, 0, ww, hh); c.strokeStyle = ['#4FD1C5', '#F6AD55', '#9F7AEA'][i]; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 128; k += 3) c.lineTo(k, 36 + 14 * Math.sin(k / (8 + i * 3) + i)); c.stroke(); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: sc.t })); m.position.set(-2.4 + i * 2.3, a + 1.6, -d / 2 + 0.22); g0.add(m); }
      const leds = []; for (let i = 0; i < 4; i++) { P(g1, 0.8, 2.0, 0.7, '#2A2F3A', -2.7 + i * 1.0, b, -d / 2 + 0.7); for (let k = 0; k < 5; k++) leds.push(P(g1, 0.08, 0.04, 0.02, '#33D17A', -2.7 + i * 1.0 + (k - 2) * 0.12, b + 1.4 + (k % 2) * 0.2, -d / 2 + 1.06, true)); }
      ticks.push((dt, t) => leds.forEach((l, i) => l.material.color.setHSL(Math.sin(t * 4 + i * 1.7) > 0.4 ? 0.38 : 0.1, 0.9, 0.5)));
      desk(g1, 1.8, b, 0.6, 1.6, 0.8); chair(g1, 1.8, b, 1.35); addActor(person('#66518A', 1), 'sit-work', 1.8, b, 1.35, Math.PI, b + 0.46);
    }
    if (z.id === 'ayur') {
      const g = fl[0], a = Y0(0); P(g, w, 0.03, d, '#D9C9A3', 0, 0.02, 0);
      [-2.4, -0.8, 0.8, 2.4].forEach((mx, i) => { P(g, 0.75, 0.04, 1.8, ['#B8863B', '#6B8F5E', '#8A5CB1', '#C9372C'][i], mx, a, 0.5); if (i < 3) addActor(person(['#F2F2F0', '#E8D8F2', '#F4E7C8'][i], i), 'yoga', mx, a + 0.04, 0.9, Math.PI, null, 0.6); });
      addActor(person('#E07A3A', 2), 'yoga', 0, a, -1.5, 0, null, 0.6);
      P(g, 4.2, 1.7, 0.3, '#8A6A3E', 0, a, -d / 2 + 0.4); for (let i = 0; i < 8; i++) P(g, 0.3, 0.35, 0.2, ['#6B8F5E', '#C9372C', '#E0A92E', '#8A5CB1'][i % 4], -1.8 + i * 0.52, a + 1.2 + (i % 2) * 0.2, -d / 2 + 0.6);
      const smoke = [0, 1, 2].map(i => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5 })); g.add(s); return s; });
      ticks.push((dt, t) => smoke.forEach((s, i) => { const u = (t * 0.3 + i / 3) % 1; s.position.set(3.0 + Math.sin(u * 5 + i) * 0.15, a + 0.4 + u * 1.4, -1.4); s.material.opacity = 0.5 * (1 - u); s.scale.setScalar(0.8 + u * 1.5); }));
      plant(g, w / 2 - 0.6, a, -d / 2 + 0.7);
      Object.assign(stations, { yoga: { x: 2.4, y: a + 0.04, z: 0.9, face: Math.PI, mode: 'yoga' }, idle: { x: 2.4, y: a + 0.04, z: 0.9, face: Math.PI, mode: 'yoga' } });
    }
    if (z.id === 'pharmacy') {
      const g = fl[0], a = Y0(0);
      P(g, 4.4, 1.0, 0.8, '#E9E4D8', 0.6, a, -d / 2 + 1.5); P(g, 4.5, 0.05, 0.9, '#2E7D6B', 0.6, a + 1.0, -d / 2 + 1.5); addActor(person('#FFFFFF', 0), 'stand', 0.6, a, -d / 2 + 0.85, 0, null);
      for (let i = 0; i < 5; i++) { P(g, 1.1, 2.0, 0.4, '#C9D2D6', -2.6 + i * 1.25, a, -d / 2 + 0.3); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) P(g, 0.3, 0.22, 0.3, ['#E0E7EE', '#2E7D6B', '#E0A92E', '#C9372C'][(k + j + i) % 4], -2.95 + i * 1.25 + j * 0.33, a + 0.35 + k * 0.42, -d / 2 + 0.55); }
      const cross = P(g, 0.9, 0.9, 0.06, '#33D17A', -w / 2 + 0.3, a + 1.8, 0.6, true); ticks.push((dt, t) => cross.material.color.setHSL(0.38, 0.8, 0.5 + 0.15 * Math.sin(t * 3)));
      P(g, 0.9, 0.9, 0.9, '#F2F2F0', 2.3, a, 1.0); P(g, 0.7, 0.2, 0.5, '#2E7D6B', 2.3, a + 0.9, 1.0); P(g, 0.25, 0.05, 0.15, '#33D17A', 2.3, a + 1.12, 1.0, true);
      addActor(person('#8A5CB1', 1), 'stand', -2.0, a, 1.4, Math.PI * 0.9, null);
      Object.assign(stations, { idle: { x: 0.6, y: a, z: -d / 2 + 2.4, face: 0 + Math.PI, mode: 'stand' } });
    }
    if (z.id === 'mart') {
      const g = fl[0], a = Y0(0), goods = ['#C9372C', '#E0A92E', '#6B8F5E', '#F4F0E6', '#8A5A3C', '#2F6FB1'];
      for (let r = 0; r < 3; r++) { P(g, 7.0, 1.5, 0.5, '#C9D2D6', -0.4, a, -1.9 + r * 1.9); for (let k = 0; k < 12; k++) P(g, 0.4, 0.28, 0.4, goods[(k + r) % 6], -3.5 + k * 0.58, a + 0.3 + (k % 3) * 0.4, -1.9 + r * 1.9); }
      P(g, 1.6, 0.9, 0.7, '#8A5A3C', w / 2 - 1.3, a, d / 2 - 1.0); addActor(person('#D79B1E', 0), 'stand', w / 2 - 1.3, a, d / 2 - 1.8, 0, null);
      P(g, 0.8, 0.5, 0.5, '#B8BEC8', -3.8, a + 0.4, 1.5); P(g, 0.9, 0.04, 0.5, '#6B7280', -3.8, a + 0.9, 1.5);
      addActor(person('#4E8B6A', 2), 'stand', 1.0, a, 0.0, Math.PI * 0.5, null); addActor(person('#C97B4A', 1), 'stand', 3.0, a, 1.3, Math.PI, null);
      Object.assign(stations, { idle: { x: -1.4, y: a, z: 0.0, face: -Math.PI / 2, mode: 'stand' }, shop: { x: -1.4, y: a, z: 0.0, face: -Math.PI / 2, mode: 'cook' } });
    }
    if (z.id === 'chaat') {
      const g = fl[0], a = Y0(0);
      P(g, 3.6, 1.0, 0.9, '#8A5A3C', -0.4, a, -d / 2 + 0.8); P(g, 3.8, 0.06, 1.0, '#E8D9BF', -0.4, a + 1.0, -d / 2 + 0.8); P(g, 0.9, 0.4, 0.8, '#2A2A2A', -1.4, a + 1.06, -d / 2 + 0.8); P(g, 3.6, 0.1, 1.1, '#D9482B', -0.4, a + 2.0, -d / 2 + 1.0);
      const sm = [0, 1, 2].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5 })); g.add(s); return s; });
      ticks.push((dt, t) => sm.forEach((s, i) => { const u = (t * 0.5 + i / 3) % 1; s.position.set(-1.4, a + 1.5 + u * 0.7, -d / 2 + 0.8); s.material.opacity = 0.5 * (1 - u); s.scale.setScalar(0.7 + u); }));
      addActor(person('#F2F2F0', 0), 'cook', -0.4, a, -d / 2 + 0.2, 0);
      for (const sx of [-1.4, 0.2, 1.8]) { P(g, 0.4, 0.5, 0.4, '#C9372C', sx, a, 0.7); }
      addActor(person('#8A5CB1', 1), 'sit-eat', -1.4, a, 0.7, Math.PI, a + 0.5); addActor(person('#4E8B6A', 2), 'sit-eat', 1.8, a, 0.7, Math.PI, a + 0.5);
      props.plate = plate(g, 0.2, a + 1.05, -d / 2 + 1.4);
      Object.assign(stations, { eat: { x: 0.2, y: a, z: 0.7, face: Math.PI, mode: 'sit-eat', seat: a + 0.5 }, idle: { x: 0.2, y: a, z: 0.7, face: Math.PI, mode: 'sit', seat: a + 0.5 } });
    }
    cut.traverse(m => { if (m.isMesh) { m.userData.id = z.id; pickables.push(m); } });
    for (const k in stations) stations[k].floor = clamp(Math.round((stations[k].y - 0.07) / FH), 0, floors - 1);
    let curFloor = -1;
    out[z.id] = {
      stations, entrance, props, actors, floors,
      setFloor(n) { if (n === curFloor) return; curFloor = n; fl.forEach((g, i) => { g.visible = i <= n; }); },
      tick(dt, t) { for (const a of actors) { a.ph += dt * 2.6 * a.speed; pose(a.fig, a.mode, a.ph); } for (const f of ticks) f(dt, t); },
      setMeal(name) { if (props.plate) props.plate.material.color.set(name ? foodColour(name) : '#E8C47A'); },
    };
  }
  return out;
}
