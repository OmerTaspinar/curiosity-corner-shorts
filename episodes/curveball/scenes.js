import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow, pathTube } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function ball() {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 24), std('#cfcac0', 0.6)); g.add(b);
    [-1, 1].forEach(s => { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(V(Math.cos(a) * 0.5, Math.sin(2 * a) * 0.18 * s, Math.sin(a) * 0.5).normalize().multiplyScalar(0.505)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.018, 6, true), std('#d0283c', 0.5))); });
    g.children[1].rotation.x = Math.PI / 2; return g;
  }
  // curved path in xz-plane (ball flies along -z, breaks toward +x)
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 8), V(0.15, 0.05, 4), V(0.7, 0, 0), V(1.9, -0.1, -4), V(3.6, -0.3, -8)]);
  const straight = new THREE.LineCurve3(V(0, 0, 8), V(0, -0.3, -8));
  const S = {};
  S.ball = {
    build(sc) {
      const g = new THREE.Group(); const B = ball(); g.add(B);
      const fl = floor('#1d2a22', 10, 0.5); fl.position.y = -1.4; g.add(fl);
      const path = pathTube(curve, 0.04, '#ffd84d', 1.8); g.add(path); const sPath = pathTube(straight, 0.02, '#ffffff', 0.8); sPath.material.uniforms.uOp.value = 0.4; g.add(sPath);
      const spin = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.03, 8, 48, Math.PI * 1.5), glowMat('#62f0ff', 1.8)); const hd = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), glowMat('#62f0ff', 1.8)); hd.position.set(0.8, 0, 0); hd.rotation.x = Math.PI / 2; spin.add(arc, hd); spin.rotation.x = Math.PI / 2; g.add(spin);
      const air = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 6, 4), glowMat('#9fe8ff', 1.6, { blending: THREE.AdditiveBlending, depthWrite: false }), 260); g.add(air);
      const layer = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.025, 8, 64), glowMat('#62f0ff', 0.9, { blending: THREE.AdditiveBlending, depthWrite: false })); layer.rotation.x = Math.PI / 2; g.add(layer);
      const force = arrow('#ffd84d', 1.2, 0.06); g.add(force); const wake = arrow('#ff7ab8', 1.2, 0.06); g.add(wake);
      const goal = new THREE.Group(); [[-1.6, 0], [1.6, 0]].forEach(([x]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), std('#fff', .5)); p.position.set(x, 0, 0); goal.add(p); }); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), std('#fff', .5)); bar.rotation.z = Math.PI / 2; bar.position.y = 1.1; goal.add(bar); goal.position.set(3.2, -0.3, -8); g.add(goal);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lF = new Label(ov, 'FORCE', { size: 42, accent: true }), lW = new Label(ov, 'AIR PUSHED', { size: 42 });
      g.userData = { B, path, sPath, spin, air, layer, force, wake, goal, lF, lW, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; [u.path, u.sPath, u.spin, u.air, u.layer, u.force, u.wake].forEach(o => o.visible = false); [u.lF, u.lW].forEach(l => l.update(stage, V(), 0));
      u.B.rotation.y = t * 14;   // spin (vertical axis -> sideways break)
      const flyTo = (k) => { u.path.visible = true; u.path.material.uniforms.uP.value = k; u.B.position.copy(curve.getPointAt(clamp(k))); };
      const flow = (deflect) => { u.air.visible = true; const r = rng(4), p = V(); for (let i = 0; i < 260; i++) { const ph = (t * 0.5 + r()) % 1; const off = V((r() - .5) * 2.2, (r() - .5) * 1.6, 0); const z = 2.6 - ph * 5.2;
        const near = Math.exp(-(off.x * off.x + off.y * off.y) * 1.4); const behind = smooth(-0.2, -2.4, z); p.set(off.x - deflect * near * behind * 1.4 + (off.x > 0 ? 1 : -1) * 0.45 * near * Math.exp(-z * z * 2), off.y, z); setInstance(u.air, i, p.add(u.B.position), 0.6 + r(), [0, 0, 0]); } u.air.instanceMatrix.needsUpdate = true; };
      function smooth(a, b, x) { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); }
      if (mode === 'hero' || mode === 'throw' || mode === 'outro') {
        const k = mode === 'outro' ? (lt / dur) : ease.inOutSine(remap(lt, 0.1, dur - 0.1)); flyTo(k); if (mode === 'throw') { u.sPath.visible = true; u.sPath.material.uniforms.uP.value = k; }
        const p = u.B.position; if (mode === 'hero') look(V(p.x - 1.5, p.y + 1.2, p.z + 3.2), V(p.x + 0.6, p.y, p.z - 3)); else look(V(-3, 4.5, 9), V(1, -0.3, -1));
      } else if (mode === 'drag') { u.B.position.set(0, 0, 0); u.layer.visible = true; u.layer.rotation.z = t * 6; u.spin.visible = true; u.spin.rotation.z = -t * 3; flow(0); look(V(2.5, 2.8, 3.5), V(0, 0, 0)); }
      else if (mode === 'wake') { u.B.position.set(0, 0, 0); u.spin.visible = true; u.spin.rotation.z = -t * 3; flow(ease.outCubic(remap(lt, 0.2, 1.2))); look(V(0.3, 4.5, 1.5), V(0, 0, -0.5)); u.wake.visible = lt > 1.0; u.wake.position.set(0, 0.3, -1.4); u.wake.rotation.set(0, 0, Math.PI / 2); u.wake.setLength(1.0); u.lW.update(stage, V(-0.8, 0.4, -1.4), clamp((lt - 1.2) / 0.3), 0, 40); }
      else if (mode === 'push') { u.B.position.set(0, 0, 0); u.spin.visible = true; u.spin.rotation.z = -t * 3; flow(1); look(V(0.3, 4.5, 1.5), V(0, 0, -0.5)); u.wake.visible = true; u.wake.position.set(0, 0.3, -1.4); u.wake.rotation.set(0, 0, Math.PI / 2); u.wake.setLength(1.0);
        u.force.visible = true; u.force.position.set(0.5, 0.3, 0); u.force.rotation.set(0, 0, -Math.PI / 2); u.force.setLength(lerp(0.3, 1.3, ease.outBack(remap(lt, 0.4, 1.0)))); u.lF.update(stage, V(1.4, 0.4, 0), clamp((lt - 0.8) / 0.3), 0, 40); }
    },
  };
  return S;
}
