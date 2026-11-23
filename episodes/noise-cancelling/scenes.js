import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, waveRibbon, floor, RoundedBoxGeometry } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function headphones() {
    const g = new THREE.Group(), shell = std('#1c1e26', 0.35, 0.6), accent = std('#ffd84d', 0.3, 0.7), soft = std('#2c2f3a', 0.9);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 16, 64, Math.PI), shell); band.position.y = 0.2; g.add(band);
    const cups = [-1, 1].map(s => { const c = new THREE.Group(); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.42, 40), shell); cup.rotation.z = Math.PI / 2; c.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 48), accent); ring.rotation.y = Math.PI / 2; ring.position.x = s * 0.21; c.add(ring);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.13, 12, 40), soft); pad.rotation.y = Math.PI / 2; pad.position.x = -s * 0.25; c.add(pad);
      const mic = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glowMat('#62f0ff', 2)); mic.position.set(s * 0.22, -0.25, 0.32); c.add(mic); c.userData.mic = mic;
      c.position.set(s * 1.25, 0.1, 0); g.add(c); return c; });
    g.userData = { cups }; return g;
  }
  const S = {};
  S.anc = {
    build(sc) {
      const g = new THREE.Group(); const H = headphones(); g.add(H);
      const noise = waveRibbon({ len: 7, width: 0.07, color: '#ff6a9a', amp: 0.45, k: 3.2, glow: 1.8 }), anti = waveRibbon({ len: 7, width: 0.07, color: '#62f0ff', amp: 0.45, k: 3.2, glow: 1.8 }), sum = waveRibbon({ len: 7, width: 0.06, color: '#ffffff', amp: 0, k: 3.2, glow: 2.2 });
      g.add(noise, anti, sum);
      const cols = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), glowMat('#ff9ab8', 1.4), 420); g.add(cols);
      const chip = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.06, 0.4, 2, 0.02), std('#0d1d2a', 0.4, 0.6, { emissive: '#0a3a5a' })); g.add(chip);
      const plane = new THREE.Group(); const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 5, 8, 24), std('#d9dee8', 0.4, 0.4)); fus.rotation.z = Math.PI / 2; plane.add(fus);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 6.5), std('#c4cad6', 0.4, 0.4)); wing.position.x = 0.2; plane.add(wing); [-1.6, 1.6].forEach(z => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 24), std('#8a92a2', .4, .7)); e.rotation.z = Math.PI / 2; e.position.set(0.5, -0.35, z); plane.add(e); });
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.08), std('#c4cad6', .4, .4)); fin.position.set(-2.6, 0.6, 0); plane.add(fin); plane.position.set(1, 2.6, -6); plane.rotation.y = 0.5; g.add(plane);
      const rings = [0, 1, 2, 3].map(() => { const r = soundRing(C('#ff6a9a')); g.add(r); return r; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const lN = new Label(ov, 'NOISE', { size: 42 }), lA = new Label(ov, 'ANTI-NOISE', { size: 42 }), lS = new Label(ov, 'SILENCE', { size: 46, accent: true });
      lN.t.material.color.set('#ff8ab0'); lA.t.material.color.set('#7ff4ff');
      g.userData = { H, noise, anti, sum, cols, chip, plane, rings, lN, lA, lS, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; [u.noise, u.anti, u.sum, u.cols, u.chip, u.plane].forEach(o => o.visible = false); u.H.visible = true; u.rings.forEach(r => r.visible = false);
      [u.lN, u.lA, u.lS].forEach(l => l.update(stage, V(), 0)); u.H.position.set(0, 0, 0); u.H.rotation.set(0, 0, 0); u.H.scale.setScalar(1);
      const setW = (w, y, amp, ph, op = 1, rev = 1) => { w.visible = true; w.position.set(0, y, 0.8); const m = w.material.uniforms; m.uAmp.value = amp; m.uPhase.value = ph; m.uOp.value = op; m.uReveal.value = rev; };
      const ph = -t * 5;
      if (mode === 'hero') { const k = ease.inOutCubic(remap(lt, 0.6, 1.4)); u.H.rotation.y = lerp(-1.2, 0.25, ease.outCubic(lt / 1.0)); u.H.position.y = 1.0;
        setW(u.noise, -1.2, 0.45 * (1 - k), ph); setW(u.anti, -1.2, -0.45 * (1 - k), ph, 1 - k); setW(u.sum, -1.2, 0, ph, k); look(V(0, 0.2, lerp(5.5, 8, ease.outCubic(lt / dur))), V(0, 0, 0));
        u.lS.update(stage, V(0, -1.2, 0.8), clamp((lt - 1.3) / 0.2), 0, 60); }
      else if (mode === 'wave') { u.H.visible = false; u.cols.visible = true; setW(u.noise, -1.6, 0.45, ph); look(V(0, 0.2, 7.5), V(0, -0.3, 0));
        const tmp = V(); let i = 0; for (let cx = 0; cx < 42; cx++) for (let cy = 0; cy < 10; cy++) { const x0 = -3.5 + cx / 41 * 7; const x = x0 + 0.12 * Math.sin(x0 * 3.2 + ph); tmp.set(x, -0.6 + cy * 0.2, 0); const dens = Math.cos(x0 * 3.2 + ph); setInstance(u.cols, i++, tmp, 0.8 + 0.4 * dens, [0, 0, 0]); } u.cols.instanceMatrix.needsUpdate = true; }
      else if (mode === 'mic') { u.H.scale.setScalar(1.3); u.H.rotation.y = 0.6; look(V(3.2, 0.3, 3.4), V(1.4, 0, 0)); setW(u.noise, -0.25, 0.3, ph, 1, ease.outCubic(remap(lt, 0, 1.0))); u.noise.position.set(4.0, -0.4, 0.5);
        u.H.userData.cups.forEach(c => c.userData.mic.scale.setScalar(1 + 0.6 * Math.abs(Math.sin(t * 8)))); u.chip.visible = true; u.chip.position.set(1.65, 0.45, 0.45); u.chip.rotation.y = 0.6; u.chip.material.emissiveIntensity = 1 + Math.sin(t * 10); }
      else if (mode === 'anti') { u.H.position.y = 1.5; u.H.scale.setScalar(0.7); look(V(0, 0.3, 7.5), V(0, -0.2, 0)); setW(u.noise, 0.0, 0.45, ph); setW(u.anti, -1.4, -0.45, ph, 1, ease.outCubic(remap(lt, 0.4, 1.6)));
        u.lN.update(stage, V(-2.6, 0.55, 0.8), clamp((lt - 0.2) / 0.3), 0, 0); u.lA.update(stage, V(-2.4, -0.85, 0.8), clamp((lt - 1.2) / 0.3), 0, 0); }
      else if (mode === 'cancel') { u.H.position.y = 1.5; u.H.scale.setScalar(0.7); look(V(0, 0.3, 7.5), V(0, -0.2, 0)); const k = ease.inOutCubic(remap(lt, 0.3, 1.5));
        setW(u.noise, lerp(0.0, -0.7, k), 0.45, ph, 1 - k * 0.8); setW(u.anti, lerp(-1.4, -0.7, k), -0.45, ph, 1 - k * 0.8); setW(u.sum, -0.7, 0, ph, k); u.lS.update(stage, V(0, -0.7, 0.8), clamp((lt - 1.6) / 0.3), 0, 70); }
      else if (mode === 'plane') { u.plane.visible = true; u.H.scale.setScalar(0.9); u.H.position.set(0, -0.6, 1); u.H.rotation.y = 0.4 + lt * 0.1; look(V(lerp(2, -1, lt / dur), 0.8, 8), V(0, 0.6, -2));
        u.rings.forEach((r, i) => { r.position.set(1.5, 2.25, -4.4); r.update(((lt + i * 0.45) % 1.8), 1.8, 0.5, lerp(3.5, 1.2, clamp(lt / dur))); r.material.color.set('#ff6a9a').multiplyScalar(2 * (1 - clamp(lt / dur) * 0.7)); }); }
    },
  };
  return S;
}
