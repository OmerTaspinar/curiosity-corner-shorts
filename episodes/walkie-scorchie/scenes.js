import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance } from '/engine/kit.js';
import { V, C, std, glowMat, floor, pathTube, RoundedBoxGeometry } from '/engine/props.js';

// Walkie-Talkie: widens toward the top; its south face (+z) is a concave glass curve.
const H = 5.2;
function towerGeo() {
  const levels = 48, around = 64, pos = [], uv = [], idx = [];
  for (let i = 0; i <= levels; i++) {
    const v = i / levels, y = v * H, w = 0.95 + 0.75 * Math.pow(v, 1.4), d = 0.75 + 0.35 * v;
    for (let j = 0; j <= around; j++) {
      const a = j / around * Math.PI * 2; let x = Math.cos(a), z = Math.sin(a);
      const sq = 6; const k = Math.pow(Math.pow(Math.abs(x), sq) + Math.pow(Math.abs(z), sq), -1 / sq); x *= k * w; z *= k * d; // superellipse
      if (z > 0) z -= 0.28 * Math.sin(Math.PI * v) * (1 - Math.pow(x / w, 2)) * (z / d);              // concave south face
      pos.push(x, y, z); uv.push(j / around, v);
    }
  }
  for (let i = 0; i < levels; i++) for (let j = 0; j < around; j++) { const a = i * (around + 1) + j, b = a + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setIndex(idx); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
const glassMat = () => new THREE.ShaderMaterial({ uniforms: { uSun: { value: 0 }, uHi: { value: 0 }, uShade: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform float uSun,uHi,uShade; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
    void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vP); float fr=pow(1.-max(dot(N,V),0.),2.);
      float gx=step(.93,fract(vUv.x*64.)); float gy=step(.9,fract(vUv.y*38.)); float grid=max(gx,gy);
      vec3 sky=mix(vec3(.03,.05,.12),vec3(.35,.25,.4),clamp(vP.y*.15+.2,0.,1.));
      float band=.5+.5*sin(vP.y*1.3+vUv.x*6.);
      vec3 c=mix(vec3(.015,.025,.05),sky,.25+fr*.5)+vec3(.04,.05,.09)*band; c=mix(c,vec3(.005),grid*.8);
      float south=smoothstep(.2,.7,N.z); c+=vec3(1.,.75,.4)*south*uSun*.55*(1.-uShade*.8)*(.6+.4*band);
      c+=vec3(1.,.55,.2)*south*uHi*.5;
      float louver=uShade*step(.6,fract(vUv.y*38.*2.))*south; c=mix(c,vec3(.18,.18,.2),louver);
      gl_FragColor=vec4(c,1.); }` });
const winMat = (seed) => new THREE.ShaderMaterial({ uniforms: { uS: { value: seed } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uS; varying vec2 vUv; varying vec3 vN; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9,78.2))+uS)*43758.5); }
    void main(){ vec2 g=vUv*vec2(6.,18.); vec2 id=floor(g); vec2 f=fract(g); float win=step(.18,f.x)*step(f.x,.82)*step(.2,f.y)*step(f.y,.8);
      float on=step(.55,h(id)); vec3 c=vec3(.05,.05,.09)+win*on*vec3(1.,.75,.4)*.9+win*(1.-on)*vec3(.06,.08,.14); c*=abs(vN.y)>.5?.4:1.; gl_FragColor=vec4(c,1.); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const SUN = V(-6, 9, 9), FOCUS = V(0.4, -1.5, 3.4);
  const S = {};
  S.tower = {
    build(sc) {
      const g = new THREE.Group(); g.position.y = -1.5;
      const tower = new THREE.Mesh(towerGeo(), glassMat()); g.add(tower);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.05, 32), std('#111522', .5, .5)); top.position.y = H; top.scale.set(1.15, 1, 0.75); g.add(top);
      const r = rng(4);
      for (let i = 0; i < 14; i++) { const h = 1 + r() * 3.2, w = 0.6 + r() * 0.8; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), winMat(r() * 10));
        const a = r() * Math.PI * 2, d = 3 + r() * 4; b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d - 1.5); if (b.position.z > 1.5 && Math.abs(b.position.x) < 2.5) b.position.z -= 4; g.add(b); }
      const ground = floor('#1d1626', 12, 0.7); g.add(ground);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), glowMat('#ffd27a', 4)); sun.position.copy(SUN).add(V(0, 1.5, 0)); g.add(sun);
      // incoming + reflected rays
      const rays = []; for (let i = 0; i < 9; i++) { const u = (i / 8 - 0.5) * 1.6, y = 1.6 + (i % 3) * 0.9;
        const hit = V(u, y, 0.75 + 0.2 * Math.cos(u)), sunP = SUN.clone().add(V(u * 0.6, 0, 0));
        const inc = pathTube(new THREE.LineCurve3(sunP, hit), 0.018, '#ffd27a', 1.6), ref = pathTube(new THREE.LineCurve3(hit, FOCUS.clone().add(V(0, 1.5, 0))), 0.02, '#ffb347', 2.2);
        g.add(inc, ref); rays.push([inc, ref]); }
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), glowMat('#ff8a3d', 2.4, { blending: THREE.AdditiveBlending, depthWrite: false })); spot.rotation.x = -Math.PI / 2; spot.position.copy(FOCUS).add(V(0, 1.52, 0)); g.add(spot);
      // car
      const car = new THREE.Group(); const paint = std('#1b2a44', 0.25, 0.6);
      const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.35, 0.7, 4, 0.12), paint); body.position.y = 0.3;
      const cab = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.3, 0.62, 4, 0.12), std('#0d1220', 0.35, 0.3)); cab.position.set(-0.08, 0.58, 0);
      car.add(body, cab); [[-0.5, .35], [0.5, .35], [-0.5, -.35], [0.5, -.35]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20), std('#111', .8)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.16, z); car.add(w); });
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), paint); mirror.position.set(0.25, 0.55, 0.38); car.add(mirror);
      car.position.copy(FOCUS).add(V(0, 1.5, 0)); car.rotation.y = 0.3; g.add(car);
      const heat = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 4), glowMat('#ffb070', 2, { blending: THREE.AdditiveBlending, depthWrite: false }), 60); g.add(heat);
      const rings = [0, 1].map(() => { const s = soundRing(C('#ff9b4d')); s.rotation.x = Math.PI / 2; s.position.copy(spot.position); g.add(s); return s; });
      g.userData = { tower, rays, spot, car, paint, heat, rings, sun }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { tower, rays, spot, car, paint, heat, rings, sun } = g.userData, m = tower.material.uniforms, mode = sc.mode;
      let rayP = 0, refP = 0, heatK = 0, shade = 0; m.uSun.value = 0.3; m.uHi.value = 0;
      if (mode === 'hero') {
        look(V(lerp(3.0, 6.0, ease.outCubic(lt / dur)), lerp(-1.2, 1.5, ease.outCubic(lt / dur)), lerp(8, 14, ease.outCubic(lt / dur))), V(0, lerp(2.2, 1.0, lt / dur), 0));
        rayP = 1; refP = ease.outCubic(remap(lt, 0.2, 1.0)); heatK = 1; m.uSun.value = 0.9;
      } else if (mode === 'orbit') {
        const a = -0.6 + lt * 0.25; look(V(Math.sin(a) * 15, 3.0, Math.cos(a) * 15), V(0, 1.0, 0));
      } else if (mode === 'curve') {
        look(V(lerp(6, 3, ease.inOutSine(lt / dur)), 9.5, lerp(10, 12, lt / dur)), V(0, 1.2, 0)); m.uSun.value = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(lt * 4)); m.uHi.value = 0.6 * ease.outCubic(lt / 1);
      } else if (mode === 'rays') {
        look(V(8, 3.5, 14.5), V(0, 1.2, 1)); rayP = ease.inOutCubic(remap(lt, 0.2, 1.8)); refP = ease.inOutCubic(remap(lt, 1.6, 3.2)); m.uSun.value = 0.3 + rayP * 0.6; heatK = refP;
      } else if (mode === 'car') {
        look(V(lerp(3.5, 2.4, lt / dur), 0.9, FOCUS.z + lerp(3.5, 2.6, lt / dur)), car.position.clone().add(V(0, -1.2, 0)).add(V(0, 0, 0)));
        rayP = 1; refP = 1; heatK = 1; m.uSun.value = 0.9;
      } else if (mode === 'shade') {
        look(V(7.5, 2.8, 14), V(0, 1.4, 1)); shade = ease.inOutCubic(remap(lt, 1.2, 2.8)); rayP = 1; refP = 1 - shade; heatK = 1 - shade; m.uSun.value = 0.9;
      }
      m.uShade.value = shade;
      rays.forEach(([inc, ref]) => { inc.material.uniforms.uP.value = rayP; inc.material.uniforms.uOp.value = rayP > 0 ? 0.55 : 0; ref.material.uniforms.uP.value = refP; ref.material.uniforms.uOp.value = refP > 0 ? 0.9 : 0; });
      spot.material.opacity = heatK * (0.7 + 0.3 * Math.sin(t * 9)); spot.scale.setScalar(0.8 + 0.2 * heatK);
      const melt = mode === 'car' ? ease.inOutSine(remap(lt, 0.5, dur)) : (mode === 'hero' ? 0.5 : (heatK > 0.5 ? 0.6 : 0));
      paint.color.set('#1b2a44').lerp(C('#ff6a1a'), melt * 0.55); paint.emissive = C('#ff4400').multiplyScalar(melt * 0.5);
      car.children[0].scale.set(1 + melt * 0.04, 1 - melt * 0.18, 1 + melt * 0.06); car.children[0].position.y = 0.3 - melt * 0.04;
      const r = rng(2), p = V();
      for (let i = 0; i < 60; i++) { const ph = (t * (0.4 + r() * 0.6) + r()) % 1; p.set(car.position.x + (r() - .5) * 1.4, car.position.y + ph * 1.8, car.position.z + (r() - .5) * 0.8); setInstance(heat, i, p, heatK * (1 - ph) * (0.6 + r()), [0, 0, 0]); }
      heat.instanceMatrix.needsUpdate = true;
      rings.forEach((s, i) => s.update(heatK > 0.5 ? ((lt + i * 0.6) % 1.2) : -1, 1.2, 0.3, 1.6));
      stage.bgMat.uniforms.uGlowAmt.value = 0.25 + heatK * 0.2; stage.bgMat.uniforms.uGlowPos.value.set(0.25, 0.85);
    },
  };
  return S;
}
