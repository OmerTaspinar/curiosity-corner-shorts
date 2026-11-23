import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow } from '/engine/props.js';

const deg = d => d * Math.PI / 180;
export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const marble = std('#bdb6a6', 0.6, 0.0), shade = std('#9c9484', 0.7, 0);
  function tower() {
    const g = new THREE.Group(), tiers = []; let y = 0;
    for (let i = 0; i < 8; i++) {
      const t = new THREE.Group(); const h = i === 0 ? 0.75 : i === 7 ? 0.55 : 0.5, r = i === 7 ? 0.42 : 0.6;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, h, 40), shade); core.position.y = h / 2; t.add(core);
      const n = i === 7 ? 12 : 22; const col = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, h * 0.78, 8), marble, n); const tmp = new THREE.Object3D();
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; tmp.position.set(Math.cos(a) * r, h * 0.47, Math.sin(a) * r); tmp.updateMatrix(); col.setMatrixAt(k, tmp.matrix); } t.add(col);
      const cornice = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.06, 40), marble); cornice.position.y = h; t.add(cornice);
      t.position.y = y; t.rotation.z = i > 2 ? deg(-0.6) * (i - 2) * 0.3 : 0; y += h + 0.03; g.add(t); tiers.push(t); }
    g.userData = { tiers, H: y }; return g;
  }
  const S = {};
  S.pisa = {
    build(sc) {
      const g = new THREE.Group(); g.position.y = -2.0;
      const pivot = new THREE.Group(); pivot.position.x = 0.6; g.add(pivot); const T = tower(); T.position.x = -0.6; pivot.add(T);
      const grass = floor('#20301f', 9, 0.4); g.add(grass);
      const cut = new THREE.Group(); g.add(cut);
      const layer = (y, h, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(4, h, 2.2), std(col, 0.95)); m.position.set(0, y - h / 2, 0); cut.add(m); return m; };
      layer(0, 0.5, '#6b5638'); layer(-0.5, 1.2, '#4a3a2a'); const clay = layer(-1.7, 1.4, '#3a2e2a');
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), std('#9b9488', 0.8)); slab.position.y = -0.18; cut.add(slab); cut.position.z = 0.0;
      const drills = [0, 1, 2].map(i => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), std('#b8bec9', 0.3, 0.9)); d.rotation.z = 1.0; d.position.set(-1.4, -0.7 - i * 0.12, (i - 1) * 0.4); g.add(d); return d; });
      const soil = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), std('#8a6a44', 0.9), 60); g.add(soil);
      const warn = soundRing(C('#ff4d4d')); warn.rotation.x = Math.PI / 2; g.add(warn); const ok = soundRing(C('#4dff9a')); ok.rotation.x = Math.PI / 2; g.add(ok);
      const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), glowMat('#ffe9c0', 1.2, { blending: THREE.AdditiveBlending, depthWrite: false }), 80); g.add(dust);
      const ov = new THREE.Group(); stage.overlay.add(ov); const l3 = new Label(ov, 'ONLY 3 M DEEP', { size: 40, accent: true }), lc = new Label(ov, 'SOFT CLAY', { size: 40 });
      g.userData = { pivot, T, cut, drills, soil, warn, ok, dust, l3, lc, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; let tilt = 4.6, showN = 8; u.cut.visible = false; u.drills.forEach(d => d.visible = false); u.soil.visible = false; u.warn.visible = u.ok.visible = false;
      [u.l3, u.lc].forEach(l => l.update(stage, V(), 0)); g.rotation.y = 0;
      if (mode === 'hero') { tilt = 4.6 + 0.6 * Math.sin(Math.min(lt, 1.2) * 6) * Math.exp(-lt * 2); const a = lerp(-0.9, -0.2, ease.outCubic(lt / dur)); look(V(Math.sin(a) * 10, lerp(-1.2, 0.6, ease.outCubic(lt / dur)), Math.cos(a) * 10), V(0, 0.6, 0)); }
      else if (mode === 'build') { showN = Math.min(8, Math.floor(remap(lt, 0.1, dur - 0.5) * 8) + 1); tilt = lerp(0, 3.5, remap(lt, 0.8, dur)); look(V(5.5, 1.0, 10), V(0, 0.8, 0)); }
      else if (mode === 'soil') { u.cut.visible = true; tilt = 4.6; look(V(1.5, -1.0, 10), V(0, -1.6, 0)); u.l3.update(stage, V(0.9, -2.2, 1.1), clamp((lt - 0.6) / 0.3), 60, 0); u.lc.update(stage, V(-1.2, -3.6, 1.1), clamp((lt - 1.0) / 0.3), 0, 0); }
      else if (mode === 'danger') { tilt = lerp(4.6, 5.6, ease.inOutSine(remap(lt, 0.2, dur))); look(V(-5, 1.2, 10), V(0, 0.8, 0)); u.warn.visible = true; u.warn.position.set(0, 0.02, 0); u.warn.update((lt % 0.9), 0.9, 1.0, 2.6); stage.shake = 0.3; }
      else if (mode === 'extract') { u.cut.visible = true; tilt = lerp(5.6, 4.0, ease.inOutSine(remap(lt, 0.5, dur))); look(V(-2, -1.0, 10), V(0, -1.6, 0)); u.drills.forEach(d => d.visible = true);
        u.soil.visible = true; const r = rng(3), p = V(); for (let i = 0; i < 60; i++) { const ph = (lt * 0.6 + r()) % 1; p.set(lerp(-0.7, -2.6, ph), lerp(-0.6, 0.1, ph) - (i % 3) * 0.12, (i % 3 - 1) * 0.4); setInstance(u.soil, i, p, 1, [0, 0, 0]); } u.soil.instanceMatrix.needsUpdate = true; }
      else if (mode === 'result') { tilt = 3.97; const a = -0.3 + lt * 0.15; look(V(Math.sin(a) * 11, 1.4, Math.cos(a) * 11), V(0, 1.0, 0)); u.ok.visible = true; u.ok.position.set(0, 0.02, 0); u.ok.update(lt % 1.2, 1.2, 1.0, 2.4); }
      u.pivot.rotation.z = deg(-tilt);
      u.T.userData.tiers.forEach((tr, i) => { tr.visible = i < showN; tr.scale.setScalar(i === showN - 1 && mode === 'build' ? ease.outBack(((remap(lt, 0.1, dur - 0.5) * 8) % 1)) : 1); });
      const r = rng(5), p = V(); for (let i = 0; i < 80; i++) { p.set((r() - .5) * 6, ((t * 0.05 + r()) % 1) * 6, (r() - .5) * 4); setInstance(u.dust, i, p, 0.5 + r(), [0, 0, 0]); } u.dust.instanceMatrix.needsUpdate = true;
      stage.bgMat.uniforms.uGlowPos.value.set(0.5, 0.7);
    },
  };
  return S;
}
