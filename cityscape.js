// Dense city fabric for Twin Nagar: facade-textured buildings (zones open into cutaways), roads with markings, sidewalks,
// filler blocks, a skyline ring, street lamps and trees, and moving traffic.
import * as THREE from 'three';
import { GRID, WORLD } from './world.config.js';

export const FH = GRID.FH;
const { colx, rowb, roadsV, roadsH, roadW, blockX, blockZ } = GRID;
const lit = [];                                              // facade materials whose windows glow at night

/* ---- facade texture: one window cell = 3 units wide x one storey tall; UVs are scaled per building so windows stay square ---- */
function cell(winCol, bg) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 160, 128);
  if (bg === '#FFFFFF') { g.fillStyle = '#E9E6DE'; g.fillRect(0, 118, 160, 10); }
  g.fillStyle = winCol; g.fillRect(34, 30, 92, 62);
  if (bg === '#FFFFFF') { g.fillStyle = '#FFFFFF'; g.fillRect(78, 30, 4, 62); g.fillRect(34, 59, 92, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = bg === '#FFFFFF' ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t;
}
const FACADE = cell('#8FB6D4', '#FFFFFF'), FACADE_EM = cell('#FFFFFF', '#000000');
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nv = Math.max(1, Math.round(h / FH));
  for (let f = 0; f < 6; f++) {
    const su = f < 2 ? Math.max(1, Math.round(d / 3)) : f < 4 ? 1 : Math.max(1, Math.round(w / 3)), sv = f === 2 || f === 3 ? 1 : nv;
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv); }
  }
  return g;
}
const facadeMat = tint => { const m = new THREE.MeshStandardMaterial({ color: tint, map: FACADE, roughness: 0.85, emissive: '#FFC870', emissiveMap: FACADE_EM, emissiveIntensity: 0 }); lit.push(m); return m; };

export function makeZone(z, ctx) {
  const { THREE: T, scene, at, mat, mesh, box, pickables, objects, signTexture } = ctx;
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

  // filler buildings (non-clickable) in the back strip of each block, and a skyline ring around the district
  const pal = ['#E8DCCB', '#D9E1E8', '#E6D5D1', '#DCE5D8', '#E9E2C8', '#D6D3E3', '#E4D0BC'];
  const fill = (x, z, w, d, floors, tint) => {
    const h = floors * FH, g = new THREE.Group(); g.position.copy(at(x, z)); scene.add(g);
    g.add(mesh(boxGeo(w, h, d), facadeMat(tint), 0, h / 2, 0)); g.add(mesh(box(w + 0.2, 0.22, d + 0.2), mat('#7C8494'), 0, h + 0.11, 0));
    if (rnd() < 0.6) g.add(mesh(box(w * 0.3, 0.6, d * 0.3), mat('#9AA3B0'), (rnd() - .5) * w * 0.4, h + 0.5, (rnd() - .5) * d * 0.4));
    if (floors >= 4 && rnd() < 0.5) g.add(mesh(box(w * 0.5, FH * 0.7, d * 0.5), mat('#B9C0CC'), 0, h + FH * 0.35 + 0.2, 0));  // penthouse
  };
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    if (r === 1 && c === 1) continue;
    const zone = WORLD.zones.find(zn => Math.abs(zn.x - colx[c]) < 0.1 && Math.abs(zn.z + zn.d / 2 + 1.6 - rowb[r]) < 0.1);
    const [x0, x1] = blockX[c], z0 = blockZ[r][0] + 0.6, zEnd = rowb[r] - 1.6 - zone.d - 0.5;
    let x = x0 + 1.4; const dep = Math.min(zEnd - z0, 3.8);
    while (x < x1 - 3.4 && dep > 2) { const w = Math.min(2.8 + rnd() * 2, x1 - 1.4 - x); fill(x + w / 2, z0 + dep / 2, w, dep, (r === 0 || c === 0) ? 3 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 2), pal[Math.floor(rnd() * pal.length)]); x += w + 0.35; }
    // side shops next to the main building
    const sideW = (x1 - x0 - zone.w) / 2 - 1.2;
    if (sideW > 1.6) for (const s of [-1, 1]) fill(zone.x + s * (zone.w / 2 + 0.5 + sideW / 2 + 0.2), zone.z, sideW, zone.d * 0.8, 1, pal[Math.floor(rnd() * pal.length)]);
  }
  const ring = (x, z, w, d, tall) => fill(x, z, w, d, tall ? 4 + Math.floor(rnd() * 5) : 1 + Math.floor(rnd() * 2), ['#CFD6DF', '#D8D2CA', '#C9D2D6', '#D3CCD8', '#DAD6C8'][Math.floor(rnd() * 5)]);
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
  const inst = (geo, m, list, fn) => { const im = new THREE.InstancedMesh(geo, m, list.length), o = new THREE.Object3D(); im.castShadow = true; list.forEach((v, i) => { o.position.set(0, 0, 0); o.scale.set(1, 1, 1); const col = fn(o, v, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (col) im.setColorAt(i, new THREE.Color(col)); }); add(im); };
  const leafMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true });
  inst(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 6), mat('#7A5A3E'), trunks, (o, [x, z, s]) => { o.position.copy(at(x, z, 0.5 * s)); o.scale.setScalar(s); });
  inst(new THREE.IcosahedronGeometry(0.8, 0), leafMat, crowns, (o, [x, z, s], i) => { o.position.copy(at(x, z, 1.5 * s)); o.scale.setScalar(s); return WORLD.colors.foliage[i % WORLD.colors.foliage.length]; });
  // street lamps
  const lamps = [];
  for (const rx of roadsV) for (let z = 1; z < D; z += 5) { lamps.push([rx - roadW / 2 - 0.2, z]); lamps.push([rx + roadW / 2 + 0.2, z + 2.5]); }
  for (const rz of roadsH) for (let x = 1; x < WORLD.size; x += 5) { lamps.push([x, rz - roadW / 2 - 0.2]); lamps.push([x + 2.5, rz + roadW / 2 + 0.2]); }
  const lampList = lamps.filter(([x, z]) => !roadsV.some(v => Math.abs(x - v) < roadW / 2 + 0.1 && roadsH.some(h => Math.abs(z - h) < roadW / 2 + 1.2)));
  inst(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), mat('#4A505C'), lampList, (o, [x, z]) => o.position.copy(at(x, z, 1.3)));
  const lampHead = new THREE.MeshBasicMaterial({ color: '#FFE9A8' });
  inst(new THREE.SphereGeometry(0.16, 8, 6), lampHead, lampList, (o, [x, z]) => o.position.copy(at(x, z, 2.65)));

  // traffic: cars + auto-rickshaws on the four roads, two lanes each (real-time, independent of the glucose clock)
  const cars = [], palette = ['#C9372C', '#2F6FB1', '#F2F2F0', '#2A2E36', '#E0A92E', '#6C9A5B', '#F2C230', '#8A8F99'];
  let id = 0;
  for (const [axis, lines] of [['h', roadsH], ['v', roadsV]]) for (const line of lines) for (const dir of [1, -1]) for (let k = 0; k < 3; k++)
    cars.push({ axis, off: line + dir * 0.8, dir, p: rnd() * (axis === 'h' ? N : D), v: 2.4 + rnd() * 2.2, col: palette[(id++) % palette.length], auto: rnd() < 0.25 });
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 0.62), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6 }), cars.length);
  const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.36, 0.56), new THREE.MeshStandardMaterial({ color: '#2D3642', roughness: 0.4 }), cars.length);
  body.castShadow = cab.castShadow = true; cars.forEach((c, i) => body.setColorAt(i, new THREE.Color(c.auto ? '#F2C230' : c.col))); add(body); add(cab);
  const o = new THREE.Object3D();
  function update(dt) {
    cars.forEach((c, i) => {
      const L = c.axis === 'h' ? N : D; c.p += c.dir * c.v * dt; if (c.p > L + 2) c.p = -2; if (c.p < -2) c.p = L + 2;
      const x = c.axis === 'h' ? c.p : c.off, z = c.axis === 'h' ? c.off : c.p, yaw = c.axis === 'h' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      o.position.copy(at(x, z, 0.35)); o.rotation.set(0, yaw, 0); o.scale.set(c.auto ? 0.8 : 1.1, 1, 1); o.updateMatrix(); body.setMatrixAt(i, o.matrix);
      o.position.copy(at(x, z, 0.72)); o.scale.set(c.auto ? 1.0 : 1.0, 1, 1); o.position.x += Math.cos(yaw) * -0.05; o.updateMatrix(); cab.setMatrixAt(i, o.matrix);
    });
    body.instanceMatrix.needsUpdate = cab.instanceMatrix.needsUpdate = true;
  }
  return { update, lit };
}
