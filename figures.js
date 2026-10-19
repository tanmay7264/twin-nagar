// Low-poly people shared by the street and the building interiors. Figure faces +z; scale 1 is about 1.55 units tall.
import * as THREE from 'three';
const cache = new Map(); const mc = c => (cache.has(c) || cache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })), cache.get(c));
export function makeFigure(shirt, scale = 1, pants = '#3A3F55', skin = '#C68E6A', hairCol = '#1B1612') {
  const g = new THREE.Group(), part = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; return o; };
  const limb = (w, h, d, mat, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.add(part(new THREE.BoxGeometry(w, h, d), mat, 0, -h / 2, 0)); g.add(piv); return piv; };
  const torso = part(new THREE.BoxGeometry(0.36, 0.52, 0.22), mc(shirt), 0, 0.96, 0), head = part(new THREE.SphereGeometry(0.15, 14, 10), mc(skin), 0, 1.38, 0);
  const hair = part(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mc(hairCol), 0, 0.02, -0.012); head.add(hair);
  const legL = limb(0.14, 0.7, 0.15, mc(pants), -0.1, 0.7), legR = limb(0.14, 0.7, 0.15, mc(pants), 0.1, 0.7);
  const armL = limb(0.1, 0.52, 0.11, mc(shirt), -0.24, 1.2), armR = limb(0.1, 0.52, 0.11, mc(shirt), 0.24, 1.2);
  g.add(torso, head); g.scale.setScalar(scale);
  return { g, legL, legR, armL, armR, head, torso, scale };
}
// modes: stand, walk, run, sit, sit-eat, sit-work, lie, yoga, cook
export function pose(f, mode, ph) {
  const s = Math.sin(ph);
  let l = 0, a = 0, ay = 0;
  f.legL.rotation.x = f.legR.rotation.x = f.armL.rotation.x = f.armR.rotation.x = 0;
  f.torso.position.y = 0.96; f.head.rotation.x = 0;
  if (mode === 'walk') { l = s * 0.75; a = s * 0.6; f.legL.rotation.x = l; f.legR.rotation.x = -l; f.armL.rotation.x = -a; f.armR.rotation.x = a; f.torso.position.y = 0.96 + Math.abs(Math.cos(ph)) * 0.04; }
  else if (mode === 'run') { l = Math.sin(ph * 1.7) * 1.0; f.legL.rotation.x = l; f.legR.rotation.x = -l; f.armL.rotation.x = -l * 0.9 - 0.7; f.armR.rotation.x = l * 0.9 - 0.7; f.torso.position.y = 0.96 + Math.abs(Math.cos(ph * 1.7)) * 0.05; }
  else if (mode.startsWith('sit')) {
    f.legL.rotation.x = f.legR.rotation.x = -1.5; f.armL.rotation.x = f.armR.rotation.x = -0.55;
    if (mode === 'sit-eat') { const b = 0.5 + 0.5 * Math.sin(ph * 1.4); f.armR.rotation.x = -1.2 - 0.95 * b; f.armL.rotation.x = -0.6; f.head.rotation.x = 0.1 * b; }
    if (mode === 'sit-work') { f.armL.rotation.x = -1.15 + Math.sin(ph * 6) * 0.06; f.armR.rotation.x = -1.15 + Math.cos(ph * 6) * 0.06; f.head.rotation.x = 0.12; }
  }
  else if (mode === 'cook') { f.armL.rotation.x = -0.9 + Math.sin(ph * 2) * 0.25; f.armR.rotation.x = -0.9 - Math.sin(ph * 2) * 0.25; }
  else if (mode === 'yoga') { f.armL.rotation.x = f.armR.rotation.x = -3.0 + Math.sin(ph * 0.6) * 0.1; f.legR.rotation.x = -0.1; }
  else if (mode === 'lie') { f.armL.rotation.x = f.armR.rotation.x = 0.05; }
  else { f.torso.position.y = 0.96 + Math.sin(ph * 0.5) * 0.008; f.armL.rotation.x = Math.sin(ph * 0.4) * 0.05; }
  f.head.position.y = f.torso.position.y + 0.42;
}
// seat height -> figure origin height (hips pivot sits 0.7 * scale above the feet)
export const sitY = (f, seatH) => seatH - 0.7 * f.scale;
