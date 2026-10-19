// Rounded, jointed people shared by the street and the building interiors. Figure faces +z; scale 1 is about 1.55 units tall.
// Limbs have elbows and knees, hands and shoes; hair has a few styles. Same API as before: { g, legL, legR, armL, armR, head, torso, scale }.
import * as THREE from 'three';
const cache = new Map(); const mc = (c, r = 0.8) => (cache.has(c + r) || cache.set(c + r, new THREE.MeshStandardMaterial({ color: c, roughness: r })), cache.get(c + r));
const G = {                                                         // shared geometry, built once
  thigh: new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), shin: new THREE.CapsuleGeometry(0.062, 0.24, 4, 10),
  upper: new THREE.CapsuleGeometry(0.055, 0.2, 4, 10), fore: new THREE.CapsuleGeometry(0.047, 0.17, 4, 10),
  hand: new THREE.SphereGeometry(0.05, 10, 8), shoe: new THREE.BoxGeometry(0.12, 0.07, 0.24), shoulder: new THREE.SphereGeometry(0.075, 10, 8),
  torso: new THREE.CapsuleGeometry(0.13, 0.28, 6, 14), hips: new THREE.CapsuleGeometry(0.12, 0.08, 4, 12), neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10),
  head: new THREE.SphereGeometry(0.135, 18, 14), hairCap: new THREE.SphereGeometry(0.147, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), eye: new THREE.SphereGeometry(0.016, 6, 5),
  nose: new THREE.SphereGeometry(0.022, 6, 5), bun: new THREE.SphereGeometry(0.065, 10, 8), long: new THREE.CapsuleGeometry(0.1, 0.14, 4, 10), ear: new THREE.SphereGeometry(0.03, 6, 5),
  belt: new THREE.CylinderGeometry(0.136, 0.136, 0.035, 14),
};
const hashOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
export function makeFigure(shirt, scale = 1, pants = '#3A3F55', skin = '#C68E6A', hairCol = '#1B1612', style = null) {
  const g = new THREE.Group(), h = hashOf(shirt + hairCol + skin);
  style = style || ['short', 'long', 'short', 'cap', 'bun'][h % 5];
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
  const sk = mc(skin, 0.7), sh = mc(shirt), pt = mc(pants), shoeM = mc(h % 3 ? '#23262D' : '#F2F2F2', 0.6), hairM = mc(hairCol, 0.9);
  // legs: hip pivot -> thigh -> knee pivot -> shin -> shoe
  const leg = x => { const hip = new THREE.Group(); hip.position.set(x, 0.7, 0); hip.add(part(G.thigh, pt, 0, -0.2, 0));
    const knee = new THREE.Group(); knee.position.y = -0.38; knee.add(part(G.shin, pt, 0, -0.17, 0), part(G.shoe, shoeM, 0, -0.34, 0.05)); hip.add(knee); g.add(hip); return { hip, knee }; };
  const L = leg(-0.085), R = leg(0.085);
  // arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand (short sleeves for some)
  const sleeve = h % 4 === 0 ? sk : sh;
  const arm = x => { const sp = new THREE.Group(); sp.position.set(x, 1.2, 0); sp.add(part(G.shoulder, sh, 0, 0, 0), part(G.upper, sh, 0, -0.15, 0));
    const elbow = new THREE.Group(); elbow.position.y = -0.29; elbow.add(part(G.fore, sleeve, 0, -0.13, 0), part(G.hand, sk, 0, -0.27, 0)); sp.add(elbow); g.add(sp); return { sp, elbow }; };
  const AL = arm(-0.215), AR = arm(0.215);
  const torso = part(G.torso, sh, 0, 0.96, 0, 1.2, 1, 0.78);
  if (style === 'cap' || h % 7 === 0) torso.add(part(G.belt, mc('#1D2026'), 0, -0.2, 0, 1.0, 1, 1.0));   // jacket / belt line
  const pelvis = part(G.hips, pt, 0, 0.74, 0, 1.15, 1, 0.8); g.add(pelvis);
  const neck = part(G.neck, sk, 0, 0.3, 0); torso.add(neck);
  const head = part(G.head, sk, 0, 1.38, 0, 0.95, 1.08, 1);
  for (const s of [-1, 1]) { head.add(part(G.eye, mc('#15171C', 0.4), s * 0.05, 0.02, 0.125), part(G.ear, sk, s * 0.13, 0, 0)); }
  head.add(part(G.nose, sk, 0, -0.015, 0.14));
  if (style !== 'bald') {
    head.add(part(G.hairCap, hairM, 0, 0.01, -0.01));
    if (style === 'long') head.add(part(G.long, hairM, 0, -0.1, -0.07, 1.3, 1, 0.9));
    if (style === 'bun') head.add(part(G.bun, hairM, 0, 0.12, -0.1));
    if (style === 'cap') { head.add(part(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 14), mc('#2B4C7E'), 0, 0.08, 0.02), part(new THREE.BoxGeometry(0.16, 0.025, 0.12), mc('#2B4C7E'), 0, 0.07, 0.14)); }
  }
  g.add(torso, head); g.scale.setScalar(scale);
  return { g, legL: L.hip, legR: R.hip, armL: AL.sp, armR: AR.sp, kneeL: L.knee, kneeR: R.knee, elbowL: AL.elbow, elbowR: AR.elbow, head, torso, pelvis, scale };
}
// modes: stand, walk, run, sit, sit-eat, sit-work, lie, yoga, cook
export function pose(f, mode, ph) {
  const s = Math.sin(ph);
  let l = 0, a = 0;
  f.legL.rotation.x = f.legR.rotation.x = f.armL.rotation.x = f.armR.rotation.x = 0; f.armL.rotation.z = f.armR.rotation.z = 0;
  f.kneeL.rotation.x = f.kneeR.rotation.x = 0; f.elbowL.rotation.x = f.elbowR.rotation.x = -0.12;
  f.torso.position.y = 0.96; f.head.rotation.x = 0; f.torso.rotation.x = 0;
  if (mode === 'walk') {
    l = s * 0.75; a = s * 0.6; f.legL.rotation.x = l; f.legR.rotation.x = -l; f.armL.rotation.x = -a; f.armR.rotation.x = a;
    f.kneeL.rotation.x = Math.max(0, -Math.cos(ph)) * 0.2 + Math.max(0, l) * 0.8; f.kneeR.rotation.x = Math.max(0, -Math.cos(ph)) * 0.2 + Math.max(0, -l) * 0.8;
    f.elbowL.rotation.x = -0.25 - Math.max(0, a) * 0.6; f.elbowR.rotation.x = -0.25 - Math.max(0, -a) * 0.6;
    f.torso.position.y = 0.96 + Math.abs(Math.cos(ph)) * 0.035; f.torso.rotation.y = 0; f.torso.rotation.x = 0.04;
  } else if (mode === 'run') {
    l = Math.sin(ph * 1.7) * 1.0; f.legL.rotation.x = l; f.legR.rotation.x = -l; f.kneeL.rotation.x = 0.3 + Math.max(0, l) * 1.4; f.kneeR.rotation.x = 0.3 + Math.max(0, -l) * 1.4;
    f.armL.rotation.x = -l * 0.9 - 0.4; f.armR.rotation.x = l * 0.9 - 0.4; f.elbowL.rotation.x = f.elbowR.rotation.x = -1.3; f.torso.rotation.x = 0.18;
    f.torso.position.y = 0.96 + Math.abs(Math.cos(ph * 1.7)) * 0.05;
  } else if (mode.startsWith('sit')) {
    f.legL.rotation.x = f.legR.rotation.x = -1.5; f.kneeL.rotation.x = f.kneeR.rotation.x = 1.5; f.armL.rotation.x = f.armR.rotation.x = -0.35; f.elbowL.rotation.x = f.elbowR.rotation.x = -0.8;
    if (mode === 'sit-eat') {                                                  // fork hand travels plate -> mouth; the other rests on the table
      const b = 0.5 + 0.5 * Math.sin(ph * 1.4);
      f.armR.rotation.x = -0.6; f.armR.rotation.z = -0.22 * b; f.elbowR.rotation.x = -1.2 - 1.55 * b; f.head.rotation.x = 0.1 * b; f.armL.rotation.x = -0.5; f.elbowL.rotation.x = -1.0;
    }
    if (mode === 'sit-work') { f.armL.rotation.x = f.armR.rotation.x = -0.75; f.elbowL.rotation.x = -0.9 + Math.sin(ph * 6) * 0.05; f.elbowR.rotation.x = -0.9 + Math.cos(ph * 6) * 0.05; f.head.rotation.x = 0.12; }
  } else if (mode === 'cook') {
    f.armL.rotation.x = -0.7 + Math.sin(ph * 2) * 0.2; f.armR.rotation.x = -0.7 - Math.sin(ph * 2) * 0.2; f.elbowL.rotation.x = f.elbowR.rotation.x = -1.0;
  } else if (mode === 'yoga') { f.armL.rotation.x = f.armR.rotation.x = -3.0 + Math.sin(ph * 0.6) * 0.1; f.elbowL.rotation.x = f.elbowR.rotation.x = 0; f.legR.rotation.x = -0.1; f.kneeR.rotation.x = 0.1; }
  else if (mode === 'lie') { f.armL.rotation.x = f.armR.rotation.x = 0.05; }
  else { f.torso.position.y = 0.96 + Math.sin(ph * 0.5) * 0.008; f.armL.rotation.x = Math.sin(ph * 0.4) * 0.05; f.elbowL.rotation.x = f.elbowR.rotation.x = -0.15; }
  f.head.position.y = f.torso.position.y + 0.42; f.pelvis.position.y = 0.74;
}
// seat height -> figure origin height (hips pivot sits 0.7 * scale above the feet)
export const sitY = (f, seatH) => seatH - 0.7 * f.scale;
