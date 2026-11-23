import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow, lathe, pathTube } from '/engine/props.js';

const stripeMat = () => new THREE.ShaderMaterial({ uniforms: {}, vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vN; void main(){ float s=step(.5,fract(vUv.x*8.)); vec3 c=mix(vec3(.9,.2,.25),vec3(1.,.82,.3),s); float b=step(.55,vUv.y)*step(vUv.y,.62); c=mix(c,vec3(.15,.6,.95),b);
    float l=.35+.65*max(dot(normalize(vN),normalize(vec3(.3,.8,.6))),0.); gl_FragColor=vec4(c*l,1.); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.top = {
    build(sc) {
      const g = new THREE.Group(); g.position.y = -1.2;
      const pre = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(); g.add(pre); pre.add(tilt); tilt.add(spin);
      const body = lathe([[0, 0], [0.05, 0.05], [0.5, 0.55], [0.85, 0.85], [0.8, 0.95], [0.3, 1.05], [0.12, 1.1], [0.1, 1.6], [0, 1.62]], stripeMat(), 64); spin.add(body);
      const fl = floor('#251a3a', 8, 0.6); g.add(fl);
      const L = arrow('#62f0ff', 2.4, 0.06); tilt.add(L); const G = arrow('#ff7a3d', 1.2, 0.06); G.rotation.z = Math.PI; g.add(G); const T = arrow('#ffd84d', 1.0, 0.05); g.add(T);
      const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), glowMat('#62f0ff', 1.8, { blending: THREE.AdditiveBlending, depthWrite: false }), 120); g.add(trail);
      const rimPts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), glowMat('#ffd84d', 2), 24); spin.add(rimPts);
      const ring = soundRing(C('#ffd84d')); ring.rotation.x = Math.PI / 2; g.add(ring);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lL = new Label(ov, 'SPIN AXIS', { size: 40 }), lG = new Label(ov, 'GRAVITY', { size: 40 });
      g.userData = { pre, tilt, spin, L, G, T, trail, rimPts, ring, lL, lG, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; let th = 0.25, phi = t * 1.2, spinA = t * 25, showL = 0, showG = 0, showT = 0, trailK = 0, rim = 0; u.ring.visible = false;
      [u.lL, u.lG].forEach(l => l.update(stage, V(), 0));
      if (mode === 'hero') { th = 0.25 + 0.04 * Math.sin(t * 3); trailK = 1; look(V(lerp(1.5, 3.5, lt / dur), lerp(-0.6, 1.5, ease.outCubic(lt / dur)), lerp(3, 6, ease.outCubic(lt / dur))), V(0, -0.3, 0)); }
      else if (mode === 'tip') { spinA = 0; phi = 0.4; const k = remap(lt, 0.5, 2.2); th = k < 1 ? 0.05 + k * k * 1.45 : 1.5; look(V(3, 1.2, 5.5), V(0, -0.4, 0)); u.ring.visible = true; u.ring.position.set(0, 0.01, 0); u.ring.update(lt - 2.2, 0.8, 0.3, 1.8); }
      else if (mode === 'spin') { th = 0.08; phi = t * 0.5; showL = ease.outBack(remap(lt, 0.6, 1.2)); rim = 1; look(V(2.5, 1.4, 5), V(0, 0, 0)); u.lL.update(stage, V(0, 1.4, 0).applyMatrix4(u.tilt.matrixWorld), clamp((lt - 1.0) / 0.3), 70, 0); }
      else if (mode === 'axis') { th = 0.3; phi = t * 0.9; showL = 1; showG = 1; showT = 1; look(V(3.5, 1.6, 5), V(0, 0, 0)); u.lG.update(stage, V(0, 0.2, 0).applyMatrix4(g.matrixWorld), clamp((lt - 0.4) / 0.3), 70, 0); }
      else if (mode === 'precess') { th = 0.3; phi = t * 1.2; showL = 1; trailK = 1; look(V(0.5, 4.5, 3.5), V(0, 0.2, 0)); }
      else if (mode === 'fall') { const k = remap(lt, 0, dur - 0.9); spinA = t * 25 * (1 - k * 0.8); th = k < 1 ? lerp(0.25, 0.7, k * k) + 0.1 * Math.sin(t * 6) * k : lerp(0.7, 1.5, ease.inCubic ? clamp((lt - (dur - 0.9)) / 0.4) : 1); phi = t * lerp(1.2, 3, k); trailK = 1 - k;
        if (k >= 1) { const q = clamp((lt - (dur - 0.9)) / 0.35); th = lerp(0.8, 1.5, q * q); } look(V(3, 1.2, 5.5), V(0, -0.3, 0)); }
      u.pre.rotation.y = phi; u.tilt.rotation.z = th; u.spin.rotation.y = spinA;
      u.L.visible = showL > 0; u.L.scale.setScalar(Math.max(0.001, showL)); u.L.position.y = 1.6;
      u.G.visible = showG > 0; u.G.position.set(0, 2.0, 0); const tipW = V(0, 1.62, 0).applyMatrix4(u.tilt.matrixWorld).applyMatrix4(g.matrixWorld.clone().invert());
      u.G.position.set(tipW.x * 0.6, tipW.y * 0.6 + 0.8, tipW.z * 0.6);
      u.T.visible = showT > 0; if (showT) { u.T.position.copy(tipW).add(V(0, 0.3, 0)); const side = V(-Math.sin(phi), 0, -Math.cos(phi)); u.T.quaternion.setFromUnitVectors(V(0, 1, 0), side); }
      u.trail.visible = trailK > 0; if (trailK > 0) { const p = V(); for (let i = 0; i < 120; i++) { const pa = phi - i * 0.04; const r = Math.sin(th) * 1.62 * 1.05, y = Math.cos(th) * 1.62 + 0.15; p.set(Math.cos(pa + Math.PI / 2) * r * 0 + -Math.sin(pa) * r * -1 * 0 + r * Math.sin(-pa + Math.PI / 2) * 0, y, 0);
        const v = V(0, 1.62, 0).applyAxisAngle(V(0, 0, 1), th).applyAxisAngle(V(0, 1, 0), pa); setInstance(u.trail, i, v.add(V(0, 0.15, 0)), trailK * (1 - i / 120), [0, 0, 0]); } u.trail.instanceMatrix.needsUpdate = true; }
      u.rimPts.visible = rim > 0; if (rim) { const p = V(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; p.set(Math.cos(a) * 0.86, 0.88, Math.sin(a) * 0.86); setInstance(u.rimPts, i, p, 1, [0, 0, 0]); } u.rimPts.instanceMatrix.needsUpdate = true; }
    },
  };
  return S;
}
