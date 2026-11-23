import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, waveRibbon, arrow, floor, fresnelMat } from '/engine/props.js';

const GAP = 3.6, NODES = 7;  // distance between arrays, number of pressure nodes
const nodeY = i => -GAP / 2 + (i + 0.5) * GAP / NODES;

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function array(sign) {
    const g = new THREE.Group(), r = 1.35;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.12, 48), std('#1c1f2b', 0.35, 0.8)); plate.position.y = -0.06; g.add(plate);
    const cells = []; const tg = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20);
    for (let ring = 0; ring < 4; ring++) { const n = ring === 0 ? 1 : ring * 6; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, d = ring * 0.3;
      const m = new THREE.Mesh(tg, std('#c9a14a', 0.3, 0.9)); m.position.set(Math.cos(a) * d, 0.02 + 0.08 * ring * ring * 0.15, Math.sin(a) * d); g.add(m);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), glowMat('#62f0ff', 1.4)); lens.rotation.x = -Math.PI / 2; lens.position.copy(m.position).add(V(0, 0.045, 0)); g.add(lens); cells.push(lens); } }
    g.rotation.x = sign > 0 ? Math.PI : 0; g.position.y = sign * (GAP / 2 + 0.1) * (sign > 0 ? 1 : 1); if (sign < 0) g.position.y = -GAP / 2 - 0.1;
    g.userData.cells = cells; return g;
  }
  const S = {};
  S.levitator = {
    build(sc) {
      const g = new THREE.Group();
      const top = array(1), bot = array(-1); g.add(top, bot);
      const rods = [0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2 + 0.5; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, GAP + 0.6, 12), std('#7d8494', 0.3, 0.9)); m.position.set(Math.cos(a) * 2.0, 0, Math.sin(a) * 2.0); g.add(m); return m; });
      const ribbons = [0, 1, 2, 3].map(i => { const w = waveRibbon({ len: GAP, width: 0.035, color: i % 2 ? '#62f0ff' : '#9b8cff', amp: 0.4, k: Math.PI * NODES / GAP, glow: 1.6 }); w.rotation.z = Math.PI / 2; w.rotation.y = i * Math.PI / 4; g.add(w); return w; });
      const planes = [...Array(NODES)].map((_, i) => { const p = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.7, 48), glowMat('#62f0ff', 1, { blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); p.rotation.x = -Math.PI / 2; p.position.y = nodeY(i); g.add(p); return p; });
      const beads = [...Array(NODES)].map((_, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12), std('#f4f7ff', 0.25, 0.1, { emissive: '#223' })); b.position.y = nodeY(i); g.add(b); return b; });
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), fresnelMat({ color: '#4fc3ff', body: 0.35, rim: 1.4 })); drop.position.y = nodeY(3); g.add(drop);
      const arrows = [1, -1].map(s => { const a = arrow('#ffd84d', 0.5, 0.03); a.rotation.z = s > 0 ? Math.PI : 0; g.add(a); return a; });
      const waves = [...Array(8)].map((_, i) => { const r = soundRing(C('#62f0ff')); r.rotation.x = Math.PI / 2; g.add(r); return r; });
      const fl = floor('#1a1530', 7, 0.6); fl.position.y = -GAP / 2 - 0.9; g.add(fl);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lab = new Label(ov, 'NODE', { accent: true, size: 44 });
      g.userData = { top, bot, ribbons, planes, beads, drop, arrows, waves, ov, lab }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { top, bot, ribbons, planes, beads, drop, arrows, waves, lab } = g.userData, mode = sc.mode;
      let standing = 1, ripples = 0, beadOn = [...Array(NODES)].map(() => 1), dropOn = 0, planeA = 0.12, arrowsOn = 0, labOn = 0;
      if (mode === 'hero') { look(V(Math.sin(lt * .5) * 2, lerp(-1.5, 0.6, ease.outCubic(lt / dur)), lerp(5, 8.5, ease.outCubic(lt / 1.2))), V(0, 0, 0)); }
      else if (mode === 'arrays') { const a = lt * 0.3; look(V(Math.sin(a) * 9, 2.2, Math.cos(a) * 9), V(0, 0, 0)); standing = 0; ripples = 1; beadOn = beadOn.map(() => 0); }
      else if (mode === 'standing') { look(V(0.5, 0.3, 8.5), V(0, 0, 0)); standing = ease.outCubic(remap(lt, 0.2, 1.2)); planeA = 0.12 + 0.45 * ease.outCubic(remap(lt, 1.5, 2.2)); beadOn = beadOn.map(() => 0); labOn = clamp((lt - 1.6) / 0.3); }
      else if (mode === 'pressure') { look(V(1.2, nodeY(3) + 0.3, 3.2), V(0, nodeY(3), 0)); arrowsOn = 1; planeA = 0.35; beadOn = beadOn.map((_, i) => i === 3 ? 1 : 0); }
      else if (mode === 'beads') { look(V(-1, 0.4, 8), V(0, 0, 0)); beadOn = beadOn.map((_, i) => clamp((lt - 0.3 - i * 0.35) / 0.5)); }
      else if (mode === 'drop') { const a = lt * 0.25; look(V(Math.sin(a) * 4.5, nodeY(3) + 0.6, Math.cos(a) * 4.5), V(0, nodeY(3), 0)); beadOn = beadOn.map(() => 0); dropOn = 1; }
      ribbons.forEach((w, i) => { const u = w.material.uniforms; u.uAmp.value = 0.35 * standing * Math.cos(t * 9 + i * 0.4); u.uPhase.value = 0; u.uOp.value = 0.25 + 0.75 * standing; });
      planes.forEach((p, i) => { p.material.opacity = planeA * (0.7 + 0.3 * Math.sin(t * 3 + i)); p.scale.setScalar(0.9 + 0.1 * Math.sin(t * 2 + i)); });
      beads.forEach((b, i) => { const k = beadOn[i]; b.visible = k > 0; const fall = (1 - ease.outBack(k)) * 1.2; b.position.y = nodeY(i) + fall + 0.03 * Math.sin(t * 6 + i); b.position.x = 0.02 * Math.sin(t * 4 + i * 2); });
      drop.visible = dropOn > 0; drop.scale.set(1 + 0.08 * Math.sin(t * 7), 1 - 0.08 * Math.sin(t * 7), 1 + 0.08 * Math.sin(t * 7)); drop.position.y = nodeY(3) + 0.03 * Math.sin(t * 3);
      arrows.forEach((a, i) => { a.visible = arrowsOn > 0; const s = i ? -1 : 1; const pulse = 0.08 * Math.sin(t * 10); a.position.set(0, nodeY(3) + s * (0.75 + pulse), 0); a.setLength(0.5); });
      waves.forEach((w, i) => { const fromTop = i % 2 === 0; const age = ((lt * 1.4 + i * 0.25) % 1.4); w.visible = ripples > 0; if (!ripples) return;
        const k = age / 1.4; w.position.y = fromTop ? GAP / 2 - k * GAP : -GAP / 2 + k * GAP; w.scale.setScalar(0.9); w.material.opacity = Math.sin(Math.PI * k) * 0.9; w.material.color.set('#62f0ff').multiplyScalar(2); });
      [top, bot].forEach(a => a.userData.cells.forEach((c, j) => c.material.color.set('#62f0ff').multiplyScalar(1.2 + 0.8 * Math.sin(t * 12 + j))));
      lab.update(stage, V(1.0, nodeY(4), 0).applyMatrix4(g.matrixWorld), labOn, 60, 0);
      g.updateMatrixWorld();
    },
  };
  return S;
}
