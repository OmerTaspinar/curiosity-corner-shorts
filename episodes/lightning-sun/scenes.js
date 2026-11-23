import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, lightning } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.storm = {
    build(sc) {
      const g = new THREE.Group();
      const cloudMat = std('#3b3a52', 0.95, 0, { emissive: '#000000' });
      const clouds = new THREE.Group(); const r = rng(6); for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + r() * 0.9, 2), cloudMat); m.position.set((r() - .5) * 9, 3.6 + r() * 0.8, (r() - .5) * 4 - 1); m.scale.y = 0.6; clouds.add(m); } g.add(clouds);
      const ground = floor('#151325', 10, 0.5); ground.position.y = -2.6; g.add(ground);
      const bolts = [1, 2, 3].map(s => { const b = lightning(V((s - 2) * 1.2, 3.4, 0), V((s - 2) * 0.6 + 0.2, -2.55, 0.3), s * 7); g.add(b); return b; });
      const channel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 16), glowMat('#e0e6ff', 3, { blending: THREE.AdditiveBlending, depthWrite: false })); channel.position.y = 0.4; g.add(channel);
      const shells = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 48, 1, true), glowMat('#9b8cff', 1.2, { blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.y = 0.4; g.add(m); return m; });
      const house = new THREE.Group(); const hb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), std('#4a4560', 0.8)); hb.position.y = 0.35; const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 4), std('#2a2638', 0.8)); roof.position.y = 0.95; roof.rotation.y = Math.PI / 4;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), glowMat('#ffd27a', 1.6)); win.position.set(0, 0.4, 0.41); house.add(hb, roof, win); house.position.set(2.6, -2.6, 1.5); g.add(house);
      const waves = [0, 1, 2, 3].map(() => { const w = soundRing(C('#b9c4ff')); w.rotation.x = Math.PI / 2; g.add(w); return w; });
      const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.35, 0.008), glowMat('#9fb4ff', 1, { blending: THREE.AdditiveBlending, depthWrite: false }), 200); g.add(rain);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lT = new Label(ov, 'A FEW MILLIONTHS OF A SECOND', { size: 38, accent: true });
      g.userData = { clouds, cloudMat, bolts, channel, shells, house, waves, rain, lT, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.bolts.forEach(b => { b.visible = false; }); u.channel.visible = false; u.shells.forEach(s => s.visible = false); u.waves.forEach(w => w.visible = false); u.house.visible = false; u.lT.update(stage, V(), 0);
      let flash = 0; const strike = (b, at, life = 0.5) => { const d = lt - at; if (d < 0 || d > life) return; b.visible = true; b.reveal(clamp(d / 0.06)); const f = Math.exp(-d * 8) * (d > 0.06 ? 1 : d / 0.06); b.userData.mat.opacity = 0.4 + 0.6 * Math.abs(Math.sin(d * 60)) * (1 - d / life); flash = Math.max(flash, f); };
      if (mode === 'hero') { strike(u.bolts[1], 0.45, 0.7); strike(u.bolts[0], 1.2, 0.5); look(V(lerp(1, 2.5, lt / dur), lerp(-1.5, 0.2, ease.outCubic(lt / dur)), lerp(6, 10, ease.outCubic(lt / dur))), V(0, 0.8, 0)); }
      else if (mode === 'slowmo') { u.bolts[1].visible = true; u.bolts[1].reveal(clamp(lt / 1.2)); u.bolts[1].userData.mat.opacity = 1; flash = 0.3 + 0.1 * Math.sin(t * 30); look(V(Math.sin(lt * 0.3) * 3, 0.6, 9), V(0, 0.5, 0)); u.lT.update(stage, V(0, -1.2, 0), clamp((lt - 1.0) / 0.3), 0, 0); }
      else if (mode === 'shock') { u.channel.visible = true; u.channel.material.opacity = 1; const d = lt - 0.6; u.shells.forEach((s, i) => { const k = d - i * 0.15; s.visible = k > 0 && k < 1.4; if (!s.visible) return; const R = 0.1 + ease.outCubic(k / 1.4) * 4; s.scale.set(R, 1, R); s.material.opacity = (1 - k / 1.4) * 0.5; });
        flash = d > 0 ? Math.exp(-d * 5) * 0.8 : 0.3; look(V(2.5, 1.2, 10), V(0, 0.4, 0)); if (d > 0 && d < 0.4) stage.shake = 2; }
      else if (mode === 'thunder') { strike(u.bolts[2], 0.1, 0.8); u.house.visible = true; u.waves.forEach((w, i) => { w.position.set(0.2, -2.55, 0.3); w.update(lt - 0.3 - i * 0.25, 2.0, 0.3, 6); }); look(V(5, 0.2, 9.5), V(0.8, -0.2, 0)); if (lt > 0.4 && lt < 1.6) stage.shake = 1.4 * (1.6 - lt); }
      u.cloudMat.emissive.set('#8a8cff').multiplyScalar(flash * 1.4); stage.flashExtra = flash * 0.22;
      u.clouds.children.forEach((c, i) => c.position.x += Math.sin(t * 0.3 + i) * 0.002);
      const r = rng(2), p = V(); for (let i = 0; i < 200; i++) { const ph = (t * (1.2 + r()) + r()) % 1; p.set((r() - .5) * 10, 3.5 - ph * 6.5, (r() - .5) * 5); setInstance(u.rain, i, p, 1, [0, 0, 0.15]); } u.rain.instanceMatrix.needsUpdate = true;
      stage.bgMat.uniforms.uGlowAmt.value = 0.2 + flash * 0.6;
    },
  };
  return S;
}
