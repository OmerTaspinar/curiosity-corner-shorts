import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, floor, waterPlane, pathTube } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const riverCurve = new THREE.CatmullRomCurve3([V(-3.2, 0.9, -1.2), V(-2.2, 0.3, -0.4), V(-1.2, -0.3, 0.3), V(0.2, -0.75, 0.6), V(1.6, -0.95, 0.4)]);
  const S = {};
  S.ocean = {
    build(sc) {
      const g = new THREE.Group();
      const sea = waterPlane(16, '#0b4f6c', 120); sea.position.set(5, -1.0, 0); g.add(sea);
      const land = new THREE.Group(); const rockMat = std('#6d5a4c', 0.9); const r = rng(5);
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + r() * 0.8, 1), rockMat); m.position.set(-2.5 - r() * 2.5, -0.8 + r() * 1.6, (r() - .5) * 3); m.scale.y = 0.7 + r() * 0.8; m.rotation.set(r(), r(), r()); land.add(m); }
      const hill = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 16), std('#4c5a3a', 0.95)); hill.scale.set(1.3, 0.6, 1); hill.position.set(-4, -1.6, 0); land.add(hill); g.add(land);
      const cloud = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + r() * 0.5, 2), std('#c9d2e0', 1)); m.position.set(-3 + r() * 2.5, 2.4 + r() * 0.4, (r() - .5) * 1.5); m.scale.y = 0.6; cloud.add(m); } g.add(cloud);
      const rain = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), fresnelMat({ color: '#9fd8ff', body: 0.4, rim: 1.3 }), 120); g.add(rain);
      const co2 = [...Array(10)].map(() => { const m = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), std('#333')); m.add(c); [-1, 1].forEach(s => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), std('#ff4d5e', 0.4, 0, { emissive: '#3a0010' })); o.position.x = s * 0.15; m.add(o); }); g.add(m); return m; });
      const minerals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05, 0), glowMat('#ffe9a8', 2), 120); g.add(minerals);
      const river = pathTube(riverCurve, 0.12, '#3aa0ff', 1.0); river.material.uniforms.uOp.value = 0.6; g.add(river);
      const vapor = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat('#dff6ff', 1.2, { blending: THREE.AdditiveBlending, depthWrite: false }), 120); g.add(vapor);
      const salt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), std('#ffffff', 0.3, 0, { emissive: '#666' }), 150); g.add(salt);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), glowMat('#ffd27a', 2.5)); sun.position.set(4.5, 3.5, -3); g.add(sun);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lC = new Label(ov, 'SLIGHTLY ACIDIC RAIN', { size: 38 }), lM = new Label(ov, 'DISSOLVED MINERALS', { size: 38, accent: true });
      g.userData = { sea, cloud, rain, co2, minerals, river, vapor, salt, sun, lC, lM, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.sea.material.uniforms.uT.value = t; let rainK = 0, co2K = 0, minK = 0, riverK = 0, vapK = 0, saltK = 0; [u.lC, u.lM].forEach(l => l.update(stage, V(), 0));
      if (mode === 'hero') { rainK = 1; riverK = 1; vapK = 1; saltK = 0.6; look(V(lerp(-1, 1.5, lt / dur), lerp(3.5, 2.2, lt / dur), lerp(8, 11, ease.outCubic(lt / dur))), V(0.5, 0, 0)); }
      else if (mode === 'rain') { rainK = 1; co2K = 1; look(V(-1.5, 1.6, 5), V(-2.2, 1.2, 0)); u.lC.update(stage, V(-2.2, 0.6, 0.5), clamp((lt - 1.0) / 0.3), 0, 0); }
      else if (mode === 'rocks') { rainK = 0.6; minK = ease.outCubic(remap(lt, 0.3, 1.2)); look(V(-1.5, 1.0, 4.5), V(-2.8, 0, 0)); u.lM.update(stage, V(-2.4, 0.9, 0.5), clamp((lt - 1.2) / 0.3), 0, 0); }
      else if (mode === 'river') { riverK = 1; minK = 1; look(V(0.5, 2.8, 6.5), V(-0.5, -0.3, 0)); }
      else if (mode === 'evap') { vapK = 1; saltK = ease.outCubic(remap(lt, 0.3, dur)); look(V(5, 1.4, 5.5), V(4, -0.6, 0)); }
      const r = rng(3), p = V();
      u.rain.visible = rainK > 0; if (rainK) { for (let i = 0; i < 120; i++) { const ph = (t * (0.9 + r() * 0.4) + r()) % 1; p.set(-4.3 + r() * 3.2, lerp(2.2, -0.6, ph), (r() - .5) * 2.4); setInstance(u.rain, i, p, rainK, [0, 0, 0]); } u.rain.instanceMatrix.needsUpdate = true; }
      u.co2.forEach((m, i) => { m.visible = co2K > 0; const ph = (t * 0.2 + i / 10) % 1; m.position.set(-4 + (i % 5) * 0.7, 1.8 - ph * 1.2, (i % 2 - 0.5) * 1.2); m.rotation.set(t + i, t * 0.7, 0); });
      u.minerals.visible = minK > 0; if (minK) { for (let i = 0; i < 120; i++) { const ph = (t * 0.25 + r()) % 1; const pt = riverCurve.getPointAt(ph); p.copy(pt).add(V((r() - .5) * 0.3, (r() - .5) * 0.2 + 0.1, (r() - .5) * 0.3)); setInstance(u.minerals, i, p, minK, [t + i, t, 0]); } u.minerals.instanceMatrix.needsUpdate = true; }
      u.river.visible = riverK > 0 || minK > 0; u.river.material.uniforms.uP.value = 1;
      u.vapor.visible = vapK > 0; if (vapK) { for (let i = 0; i < 120; i++) { const ph = (t * 0.35 + r()) % 1; p.set(2 + r() * 5, -0.95 + ph * 3.5, (r() - .5) * 4); setInstance(u.vapor, i, p, vapK * (1 - ph), [0, 0, 0]); } u.vapor.instanceMatrix.needsUpdate = true; }
      u.salt.visible = saltK > 0; if (saltK) { const n = Math.floor(150 * saltK); for (let i = 0; i < 150; i++) { p.set(2 + r() * 4.5, -1.05 + r() * 0.12, (r() - .5) * 3.5); setInstance(u.salt, i, p, i < n ? 1 : 0.0001, [r() * 3, r() * 3, 0]); } u.salt.instanceMatrix.needsUpdate = true; }
    },
  };
  return S;
}
