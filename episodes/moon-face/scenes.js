import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label, DynText } from '/engine/kit.js';
import { V, C, std, glowMat, planet, atmosphere, stars, pathTube, arrow } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const R = 2.7;
  const S = {};
  S.moon = {
    build(sc) {
      const g = new THREE.Group(); g.add(stars(900, 60));
      const earth = planet({ r: 0.95, type: 'earth', seed: 7 }); g.add(earth); g.add(atmosphere(1.05, '#4fa8ff', 2));
      const moonG = new THREE.Group(); const moon = planet({ r: 0.42, type: 'moon', colA: '#b6b6be', colB: '#6c6c76', seed: 3 }); moon.material.uniforms.uMark.value = 1; moonG.add(moon); g.add(moonG);
      const face = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 12), glowMat('#ffd84d', 2)); face.rotation.x = Math.PI / 2; face.position.z = 0.52; moon.add(face);
      const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(V(Math.cos(a) * R, 0, Math.sin(a) * R)); }
      const orbit = pathTube(new THREE.CatmullRomCurve3(pts, true), 0.01, '#62f0ff', 1.2); orbit.material.uniforms.uOp.value = 0.5; g.add(orbit);
      const spinArc = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 48, Math.PI * 1.5), glowMat('#ffd84d', 1.8)); arc.rotation.x = Math.PI / 2; const hd = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), glowMat('#ffd84d', 1.8)); hd.position.set(0, 0, 0.85); hd.rotation.z = -Math.PI / 2; spinArc.add(arc, hd); moonG.add(spinArc);
      const tide = [1, -1].map(s => { const a = arrow('#ff7ab8', 0.5, 0.03); moonG.add(a); return a; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const days = new DynText(ov, { size: 80, fill: '#ffffff', strokeW: 8 }); days.mesh.position.y = -250;
      g.userData = { earth, moonG, moon, orbit, spinArc, tide, days, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.earth.material.uniforms.uT.value = t; u.spinArc.visible = false; u.tide.forEach(a => a.visible = false); u.days.mesh.visible = false; u.moon.scale.set(1, 1, 1);
      let orbitA = t * 0.25, spinOffset = 0, earthSpin = t * 0.4;
      if (mode === 'hero') { orbitA = lerp(-0.4, 0.6, lt / dur); look(V(lerp(-1, 1.5, lt / dur), 2.0, lerp(9, 12, ease.outCubic(lt / dur))), V(0, 0, 0)); u.moonG.position.set(0, 0, 0); }
      else if (mode === 'orbit') { orbitA = lt * 0.6; look(V(0, 11, 3), V(0, 0, 0)); }
      else if (mode === 'spin') { orbitA = remap(lt, 0.3, dur - 0.3) * Math.PI * 2; u.spinArc.visible = true; look(V(0, 11, 3), V(0, 0, 0)); u.days.mesh.visible = true; u.days.set('DAY ' + Math.round(remap(lt, 0.3, dur - 0.3) * 27)); }
      else if (mode === 'bulge') { orbitA = 0.3; const k = ease.outCubic(remap(lt, 0.3, 1.2)); u.moon.scale.set(1, 1, 1 + 0.35 * k); spinOffset = t * 3; u.tide.forEach((a, i) => { a.visible = true; a.position.set(0, 0, (i ? -1 : 1) * 0.65 * (1 + 0.35 * k)); a.rotation.x = i ? -Math.PI / 2 : Math.PI / 2; a.setLength(0.4 * k); }); look(V(Math.cos(0.3) * R * 0.4 + 0.5, 1.2, Math.sin(0.3) * R + 3.5), V(Math.cos(0.3) * R * 0.7, 0, Math.sin(0.3) * R * 0.7)); }
      else if (mode === 'lock') { orbitA = 0.3 + lt * 0.15; const k = ease.inOutSine(remap(lt, 0, dur - 0.6)); u.moon.scale.set(1, 1, 1.35); spinOffset = (1 - k) * (t * 4); look(V(Math.cos(orbitA) * R * 0.4 + 0.5, 1.2, Math.sin(orbitA) * R + 3.5), V(Math.cos(orbitA) * R * 0.7, 0, Math.sin(orbitA) * R * 0.7)); }
      else if (mode === 'outro') { orbitA = t * 0.2; earthSpin = t * lerp(0.6, 0.15, clamp(lt / dur)); look(V(Math.sin(lt * 0.2) * 4, 3.5, 10), V(0, 0, 0)); }
      u.earth.rotation.y = earthSpin;
      u.moonG.position.set(Math.cos(orbitA) * R, 0, Math.sin(orbitA) * R);
      // face always points to Earth (tidally locked) unless spinOffset adds extra spin
      u.moonG.lookAt(0, 0, 0); u.moon.rotation.y = spinOffset;
    },
  };
  return S;
}
