import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, planet, ringDisk, stars, waterPlane, fresnelMat, RoundedBoxGeometry, atmosphere } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function saturn(r = 1.6) {
    const g = new THREE.Group(); const body = planet({ r, type: 'gas', colA: '#e9cf98', colB: '#b98d52', seed: 4 }); g.add(body);
    const ring = ringDisk(r * 1.25, r * 2.2); ring.rotation.x = Math.PI / 2; g.add(ring); g.rotation.set(0.42, 0, 0.18); g.userData = { body, ring }; return g;
  }
  const S = {};
  S.saturn = {
    build(sc) {
      const g = new THREE.Group(); const sat = saturn(); g.add(sat); g.add(stars(800, 50));
      const water = waterPlane(30, '#0d4a6e', 140); water.position.y = -0.4; g.add(water);
      const tub = new THREE.Group(); const shell = new THREE.Mesh(new RoundedBoxGeometry(9, 2.6, 5.5, 6, 1.1), std('#cfcac2', 0.4, 0.05)); shell.position.y = -1.27; tub.add(shell);
      [[-3.6, -2.2], [3.6, -2.2], [-3.6, 2.2], [3.6, 2.2]].forEach(([x, z]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 8), std('#d4af37', .25, .9)); f.position.set(x, -2.4, z); tub.add(f); });
      const tw = waterPlane(8.2, '#2a8fc4', 80); tw.scale.set(1, 4.8 / 8.2, 1); tw.position.y = 0.15; tub.add(tw); tub.userData.water = tw; g.add(tub);
      const earths = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8), std('#3f8cff', 0.5, 0, { emissive: '#0a2a6a' }), 700); g.add(earths);
      const gas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 260); g.add(gas);
      const ghost = new THREE.Mesh(new THREE.SphereGeometry(1.6, 48, 24), fresnelMat({ color: '#ffd9a0', body: 0.05, rim: 1.0 })); g.add(ghost);
      const rings = [0, 1, 2].map(() => { const r = soundRing(C('#bfe9ff')); r.rotation.x = Math.PI / 2; g.add(r); return r; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const lH = new Label(ov, 'HYDROGEN', { size: 42 }), lHe = new Label(ov, 'HELIUM', { size: 42, accent: true });
      g.userData = { sat, water, tub, earths, gas, ghost, rings, ov, lH, lHe }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.sat.userData.body.material.uniforms.uT.value = t;
      [u.water, u.tub, u.earths, u.gas, u.ghost].forEach(o => o.visible = false); u.sat.visible = true; u.sat.scale.setScalar(1); u.sat.position.set(0, 0, 0);
      u.rings.forEach(r => r.visible = false); u.lH.update(stage, V(), 0); u.lHe.update(stage, V(), 0);
      u.sat.rotation.y = t * 0.1;
      const bob = (y0) => y0 + 0.08 * Math.sin(t * 1.8);
      if (mode === 'hero') {
        u.water.visible = true; u.water.material.uniforms.uT.value = t;
        const drop = ease.outBack(remap(lt, 0.0, 0.7), 1.2); u.sat.position.y = lerp(4, bob(0.15), drop);
        look(V(lerp(2.5, 4.5, lt / dur), lerp(1.0, 2.6, lt / dur), lerp(9, 13, ease.outCubic(lt / dur))), V(0, 0.3, 0));
        u.rings.forEach((r, i) => { r.position.set(0, -0.38, 0); r.update(lt - 0.55 - i * 0.18, 1.4, 1.7, 5); });
      } else if (mode === 'earths') {
        u.ghost.visible = true; u.earths.visible = true; u.sat.visible = false; look(V(Math.sin(lt * .2) * 2, 0.6, 7.5), V(0, 0, 0));
        const r = rng(3), p = V(), n = Math.floor(700 * ease.outCubic(remap(lt, 0.2, dur - 0.3)));
        for (let i = 0; i < 700; i++) { let q; do { q = V(r() - .5, r() - .5, r() - .5).multiplyScalar(3.1); } while (q.length() > 1.5); const k = clamp((lt - 0.2 - i / 700 * (dur - 0.6)) / 0.5);
          p.copy(q).add(V(0, 4 * (1 - ease.outCubic(k)), 0)); setInstance(u.earths, i, p, i < n ? ease.outBack(k) : 0.0001, [0, t, 0]); }
        u.earths.instanceMatrix.needsUpdate = true; u.ghost.rotation.y = t * 0.1;
      } else if (mode === 'gas') {
        u.ghost.visible = true; u.gas.visible = true; u.sat.visible = false; look(V(0.5, 0.4, 6), V(0, 0, 0));
        const r = rng(5), p = V();
        for (let i = 0; i < 260; i++) { const rad = 0.3 + r() * 1.15, a = r() * 6.28 + t * (0.3 + r() * 0.4), b = (r() - .5) * 2.4; p.set(Math.cos(a) * rad * Math.cos(b * 0.5), Math.sin(b * 0.5) * rad, Math.sin(a) * rad * Math.cos(b * 0.5));
          setInstance(u.gas, i, p, ease.outCubic(remap(lt, 0.1 + i / 1000, 0.6 + i / 1000)), [0, 0, 0]); u.gas.setColorAt(i, (i % 5 === 0 ? C('#ff7ab8') : C('#62f0ff')).multiplyScalar(2)); }
        u.gas.instanceMatrix.needsUpdate = true; u.gas.instanceColor.needsUpdate = true;
        u.lH.update(stage, V(-0.4, 0.9, 0), clamp((lt - 0.8) / 0.3)); u.lHe.update(stage, V(0.4, -0.9, 0), clamp((lt - 1.2) / 0.3));
      } else if (mode === 'bath' || mode === 'outro') {
        u.tub.visible = true; u.tub.userData.water.material.uniforms.uT.value = t; u.sat.scale.setScalar(0.55);
        const drop = mode === 'bath' ? ease.outBack(remap(lt, 0.3, 1.1), 1.3) : 1; u.sat.position.set(0.4, lerp(4.5, bob(0.55), drop), 0);
        u.rings.forEach((r, i) => { r.position.set(0.4, 0.17, 0); r.update(mode === 'bath' ? lt - 0.9 - i * 0.2 : -1, 1.4, 0.9, 3); });
        if (mode === 'bath') look(V(lerp(6, 4, lt / dur), lerp(5, 4.2, lt / dur), lerp(12.5, 11.5, lt / dur)), V(0, 0.2, 0));
        else look(V(lerp(4, 7, ease.inOutSine(lt / dur)), lerp(4.2, 8, ease.inOutSine(lt / dur)), lerp(11.5, 22, ease.inOutSine(lt / dur))), V(0, 0, 0));
      }
    },
  };
  return S;
}
