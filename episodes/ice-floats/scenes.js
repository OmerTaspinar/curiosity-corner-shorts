import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, floor, h2o, RoundedBoxGeometry, waterPlane } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const iceMat = () => fresnelMat({ color: '#cff4ff', body: 0.25, rim: 1.3, power: 1.8 });
  // hexagonal ice lattice positions (2 layers of honeycomb)
  const latt = []; for (let layer = 0; layer < 1; layer++) for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) { if (Math.abs(q + r) > 1) continue;
    const cx = (q + r * 0.5) * 1.3, cy = r * 1.125; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const p = V(cx + Math.cos(a) * 0.75, cy + Math.sin(a) * 0.75, layer * 0.9 - 0.45 + (k % 2) * 0.25); if (!latt.some(o => o.distanceTo(p) < 0.2)) latt.push(p); } }
  const S = {};
  S.ice = {
    build(sc) {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.15, 3.2, 48, 1, true), fresnelMat({ color: '#bfe9ff', body: 0.05, rim: 0.9, side: THREE.DoubleSide })); glass.position.y = -0.4; g.add(glass);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.12, 2.3, 48), fresnelMat({ color: '#3aa0ff', body: 0.3, rim: 0.8 })); water.position.y = -0.85; g.add(water);
      const surf = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), glowMat('#6fc3ff', 0.6, { opacity: 0.6, depthWrite: false })); surf.rotation.x = -Math.PI / 2; surf.position.y = 0.3; g.add(surf);
      const cube = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.8, 0.8, 4, 0.12), iceMat()); g.add(cube);
      const block = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 0.7, 4, 0.06), std('#ff9a3c', 0.5, 0.1, { emissive: '#3a1800' })); g.add(block);
      const fl = floor('#13283a', 8, 0.6); fl.position.y = -2.0; g.add(fl);
      const mols = latt.map(() => { const m = h2o(0.85); g.add(m); return m; });
      const bonds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), glowMat('#9fe8ff', 1.6, { blending: THREE.AdditiveBlending, depthWrite: false }), 300); g.add(bonds);
      const pairs = []; latt.forEach((a, i) => latt.forEach((b, j) => { if (j > i && a.distanceTo(b) < 0.9) pairs.push([i, j]); }));
      const voids = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 6), glowMat('#ffd84d', 0.9, { blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 20); g.add(voids);
      const lakeIce = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 4), iceMat()); const lakeW = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 4), fresnelMat({ color: '#1a6aa8', body: 0.45, rim: 0.4 })); g.add(lakeIce, lakeW);
      const fish = [0, 1, 2].map(i => { const f = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), std(i ? '#ff9a3c' : '#ffd84d', 0.4, 0.2)); b.scale.set(1.6, 0.8, 0.6); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 3), b.material); tl.rotation.z = Math.PI / 2; tl.position.x = -0.45; f.add(b, tl); g.add(f); return f; });
      const rings = [0, 1].map(() => { const r = soundRing(C('#bfe9ff')); r.rotation.x = Math.PI / 2; g.add(r); return r; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const lS = new Label(ov, 'SOLID WAX SINKS', { size: 40 }), lB = new Label(ov, 'HYDROGEN BONDS', { size: 40, accent: true });
      g.userData = { glass, water, surf, cube, block, mols, bonds, pairs, voids, lakeIce, lakeW, fish, rings, lS, lB, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; const cup = [u.glass, u.water, u.surf];
      [...cup, u.cube, u.block, u.bonds, u.voids, u.lakeIce, u.lakeW].forEach(o => o.visible = false); u.mols.forEach(m => m.visible = false); u.fish.forEach(f => f.visible = false); u.rings.forEach(r => r.visible = false);
      [u.lS, u.lB].forEach(l => l.update(stage, V(), 0)); u.water.material.uniforms.uC.value.set('#3aa0ff');
      if (mode === 'hero' || mode === 'sink') {
        cup.forEach(o => o.visible = true);
        if (mode === 'hero') { u.cube.visible = true; const k = remap(lt, 0.0, 0.6); const y = k < 1 ? lerp(3, 0.3, k * k) : 0.12 + 0.08 * Math.sin((lt - 0.6) * 5) * Math.exp(-(lt - 0.6) * 1.5); u.cube.position.set(0, y, 0); u.cube.rotation.set(0.3, lt * 0.5, 0.2);
          u.rings.forEach((r, i) => { r.position.set(0, 0.31, 0); r.update(lt - 0.55 - i * 0.15, 1, 0.4, 1.3); }); look(V(lerp(1.5, 2.5, lt / dur), lerp(1.5, 1.0, lt / dur), lerp(4.5, 6.5, ease.outCubic(lt / dur))), V(0, -0.2, 0)); }
        else { u.water.material.uniforms.uC.value.set('#ff8a2a'); u.block.visible = true; const k = ease.inOutSine(remap(lt, 0.4, dur - 0.4)); u.block.position.set(0, lerp(0.6, -1.55, k), 0); u.block.rotation.y = lt * 0.4; look(V(2.2, 0.6, 5.8), V(0, -0.6, 0)); u.lS.update(stage, u.block.position, clamp((lt - 1.2) / 0.3), 0, 80); }
      } else if (mode === 'weird') { const m = u.mols[0]; m.visible = true; m.position.set(0, 0, 0); m.rotation.set(t * 0.6, t * 0.9, 0); m.scale.setScalar(2.4); look(V(0, 0.3, 5.5), V(0, 0, 0)); }
      else if (mode === 'lattice' || mode === 'gaps') {
        const k = mode === 'lattice' ? ease.inOutCubic(remap(lt, 0.4, dur - 0.4)) : 1; const r = rng(4);
        u.mols.forEach((m, i) => { m.visible = true; m.scale.setScalar(1); const jumble = V((r() - .5) * 4.5 + Math.sin(t * 1.3 + i) * 0.3, (r() - .5) * 4 + Math.cos(t * 1.1 + i) * 0.3, (r() - .5) * 2);
          m.position.copy(jumble.lerp(latt[i], k)); m.rotation.set(t * (1 - k) + i, t * (1 - k) * 1.3 + i * 0.5, 0); });
        u.bonds.visible = k > 0.6; let bi = 0; const tmp = new THREE.Object3D();
        u.pairs.slice(0, 300).forEach(([a, b]) => { const A = u.mols[a].position, B = u.mols[b].position; tmp.position.copy(A).add(B).multiplyScalar(0.5); tmp.scale.set(1, A.distanceTo(B), 1); tmp.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()); tmp.updateMatrix(); u.bonds.setMatrixAt(bi++, tmp.matrix); });
        u.bonds.count = bi; u.bonds.instanceMatrix.needsUpdate = true; u.bonds.material.opacity = clamp((k - 0.6) / 0.4) * 0.8;
        if (mode === 'gaps') { u.voids.visible = true; let vi = 0; for (let q = -2; q <= 2; q++) for (let rr = -2; rr <= 2; rr++) { if (Math.abs(q + rr) > 2 || vi >= 20) continue; tmp.position.set((q + rr * 0.5) * 1.3, rr * 1.125, -0.1); tmp.scale.setScalar(0.8 + 0.2 * Math.sin(t * 4 + vi)); tmp.quaternion.identity(); tmp.rotation.set(0, 0, Math.PI / 6); tmp.updateMatrix(); u.voids.setMatrixAt(vi++, tmp.matrix); } u.voids.count = vi; u.voids.instanceMatrix.needsUpdate = true; }
        else u.lB.update(stage, latt[3], clamp((lt - (dur - 0.9)) / 0.3), 0, 70);
        look(V(Math.sin(lt * 0.25) * 2.0, 0.6, 8.0), V(0, 0, 0));
      } else if (mode === 'lake') { u.lakeIce.visible = u.lakeW.visible = true; u.lakeIce.position.y = 0.6; u.lakeW.position.y = -0.88; look(V(3, 1.6, 8.5), V(0, -0.4, 0));
        u.fish.forEach((f, i) => { f.visible = true; const a = t * (0.5 + i * 0.15) + i * 2; f.position.set(Math.sin(a) * 2.6, -0.6 - i * 0.45, Math.cos(a) * 1.0); f.rotation.y = -a + Math.PI / 2 * (Math.cos(a) > 0 ? 1 : -1) * 0 + Math.atan2(Math.cos(a) * 2.6, -Math.sin(a) * 1.0) * 0; f.lookAt(f.position.clone().add(V(Math.cos(a) * 2.6, 0, -Math.sin(a) * 1.0))); f.rotateY(-Math.PI / 2); }); }
    },
  };
  return S;
}
