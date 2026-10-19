// World engine distilled from GCL Campus (site/scene.js). Everything visible comes from world.config.js.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { WORLD } from './world.config.js';
import { initCity } from './city.js';
import { makeZone, buildCity } from './cityscape.js';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = WORLD.size, C = N / 2;
const at = (x, z, y = 0) => new THREE.Vector3(x - C, y, z - C);   // grid units 0..N, centred at the origin
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Required credit (Tanmay's BM Ecosystem Builder). The world refuses to run if it is removed, hidden or changed.
const PORTFOLIO = 'https://www.tanmayportfolio.me/', REPO = 'https://github.com/tanmay7264/tanmays-bm-ecosystem-builder';
const CREDIT = `Built and designed by <a href="${PORTFOLIO}" target="_blank" rel="noopener">Tanmay</a> · <a href="${REPO}" target="_blank" rel="noopener">BM Ecosystem Builder</a>`;
const credit = document.createElement('p'); credit.className = 'card credit'; credit.innerHTML = CREDIT; document.body.append(credit);
const creditOk = () => {
  const el = document.querySelector('.credit'), s = el && getComputedStyle(el), r = el?.getBoundingClientRect();
  return !!el && el.isConnected && el.innerHTML === CREDIT && s.display !== 'none' && s.visibility === 'visible' && +s.opacity >= 0.9
    && r.width > 40 && r.height > 10 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
};
let creditTimer;
function creditError() {
  clearInterval(creditTimer); renderer?.setAnimationLoop(null);
  document.body.innerHTML = `<div class="credit-error" role="alert"><h1>Credit required</h1><p>This world was made with Tanmay's BM Ecosystem Builder, which requires the credit
    "Built and designed by Tanmay" with links to <a href="${PORTFOLIO}">${PORTFOLIO}</a> and <a href="${REPO}">${REPO}</a>.</p><p>Restore the credit to use this world.</p></div>`;
  throw new Error("Credit removed: Tanmay's BM Ecosystem Builder requires the credit to stay visible.");
}

const canvas = $('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch { document.body.classList.add('no-webgl'); $('.nogl').hidden = false; throw new Error('No WebGL'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);                                   // sky gradient is CSS behind the canvas
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(WORLD.colors.haze, N * 4.5, N * 6.5);

const mats = new Map();
const mat = (c, key = c) => { if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })); return mats.get(key); };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const mesh = (geo, m, x = 0, y = 0, z = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; };
const flat = (x, z, w, d, y, c) => scene.add(mesh(box(w, 0.02, d), mat(c), x - C + w / 2, y, z - C + d / 2, false));
let seed = WORLD.seed || 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // same world every visit

/* ---------- Camera: orthographic isometric, tilt locked, spin allowed ---------- */
const FR = N * 0.55, OFFSET = new THREE.Vector3(60, 52, 60), HOME_ZOOM = 0.9;
const camera = new THREE.OrthographicCamera(-FR, FR, FR, -FR, 30, 240);
camera.position.copy(OFFSET);
const controls = new MapControls(camera, canvas);
controls.enableDamping = !reduceMotion; controls.dampingFactor = 0.08;
controls.minZoom = 0.6; controls.maxZoom = 4; controls.zoomToCursor = true;
controls.minPolarAngle = controls.maxPolarAngle = new THREE.Spherical().setFromVector3(OFFSET).phi;

const hemi = new THREE.HemisphereLight('#E6EEFF', WORLD.colors.ground, 1.45); scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFF1DC', 2.1);
sun.position.set(N * 0.9, N * 1.4, N * 0.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -N * 0.8, right: N * 0.8, top: N * 0.8, bottom: -N * 0.8, near: 1, far: N * 4 }); sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; scene.add(sun);

/* ---------- Ground: presentation slab like an architect's model (layers never coplanar = no z-fight flicker) ---------- */
const SLAB = N + 10;
scene.add(mesh(box(SLAB, 0.06, SLAB), mat(WORLD.colors.ground), 0, -0.03, 0, false));
scene.add(mesh(box(SLAB + 0.04, 0.08, SLAB + 0.04), mat(WORLD.colors.trim), 0, -0.1, 0, false));
scene.add(mesh(box(SLAB, 0.9, SLAB), mat('#F3EFE7'), 0, -0.6, 0));
{ const floor = mesh(new THREE.PlaneGeometry(400, 400), mat(WORLD.colors.floor), 0, -1.2, 0, false); floor.rotation.x = -Math.PI / 2; scene.add(floor); }
for (const [x, z, w, d, c] of WORLD.areas || []) flat(x, z, w, d, 0.006, c);            // lawns, plazas, water, soil…
for (const [x, z, w, d] of WORLD.paths || []) { flat(x - 0.07, z - 0.07, w + 0.14, d + 0.14, 0.011, '#CDBFA6'); flat(x, z, w, d, 0.015, WORLD.colors.path); }

/* ---------- Zones + city fabric (roads, blocks, filler buildings, traffic) ---------- */
const pickables = [], objects = {};
let city = null;                                          // life layer (people, glucose twin, Twin Lab), created after the scene is built
function signTexture(text, colour) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 108;
  const g = c.getContext('2d');
  g.fillStyle = colour; g.beginPath(); g.roundRect(4, 4, 632, 100, 18); g.fill();
  g.fillStyle = '#FFFFFF'; g.font = '700 48px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 320, 58, 600);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const cityCtx = { THREE, scene, at, mat, mesh, box, flat, C, N, rnd, pickables, objects, signTexture };
for (const z of WORLD.zones) makeZone(z, cityCtx);
const fabric = buildCity(cityCtx);

/* ---------- Selection: outline, bobbing pin, pulsing ring, smooth fly-to ---------- */
const ACCENT = WORLD.colors.accent;
const pin = new THREE.Group(), pinMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4 });
{ const tip = mesh(new THREE.ConeGeometry(0.22, 0.55, 20), pinMat, 0, 0.36, 0); tip.rotation.x = Math.PI; pin.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), pinMat, 0, 0.72, 0), tip); }
const marker = new THREE.Group(); marker.add(pin); marker.visible = false; scene.add(marker);
const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 56), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
let outline = null, selected = null, anim = null;
const offset = () => camera.position.clone().sub(controls.target);
const tween = (toT, toZ, toOff = null) => { anim = { t: reduceMotion ? 1 : 0, fromT: controls.target.clone(), toT, fromZ: camera.zoom, toZ, fromOff: offset(), toOff }; };

function select(id) {
  if (id && !objects[id]) id = null;
  selected = id;
  if (outline) { outline.parent.remove(outline); outline.geometry.dispose(); outline = null; }
  const o = objects[id];
  ring.visible = marker.visible = !!o;
  if (o) {
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(box(o.size.x + 0.14, o.size.y, o.size.z + 0.14)), new THREE.LineBasicMaterial({ color: ACCENT }));
    outline.position.y = o.size.y / 2; o.group.add(outline);
    marker.position.copy(o.top); ring.position.set(o.group.position.x, 0.04, o.group.position.z); ring.scale.setScalar(o.r);
    tween(o.group.position.clone().setY(0), Math.max(camera.zoom, 1.8));
  }
  renderPanel();
  history.replaceState(null, '', id ? '#' + id : location.pathname);
}

/* ---------- Info panel (HTML card over the canvas) ---------- */
const panel = $('#panel');
function renderPanel() {
  const z = WORLD.zones.find(o => o.id === selected);
  const custom = city?.panel(z);
  panel.innerHTML = custom ?? (z
    ? `<small class="kicker" style="color:${z.color}">${esc(z.kicker || WORLD.title)}</small><h2>${esc(z.name)}</h2><p>${esc(z.blurb || '')}</p>
       ${z.facts ? `<dl>${z.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
       <button class="btn" data-close>Back to overview</button>`
    : `<small class="kicker">WELCOME</small><h2>${esc(WORLD.title)}</h2><p>${esc(WORLD.intro)}</p>
       <ul>${WORLD.zones.map(o => `<li><button data-select="${o.id}"><i style="background:${o.color}"></i>${esc(o.name)}</button></li>`).join('')}</ul>
       <p class="muted">Click any building · drag to pan · scroll to zoom</p>`);
  city?.afterPanel(selected);
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-select]'); if (s) return select(s.dataset.select);
  if (e.target.closest('[data-close]')) { select(null); tween(new THREE.Vector3(), HOME_ZOOM, OFFSET.clone()); }
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'zoomin' || a === 'zoomout') tween(controls.target.clone(), THREE.MathUtils.clamp(camera.zoom * (a === 'zoomin' ? 1.3 : 1 / 1.3), controls.minZoom, controls.maxZoom));
  if (a === 'spin') tween(controls.target.clone(), camera.zoom, offset().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4));
  if (a === 'home') tween(new THREE.Vector3(), HOME_ZOOM, OFFSET.clone());
});
addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });

/* ---------- Picking + hover ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pickAt = e => {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(pickables, false)[0]?.object.userData.id ?? null;
};
let down = null, hovered = null;
canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; anim = null; });
canvas.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) select(pickAt(e)); down = null; }); // a click, not a drag
canvas.addEventListener('pointermove', e => {
  if (e.buttons) return;
  const id = pickAt(e); if (id === hovered) return;
  objects[hovered]?.hover(false);
  hovered = id; objects[id]?.hover(true);
  canvas.style.cursor = id ? 'pointer' : '';
});

/* ---------- HTML labels pinned to 3D anchors, decluttered every frame ---------- */
const labels = WORLD.zones.map(z => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'maplabel';
  el.innerHTML = `<i style="background:${z.color}"></i>${esc(z.name)}`;
  el.addEventListener('click', () => select(z.id)); $('#labels').append(el);
  return { id: z.id, el, anchor: objects[z.id].top, x: 0, y: 0, w: 0, h: 0 };
});
city = initCity({ ...cityCtx, camera, controls, mats, esc, sun, hemi, select, reduceMotion, lit: fabric.lit, getSelected: () => selected, tween, refreshPanel: () => renderPanel() });
let measured = 0, panels = [];
function declutter() {             // selected label first; hide any that would overlap a placed label, a UI card or the edge
  if (performance.now() - measured > 400) {
    measured = performance.now();
    for (const l of labels) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
    panels = [...document.querySelectorAll('.card')].map(e => e.getBoundingClientRect()).filter(r => r.width);
  }
  const placed = [], cw = canvas.clientWidth, ch = canvas.clientHeight;
  for (const l of [...labels].sort((a, b) => (b.id === selected) - (a.id === selected))) {
    const r = { left: l.x - l.w / 2 - 3, top: l.y - l.h - 9, right: l.x + l.w / 2 + 3, bottom: l.y + 3 };
    const hit = q => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
    const off = !l.w || r.left < 0 || r.right > cw || r.top < 0 || r.bottom > ch || panels.some(hit) || placed.some(hit);
    l.el.classList.toggle('hid', off); l.el.classList.toggle('on', l.id === selected);
    if (!off) placed.push(r);
  }
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h, fr = a < 1 ? FR / a * 0.75 : FR; // portrait: widen
  renderer.setSize(w, h, false);
  Object.assign(camera, { left: -fr * a, right: fr * a, top: fr, bottom: -fr }); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();
camera.zoom = HOME_ZOOM; camera.updateProjectionMatrix();

const SIM_PLAYING = () => city.playing();
const v = new THREE.Vector3(), clock = new THREE.Clock(), BOUND = N * 0.55;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (anim) {                                              // 0.9s cubic ease-out
    anim.t = Math.min(1, anim.t + dt / 0.9); const k = 1 - Math.pow(1 - anim.t, 3);
    controls.target.lerpVectors(anim.fromT, anim.toT, k);
    const off = anim.toOff ? anim.fromOff.clone().lerp(anim.toOff, k).setLength(anim.fromOff.length()) : anim.fromOff;
    camera.position.copy(controls.target).add(off);
    camera.zoom = THREE.MathUtils.lerp(anim.fromZ, anim.toZ, k); camera.updateProjectionMatrix();
    if (anim.t >= 1) anim = null;
  }
  fabric.update(SIM_PLAYING() ? dt : 0);
  city.update(dt, t, canvas.clientWidth, canvas.clientHeight);
  const before = controls.target.clone();                  // keep the world on screen
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -BOUND, BOUND);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -BOUND, BOUND);
  camera.position.add(controls.target.clone().sub(before));
  controls.update();
  if (!reduceMotion) { pin.position.y = Math.sin(t * 2.4) * 0.12; ring.material.opacity = 0.35 + Math.sin(t * 2.4) * 0.25; }
  renderer.render(scene, camera);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const l of labels) {
    v.copy(l.anchor).project(camera); l.x = (v.x + 1) / 2 * w; l.y = (1 - v.y) / 2 * h;
    l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, -100%)`;
  }
  declutter();
});

select(location.hash.slice(1) || null);                    // deep links: #<zone-id>
if (!creditOk()) creditError();
creditTimer = setInterval(() => { if (!creditOk()) creditError(); }, 1500);
// ponytail: client-side check only; anyone editing this file can strip it. Real enforcement = a license, not code.
