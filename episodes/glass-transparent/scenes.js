import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, floor, arrow, RoundedBoxGeometry } from '/engine/props.js';

const VIS = ['#ff4d4d', '#ff9a3c', '#ffe14a', '#4fe36b', '#3aa0ff', '#8a6bff'];
export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.glass = {
    build(sc) {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new RoundedBoxGeometry(0.5, 3.2, 2.6, 4, 0.06), fresnelMat({ color: '#bfe9ff', body: 0.1, rim: 1.2, power: 2.0 })); g.add(glass);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 3.2, 2.6)), new THREE.LineBasicMaterial({ color: C('#bfe9ff').multiplyScalar(1.5), toneMapped: false, transparent: true, opacity: 0.5 })); glass.add(edges);
      const wood = new THREE.Mesh(new RoundedBoxGeometry(0.5, 3.2, 2.6, 4, 0.06), std('#7a4a2a', 0.8)); g.add(wood);
      const fl = floor('#1a2230', 8, 0.6); fl.position.y = -2.0; g.add(fl);
      const ph = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 90); g.add(ph);
      const trails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), 90); g.add(trails);
      const pops = [...Array(6)].map(() => { const r = soundRing(C('#ffb36b')); r.rotation.y = Math.PI / 2; g.add(r); return r; });
      // energy diagram
      const diag = new THREE.Group(); const lo = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), glowMat('#62f0ff', 1.6)); lo.position.y = -1.1; const hi = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), glowMat('#ffd84d', 1.6)); hi.position.y = 1.2; diag.add(lo, hi);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), glowMat('#62f0ff', 2.5)); diag.add(e); const jump = arrow('#ffffff', 1, 0.05); diag.add(jump); g.add(diag);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lGap = new Label(ov, 'ENERGY GAP', { size: 44, accent: true }), lV = new Label(ov, 'VISIBLE: TOO WEAK', { size: 38 }), lU = new Label(ov, 'UV: ABSORBED', { size: 38 });
      lU.t.material.color.set('#c9a8ff');
      g.userData = { glass, wood, ph, trails, pops, diag, e, jump, lGap, lV, lU, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.glass.visible = u.wood.visible = false; u.diag.visible = false; u.pops.forEach(p => p.visible = false); [u.lGap, u.lV, u.lU].forEach(l => l.update(stage, V(), 0));
      // photons travel +x from -4 to +4; stopAt: x where absorbed (null = pass), uvFrac: share that are ultraviolet
      const stream = (stopFn, uvFrac = 0) => { const r = rng(5), p = V(), tmp = new THREE.Object3D(); u.ph.visible = u.trails.visible = true;
        for (let i = 0; i < 90; i++) { const uv = r() < uvFrac; const ph = (t * 0.3 + r()) % 1; let x = -4 + ph * 8; const y = (r() - .5) * 2.6, z = (r() - .5) * 2.0; const stop = stopFn(uv); let a = 1;
          if (stop !== null && x > stop) { a = clamp(1 - (x - stop) * 4); x = stop; }
          p.set(x, y, z); setInstance(u.ph, i, p, a > 0 ? 1 : 0.0001, [0, 0, 0]); const col = uv ? C('#b06bff') : C(VIS[i % 6]); u.ph.setColorAt(i, col.clone().multiplyScalar(2.2));
          tmp.position.set(x - 0.25, y, z); tmp.scale.set(1, a, a); tmp.updateMatrix(); u.trails.setMatrixAt(i, tmp.matrix); u.trails.setColorAt(i, col.clone().multiplyScalar(1.2)); }
        u.ph.instanceMatrix.needsUpdate = u.ph.instanceColor.needsUpdate = u.trails.instanceMatrix.needsUpdate = u.trails.instanceColor.needsUpdate = true; };
      u.ph.visible = u.trails.visible = false;
      if (mode === 'hero') { u.glass.visible = true; stream(() => null); u.glass.rotation.y = lerp(-0.8, -0.3, ease.outCubic(lt / dur)); look(V(lerp(2.5, 3.5, lt / dur), 0.8, lerp(4.5, 7.5, ease.outCubic(lt / dur))), V(0, 0, 0)); }
      else if (mode === 'photons') { stream(() => null); look(V(0, 0.6, 7), V(0, 0, 0)); }
      else if (mode === 'absorb') { u.wood.visible = true; u.wood.rotation.y = -0.3; stream(() => -0.25); look(V(2.5, 0.8, 7), V(-0.6, 0, 0)); u.pops.forEach((pp, i) => { pp.position.set(-0.27, (rng(i + 1)() - .5) * 2.4, (rng(i + 9)() - .5) * 1.8); pp.update(((lt + i * 0.35) % 1.2) - 0.2, 0.5, 0.05, 0.4); }); }
      else if (mode === 'gap' || mode === 'uv') {
        if (mode === 'gap') { u.diag.visible = true; look(V(0, 0, 7), V(0, 0, 0)); const k = (lt % 1.6) / 1.6; const h = 1.2 * Math.sin(Math.PI * clamp(k * 1.1)); u.e.position.set(0, -1.1 + h, 0); u.jump.position.set(-0.6, -1.1, 0); u.jump.setLength(Math.max(0.2, h + 0.1));
          u.lGap.update(stage, V(1.0, 0.05, 0), clamp((lt - 0.6) / 0.3), 0, 0); u.lV.update(stage, V(0, -1.6, 0), clamp((lt - 1.2) / 0.3), 0, 0); }
        else { u.glass.visible = true; u.glass.rotation.y = -0.3; stream(uv => uv ? 0.0 : null, 0.4); look(V(2.5, 0.8, 7.5), V(0, 0, 0)); u.lU.update(stage, V(0, 1.9, 0), clamp((lt - 0.8) / 0.3), 0, 0); } }
      else if (mode === 'through') { u.glass.visible = true; u.glass.rotation.y = -0.3; stream(() => null); const a = lt * 0.15; look(V(Math.sin(a + 0.4) * 7, 0.8, Math.cos(a + 0.4) * 7), V(0, 0, 0)); }
    },
  };
  return S;
}
