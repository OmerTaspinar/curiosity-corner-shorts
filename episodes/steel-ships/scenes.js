import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, waterPlane, arrow, RoundedBoxGeometry } from '/engine/props.js';

function hullGeo(w = 1.2, h = 0.8, t = 0.06, len = 4) {
  const sh = new THREE.Shape(); const pts = []; for (let i = 0; i <= 20; i++) { const a = Math.PI + i / 20 * Math.PI; pts.push([Math.cos(a) * w, Math.sin(a) * h + 0.0]); }
  sh.moveTo(-w, 0.35); pts.forEach(([x, y]) => sh.lineTo(x, y)); sh.lineTo(w, 0.35); sh.lineTo(w - t, 0.35);
  for (let i = 20; i >= 0; i--) { const a = Math.PI + i / 20 * Math.PI; sh.lineTo(Math.cos(a) * (w - t), Math.sin(a) * (h - t)); } sh.lineTo(-w + t, 0.35); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 20 }); g.translate(0, 0, -len / 2); return g;
}

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const steel = std('#8a94a6', 0.35, 0.8), paint = std('#c0392b', 0.5, 0.3);
  const S = {};
  S.ship = {
    build(sc) {
      const g = new THREE.Group();
      const water = waterPlane(30, '#0b4f6c', 140); water.material.uniforms.uOp.value = 0.82; g.add(water);
      const under = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 30), fresnelMat({ color: '#0a3550', body: 0.55, rim: 0.2, side: THREE.BackSide })); under.position.y = -3.02; g.add(under);
      const block = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.05), steel); g.add(block);
      const ship = new THREE.Group(); const hull = new THREE.Mesh(hullGeo(), steel); ship.add(hull); const stripe = new THREE.Mesh(hullGeo(1.205, 0.805, 0.03, 4.01), paint); stripe.scale.y = 0.35; stripe.position.y = -0.52; ship.add(stripe);
      const house = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.6, 1.2, 3, 0.08), std('#e8e8ec', 0.5)); house.position.set(0, 0.65, -0.8); house.material.color.set('#b9bcc4'); ship.add(house);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.5, 20), paint); funnel.position.set(0, 1.15, -0.9); ship.add(funnel);
      const air = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.9, 32, 1, false, 0, Math.PI), glowMat('#62f0ff', 0.5, { blending: THREE.AdditiveBlending, depthWrite: false })); air.rotation.set(Math.PI / 2, 0, Math.PI / 2); air.scale.set(1, 1, 0.7); air.position.y = 0.0; ship.add(air); g.add(ship);
      const disp = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 4), fresnelMat({ color: '#4fc3ff', body: 0.35, rim: 1.0 })); g.add(disp);
      const ups = [...Array(5)].map(() => { const a = arrow('#62f0ff', 0.8, 0.05); g.add(a); return a; }); const down = arrow('#ff7a3d', 1.4, 0.07); down.rotation.z = Math.PI; g.add(down);
      const rings = [0, 1, 2].map(() => { const r = soundRing(C('#bfe9ff')); r.rotation.x = Math.PI / 2; r.position.y = 0.02; g.add(r); return r; });
      const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), fresnelMat({ color: '#dff6ff', body: 0.2, rim: 1.4 }), 50); g.add(bubbles);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lA = new Label(ov, 'MOSTLY AIR', { size: 42, accent: true }), lB = new Label(ov, 'BUOYANCY', { size: 40 }), lW = new Label(ov, 'WEIGHT', { size: 40 });
      g.userData = { water, under, block, ship, air, disp, ups, down, rings, bubbles, lA, lB, lW, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.water.material.uniforms.uT.value = t; [u.block, u.ship, u.disp, u.down].forEach(o => o.visible = false); u.ups.forEach(a => a.visible = false); u.rings.forEach(r => r.visible = false); u.bubbles.visible = false; u.air.visible = false;
      [u.lA, u.lB, u.lW].forEach(l => l.update(stage, V(), 0));
      const bob = 0.05 * Math.sin(t * 1.6), roll = 0.04 * Math.sin(t * 1.1);
      const sink = (start) => { u.block.visible = true; const d = lt - start; const y = d < 0 ? 2.6 : d < 0.4 ? lerp(2.6, 0, (d / 0.4) ** 2) : -Math.min(4.5, (d - 0.4) * 1.6); u.block.position.set(-1.2, y, 0.5); u.block.rotation.set(d * 0.4, d * 0.3, 0);
        u.rings.forEach((r, i) => { r.position.set(-1.2, 0.02, 0.5); r.update(d - 0.4 - i * 0.15, 1.2, 0.5, 2); });
        u.bubbles.visible = d > 0.4; const rr = rng(4), p = V(); for (let i = 0; i < 50; i++) { const ph = ((d - 0.4) * 0.8 + rr()) % 1; p.set(-1.2 + (rr() - .5) * 0.4, lerp(y, -0.05, ph), 0.5 + (rr() - .5) * 0.4); setInstance(u.bubbles, i, p, d > 0.4 ? 1 - ph * 0.5 : 0.0001, [0, 0, 0]); } u.bubbles.instanceMatrix.needsUpdate = true; };
      const float = (y = 0.1) => { u.ship.visible = true; u.ship.position.set(1.0, y + bob, 0); u.ship.rotation.set(0, 0.5, roll); };
      if (mode === 'hero') { float(); u.ship.position.x = 0.9; sink(0.6); look(V(lerp(-1, 2, lt / dur), lerp(1.8, 3.2, lt / dur), lerp(6.5, 10, ease.outCubic(lt / dur))), V(0, -0.2, 0)); }
      else if (mode === 'block') { sink(0.8); look(V(-0.6, 1.6, 5.5), V(-1.2, -0.2, 0.5)); }
      else if (mode === 'hull') { float(); u.ship.position.x = 0; u.air.visible = true; u.air.material.opacity = 0.4 + 0.2 * Math.sin(t * 3); look(V(lerp(5, 3.5, lt / dur), 2.6, 5.5), V(0, 0, 0)); u.lA.update(stage, V(0, 0.2, 0), clamp((lt - 0.6) / 0.3), 0, 0); }
      else if (mode === 'displace') { float(); u.ship.position.x = 0; u.disp.visible = true; const k = ease.outCubic(remap(lt, 0.3, 1.5)); u.disp.position.set(lerp(0, 2.8, k), lerp(-0.4, 0.6, k), 0); u.disp.rotation.y = 0.5; look(V(3, 2.4, 7), V(1, 0, 0)); }
      else if (mode === 'buoy') { float(); u.ship.position.x = 0; look(V(4.5, 0.6, 6.5), V(0, -0.2, 0)); u.ups.forEach((a, i) => { a.visible = true; a.position.set((i - 2) * 0.35, -1.6, 0.6); a.setLength(0.6 + 0.08 * Math.sin(t * 4 + i)); }); u.down.visible = true; u.down.position.set(0, 1.9, 0.4);
        u.lB.update(stage, V(1.1, -1.4, 0.6), clamp((lt - 0.5) / 0.3), 60, 0); u.lW.update(stage, V(0.5, 1.6, 0.4), clamp((lt - 0.8) / 0.3), 70, 0); }
      else if (mode === 'outro') { float(); u.ship.position.x = 0; const a = lt * 0.2; look(V(Math.sin(a) * 8, 3, Math.cos(a) * 8), V(0, 0, 0)); }
    },
  };
  return S;
}
