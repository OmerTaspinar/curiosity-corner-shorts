import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow } from '/engine/props.js';

// Stylised cat in two halves that can rotate independently around the body axis (the real righting mechanism).
export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const fur = std('#ff9a3c', 0.6), furD = std('#d9661c', 0.6), white = std('#fff4e6', 0.6), dark = std('#1a1020', 0.3);
  function half(front) {
    const pivot = new THREE.Group(), body = new THREE.Group(); pivot.add(body);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 8, 24), fur); torso.rotation.z = Math.PI / 2; torso.position.x = front ? 0.38 : -0.38; body.add(torso);
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.035, 8, 32, Math.PI), furD); st.rotation.y = Math.PI / 2; st.position.x = (front ? 0.2 : -0.25) + (front ? 1 : -1) * i * 0.18; body.add(st); }
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12), white); belly.scale.set(1.3, 0.6, 0.9); belly.position.set(front ? 0.4 : -0.35, -0.16, 0); body.add(belly);
    const legs = [];
    [-0.17, 0.17].forEach(z => { const leg = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 6, 12), fur); m.position.y = -0.3; leg.add(m);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 8), white); paw.position.y = -0.58; leg.add(paw); leg.position.set(front ? 0.6 : -0.6, -0.18, z); body.add(leg); legs.push(leg); });
    if (front) {
      const head = new THREE.Group(); head.position.set(1.05, 0.22, 0); body.add(head);
      const sk = new THREE.Mesh(new THREE.SphereGeometry(0.33, 32, 16), fur); sk.scale.set(1, 0.9, 1.05); head.add(sk);
      [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), fur); ear.position.set(-0.02, 0.32, s * 0.17); ear.rotation.x = s * 0.25; head.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8), std('#c8ff6a', 0.2, 0, { emissive: '#3a5a00' })); eye.position.set(0.26, 0.06, s * 0.13); head.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 6), dark); pup.scale.set(0.5, 1.3, 0.5); pup.position.set(0.33, 0.06, s * 0.13); head.add(pup);
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), white); wh.rotation.x = Math.PI / 2 + s * 0.1; wh.rotation.z = 0.15; wh.position.set(0.3, -0.07, s * 0.2); head.add(wh); });
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 6), std('#ff6f8a', .4)); nose.position.set(0.33, -0.03, 0); head.add(nose);
    } else {
      const pts = [V(-0.7, 0.05, 0), V(-1.05, 0.3, 0), V(-1.25, 0.7, 0.1), V(-1.15, 1.0, 0.25)];
      const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.07, 10), fur); body.add(tail);
    }
    pivot.userData = { legs, body }; return pivot;
  }
  const S = {};
  S.cat = {
    build(sc) {
      const g = new THREE.Group(); const cat = new THREE.Group(); g.add(cat);
      const F = half(true), B = half(false); cat.add(F, B);
      const fl = floor('#25183a', 8, 0.6); fl.position.y = -2.6; g.add(fl);
      const rings = [0, 1, 2].map(() => { const r = soundRing(C('#ffd84d')); r.rotation.x = Math.PI / 2; r.position.y = -2.58; g.add(r); return r; });
      const lines = [...Array(26)].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), glowMat('#ffffff', 1, { blending: THREE.AdditiveBlending, depthWrite: false })); g.add(m); return m; });
      const arF = new THREE.Group(), arB = new THREE.Group();
      [[arF, '#62f0ff', 1.0], [arB, '#ffd84d', -0.9]].forEach(([a, col, x]) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 48, Math.PI * 1.4), glowMat(col, 1.8)); arc.rotation.y = Math.PI / 2;
        const hd = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 12), glowMat(col, 1.8)); hd.position.set(0, 0.62, 0); hd.rotation.x = Math.PI / 2; a.add(arc, hd); a.position.x = x; a.visible = false; cat.add(a); });
      const ov = new THREE.Group(); stage.overlay.add(ov);
      const lf = new Label(ov, 'FRONT', { size: 42 }), lb = new Label(ov, 'BACK', { size: 42, accent: true });
      g.userData = { cat, F, B, rings, lines, arF, arB, lf, lb, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { cat, F, B, rings, lines, arF, arB, lf, lb } = g.userData, mode = sc.mode;
      // righting sequence parameter p (0 upside-down -> 1 upright)
      let p = 0, y = 0.4, bend = 0, labels = 0, hlF = 0, hlB = 0, speed = 0; arF.visible = arB.visible = false;
      const seq = (q) => {   // front turns first (tucked), then back follows
        const a = ease.inOutCubic(remap(q, 0, 0.55)), b = ease.inOutCubic(remap(q, 0.4, 1));
        return { f: Math.PI * (1 - a) - 0.25 * b * (1 - b) * 4, b: Math.PI * (1 - b) + 0.25 * a * (1 - a) * 4 * 0.6, tuckF: Math.sin(Math.PI * clamp(q / 0.55)), tuckB: Math.sin(Math.PI * clamp((q - 0.4) / 0.6)) };
      };
      let ang;
      if (mode === 'hero') { p = remap(lt, 0.1, dur - 0.2); y = lerp(2.4, -1.5, ease.inOutSine(remap(lt, 0, dur))); speed = 1; look(V(lerp(1.5, 3.5, lt / dur), y + 0.5, lerp(4.5, 7.5, ease.outCubic(lt / dur))), V(0, y, 0)); }
      else if (mode === 'flip') { p = remap(lt, 0.2, dur - 0.3); y = lerp(1.6, -0.6, lt / dur); speed = 0.7; look(V(4.2, y + 0.6, 6.5), V(0, y, 0)); }
      else if (mode === 'split') { p = 0.0; y = 0.2; bend = ease.outCubic(remap(lt, 0.3, 1.0)) * 0.35; labels = clamp((lt - 0.6) / 0.3); hlF = hlB = labels; look(V(Math.sin(lt * 0.4) * 2, 1.2, 6.5), V(0, 0.2, 0)); }
      else if (mode === 'front') { p = lerp(0, 0.55, ease.inOutSine(remap(lt, 0.3, dur - 0.3))); y = 0.3; bend = 0.35; hlF = 1; arF.visible = true; labels = 1; look(V(2.5, 1.5, 6.0), V(0, 0.2, 0)); }
      else if (mode === 'back') { p = lerp(0.55, 1, ease.inOutSine(remap(lt, 0.2, dur - 0.3))); y = 0.3; bend = 0.35 * (1 - remap(lt, dur - 0.6, dur)); hlB = 1; arB.visible = true; labels = 1; look(V(-2.5, 1.5, 6.0), V(0, 0.2, 0)); }
      else if (mode === 'land') { p = 1; y = lerp(0.8, -1.82, ease.outCubic(remap(lt, 0.2, 1.2))); look(V(Math.sin(lt * 0.3) * 4, 0.5, 7), V(0, -1.2, 0)); rings.forEach((r, i) => r.update(lt - 1.15 - i * 0.12, 1, 0.5, 2.5)); }
      ang = seq(clamp(p));
      if (mode === 'split') ang = { f: 0, b: 0, tuckF: 0, tuckB: 0 }; // shown upright for clarity
      cat.position.y = y; cat.rotation.set(0, mode === 'hero' ? lt * 0.4 : -0.3, 0);
      F.rotation.set(ang.f, 0, bend); B.rotation.set(ang.b, 0, -bend);
      F.userData.legs.forEach(l => l.rotation.z = -ang.tuckF * 1.3); B.userData.legs.forEach(l => l.rotation.z = ang.tuckB * 1.3);
      arF.rotation.x = -t * 3; arB.rotation.x = -t * 3; arF.position.y = 0.0; arB.position.y = 0.0;
      [F, B].forEach((h, i) => h.userData.body.traverse(o => { if (o.material && o.material.emissive && o.material.color.getHex() !== 0x1a1020) {} }));
      lines.forEach((m, i) => { const r = rng(i + 1); const ph = (t * 2.5 + r()) % 1; m.visible = speed > 0; m.position.set((r() - .5) * 4, cat.position.y + 3 - ph * 6, (r() - .5) * 3 - 1); m.material.opacity = Math.sin(Math.PI * ph) * 0.5 * speed; });
      const fp = V(0.5, 0.75, 0).applyMatrix4(cat.matrixWorld), bp = V(-0.5, 0.75, 0).applyMatrix4(cat.matrixWorld);
      lf.update(stage, fp, labels, 0, 50); lb.update(stage, bp, labels, 0, 50);
      cat.updateMatrixWorld();
    },
  };
  return S;
}
