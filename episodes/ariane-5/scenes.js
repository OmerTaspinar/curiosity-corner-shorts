import { THREE, PAL, NOISE, clamp, lerp, remap, ease, rng, soundRing, setInstance, DynText } from '/engine/kit.js';
import { V, C, std, glowMat, floor, stars, pathTube, lathe } from '/engine/props.js';

function flameMat() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: NOISE + `uniform float uT,uK; varying vec2 vUv; void main(){ float y=vUv.y; float n=snoise(vec3(vUv.x*6.,y*4.-uT*12.,uT))*.5+.5;
      float a=pow(y,1.5)*(.6+.6*n)*uK; vec3 c=mix(vec3(1.,.35,.05),vec3(1.,.95,.7),pow(y,3.)); gl_FragColor=vec4(c*a*2.2,a); }` });
}
function fireMat() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uA: { value: 1 }, uHeat: { value: 1 } },
    vertexShader: NOISE + `uniform float uT; varying float vN; varying vec3 vNr; varying vec3 vP; void main(){ float n=snoise(position*1.8+uT*.8); vN=n; vec3 p=position+normal*n*.25;
      vec4 wp=modelMatrix*vec4(p,1.); vP=wp.xyz; vNr=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform float uA,uHeat; varying float vN; varying vec3 vNr; varying vec3 vP; void main(){ vec3 V=normalize(cameraPosition-vP); float f=max(dot(normalize(vNr),V),0.);
      float h=clamp(f*uHeat+vN*.3,0.,1.); vec3 c=mix(vec3(.15,.05,.03),vec3(1.,.4,.08),smoothstep(.1,.6,h)); c=mix(c,vec3(1.,.95,.7),smoothstep(.7,1.,h));
      gl_FragColor=vec4(c*(1.+h*2.),uA*(.4+.6*f)); }` });
}

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function rocket() {
    const g = new THREE.Group(), white = std('#c9ced8', 0.45, 0.1), dark = std('#2b2f3a', 0.5, 0.4);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.0, 40), white); core.position.y = 1.5; g.add(core);
    const fairing = lathe([[0, 0], [0.34, 0], [0.34, 0.6], [0.28, 1.0], [0.12, 1.3], [0, 1.38]], white); fairing.position.y = 3.0; g.add(fairing);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.08, 40), dark); band.position.y = 3.0; g.add(band);
    const flames = [];
    [-1, 1].forEach(s => { const b = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 32), white); body.position.y = 1.2; const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 32), white); nose.position.y = 2.62;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 32), dark); ring.position.y = 0.4; b.add(body, nose, ring); b.position.x = s * 0.52; g.add(b);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.8, 24, 1, true), flameMat()); fl.rotation.x = Math.PI; fl.position.set(s * 0.52, -0.9, 0); g.add(fl); flames.push(fl); });
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24), dark); nz.position.y = -0.1; g.add(nz);
    const fc = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 24, 1, true), flameMat()); fc.rotation.x = Math.PI; fc.position.y = -0.95; g.add(fc); flames.push(fc);
    const ESA = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.9), glowMat('#3a6bff', 0.8)); ESA.position.set(0, 1.9, 0.325); g.add(ESA);
    g.userData.flames = flames; return g;
  }
  const S = {};
  S.rocket = {
    build(sc) {
      const g = new THREE.Group(); const R = rocket(); g.add(R); g.add(stars(700, 60));
      const pad = floor('#1a1d2b', 10, 0.5); pad.position.y = -1.4; g.add(pad);
      const tower = new THREE.Group(); for (let i = 0; i < 10; i++) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), std('#58607a', .5, .6)); fr.position.y = -1.4 + i * 0.5; tower.add(fr); }
      [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 5, 0.04), std('#58607a', .5, .6)); p.position.set(x, 1.1, z); tower.add(p); });
      tower.position.x = -1.8; g.add(tower);
      const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), std('#b9b4c4', 1, 0, { transparent: true, opacity: 0.55, depthWrite: false }), 70); g.add(smoke);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), fireMat()); fire.visible = false; g.add(fire);
      const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.12), std('#e8e8f0', .5, .3, { emissive: '#ff6a20', emissiveIntensity: 0.6 }), 80); debris.visible = false; g.add(debris);
      const shock = [0, 1].map(() => { const r = soundRing(C('#ffb36b')); g.add(r); return r; });
      const trail = pathTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 3, 0), V(0.3, 5.5, 0), V(2.5, 7.2, 0), V(5.5, 7.8, 0)]), 0.06, '#ff5a3d', 2); g.add(trail);
      // bits visual
      const bits = new THREE.Group(); g.add(bits);
      const cell = new THREE.BoxGeometry(0.16, 0.3, 0.16);
      const big = new THREE.InstancedMesh(cell, glowMat('#ffffff', 1), 64); const slot = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), std('#ffd84d', .3, .2, { transparent: true, opacity: 0.35 }), 16);
      bits.add(big, slot);
      const ov = new THREE.Group(); stage.overlay.add(ov); const err = new DynText(ov, { size: 90, fill: '#ff4d4d', strokeW: 8, glow: '#ff2020' }); err.mesh.position.y = -120;
      g.userData = { R, smoke, fire, debris, shock, trail, bits, big, slot, err, ov, tower, pad }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { R, smoke, fire, debris, shock, trail, bits, big, slot, err, tower } = g.userData, mode = sc.mode;
      R.userData.flames.forEach((f, i) => { f.material.uniforms.uT.value = t + i; f.scale.set(1, 1 + 0.15 * Math.sin(t * 30 + i), 1); });
      let alt = 0, tilt = 0, flames = 1, boom = -1, smokeK = 0; R.visible = true; bits.visible = false; trail.visible = false; err.mesh.visible = false; tower.visible = true; fire.visible = debris.visible = false;
      if (mode === 'hero') { alt = 2 + lt * 2.2; tilt = ease.inOutCubic(remap(lt, 0.9, 1.5)) * 1.3; boom = lt - 1.5; look(V(3.5, alt - 1.5, lerp(7, 11, ease.outCubic(lt / dur))), V(0, alt + 1.4, 0)); smokeK = 0.3;
        err.mesh.visible = lt > 0.85 && lt < 1.6 && Math.sin(t * 40) > -0.3; err.set('OVERFLOW'); }
      else if (mode === 'launch') { alt = Math.pow(remap(lt, 0.8, dur), 1.8) * 6; look(V(lerp(5, 3.5, lt / dur), lerp(0.2, 1.5 + alt * 0.6, lt / dur), lerp(10, 12, lt / dur)), V(0, 1.5 + alt * 0.7, 0)); smokeK = 1; }
      else if (mode === 'bits') { R.visible = false; tower.visible = false; bits.visible = true; look(V(Math.sin(lt * .3) * 2, 0.6, 12), V(0, 0.9, 0));
        const k = ease.inOutCubic(remap(lt, 0.8, dur - 0.6)), tmp = new THREE.Object3D();
        for (let i = 0; i < 64; i++) { const row = Math.floor(i / 16), col = i % 16; const sx = (col - 7.5) * 0.2, sy = 2.4 - row * 0.4;
          const inSlot = i < 16; const tx = (col - 7.5) * 0.22, ty = 0.4; const p = V(lerp(sx, inSlot ? tx : tx + (i % 3 - 1) * 0.3, k), lerp(sy, inSlot ? ty : ty - 0.6 - row * 0.35 - (k * k) * 1.5, k), 0);
          tmp.position.copy(p); tmp.rotation.set(inSlot ? 0 : k * (i % 5), inSlot ? 0 : k * 2, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); big.setMatrixAt(i, tmp.matrix);
          big.setColorAt(i, inSlot ? C('#62f0ff').multiplyScalar(1.6) : C('#62f0ff').lerp(C('#ff3d3d'), clamp(k * 1.6)).multiplyScalar(1.6)); }
        for (let j = 0; j < 16; j++) { tmp.position.set((j - 7.5) * 0.22, 0.4, 0); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); slot.setMatrixAt(j, tmp.matrix); }
        big.instanceMatrix.needsUpdate = true; big.instanceColor.needsUpdate = true; slot.instanceMatrix.needsUpdate = true;
        err.mesh.visible = k > 0.7 && Math.sin(t * 30) > -0.5; err.set('OVERFLOW'); }
      else if (mode === 'veer') { const q = remap(lt, 0.3, dur); alt = 5; tilt = ease.inOutCubic(remap(lt, 0.2, 1.6)) * 1.55; trail.visible = true; trail.material.uniforms.uP.value = 0.4 + 0.6 * ease.inOutSine(q); tower.visible = false;
        const pt = trail.geometry.parameters.path.getPointAt(0.4 + 0.6 * ease.inOutSine(q)); R.position.set(pt.x, pt.y, 0); look(V(pt.x + 3, pt.y - 1, 12), V(pt.x * 0.7, pt.y, 0)); err.mesh.visible = Math.sin(t * 20) > 0; err.set('ERROR'); }
      else if (mode === 'boom') { alt = 6; boom = lt - 0.15; tower.visible = false; look(V(2, alt + 0.5, lerp(9, 13, ease.outCubic(lt / dur))), V(0, alt + 1.2, 0)); tilt = 1.2; }
      if (mode !== 'veer') R.position.set(0, alt, 0);
      R.rotation.z = -tilt;
      R.visible = R.visible && !(boom > 0.05);
      if (boom > 0) { fire.visible = true; const k = ease.outCubic(boom / 1.2); fire.position.set(R.position.x, R.position.y + 1.5, 0); fire.scale.setScalar(0.3 + k * 2.6); fire.material.uniforms.uT.value = t; fire.material.uniforms.uA.value = clamp(1.3 - boom * 0.5); fire.material.uniforms.uHeat.value = 1.4 - k * 0.6;
        debris.visible = true; const r = rng(3), p = V();
        for (let i = 0; i < 80; i++) { const d = V(r() - .5, r() - .5, r() - .5).normalize(); p.copy(fire.position).addScaledVector(d, (1 + r() * 4) * ease.outCubic(boom / 1.5)); p.y -= boom * boom * 0.8; setInstance(debris, i, p, 0.5 + r(), [t * 3 + i, t * 2, i]); }
        debris.instanceMatrix.needsUpdate = true; shock.forEach((s, i) => { s.position.copy(fire.position); s.update(boom - i * 0.15, 1.2, 0.5, 6); }); stage.shake = Math.exp(-boom * 3) * 2.5; }
      else shock.forEach(s => s.visible = false);
      const r = rng(9), p = V();
      for (let i = 0; i < 70; i++) { const ph = (lt * 0.4 + r()) % 1; const a = r() * Math.PI * 2; p.set(Math.cos(a) * (0.5 + ph * 3.5), -1.1 + ph * 0.8 + r() * 0.3, Math.sin(a) * (0.5 + ph * 2.5)); setInstance(smoke, i, p, smokeK * (0.6 + ph * 1.8) * (0.5 + r() * 0.6), [i, i * 2, 0]); }
      smoke.instanceMatrix.needsUpdate = true;
      stage.bgMat.uniforms.uGlowAmt.value = 0.25 + (boom > 0 ? Math.exp(-boom) * 0.6 : 0);
    },
  };
  return S;
}
