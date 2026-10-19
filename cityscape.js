// Dense city fabric for Twin Nagar: facade-textured buildings (zones open into cutaways), roads with markings, sidewalks,
// filler blocks, a skyline ring, street lamps and trees, and moving traffic.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, WORLD } from './world.config.js';
import { makeFigure, pose } from './figures.js';

export const FH = GRID.FH;
const { colx, rowb, roadsV, roadsH, roadW, blockX, blockZ } = GRID;
const lit = [];                                              // facade materials whose windows glow at night

/* ---- facade textures: one window cell = 3 units wide x one storey tall; UVs are scaled per building so windows stay square.
   Kinds: stone (zones, tinted), brick (tenements), glass (curtain-wall towers), deco (limestone piers). Baked colour, so tint is white. ---- */
function tex(draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 128; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t;
}
const FACADE = tex(g => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 160, 128); g.fillStyle = '#E9E6DE'; g.fillRect(0, 118, 160, 10); g.fillStyle = '#8FB6D4'; g.fillRect(34, 30, 92, 62); g.fillStyle = '#FFFFFF'; g.fillRect(78, 30, 4, 62); g.fillRect(34, 59, 92, 3); });
const EM = { win: tex(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 160, 128); g.fillStyle = '#FFF'; g.fillRect(34, 30, 92, 62); }, false),
  glass: tex(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 160, 128); g.fillStyle = '#FFF'; g.fillRect(6, 8, 148, 84); }, false),
  deco: tex(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 160, 128); g.fillStyle = '#FFF'; g.fillRect(28, 26, 34, 72); g.fillRect(98, 26, 34, 72); }, false) };
const BRICK = ['#A8503A', '#8E4636', '#B9654A', '#7C5A48', '#9A8A7A'].map(base => tex(g => {
  g.fillStyle = base; g.fillRect(0, 0, 160, 128); g.fillStyle = 'rgba(255,255,255,0.14)';
  for (let y = 0; y < 128; y += 8) { g.fillRect(0, y, 160, 1); for (let x = (y / 8) % 2 ? 0 : 10; x < 160; x += 20) g.fillRect(x, y, 1, 8); }
  g.fillStyle = '#EDE6D6'; g.fillRect(28, 24, 104, 8); g.fillRect(30, 94, 100, 6);                                  // stone lintel + sill
  g.fillStyle = '#26323E'; g.fillRect(34, 32, 92, 62); g.fillStyle = '#EDE6D6'; g.fillRect(78, 32, 4, 62); g.fillRect(34, 61, 92, 3);
  g.fillStyle = 'rgba(160,200,235,0.35)'; g.fillRect(36, 34, 40, 24); g.fillRect(84, 34, 40, 24);
}));
const GLASS = ['#4F86B0', '#3F8A8A', '#35506E', '#8A7358', '#6C7F95'].map(base => tex(g => {
  const gr = g.createLinearGradient(0, 0, 160, 128); gr.addColorStop(0, base); gr.addColorStop(1, '#1D2B3A'); g.fillStyle = gr; g.fillRect(0, 0, 160, 128);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0, 90); g.lineTo(100, 0); g.lineTo(160, 0); g.lineTo(30, 128); g.lineTo(0, 128); g.fill();
  g.fillStyle = '#2B3340'; g.fillRect(0, 98, 160, 30); g.fillRect(0, 0, 3, 128); g.fillRect(77, 0, 3, 98); g.fillRect(157, 0, 3, 128);   // spandrel + mullions
}));
const DECO = ['#D9CFB8', '#C9B28F', '#CFC8BC'].map(base => tex(g => {
  g.fillStyle = base; g.fillRect(0, 0, 160, 128); g.fillStyle = 'rgba(0,0,0,0.08)'; for (const x of [0, 66, 94, 156]) g.fillRect(x, 0, 4, 128);
  g.fillStyle = '#2C3846'; g.fillRect(28, 26, 34, 72); g.fillRect(98, 26, 34, 72); g.fillStyle = 'rgba(160,200,235,0.3)'; g.fillRect(30, 28, 30, 26); g.fillRect(100, 28, 30, 26);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 112, 160, 16);
}));
const KINDS = { brick: [BRICK, EM.win], glass: [GLASS, EM.glass], deco: [DECO, EM.deco] };
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nv = Math.max(1, Math.round(h / FH));
  for (let f = 0; f < 6; f++) {
    const su = f < 2 ? Math.max(1, Math.round(d / 3)) : f < 4 ? 1 : Math.max(1, Math.round(w / 3)), sv = f === 2 || f === 3 ? 1 : nv;
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv); }
  }
  return g;
}
const glowK = () => 0.25 + Math.random() * 0.75;                                                               // each building's night window brightness (not seeded: only affects glow)
const facadeMat = tint => { const m = new THREE.MeshStandardMaterial({ color: tint, map: FACADE, roughness: 0.85, emissive: '#FFC870', emissiveMap: EM.win, emissiveIntensity: 0 }); m.userData.k = glowK(); lit.push(m); return m; };
const kindMat = (kind, i) => { const [maps, em] = KINDS[kind]; const m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: maps[i % maps.length], roughness: kind === 'glass' ? 0.25 : 0.88, metalness: kind === 'glass' ? 0.35 : 0, emissive: kind === 'glass' ? '#BFE2FF' : '#FFC870', emissiveMap: em, emissiveIntensity: 0 }); m.userData.k = glowK(); lit.push(m); return m; };
let _signTexture = null;
const signCache = new Map();
function signMat(text, colour) { const k = text + colour; if (!signCache.has(k)) signCache.set(k, new THREE.MeshBasicMaterial({ map: _signTexture(text, colour), transparent: true })); return signCache.get(k); }

/* ---- vehicles: one merged geometry per type for the paint (instance colour) and one for fixed trim (vertex colour) ---- */
const vcol = (g, hex) => { const n = g.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(hex); for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
const vb = (w, h, d, x, y, z, hex, top = 1) => { const g = new THREE.BoxGeometry(w, h, d); if (top !== 1) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * top); } g.translate(x, y, z); return hex ? vcol(g, hex) : g; };
const vw = (x, z, r) => { const g = new THREE.CylinderGeometry(r, r, 0.2, 14); g.rotateX(Math.PI / 2); g.translate(x, r, z); return vcol(g, '#15171A'); };
const GL = '#1F2D3D';
const car = (L, W, H, taxi) => {
  const cab = H - 0.5, paint = [vb(L, 0.36, W, 0, 0.36, 0), vb(L * 0.36, 0.05, W * 0.86, -L * 0.07, 0.36 + 0.18 + cab + 0.02, 0)];
  const trim = [vb(L * 0.5, cab, W * 0.9, -L * 0.07, 0.54 + cab / 2, 0, GL, 0.72), vw(L * 0.31, W * 0.46, 0.27), vw(L * 0.31, -W * 0.46, 0.27), vw(-L * 0.31, W * 0.46, 0.27), vw(-L * 0.31, -W * 0.46, 0.27),
    vb(0.05, 0.1, 0.28, L / 2, 0.5, W * 0.3, '#FFF6D0'), vb(0.05, 0.1, 0.28, L / 2, 0.5, -W * 0.3, '#FFF6D0'), vb(0.05, 0.1, 0.28, -L / 2, 0.5, W * 0.3, '#C0202A'), vb(0.05, 0.1, 0.28, -L / 2, 0.5, -W * 0.3, '#C0202A'),
    vb(0.12, 0.14, W + 0.02, L / 2, 0.3, 0, '#2A2D33'), vb(0.12, 0.14, W + 0.02, -L / 2, 0.3, 0, '#2A2D33')];
  if (taxi) trim.push(vb(0.4, 0.13, 0.2, -L * 0.07, 0.36 + 0.18 + cab + 0.1, 0, '#FFF3C0'), vb(L + 0.01, 0.05, W + 0.01, 0, 0.45, 0, '#1B1B1B'));
  return { paint, trim, L, W };
};
const VEH = {
  sedan: () => car(3.0, 1.3, 1.0), taxi: () => car(3.1, 1.32, 1.05, true), suv: () => car(3.2, 1.4, 1.25),
  bus: () => ({ L: 6.4, W: 1.52, paint: [vb(6.4, 1.5, 1.5, 0, 1.05, 0), vb(6.4, 0.08, 1.5, 0, 1.84, 0)],
    trim: [vb(6.0, 0.62, 1.52, 0, 1.45, 0, '#2B3945'), vb(6.42, 0.22, 1.52, 0, 0.78, 0, '#1F5FAE'), vb(0.05, 0.75, 1.4, 3.2, 1.4, 0, GL), vb(2.2, 0.14, 1.0, -0.6, 1.93, 0, '#C6CBD2'), vw(2.2, 0.6, 0.32), vw(2.2, -0.6, 0.32), vw(-2.0, 0.6, 0.32), vw(-2.0, -0.6, 0.32), vb(0.05, 0.12, 0.3, 3.2, 0.62, 0.45, '#FFF6D0'), vb(0.05, 0.12, 0.3, 3.2, 0.62, -0.45, '#FFF6D0')] }),
  truck: () => ({ L: 4.6, W: 1.45, paint: [vb(1.2, 1.0, 1.4, 1.6, 0.75, 0), vb(3.3, 1.5, 1.45, -0.55, 1.0, 0)],
    trim: [vb(0.05, 0.42, 1.3, 2.2, 1.05, 0, GL), vw(1.6, 0.6, 0.3), vw(1.6, -0.6, 0.3), vw(-1.2, 0.6, 0.3), vw(-1.2, -0.6, 0.3), vw(-2.0, 0.6, 0.3), vw(-2.0, -0.6, 0.3), vb(0.05, 0.1, 0.3, 2.2, 0.5, 0.4, '#FFF6D0'), vb(0.05, 0.1, 0.3, 2.2, 0.5, -0.4, '#FFF6D0')] }),
};
const vehicleKit = {};
function kit(type) {
  if (!vehicleKit[type]) { const v = VEH[type](); vehicleKit[type] = { L: v.L, W: v.W, paint: mergeGeometries(v.paint), trim: mergeGeometries(v.trim) }; }
  return vehicleKit[type];
}
export function makeVehicle(type, colour, scale = 1) {                                                          // a single (non-instanced) vehicle, e.g. Asha's taxi
  const k = kit(type), g = new THREE.Group();
  const body = new THREE.Mesh(k.paint, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45 })), trim = new THREE.Mesh(k.trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
  body.castShadow = trim.castShadow = true; g.add(body, trim); g.scale.setScalar(scale); return g;
}

export function makeZone(z, ctx) {
  const { THREE: T, scene, at, mat, mesh, box, pickables, objects, signTexture } = ctx; _signTexture = signTexture;
  const { id, x, z: zz, w, d, floors, color } = z, h = floors * FH; z.h = h;
  const g = new THREE.Group(); g.position.copy(at(x, zz)); scene.add(g);
  const shell = new THREE.Group(), roof = new THREE.Group(), cut = new THREE.Group(); cut.visible = false; g.add(shell, roof, cut);
  const wallMat = facadeMat(z.wall || '#F3EFE6'), baseCol = new THREE.Color(z.wall || '#F3EFE6');
  const walls = mesh(boxGeo(w, h, d), wallMat, 0, h / 2, 0); shell.add(walls);
  shell.add(mesh(box(w + 0.3, 0.2, d + 0.3), mat('#CFC8B8'), 0, 0.1, 0));
  if (!z.open) {
    shell.add(mesh(box(1.5, 1.9, 0.06), mat('#35414F'), 0, 0.95, d / 2 + 0.03, false));                         // glass door
    shell.add(mesh(box(2.4, 0.14, 1.1), mat(color), 0, 2.15, d / 2 + 0.5));                                       // awning
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.85, 5.2), 0.8), new THREE.MeshBasicMaterial({ map: signTexture(z.name, color), transparent: true }));
    sign.position.set(0, Math.min(h - 0.5, 3.1), d / 2 + 0.04); shell.add(sign);
  } else {                                                                                                          // open-air pavilion
    walls.visible = false;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) shell.add(mesh(box(0.3, h, 0.3), mat('#EFE9D8'), sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2)));
    shell.add(mesh(box(w - 0.6, 0.12, d - 0.6), mat('#D8CDB4'), 0, 0.14, 0));
  }
  roof.add(mesh(box(w + 0.25, 0.28, d + 0.25), mat(color), 0, h + 0.14, 0));                                       // roof slab in the zone colour
  for (const [rx, rz, rw, rd] of [[0, -(d / 2 + 0.1), w + 0.3, 0.2], [0, d / 2 + 0.1, w + 0.3, 0.2], [-(w / 2 + 0.1), 0, 0.2, d], [w / 2 + 0.1, 0, 0.2, d]])
    roof.add(mesh(box(rw, 0.35, rd), mat('#6E7686'), rx, h + 0.4, rz));                                           // parapet
  if (!z.open) { roof.add(mesh(box(1.4, 0.7, 1.0), mat('#9AA3B0'), -w * 0.25, h + 0.65, -d * 0.2), mesh(box(1.0, 0.5, 0.8), mat('#9AA3B0'), w * 0.2, h + 0.55, d * 0.1)); }
  g.traverse(m => { if (m.isMesh) { m.userData.id = id; pickables.push(m); } });
  const o = objects[id] = {
    group: g, body: walls, size: new THREE.Vector3(w, h, d), top: at(x, zz, h + 1.4), r: Math.max(w, d) * 0.75, shell, roof, cut, h, open: 0,
    hover(on) { wallMat.color.copy(baseCol).lerp(new THREE.Color('#FFFFFF'), on ? 0.35 : 0); },
    setOpen(k) {                                                                                                    // 0 closed .. 1 cutaway with the roof lifted away
      o.open = k; const e = 1 - Math.pow(1 - k, 3);
      roof.position.y = e * 4; roof.visible = k < 0.55; shell.visible = k < 0.4; cut.visible = k > 0.15;
    },
  };
  return o;
}

export function buildCity(ctx) {
  const { THREE: T, scene, at, mat, mesh, box, flat, C, N, D, rnd, pickables, objects } = ctx;
  const add = (o) => (scene.add(o), o);
  // blocks: pavement plots (park block is lawn)
  const NC = colx.length, NR = rowb.length;
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const [x0, x1] = blockX[c], [z0, z1] = blockZ[r], park = r === 1 && c === 1;
    flat(x0, z0, x1 - x0, z1 - z0, 0.01, park ? '#9FCB7C' : '#D9D6CF');
    if (!park) flat(x0, z1 - 1.6, x1 - x0, 1.6, 0.02, '#E8E5DE');                                            // sidewalk strip along the south edge
  }
  // roads + markings
  const ROAD = '#454A55';
  for (const rz of roadsH) flat(0, rz - roadW / 2, WORLD.size, roadW, 0.012, ROAD);
  for (const rx of roadsV) flat(rx - roadW / 2, 0, roadW, D, 0.013, ROAD);
  const dash = [], zebra = [];
  for (const rz of roadsH) for (let x = 0.5; x < WORLD.size; x += 2) if (!roadsV.some(v => Math.abs(x - v) < roadW / 2 + 1)) dash.push([x, rz, 1.1, 0.14]);
  for (const rx of roadsV) for (let z = 0.5; z < D; z += 2) if (!roadsH.some(v => Math.abs(z - v) < roadW / 2 + 1)) dash.push([rx, z, 0.14, 1.1]);
  for (const rx of roadsV) for (const rz of roadsH) for (let i = -3; i <= 3; i++) {                           // zebra crossings on all four arms
    for (const s of [-1, 1]) { zebra.push([rx + i * 0.42, rz + s * (roadW / 2 + 0.5), 0.22, 1.0]); zebra.push([rx + s * (roadW / 2 + 0.5), rz + i * 0.42, 1.0, 0.22]); }
  }
  const strips = (list, col) => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }), list.length), o = new THREE.Object3D();
    list.forEach(([x, z, w, d], i) => { o.position.copy(at(x, z, 0.03)); o.scale.set(w, 1, d); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); add(im); };
  strips(dash, '#F2E9B8'); strips(zebra, '#F4F4F0');

  // ---- filler buildings (non-clickable): brick tenements with storefronts, fire escapes and water towers; glass and deco towers around the edge
  const SHOPS = [['DELI', '#2F7A4B'], ['PIZZA', '#C9372C'], ['BAGELS', '#B8863B'], ['BANK', '#2B5C9A'], ['NAILS', '#C2557A'], ['LAUNDRY', '#3E7CB1'], ['BOOKS', '#6B4E9B'], ['DINER', '#D9693A'], ['BARBER', '#2A2E36'], ['THAI', '#B03A2E'], ['SUSHI', '#1F6F78'], ['TACOS', '#D79B1E'], ['FLORIST', '#4CA96A'], ['HARDWARE', '#5A6270'], ['COFFEE', '#6B4A32'], ['PHARMACY', '#2E7D6B']];
  const metal = '#9AA3B0';
  const roofProps = (g, w, d, h, floors) => {
    if (rnd() < 0.7) g.add(mesh(box(w * 0.3, 0.6, d * 0.3), mat(metal), (rnd() - .5) * w * 0.4, h + 0.5, (rnd() - .5) * d * 0.4));
    if (floors >= 3 && w > 2.4 && rnd() < 0.55) {                                                          // rooftop wooden water tank on legs
      const tx = (rnd() - .5) * w * 0.4, tz = (rnd() - .5) * d * 0.4;
      for (const [lx, lz] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) g.add(mesh(box(0.06, 0.9, 0.06), mat('#4A3A2C'), tx + lx, h + 0.75, tz + lz));
      g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.85, 12), mat('#8B6B4A'), tx, h + 1.65, tz), mesh(new THREE.ConeGeometry(0.46, 0.35, 12), mat('#5C4636'), tx, h + 2.25, tz));
    }
  };
  const fireEscape = (g, w, d, floors) => {
    const x0 = (rnd() - .5) * w * 0.3;
    for (let f = 1; f < floors; f++) {
      g.add(mesh(box(1.5, 0.05, 0.55), mat('#23272E'), x0, f * FH - 0.45, d / 2 + 0.28, false), mesh(box(1.5, 0.4, 0.03), mat('#23272E'), x0, f * FH - 0.2, d / 2 + 0.55, false));
      g.add(mesh(box(0.05, FH, 0.05), mat('#23272E'), x0 + 0.68, f * FH - FH / 2, d / 2 + 0.5, false));
    }
  };
  const shopfront = (g, w, d, h) => {
    const [name, col] = SHOPS[Math.floor(rnd() * SHOPS.length)], sw = Math.min(w * 0.8, 2.4);
    g.add(mesh(box(w * 0.82, 1.55, 0.06), mat('#2B3A48'), 0, 0.95, d / 2 + 0.03, false), mesh(box(w * 0.86, 0.1, 0.7), mat(col), 0, 1.92, d / 2 + 0.34));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 5.9), signMat(name, col)); s.position.set(0, Math.min(h - 0.3, 2.3), d / 2 + 0.06); g.add(s);
  };
  const billboards = [];
  const fill = (x, z, w, d, floors, kind, vi, o = {}) => {
    const h = floors * FH, g = new THREE.Group(); g.position.copy(at(x, z)); scene.add(g);
    const fm = kind === 'stone' ? facadeMat(pal[vi % pal.length]) : kindMat(kind, vi);
    g.add(mesh(boxGeo(w, h, d), fm, 0, h / 2, 0)); g.add(mesh(box(w + 0.2, 0.22, d + 0.2), mat(kind === 'glass' ? '#4B5563' : '#7C8494'), 0, h + 0.11, 0));
    if (kind === 'brick' || kind === 'stone') { if (floors <= 4 && !o.noShop) shopfront(g, w, d, h); if (floors >= 3 && kind === 'brick' && rnd() < 0.7) fireEscape(g, w, d, floors); }
    if (!o.noProps) roofProps(g, w, d, h, floors);
    return { g, h };
  };
  const pal = ['#E8DCCB', '#D9E1E8', '#E6D5D1', '#DCE5D8', '#E9E2C8', '#D6D3E3', '#E4D0BC'];
  const STREET = ['brick', 'brick', 'stone', 'deco', 'brick'];
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    if (r === 1 && c === 1) continue;
    const zone = WORLD.zones.find(zn => Math.abs(zn.x - colx[c]) < 0.1 && Math.abs(zn.z + zn.d / 2 + 1.6 - rowb[r]) < 0.1);
    const [x0, x1] = blockX[c], z0 = blockZ[r][0] + 0.6, zEnd = rowb[r] - 1.6 - zone.d - 0.5;
    let x = x0 + 1.4; const dep = Math.min(zEnd - z0, 3.8);
    while (x < x1 - 3.4 && dep > 2) {
      const w = Math.min(2.8 + rnd() * 2, x1 - 1.4 - x), tall = r === 0, fl = tall ? 3 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 3);                 // only the top row may be tall: anything taller hides the blocks behind it
      const kind = tall && rnd() < 0.5 ? (rnd() < 0.5 ? 'glass' : 'deco') : STREET[Math.floor(rnd() * STREET.length)];
      const b = fill(x + w / 2, z0 + dep / 2, w, dep, fl, kind, Math.floor(rnd() * 5));
      if (billboards.length < 4 && r >= 1 && fl <= 4 && w > 3 && rnd() < 0.25) billboards.push([x + w / 2, z0 + dep / 2, b.h + 0.4, w]);
      x += w + 0.35;
    }
    const sideW = (x1 - x0 - zone.w) / 2 - 1.2;                                                              // street-front shops beside the main building
    if (sideW > 1.6) for (const s of [-1, 1]) fill(zone.x + s * (zone.w / 2 + 0.5 + sideW / 2 + 0.2), zone.z, sideW, zone.d * 0.8, 1 + Math.floor(rnd() * 2), rnd() < 0.5 ? 'brick' : 'stone', Math.floor(rnd() * 5));
  }
  // billboards: bright ad boards on a few roofs
  const adTex = (lines, a, b) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#FFF'; g.textAlign = 'center'; g.font = '800 64px Inter, Arial, sans-serif'; g.fillText(lines[0], 256, 110, 480); g.font = '600 38px Inter, Arial, sans-serif'; g.fillText(lines[1], 256, 190, 480);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const ADS = [[['TWIN NAGAR', 'your glucose, simulated'], '#0F8B8D', '#1B3A5C'], [['WALK 10 MIN', 'after every meal'], '#D9693A', '#8A2B3B'], [['LOG THE CHAI', 'every bite counts'], '#6B4E9B', '#2B2A66'], [['DRINK WATER', 'not the cola'], '#2B8FD6', '#12466E']];
  billboards.forEach(([x, z, y, w], i) => { const [l, a, b] = ADS[i % ADS.length], g = new THREE.Group(); g.position.copy(at(x, z)); scene.add(g);
    for (const s of [-1, 1]) g.add(mesh(box(0.08, 1.2, 0.08), mat('#3A3F48'), s * 1.1, y + 0.3, 0.2));
    g.add(mesh(box(2.8, 1.5, 0.12), mat('#20242B'), 0, y + 1.35, 0.2)); const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: adTex(l, a, b) })); p.position.set(0, y + 1.35, 0.27); g.add(p); });
  // skyline ring: low in front (south, east), tall behind (north, west), with setbacks, plus three landmark towers
  const tower = (x, z, w, d, tiers, kind, vi, spire) => {                                                  // stacked setback tiers, optional spire
    let y = 0, ww = w, dd = d;
    tiers.forEach((fl, i) => { const h = fl * FH, g = new THREE.Group(); g.position.copy(at(x, z, y)); scene.add(g);
      g.add(mesh(boxGeo(ww, h, dd), kindMat(kind, vi + i), 0, h / 2, 0)); g.add(mesh(box(ww + 0.2, 0.2, dd + 0.2), mat('#6E7686'), 0, h + 0.1, 0)); y += h; ww *= 0.72; dd *= 0.72; });
    if (spire) { const g = new THREE.Group(); g.position.copy(at(x, z, y)); scene.add(g); g.add(mesh(new THREE.ConeGeometry(ww * 0.45, spire, 8), mat('#C6CCD6'), 0, spire / 2, 0)); g.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, spire * 0.6, 6), mat('#8A8F99'), 0, spire * 1.2, 0)); }
  };
  tower(10, -3.4, 5.2, 4.2, [6, 4, 3], 'deco', 0, 5);                                                         // Empire-State-style setback tower
  tower(-3.4, 40, 4.4, 4.4, [7, 3, 3], 'deco', 1, 6);                                                         // silver-crowned art-deco tower
  tower(-3.4, 12, 4.6, 4.2, [7, 3, 3], 'glass', 2, 3);                                                       // glass tower with a mast
  tower(52, -3.4, 4.4, 4, [5, 3], 'glass', 4, 0);
  const keep = [[10, -3.4], [-3.4, 40], [-3.4, 12], [52, -3.4]];
  const ring = (x, z, w, d, tall) => { if (keep.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 5)) return;
    const kind = tall ? ['glass', 'deco', 'brick', 'glass'][Math.floor(rnd() * 4)] : ['brick', 'stone', 'brick', 'deco'][Math.floor(rnd() * 4)];
    fill(x, z, w, d, tall ? 4 + Math.floor(rnd() * 5) : 1 + Math.floor(rnd() * 2), kind, Math.floor(rnd() * 5), { noShop: true }); };
  for (let p = -2; p < N + 2; p += 4.4) { const w = 3.3 + rnd() * 1.2; ring(p, -3.2, w, 3.4, true); ring(p, D + 3.2, w, 3.4, false); }
  for (let p = -2; p < D + 2; p += 4.4) { const w = 3.3 + rnd() * 1.2; ring(-3.2, p, 3.4, w, true); ring(N + 3.2, p, 3.4, w, false); }   // tall to the north and west (behind), low to the south and east (in front of the camera)

  // Lake Park: track, pond, benches, trees
  const track = '#C9A27A';
  flat(19.4, 19.4, 9.2, 0.6, 0.03, track); flat(19.4, 28.0, 9.2, 0.6, 0.03, track); flat(19.4, 19.4, 0.6, 9.2, 0.03, track); flat(28.0, 19.4, 0.6, 9.2, 0.03, track);
  flat(26.0, 21.2, 2.4, 2.0, 0.035, '#8CC7E6');
  const trunks = [], crowns = [];
  const tree = (x, z, s = 1) => { trunks.push([x, z, s]); crowns.push([x, z, s]); };
  for (let i = 0; i < 26; i++) { const x = 18.2 + rnd() * 11.6, z = 18.2 + rnd() * 11.6; const onTrack = (x > 19.1 && x < 28.9 && z > 19.1 && z < 28.9) && !(x > 20.2 && x < 27.8 && z > 20.2 && z < 27.6) ? true : false; if (!onTrack && !(x > 21 && x < 27 && z > 21 && z < 27) && !(x > 25.6 && x < 28.6 && z > 20.8 && z < 23.5)) tree(x, z, 0.9 + rnd() * 0.5); }
  for (const rx of roadsV) for (let z = 3; z < D - 2; z += 4.2) if (!roadsH.some(v => Math.abs(z - v) < 3.4)) { tree(rx - roadW / 2 - 0.4, z, 0.8); tree(rx + roadW / 2 + 0.4, z + 2.1, 0.8); }
  const inst = (geo, m, list, fn) => { const im = new THREE.InstancedMesh(geo, m, list.length), o = new THREE.Object3D(); im.castShadow = true; list.forEach((v, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); const col = fn(o, v, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (col) im.setColorAt(i, new THREE.Color(col)); }); add(im); return im; };
  const leafMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true });
  inst(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 6), mat('#7A5A3E'), trunks, (o, [x, z, s]) => { o.position.copy(at(x, z, 0.5 * s)); o.scale.setScalar(s); });
  inst(new THREE.IcosahedronGeometry(0.8, 1), leafMat, crowns, (o, [x, z, s], i) => { o.position.copy(at(x, z, 1.5 * s)); o.scale.setScalar(s); return WORLD.colors.foliage[i % WORLD.colors.foliage.length]; });

  // ---- street furniture: cobra-head lamps, hydrants, bins, benches, mailboxes, bike docks, bus shelters, subway entrances, food carts, newsstands
  const inX = (x) => roadsV.some(v => Math.abs(x - v) < roadW / 2 + 1.8), inZ = (z) => roadsH.some(v => Math.abs(z - v) < roadW / 2 + 1.8);
  const curbs = [];                                                                                                 // [x, z, yaw-to-road]
  for (const rx of roadsV) for (const s of [-1, 1]) for (let z = 3; z < D - 2; z += 2.6) if (!inZ(z)) curbs.push([rx + s * (roadW / 2 + 0.3), z, s > 0 ? Math.PI : 0, 'v']);
  for (const rz of roadsH) for (const s of [-1, 1]) for (let x = 3; x < N - 2; x += 2.6) if (!inX(x)) curbs.push([x, rz + s * (roadW / 2 + 0.3), s > 0 ? Math.PI / 2 : -Math.PI / 2, 'h']);
  const pick = (every, off) => curbs.filter((_, i) => (i + off) % every === 0);
  const lampList = pick(2, 0).filter((_, i) => i % 2 === 0);
  inst(new THREE.CylinderGeometry(0.05, 0.06, 2.8, 6), mat('#3E444F'), lampList, (o, [x, z]) => o.position.copy(at(x, z, 1.4)));
  inst(new THREE.BoxGeometry(0.7, 0.06, 0.07), mat('#3E444F'), lampList, (o, [x, z, yaw]) => { o.position.copy(at(x, z, 2.8)); o.rotation.y = yaw; o.translateX(0.32); });
  inst(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFE9A8' }), lampList, (o, [x, z, yaw]) => { o.position.copy(at(x, z, 2.74)); o.rotation.y = yaw; o.translateX(0.62); });
  const hyd = pick(9, 3);
  inst(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 8), mat('#C9372C'), hyd, (o, [x, z]) => o.position.copy(at(x, z, 0.21)));
  inst(new THREE.SphereGeometry(0.11, 8, 6), mat('#C9372C'), hyd, (o, [x, z]) => o.position.copy(at(x, z, 0.46)));
  const bins = pick(5, 1);
  inst(new THREE.CylinderGeometry(0.17, 0.15, 0.5, 10), mat('#2F5D45'), bins, (o, [x, z]) => o.position.copy(at(x, z, 0.25)));
  const benches = pick(11, 5);
  inst(new THREE.BoxGeometry(0.9, 0.08, 0.34), mat('#7A5A3E'), benches, (o, [x, z, yaw]) => { o.position.copy(at(x, z, 0.38)); o.rotation.y = yaw + Math.PI / 2; });
  inst(new THREE.BoxGeometry(0.9, 0.3, 0.05), mat('#7A5A3E'), benches, (o, [x, z, yaw]) => { o.position.copy(at(x, z, 0.58)); o.rotation.y = yaw + Math.PI / 2; o.translateZ(-0.17); });
  const mail = pick(17, 7);
  inst(new THREE.BoxGeometry(0.3, 0.55, 0.3), mat('#2B5C9A'), mail, (o, [x, z]) => o.position.copy(at(x, z, 0.3)));
  const docks = pick(23, 2);                                                                                         // bike-share docks: a row of bikes with blue frames
  inst(new THREE.BoxGeometry(0.1, 0.5, 1.4), mat('#2B8FD6'), docks, (o, [x, z, yaw]) => { o.position.copy(at(x, z, 0.3)); o.rotation.y = yaw + Math.PI / 2; });
  // bus shelters, subway entrances, food carts, newsstands (a few hand-placed)
  const spots = { shelter: [[14.4 - 0.1, 23.5, 'v'], [49.9, 38, 'v'], [32 + 2.0, 55, 'v'], [26, 17.4, 'h']], subway: [[14.3, 14.3], [49.8, 17.7], [17.7, 49.8], [33.7, 33.7], [49.8, 49.8]],
    cart: [[17.9, 5], [30.2, 20], [50, 9], [13.2, 55], [33.8, 57], [46.2, 25], [14.5, 40], [46.2, 41]], news: [[17.9, 12], [30.1, 36], [49.9, 55]] };
  for (const [x, z, ax] of spots.shelter) { const g = new THREE.Group(); g.position.copy(at(x, z)); g.rotation.y = ax === 'h' ? 0 : Math.PI / 2; scene.add(g);
    for (const s of [-1, 1]) g.add(mesh(box(0.06, 1.9, 0.06), mat('#2A2E36'), s * 0.9, 0.95, 0));
    g.add(mesh(box(2.1, 0.08, 0.8), mat('#2A2E36'), 0, 1.95, 0), mesh(box(1.9, 1.2, 0.04), mat('#8FB6D4'), 0, 1.1, -0.38), mesh(box(1.4, 0.06, 0.3), mat('#7A5A3E'), 0, 0.5, -0.2));
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshBasicMaterial({ map: adTex(['BUS', 'M15'], '#1F5FAE', '#12466E') })); ad.position.set(1.12, 1.1, 0.0); ad.rotation.y = Math.PI / 2; g.add(ad); }
  for (const [x, z] of spots.subway) { const g = new THREE.Group(); g.position.copy(at(x, z)); scene.add(g);
    g.add(mesh(box(1.5, 0.12, 1.1), mat('#15171A'), 0, 0.03, 0, false));
    for (const [rw, rd, rx2, rz2] of [[1.5, 0.05, 0, -0.55], [1.5, 0.05, 0, 0.55], [0.05, 1.1, -0.75, 0], [0.05, 1.1, 0.75, 0]]) g.add(mesh(box(rw, 0.9, rd), mat('#2E6B3A'), rx2, 0.5, rz2));
    for (const s of [-1, 1]) { g.add(mesh(box(0.07, 1.5, 0.07), mat('#2E6B3A'), s * 0.75, 0.75, 0.55)); g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: '#7CFF9B' }), s * 0.75, 1.62, 0.55, false)); }
    g.add(mesh(box(0.8, 0.07, 0.6), mat('#4A505C'), 0, 0.12, 0, false)); }
  for (const [x, z] of spots.cart) { const g = new THREE.Group(); g.position.copy(at(x, z)); g.rotation.y = (x * 7 | 0) % 4 * Math.PI / 2; scene.add(g);
    g.add(mesh(box(1.1, 0.55, 0.6), mat('#B8BEC8'), 0, 0.55, 0), mesh(box(1.14, 0.12, 0.64), mat('#2B5C9A'), 0, 0.88, 0));
    for (const s of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10), mat('#15171A'), s * 0.4, 0.17, 0.35); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(mesh(box(0.05, 1.3, 0.05), mat('#8A8F99'), 0.45, 1.5, 0), mesh(new THREE.ConeGeometry(0.75, 0.3, 10), mat(x * 3 % 2 < 1 ? '#F2C230' : '#C9372C'), 0.45, 2.1, 0)); }
  for (const [x, z] of spots.news) { const g = new THREE.Group(); g.position.copy(at(x, z)); scene.add(g);
    g.add(mesh(box(1.3, 1.2, 0.8), mat('#2F5D45'), 0, 0.6, 0), mesh(box(1.5, 0.1, 1.0), mat('#1F3D2E'), 0, 1.3, 0), mesh(box(1.1, 0.6, 0.04), mat('#E8D9A8'), 0, 0.8, 0.42)); }
  // traffic signals: a pole at each corner of each intersection with a red/green lamp for each approach; they drive the cars
  const SIG = 18, signal = t => { const p = t % SIG; return { h: p < 6.5 ? 'g' : p < 8 ? 'y' : 'r', v: p >= 9 && p < 15.5 ? 'g' : p >= 15.5 && p < 17 ? 'y' : 'r' }; };
  const poles = [];
  for (const rx of roadsV) for (const rz of roadsH) for (const sx of [-1, 1]) for (const sz of [-1, 1]) poles.push([rx + sx * (roadW / 2 + 0.35), rz + sz * (roadW / 2 + 0.35), sx, sz]);
  inst(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), mat('#2A2E36'), poles, (o, [x, z]) => o.position.copy(at(x, z, 1.5)));
  inst(new THREE.BoxGeometry(0.2, 0.55, 0.2), mat('#1D2026'), poles, (o, [x, z]) => o.position.copy(at(x, z, 3.05)));
  const lampMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const lampH = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), lampMat, poles.length), lampV = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), lampMat, poles.length);
  { const oo = new THREE.Object3D(); poles.forEach(([x, z, sx, sz], i) => { oo.position.copy(at(x, z, 3.1)); oo.position.z += -sz * 0.13; oo.updateMatrix(); lampH.setMatrixAt(i, oo.matrix);                         // faces the road it governs
    oo.position.copy(at(x, z, 3.1)); oo.position.x += -sx * 0.13; oo.updateMatrix(); lampV.setMatrixAt(i, oo.matrix); }); add(lampH); add(lampV); }
  const COL = { g: new THREE.Color('#38E36C'), y: new THREE.Color('#FFC83A'), r: new THREE.Color('#FF3B30') };
  let lastSig = '';
  const paintSignals = s => { const key = s.h + s.v; if (key === lastSig) return; lastSig = key; for (let i = 0; i < poles.length; i++) { lampH.setColorAt(i, COL[s.h]); lampV.setColorAt(i, COL[s.v]); } lampH.instanceColor.needsUpdate = lampV.instanceColor.needsUpdate = true; };
  // street-level people: vendors, commuters at shelters, a few chatting
  const folk = [];
  const peep = (x, z, face, shirt, i) => { const f = makeFigure(shirt, 1.0, ['#2F3A52', '#4A3F36', '#3A3F55', '#5A5A5F'][i % 4], ['#C68E6A', '#8D5A3B', '#E0B48E', '#B07A55'][i % 4], ['#1B1612', '#2B1D14', '#6B4A32', '#8E8E93'][i % 4]); f.g.position.copy(at(x, z)); f.g.rotation.y = face; scene.add(f.g); folk.push({ f, ph: i * 1.7 }); };
  const shirts2 = ['#D6D8DC', '#3E7CB1', '#C9372C', '#2F7A4B', '#E0A92E', '#7A5AA8', '#222831', '#E87D5A'];
  spots.cart.forEach(([x, z], i) => peep(x + 0.9, z + 0.1, -Math.PI / 2, shirts2[i % 8], i));
  spots.shelter.forEach(([x, z], i) => { peep(x + 0.25, z + 0.4, Math.PI, shirts2[(i + 3) % 8], i + 2); peep(x - 0.35, z + 0.45, Math.PI, shirts2[(i + 5) % 8], i + 5); });
  spots.news.forEach(([x, z], i) => peep(x, z + 0.95, Math.PI, shirts2[(i + 1) % 8], i + 9));
  // steam from manhole vents
  const puffTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const vents = [[32, 24.5], [16, 38], [48, 12], [24, 48.6], [40, 32.3]], puffs = [];
  for (const [x, z] of vents) {
    const cone = mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.4, 10), mat('#E8742B'), 0, 0, 0, false); cone.position.copy(at(x, z, 0.2)); scene.add(cone);
    for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.5 })); s.position.copy(at(x, z, 0.5)); scene.add(s); puffs.push({ s, x, z, k }); }
  }

  // ---- traffic: taxis, sedans, SUVs, delivery trucks and (on the avenues) buses, right-hand drive, one car-following rule and the signals
  const TYPES = ['sedan', 'taxi', 'suv', 'bus', 'truck'], PAINT = { sedan: ['#C9372C', '#2F6FB1', '#F2F2F0', '#2A2E36', '#8A8F99', '#3F6B4E'], suv: ['#2A2E36', '#F2F2F0', '#5A6270', '#7A2B2B'], taxi: ['#F2C230'], bus: ['#F4F6F8'], truck: ['#F2F2F0', '#5B3A29', '#2B5C9A'] };
  const cars = [];
  for (const [axis, lines] of [['h', roadsH], ['v', roadsV]]) for (const line of lines) for (const dir of [1, -1]) {
    const lane = { cars: [] }; const n = 5;
    for (let k = 0; k < n; k++) {
      const r = rnd(); const type = r < 0.3 ? 'taxi' : r < 0.58 ? 'sedan' : r < 0.74 ? 'suv' : r < 0.86 && axis === 'v' ? 'bus' : r < 0.93 ? 'truck' : 'taxi';
      const L = kit(type).L, c = { axis, off: axis === 'h' ? line + dir * 0.8 : line - dir * 0.8, dir, lane, type, L, p: (k + rnd() * 0.5) * ((axis === 'h' ? N : D) / n), v: 0, v0: 3.4 + rnd() * 1.8, col: PAINT[type][Math.floor(rnd() * PAINT[type].length)] };
      c.v = c.v0; lane.cars.push(c); cars.push(c);
    }
  }
  const meshes = {};
  for (const type of TYPES) {
    const mine = cars.filter(c => c.type === type); if (!mine.length) continue; const k = kit(type);
    const body = new THREE.InstancedMesh(k.paint, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4, metalness: 0.2 }), mine.length), trim = new THREE.InstancedMesh(k.trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), mine.length);
    body.castShadow = trim.castShadow = true; mine.forEach((c, i) => { c.i = i; c.body = body; c.trim = trim; body.setColorAt(i, new THREE.Color(c.col)); }); add(body); add(trim); meshes[type] = [body, trim];
  }
  const o = new THREE.Object3D(); let clock = 0;
  const stops = c => (c.axis === 'h' ? roadsV : roadsH);
  function update(dt) {
    clock += dt; const sig = signal(clock); paintSignals(sig);
    for (const c of cars) {
      const Lmax = c.axis === 'h' ? N : D; let vmax = c.v0;
      let gap = 1e9; for (const q of c.lane.cars) if (q !== c) { const g = (q.p - c.p) * c.dir - (q.L + c.L) / 2 - 0.55; if (g > -0.2 && g < gap) gap = g; }
      if (gap < 1e8) vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 4 * gap)));
      const state = sig[c.axis];
      if (state !== 'g') for (const s of stops(c)) {                                                      // next stop line ahead on a red/yellow
        const line = s - c.dir * (roadW / 2 + 0.3) - c.dir * c.L / 2, dist = (line - c.p) * c.dir;
        if (dist > -0.1 && dist < 14) { const need = c.v * c.v / (2 * Math.max(dist, 0.05)); if (state === 'r' || need < 4.5) vmax = Math.min(vmax, Math.sqrt(Math.max(0, 2 * 4 * dist))); }
      }
      const acc = vmax > c.v ? 2.4 : 5; c.v += Math.max(-acc * dt, Math.min(acc * dt, vmax - c.v)); if (c.v < 0.02) c.v = 0;
      c.p += c.dir * c.v * dt; if (c.p > Lmax + 3) c.p = -3; if (c.p < -3) c.p = Lmax + 3;
      const x = c.axis === 'h' ? c.p : c.off, z = c.axis === 'h' ? c.off : c.p, yaw = c.axis === 'h' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      o.position.copy(at(x, z, 0.03)); o.rotation.set(0, yaw, 0); o.scale.set(1, 1, 1); o.updateMatrix(); c.body.setMatrixAt(c.i, o.matrix); c.trim.setMatrixAt(c.i, o.matrix);
    }
    for (const [b, t] of Object.values(meshes)) b.instanceMatrix.needsUpdate = t.instanceMatrix.needsUpdate = true;
    for (const p of puffs) { const u = ((clock * 0.25 + p.k / 4) % 1); p.s.position.copy(at(p.x, p.z, 0.5 + u * 2.4)); p.s.scale.setScalar(0.5 + u * 1.4); p.s.material.opacity = 0.5 * (1 - u); }
    for (const q of folk) { q.ph += dt * 2; pose(q.f, 'stand', q.ph); }
  }
  return { update, lit };
}
