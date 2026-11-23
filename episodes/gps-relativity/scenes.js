import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, planet, atmosphere, stars, pathTube, RoundedBoxGeometry, lineMat } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function satellite() {
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), std('#d4af37', 0.3, 0.9)); g.add(body);
    [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.22), std('#1d3a8a', 0.3, 0.6, { emissive: '#0a1a5a' })); p.position.x = s * 0.42; g.add(p); });
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.08, 16, 1, true), std('#eee', .4, .5)); dish.position.y = -0.15; dish.rotation.x = Math.PI; g.add(dish); return g;
  }
  function clock(col) {
    const g = new THREE.Group(); const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), std('#0f1428', 0.6)); g.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), glowMat(col, 1.8)); g.add(ring);
    for (let i = 0; i < 12; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.01), glowMat('#ffffff', 1.2)); const a = i / 12 * Math.PI * 2; tk.position.set(Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0.01); tk.rotation.z = -a; g.add(tk); }
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, 0.01), glowMat(col, 2)); hand.geometry.translate(0, 0.17, 0.02); g.add(hand); g.userData.hand = hand; return g;
  }
  const ORB = 3.6, N = 6;
  const satPos = (i, t) => { const plane = Math.floor(i / 2), a = t * 0.35 + i * 1.7; const tilt = (plane - 1) * 0.7; const p = V(Math.cos(a) * ORB, 0, Math.sin(a) * ORB); p.applyAxisAngle(V(1, 0, 0), 0.5 + tilt * 0.4).applyAxisAngle(V(0, 1, 0), plane * 1.05); return p; };
  const S = {};
  S.gps = {
    build(sc) {
      const g = new THREE.Group(); g.add(stars(800, 50));
      const earth = planet({ r: 1.6, type: 'earth', seed: 5 }); g.add(earth); const atmo = atmosphere(1.75, '#4fa8ff', 2.0); g.add(atmo);
      const sats = [...Array(N)].map(() => { const s = satellite(); g.add(s); return s; });
      const orbits = [0, 1, 2].map(pl => { const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; const tilt = (pl - 1) * 0.7; pts.push(V(Math.cos(a) * ORB, 0, Math.sin(a) * ORB).applyAxisAngle(V(1, 0, 0), 0.5 + tilt * 0.4).applyAxisAngle(V(0, 1, 0), pl * 1.05)); }
        const o = pathTube(new THREE.CatmullRomCurve3(pts, true), 0.008, '#62f0ff', 1.2); o.material.uniforms.uOp.value = 0.5; g.add(o); return o; });
      const beams = sats.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), lineMat('#ffd84d', 2)); g.add(m); return m; });
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), glowMat('#ffd84d', 3)); g.add(pin);
      const pinRings = [0, 1].map(() => { const r = soundRing(C('#ffd84d')); g.add(r); return r; });
      // warped spacetime grid
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(14, 14, 60, 60), new THREE.MeshBasicMaterial({ color: C('#6a5cff').multiplyScalar(1.4), wireframe: true, transparent: true, opacity: 0.35, toneMapped: false }));
      const gp = grid.geometry.attributes.position; for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), r = Math.sqrt(x * x + y * y); gp.setZ(i, -2.4 / (1 + r * r * 0.35)); } grid.rotation.x = -Math.PI / 2; grid.position.y = -1.9; g.add(grid);
      const cG = clock('#62f0ff'), cS = clock('#ffd84d'); g.add(cG, cS);
      // map + phone
      const map = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, 1, 1), new THREE.ShaderMaterial({ uniforms: {}, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying vec2 vUv; void main(){ vec2 g=fract(vUv*16.); float l=step(.96,g.x)+step(.96,g.y); vec2 b=fract(vUv*4.); float road=step(.985,b.x)+step(.985,b.y); vec3 c=vec3(.05,.08,.12)+l*vec3(.05,.08,.12)+road*vec3(.25,.3,.4); float a=smoothstep(.5,.3,length(vUv-.5)); gl_FragColor=vec4(c,a); }`, transparent: true }));
      map.rotation.x = -Math.PI / 2; map.position.y = -1.0; g.add(map);
      const dotTrue = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), glowMat('#62f0ff', 2.5)); const dotFalse = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), glowMat('#ff4d4d', 2.5)); g.add(dotTrue, dotFalse);
      const drift = pathTube(new THREE.CatmullRomCurve3([V(0, -0.95, 0), V(0.8, -0.95, -0.5), V(1.6, -0.95, -0.4), V(2.6, -0.95, -1.4)]), 0.025, '#ff4d4d', 1.8); g.add(drift);
      const phone = new THREE.Group(); const ph = new THREE.Mesh(new RoundedBoxGeometry(1.5, 3, 0.14, 6, 0.18), std('#111318', 0.3, 0.7)); phone.add(ph);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.8), map.material); scr.position.z = 0.075; phone.add(scr);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), glowMat('#3aa0ff', 2.5)); dot.position.z = 0.08; phone.add(dot); g.add(phone);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lG = new Label(ov, 'GROUND', { size: 40 }), lS = new Label(ov, 'SATELLITE', { size: 40, accent: true }), lD = new Label(ov, 'WITHOUT CORRECTION', { size: 38 });
      g.userData = { earth, atmo, sats, orbits, beams, pin, pinRings, grid, cG, cS, map, dotTrue, dotFalse, drift, phone, dot, lG, lS, lD, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.earth.material.uniforms.uT.value = t; u.earth.rotation.y = t * 0.05;
      const all = [u.earth, u.atmo, u.grid, u.cG, u.cS, u.map, u.dotTrue, u.dotFalse, u.drift, u.phone, u.pin]; all.forEach(o => o.visible = false);
      u.sats.forEach(s => s.visible = false); u.orbits.forEach(o => o.visible = false); u.beams.forEach(b => b.visible = false); u.pinRings.forEach(r => r.visible = false);
      [u.lG, u.lS, u.lD].forEach(l => l.update(stage, V(), 0));
      const showSystem = (beams) => { u.earth.visible = u.atmo.visible = true; u.orbits.forEach(o => o.visible = true);
        const target = V(0.55, 1.05, 1.0).normalize().multiplyScalar(1.62).applyAxisAngle(V(0, 1, 0), t * 0.05); u.pin.visible = beams; u.pin.position.copy(target);
        u.sats.forEach((s, i) => { s.visible = true; const p = satPos(i, t); s.position.copy(p); s.lookAt(0, 0, 0);
          const b = u.beams[i]; b.visible = beams && p.dot(target) > 0; if (b.visible) { const mid = p.clone().add(target).multiplyScalar(0.5); b.position.copy(mid); b.scale.y = p.distanceTo(target); b.quaternion.setFromUnitVectors(V(0, 1, 0), p.clone().sub(target).normalize()); b.material.opacity = 0.5 + 0.5 * Math.sin(t * 8 + i); } });
        if (beams) u.pinRings.forEach((r, i) => { r.position.copy(target); r.lookAt(0, 0, 0); r.update((lt + i * 0.5) % 1, 1, 0.1, 0.6); }); };
      if (mode === 'hero') { showSystem(true); look(V(Math.sin(lt * 0.3) * 3, lerp(5, 2.5, ease.outCubic(lt / dur)), lerp(8, 14, ease.outCubic(lt / dur))), V(0, 0, 0)); }
      else if (mode === 'orbit') { showSystem(false); const a = lt * 0.2; look(V(Math.sin(a) * 14, 4, Math.cos(a) * 14), V(0, 0, 0)); }
      else if (mode === 'gravity') { u.earth.visible = u.atmo.visible = true; u.grid.visible = true; u.earth.position.y = -1.0; look(V(0, 4.5, 13.5), V(0, 0.2, 0));
        u.cG.visible = u.cS.visible = true; u.cG.position.set(-2.0, 1.3, 1.5); u.cS.position.set(2.2, 3.0, 0.5); [u.cG, u.cS].forEach(c => c.lookAt(stage.camera.position));
        u.cG.userData.hand.rotation.z = -t * 2.0; u.cS.userData.hand.rotation.z = -t * 2.6; const s = u.sats[0]; s.visible = true; s.position.set(2.2, 2.2, 0.5); s.rotation.y = t;
        u.lG.update(stage, u.cG.position, clamp((lt - 0.4) / 0.3), 0, 85); u.lS.update(stage, u.cS.position, clamp((lt - 0.6) / 0.3), 0, 85); }
      else if (mode === 'drift') { u.map.visible = true; u.dotTrue.visible = u.dotFalse.visible = u.drift.visible = true; look(V(1.4, 6.0, 6.8), V(1.2, -1, -0.6));
        const k = ease.inOutSine(remap(lt, 0.4, dur - 0.3)); u.dotTrue.position.set(0, -0.92, 0); const p = u.drift.geometry.parameters.path.getPointAt(k); u.dotFalse.position.copy(p).add(V(0, 0.03, 0)); u.drift.material.uniforms.uP.value = k;
        u.lD.update(stage, u.dotFalse.position, clamp((lt - 0.8) / 0.3), 0, 60); }
      else if (mode === 'phone') { u.phone.visible = true; showSystem(false); u.earth.visible = u.atmo.visible = false; u.orbits.forEach(o => o.visible = false);
        u.phone.position.set(0, -0.3, 1); u.phone.scale.setScalar(0.85); u.phone.rotation.set(-0.5 + 0.05 * Math.sin(t), 0.25 * Math.sin(lt * 0.4), 0); u.dot.scale.setScalar(1 + 0.25 * Math.sin(t * 5));
        u.sats.forEach((s, i) => { s.visible = true; s.position.set((i - 2.5) * 0.9, 2.8 + 0.3 * Math.sin(i + t), -1 - (i % 2)); s.rotation.y = t + i; });
        look(V(0, 1.0, 10.5), V(0, 0.6, 0)); }
      if (mode !== 'gravity') u.earth.position.y = 0;
    },
  };
  return S;
}
