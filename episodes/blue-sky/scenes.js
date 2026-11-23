import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, planet, atmosphere, stars, waveRibbon, fresnelMat } from '/engine/props.js';

const RAINBOW = ['#ff3b3b', '#ff8a1f', '#ffe14a', '#4fe36b', '#3aa0ff', '#7b5cff'];

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  // photon stream: white photons travel +x; a fraction (blue) scatter at random times into random directions
  function photons(n, seed) {
    const r = rng(seed), mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    mesh.userData.p = [...Array(n)].map(() => ({ y: (r() - .5) * 2.4, z: (r() - .5) * 1.2, ph: r(), blue: r() < 0.55, ts: 0.25 + r() * 0.5, dir: V(r() - .5, r() - .5, r() - .5).normalize(), red: r() }));
    return mesh;
  }
  function flow(mesh, t, { x0 = -4, len = 8, speed = 0.35, scatter = 1, sunset = 0, origin = V() } = {}) {
    const p = V(); mesh.userData.p.forEach((q, i) => {
      const ph = (t * speed + q.ph) % 1; let x = x0 + ph * len, y = q.y, z = q.z; let col = C('#ffffff');
      const blueOut = q.blue && scatter > 0 && ph > q.ts;
      if (blueOut) { const d = (ph - q.ts) * len; const bx = x0 + q.ts * len; x = bx + q.dir.x * d; y = q.y + q.dir.y * d; z = q.z + q.dir.z * d; col = C('#3aa0ff'); }
      else if (scatter > 0 && ph > 0.15) col = q.blue ? C('#ffffff') : C('#ffd8a8');
      if (sunset > 0) col = blueOut ? C('#3aa0ff').multiplyScalar(1 - sunset * 0.6) : C('#ffffff').lerp(C(q.red > 0.5 ? '#ff5a2a' : '#ff9a3c'), clamp(ph * 1.5) * sunset);
      p.set(x, y, z).add(origin); setInstance(mesh, i, p, blueOut ? 1.2 : 1, [0, 0, 0]); mesh.setColorAt(i, col.multiplyScalar(2.2));
    }); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  function molecules(n, seed, spread = [7, 3, 2]) {
    const g = new THREE.Group(), r = rng(seed), mN = std('#7fa8ff', 0.3, 0.1, { emissive: '#10204a' }), mO = std('#ff7a8a', 0.3, 0.1, { emissive: '#40101a' });
    for (let i = 0; i < n; i++) { const m = new THREE.Group(); const mat = r() < 0.78 ? mN : mO; [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8), mat); a.position.x = s * 0.07; m.add(a); });
      m.position.set((r() - .5) * spread[0], (r() - .5) * spread[1], (r() - .5) * spread[2]); m.rotation.set(r() * 6, r() * 6, r() * 6); m.userData.w = r() * 2; g.add(m); }
    return g;
  }
  const S = {};
  S.sky = {
    build(sc) {
      const g = new THREE.Group(), mode = sc.mode; const u = {};
      u.stars = stars(500, 50); g.add(u.stars);
      u.earth = planet({ r: 3, type: 'earth', seed: 2 }); u.earth.position.set(0, -4.2, 0); g.add(u.earth);
      u.atmo = atmosphere(3.35, '#4fa8ff', 2.2); u.atmo.position.copy(u.earth.position); g.add(u.atmo);
      u.sun = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 16), glowMat('#fff3c4', 2.2)); u.sun.position.set(-6, 2.5, -2); g.add(u.sun);
      u.ph = photons(220, 3); g.add(u.ph);
      u.mol = molecules(26, 5); g.add(u.mol);
      u.prism = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 3), fresnelMat({ color: '#cfe8ff', body: 0.22, rim: 1.3 })); u.prism.add(new THREE.LineSegments(new THREE.EdgesGeometry(u.prism.geometry), new THREE.LineBasicMaterial({ color: C('#e8f6ff').multiplyScalar(2), toneMapped: false }))); g.add(u.prism);
      u.inBeam = waveRibbon({ len: 4, width: 0.09, color: '#ffffff', amp: 0, k: 1, glow: 2 }); g.add(u.inBeam);
      u.rays = RAINBOW.map((c, i) => { const w = waveRibbon({ len: 4.2, width: 0.07, color: c, amp: 0, k: 1, glow: 2 }); g.add(w); return w; });
      u.blueW = waveRibbon({ len: 5, width: 0.05, color: '#3aa0ff', amp: 0.25, k: 9, glow: 2 }); u.redW = waveRibbon({ len: 5, width: 0.05, color: '#ff4a3a', amp: 0.25, k: 3, glow: 2 }); g.add(u.blueW, u.redW);
      u.dome = new THREE.Mesh(new THREE.SphereGeometry(4, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), fresnelMat({ color: '#3aa0ff', body: 0.18, rim: 0.9, side: THREE.DoubleSide })); g.add(u.dome);
      u.fl = floor('#1a3a2a', 7, 0.3); g.add(u.fl);
      u.person = new THREE.Group(); const sk = std('#f2c9a0', .6); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 6, 12), std('#ffd84d', .6)); b.position.y = 0.45; const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), sk); h.position.y = 0.95; u.person.add(b, h); g.add(u.person);
      const ov = new THREE.Group(); stage.overlay.add(ov); u.lb = new Label(ov, 'BLUE: SHORT WAVES', { size: 40 }); u.lr = new Label(ov, 'RED: LONG WAVES', { size: 40 }); u.lb.t.material.color.set('#7fc4ff'); u.lr.t.material.color.set('#ff8a7a');
      g.userData = { u, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { u } = g.userData, mode = sc.mode;
      Object.values(u).forEach(o => { if (o && o.isObject3D) o.visible = false; }); u.rays.forEach(r => r.visible = false);
      u.stars.visible = true; u.stars.material.uniforms.uT.value = t; u.lb.update(stage, V(), 0); u.lr.update(stage, V(), 0);
      if (mode === 'hero' || mode === 'dome' && false) {}
      if (mode === 'hero') {
        u.earth.visible = u.atmo.visible = u.sun.visible = u.ph.visible = true; u.earth.material.uniforms.uT.value = t;
        look(V(lerp(0, 1.5, lt / dur), lerp(1.5, -0.5, ease.outCubic(lt / dur)), lerp(13, 7.5, ease.outCubic(lt / dur))), V(0, -1.2, 0));
        u.earth.rotation.y = t * 0.05; flow(u.ph, t, { x0: -6, len: 7, speed: 0.6, origin: V(0, -0.6, 0), scatter: 1 });
      } else if (mode === 'prism') {
        u.prism.visible = u.inBeam.visible = true; u.rays.forEach(r => r.visible = true);
        look(V(0.6, 0.4, 7.5), V(0.4, 0, 0)); u.prism.rotation.y = 0; u.prism.rotation.z = 0; u.prism.rotation.set(Math.PI / 2 + 0.25, 0.35, Math.PI / 6 + lt * 0.08);
        u.inBeam.position.set(-2.6, 0.2, 0); u.inBeam.rotation.z = -0.1; u.inBeam.material.uniforms.uReveal.value = ease.outCubic(remap(lt, 0, 0.6));
        u.rays.forEach((r, i) => { r.position.set(0.3, 0, 0); r.geometry.translate && 0; r.rotation.z = (i - 2.5) * 0.12 - 0.15; r.position.set(0.3 + Math.cos(r.rotation.z) * 2.1, Math.sin(r.rotation.z) * 2.1, 0); r.material.uniforms.uReveal.value = ease.outCubic(remap(lt, 0.5, 1.4)); });
      } else if (mode === 'scatter') {
        u.ph.visible = u.mol.visible = true; look(V(Math.sin(lt * 0.2) * 1.5, 0.5, 6.5), V(0, 0, 0));
        u.mol.children.forEach((m, i) => { m.rotation.x += 0; m.rotation.set(t * m.userData.w + i, t * 0.7 + i, 0); });
        flow(u.ph, t, { x0: -5, len: 10, speed: 0.25, scatter: clamp(lt / 0.6) });
      } else if (mode === 'waves') {
        u.blueW.visible = u.redW.visible = true; u.mol.visible = true; look(V(0, 0.2, 7), V(0, 0, 0));
        u.blueW.position.set(0, 0.9, 0); u.redW.position.set(0, -0.9, 0); u.blueW.material.uniforms.uPhase.value = -t * 8; u.redW.material.uniforms.uPhase.value = -t * 3;
        u.blueW.material.uniforms.uAmp.value = 0.25; u.redW.material.uniforms.uAmp.value = 0.25;
        u.mol.children.forEach((m, i) => { m.visible = i < 6; m.rotation.set(t * m.userData.w, t, 0); });
        u.lb.update(stage, V(0, 1.35, 0), clamp((lt - 0.4) / 0.3)); u.lr.update(stage, V(0, -0.45, 0), clamp((lt - 0.7) / 0.3));
      } else if (mode === 'dome' || mode === 'sunset') {
        const sunset = mode === 'sunset' ? ease.inOutSine(remap(lt, 0.2, 2.0)) : 0;
        if (sunset > 0) stage.setTheme('fire');
        u.dome.visible = u.fl.visible = u.person.visible = u.ph.visible = u.sun.visible = true;
        u.dome.material.uniforms.uC.value.set('#3aa0ff').lerp(C('#ff7a2a'), sunset);
        u.sun.position.set(lerp(-3, -5.5, sunset), lerp(5, 0.6, sunset), -3);
        look(V(Math.sin(lt * 0.25) * 2 + 2, lerp(2.2, 1.4, sunset), 9.5), V(0, 1.2, 0));
        const origin = mode === 'dome' ? V(0, 1.6, 0) : V(0, 0.9, 0);
        flow(u.ph, t, { x0: -4.5, len: 9, speed: 0.3, origin, scatter: 1, sunset });
      }
    },
  };
  return S;
}
