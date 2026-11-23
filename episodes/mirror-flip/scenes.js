import { THREE, PAL, clamp, lerp, remap, ease, rng, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow, fresnelMat } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function person() {
    const g = new THREE.Group(), body = std('#3fb6c9', 0.5), skin = std('#f2c9a0', 0.6), dark = std('#2a2340', 0.6);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 8, 20), body); torso.position.y = 1.35; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 16), skin); head.position.y = 2.15; g.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 16), std('#ff9f6b', 0.5)); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 2.15, -0.3); g.add(nose);
    [-1, 1].forEach(s => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 6), dark); eye.position.set(s * 0.1, 2.22, -0.24); g.add(eye); });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, 1.3), dark); hair.position.y = 2.18; hair.rotation.x = 0.35; g.add(hair);
    const arms = {};
    [['L', 1], ['R', -1]].forEach(([k, s]) => {   // person faces -z, so their right side is world -x... (from behind we see R on the right: +x is their LEFT)
      const sh = new THREE.Group(); sh.position.set(s * 0.45, 1.75, 0); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 6, 12), body); arm.position.y = -0.4; sh.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8), k === 'R' ? std('#ffd84d', 0.4, 0, { emissive: '#7a5a00' }) : skin); hand.position.y = -0.82; sh.add(hand); g.add(sh); arms[k] = sh; });
    [-1, 1].forEach(s => { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 6, 12), dark); leg.position.set(s * 0.17, 0.5, 0); g.add(leg); });
    g.userData = { arms, nose, head }; return g;
  }
  const S = {};
  S.mirror = {
    build(sc) {
      const g = new THREE.Group(); g.position.y = -1.3;
      const P = person(); P.position.z = 1.5; g.add(P);
      const R = person(); R.scale.z = -1; R.position.z = -1.5; g.add(R);      // true mirror image (flipped through the mirror plane z=0)
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), fresnelMat({ color: '#9fd8ff', body: 0.1, rim: 0.4, side: THREE.DoubleSide })); glass.position.y = 1.5; g.add(glass);
      const frame = new THREE.Group(); [[0, 1.75, 3.6, 0.1], [0, -1.75, 3.6, 0.1], [1.75, 0, 0.1, 3.6], [-1.75, 0, 0.1, 3.6]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), std('#d4af37', 0.3, 0.9)); m.position.set(x, y, 0); frame.add(m); }); frame.position.y = 1.5; g.add(frame);
      const fl = floor('#22183a', 7, 0.6); g.add(fl);
      const ghost = person(); ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; } }); g.add(ghost);
      const upA = arrow('#62f0ff', 0.9, 0.04); g.add(upA); const dnA = arrow('#62f0ff', 0.9, 0.04); dnA.rotation.z = Math.PI; g.add(dnA);
      const zA = arrow('#ffd84d', 1.0, 0.05), zB = arrow('#ffd84d', 1.0, 0.05); g.add(zA, zB);
      const cross = new THREE.Group(); [1, -1].forEach(s => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.05), glowMat('#ff4d4d', 2)); b.rotation.z = s * Math.PI / 4; cross.add(b); }); cross.position.set(0, 3.3, 0); g.add(cross);
      const lr = new THREE.Group(); [-1, 1].forEach(s => { const a = arrow('#ffffff', 0.8, 0.04); a.rotation.z = s * Math.PI / 2; a.position.x = s * 0.1; lr.add(a); }); lr.position.set(0, 3.3, 0); g.add(lr);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lR = new Label(ov, 'RIGHT HAND', { size: 40, accent: true }), lR2 = new Label(ov, 'SAME SIDE', { size: 40, accent: true });
      g.userData = { P, R, ghost, upA, dnA, zA, zB, cross, lr, lR, lR2, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; let raise = 0, labels = 0;
      [u.ghost, u.upA, u.dnA, u.zA, u.zB, u.cross, u.lr].forEach(o => o.visible = false); u.R.scale.z = -1; u.R.position.z = -1.5;
      const camBehind = (k = 0) => look(V(lerp(2.6, 1.6, k), 1.2, 7.8), V(0, 0.4, 0));
      if (mode === 'hero') { const a = lerp(0.9, 0.3, ease.outCubic(lt / dur)); look(V(Math.sin(a) * 8, 1.4, Math.cos(a) * 8), V(0, 0.4, 0)); u.lr.visible = true; u.cross.visible = lt > 0.8; u.cross.scale.setScalar(ease.outBack(remap(lt, 0.8, 1.1))); u.lr.position.set(0, 2.1, 0); u.cross.position.set(0, 2.1, 0); }
      else if (mode === 'hand') { camBehind(lt / dur); raise = ease.outBack(remap(lt, 0.3, 0.9)); labels = clamp((lt - 1.0) / 0.3); }
      else if (mode === 'updown') { camBehind(0.5); raise = 1; u.upA.visible = u.dnA.visible = true; const p = 0.08 * Math.sin(t * 4); u.upA.position.set(0.9, 2.5 + p, 0); u.dnA.position.set(0.9, 0.9 - p, 0); }
      else if (mode === 'depth') { look(V(7.5, 2.5, 0.5), V(0, 0.6, 0)); raise = 1; const k = ease.inOutCubic(remap(lt, 0.6, 1.8)); u.R.scale.z = lerp(1, -1, k); u.R.position.z = -1.5;
        u.zA.visible = u.zB.visible = true; u.zA.position.set(0, 2.15, 0.6); u.zA.rotation.x = -Math.PI / 2; u.zB.position.set(0, 2.15, -0.6); u.zB.rotation.x = Math.PI / 2; [u.zA, u.zB].forEach(a => a.setLength(0.6 + 0.1 * Math.sin(t * 5))); }
      else if (mode === 'nose') { look(V(lerp(4.5, 3.5, lt / dur), 2.0, lerp(3.5, 2.5, lt / dur)), V(0, 0.9, 0)); raise = 1; u.zA.visible = u.zB.visible = true; u.zA.position.set(0.0, 2.15, 1.1); u.zA.rotation.x = -Math.PI / 2; u.zB.position.set(0.0, 2.15, -1.1); u.zB.rotation.x = Math.PI / 2; [u.zA, u.zB].forEach(a => a.setLength(0.5)); }
      else if (mode === 'walk') { look(V(lerp(5.5, 1.5, lt / dur), 3.5, lerp(7, 8.5, lt / dur)), V(0, 0.4, 0)); raise = 1; u.ghost.visible = true;
        const k = ease.inOutSine(remap(lt, 0.3, dur - 0.4)), a = k * Math.PI; u.ghost.position.set(Math.sin(a) * 2.4, 0, Math.cos(a) * 1.5); u.ghost.rotation.y = a; u.ghost.userData.arms.R.rotation.z = Math.PI * 0.85; }
      [u.P, u.R].forEach(p => { p.userData.arms.R.rotation.z = -raise * Math.PI * 0.85; });
      u.ghost.userData.arms.R.rotation.z = -Math.PI * 0.85;
      const hp = V(-0.45, 1.6 + 1.6, 1.5).applyMatrix4(g.matrixWorld), hr = V(-0.45, 3.2, -1.5).applyMatrix4(g.matrixWorld);
      g.updateMatrixWorld(); u.lR.update(stage, hp, labels, 0, 50); u.lR2.update(stage, hr, labels, 0, 50);
    },
  };
  return S;
}
