import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing } from '/engine/kit.js';
import { V, C, std, glowMat, arrow, floor } from '/engine/props.js';

// A dry noodle built from many short segments laid along a bending arc. Pieces can break off and fly.
const L = 6, N = 160, R0 = 0.09;
function noodleGeo() {
  const g = new THREE.CylinderGeometry(R0, R0, L / N * 1.02, 14, 1);
  const col = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const stripe = Math.cos(a) > 0.82 ? 0.55 : 1; col.push(stripe, stripe * 0.97, stripe * 0.9); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
// point + tangent angle on arc with curvature k (s from -L/2..L/2)
function arcAt(s, k) { if (Math.abs(k) < 1e-4) return [s, 0, 0]; const R = 1 / k; return [R * Math.sin(s / R), R * (1 - Math.cos(s / R)), s / R]; }

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const geo = noodleGeo();
  const mat = std('#e3a847', 0.55, 0, { vertexColors: true });
  const pileMat = std('#e3a847', 0.55, 0);
  const crackMat = glowMat('#fff2c0', 3);
  const tmp = new THREE.Object3D(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), ax = V(1, 0, 0);

  // pose(mesh, k, twist, breaks[{s, t}], tBreak-relative motion, highlight fn)
  function pose(mesh, { k, twist = 0, breaks = [], lt, wave = null, seedFly = 1 }) {
    const r = rng(seedFly); const cuts = breaks.filter(b => lt >= b.t).map(b => b.s).sort((a, b) => a - b);
    const bounds = [-L / 2, ...cuts, L / 2];
    const pieces = bounds.slice(0, -1).map((a, i) => ({ a, b: bounds[i + 1], v: V((r() - .5) * 1.0, 0.6 + r() * 1.0, (r() - .5) * 1.0), w: (r() - .5) * 6, }));
    const firstT = breaks.length ? Math.min(...breaks.map(b => b.t)) : 1e9;
    for (let i = 0; i < N; i++) {
      const s = -L / 2 + (i + 0.5) * L / N;
      const pi = pieces.findIndex(p => s >= p.a && s < p.b); const P = pieces[pi];
      const tb = Math.max(firstT, ...breaks.filter(b => b.t <= lt && (b.s === P.a || b.s === P.b)).map(b => b.t), firstT);
      const dt = pieces.length > 1 ? Math.max(0, lt - tb) * 0.55 : 0;
      const kk = pieces.length > 1 ? k * Math.exp(-dt * 6) : k;           // released pieces snap straight
      const [x, y, ang] = arcAt(s, kk);
      tmp.position.set(x, y, 0);
      q.setFromAxisAngle(V(0, 0, 1), ang - Math.PI / 2); qt.setFromAxisAngle(V(0, 1, 0), twist * (s / L + 0.5)); tmp.quaternion.copy(q).multiply(qt);
      if (dt > 0) { const c = (P.a + P.b) / 2, [cx, cy] = arcAt(c, kk); const dr = Math.min(dt, 0.7); const rot = new THREE.Quaternion().setFromAxisAngle(V(0.3, 0.2, 1).normalize(), P.w * dr * 0.25);
        tmp.position.sub(V(cx, cy, 0)).applyQuaternion(rot).add(V(cx, cy, 0)).add(P.v.clone().multiplyScalar(dt)).add(V(0, -4.9 * dt * dt * 0.6, 0)); tmp.position.y = Math.max(tmp.position.y, -1.18); tmp.quaternion.premultiply(rot); }
      tmp.scale.setScalar(1); tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix);
      const hl = wave ? wave(s) : 0; mesh.setColorAt(i, C('#ffffff').lerp(C('#fff1a0').multiplyScalar(3.0), hl));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }

  const S = {};
  S.noodle = {
    build(sc) {
      const g = new THREE.Group();
      const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; for (let i = 0; i < N; i++) m.setColorAt(i, C('#fff')); g.add(m);
      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), crackMat); flash.visible = false; g.add(flash);
      const rings = [0, 1].map(() => { const r = soundRing(C('#ffd27a')); g.add(r); return r; });
      const table = floor('#3a2016', 9, 0.6); table.position.y = -1.3; g.add(table);
      let pile = null;
      if (sc.mode === 'pile') {   // many broken bits lying around
        const r = rng(9); pile = new THREE.InstancedMesh(new THREE.CylinderGeometry(R0, R0, 1, 12), pileMat, 70);
        for (let i = 0; i < 70; i++) { const len = 0.3 + r() * 1.6; tmp.position.set((r() - .5) * 6, -1.35 + r() * 0.15, (r() - .5) * 4); tmp.rotation.set(Math.PI / 2 + (r() - .5) * .2, r() * 6, 0); tmp.rotation.order = 'YXZ'; tmp.rotation.set(Math.PI / 2, r() * 6, 0); tmp.scale.set(1, len, 1); tmp.updateMatrix(); pile.setMatrixAt(i, tmp.matrix); pile.setColorAt(i, C('#fff')); }
        g.add(pile);
      }
      const arrows = [-1, 1].map(sd => { const a = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 48, Math.PI * 1.5), glowMat(PAL.accent, 1.6)); arc.rotation.y = Math.PI / 2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12), glowMat(PAL.accent, 1.6)); head.position.set(0, 0.35, 0); head.rotation.x = sd * Math.PI / 2; a.add(arc, head); a.position.x = sd * (L / 2 + 0.15); a.visible = false; g.add(a); return a; });
      g.userData = { m, flash, rings, arrows }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { m, flash, rings, arrows } = g.userData; flash.visible = false; arrows.forEach(a => a.visible = false);
      g.position.set(0, -0.5, 0); g.rotation.set(0, -0.75, 0); 
      const crack = (s, tc, k) => { const d = lt - tc; if (d > 0 && d < 0.25) { const [x, y] = arcAt(s, k); flash.visible = true; flash.position.set(x, y, 0); flash.scale.setScalar(1 + d * 20); flash.material.opacity = 1 - d / 0.25; } };
      if (sc.mode === 'hero') {
        const k = 0.55 * ease.inOutCubic(remap(lt, 0, 1.15));
        look(V(lerp(1.2, 0.4, ease.outCubic(lt / dur)), lerp(0.3, 1.6, ease.outCubic(lt / dur)), lerp(5.0, 9.0, ease.outCubic(lt / 1.0))), V(0, 0.1, 0));
        pose(m, { k, lt, breaks: [{ s: 0.25, t: 1.2 }, { s: -1.15, t: 1.26 }, { s: 1.5, t: 1.31 }], seedFly: 3 });
        crack(0.25, 1.2, k); rings.forEach((r, i) => { r.position.set(arcAt(0.25, k)[0], arcAt(0.25, k)[1], 0); r.update(lt - 1.2 - i * 0.1, 0.8, 0.3, 2.2); });
        stage.shake = lt > 1.2 && lt < 1.6 ? 1.2 : 0;
      } else if (sc.mode === 'shatter') {
        const k = 0.6 * ease.inOutCubic(remap(lt, 0.1, 1.3));
        look(V(-1.5 + lt * 0.4, 2.0, 9.0), V(0, 0.2, 0)); g.rotation.y = -0.55;
        pose(m, { k, lt, breaks: [{ s: -0.2, t: 1.4 }, { s: 1.1, t: 1.45 }, { s: -1.4, t: 1.5 }, { s: 2.0, t: 1.56 }], seedFly: 7 });
        crack(-0.2, 1.4, k);
      } else if (sc.mode === 'pile') {
        look(V(Math.sin(lt * 0.3) * 6, 3.2, Math.cos(lt * 0.3) * 6), V(0, -1.2, 0));
        m.visible = false;
      } else if (sc.mode === 'wave') {
        m.visible = true;
        const k = 0.6, tc = 0.6, sp = 2.2;
        look(V(0.5, 1.6, lerp(9.5, 8.0, lt / dur)), V(0, 0.3, 0));
        const front = s => { const d = lt - tc; if (d < 0) return 0; const pos = d * sp; return Math.exp(-Math.pow((Math.abs(s - 0.0) - pos) / 0.25, 2)); };
        const reach = 0.0 + 1.6; const tSecond = tc + reach / sp;
        pose(m, { k, lt, breaks: [{ s: 0.0, t: tc }, { s: 1.6, t: tSecond }, { s: -1.6, t: tSecond + 0.04 }], wave: front, seedFly: 11 });
        crack(0, tc, k); crack(1.6, tSecond, k);
      } else if (sc.mode === 'twist' || sc.mode === 'clean') {
        const tw = sc.mode === 'twist' ? (270 * Math.PI / 180) * ease.inOutCubic(remap(lt, 0.4, dur - 0.6)) : 270 * Math.PI / 180;
        const k = sc.mode === 'twist' ? 0 : 0.55 * ease.inOutCubic(remap(lt, 0.1, 1.0));
        look(V(0.6, 2.0, 12.5), V(0, 0.0, 0)); g.rotation.y = sc.mode === 'twist' ? -0.95 : -0.6;
        const breaks = sc.mode === 'clean' ? [{ s: 0.05, t: 1.05 }] : [];
        pose(m, { k, twist: tw, lt, breaks, seedFly: 2 });
        if (sc.mode === 'twist') arrows.forEach((a, i) => { a.visible = true; a.rotation.x = (i ? -1 : 1) * tw; });
        else crack(0.05, 1.05, k);
      }
      if (sc.mode !== 'pile') m.visible = true;
    },
  };
  return S;
}
