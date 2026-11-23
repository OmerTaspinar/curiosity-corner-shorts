import { THREE, PAL, NOISE, clamp, lerp, remap, ease, rng, setInstance, soundRing, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, arrow } from '/engine/props.js';

// thin-film soap shader; uRound morphs a subdivided cube into a sphere of equal "size"
const soapMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uRound: { value: 1 }, uT: { value: 0 }, uOp: { value: 1 } },
  vertexShader: NOISE + `uniform float uRound,uT; varying vec3 vN; varying vec3 vP; varying vec3 vO; void main(){ vec3 sph=normalize(position)*0.62; vec3 p=mix(position,sph,uRound);
    p+=normalize(p)*snoise(p*2.+uT*.6)*.015*uRound; vO=p; vec4 wp=modelMatrix*vec4(p,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*mix(normal,normalize(position),uRound)); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: NOISE + `uniform float uT,uOp; varying vec3 vN; varying vec3 vP; varying vec3 vO; vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
    void main(){ vec3 V=normalize(cameraPosition-vP); vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; float c=abs(dot(N,V)); float fr=pow(1.-c,2.);
      float film=c*2.+snoise(vO*1.5+vec3(0.,uT*.3,0.))*.6+vO.y*.8; vec3 col=hue(fract(film))*.9; vec3 H=normalize(normalize(vec3(.5,.9,.4))+V); float sp=pow(max(dot(N,H),0.),140.);
      gl_FragColor=vec4(col*(.15+fr*1.4)+sp*2.,(.08+fr*.85+sp)*uOp); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.bubble = {
    build(sc) {
      const g = new THREE.Group(); const geo = new THREE.BoxGeometry(1, 1, 1, 28, 28, 28);
      const main = new THREE.Mesh(geo, soapMat()); g.add(main);
      const wand = new THREE.Group(); [[0, 0.55, 1.2, 0.06], [0, -0.55, 1.2, 0.06], [0.55, 0, 0.06, 1.2], [-0.55, 0, 0.06, 1.2]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), std('#ff7ab8', 0.4, 0.2)); b.position.set(x, y, 0); wand.add(b); });
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), std('#ff7ab8', 0.4, 0.2)); stick.position.y = -1.45; wand.add(stick); g.add(wand);
      const arrows = [...Array(8)].map(() => { const a = arrow('#ffd84d', 0.4, 0.025); g.add(a); return a; });
      const extra = [...Array(9)].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 24), soapMat()); g.add(m); return m; });
      const cubeRef = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 20, 20, 20), soapMat()); g.add(cubeRef);
      const pop = [0, 1].map(() => { const r = soundRing(C('#ffffff')); g.add(r); return r; });
      const fl = floor('#2a1840', 8, 0.5); fl.position.y = -2.2; g.add(fl);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lC = new Label(ov, 'MORE SURFACE', { size: 40 }), lS = new Label(ov, 'LEAST SURFACE', { size: 40, accent: true });
      g.userData = { main, wand, arrows, extra, cubeRef, pop, lC, lS, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, m = u.main.material.uniforms; m.uT.value = t; m.uOp.value = 1;
      u.wand.visible = false; u.arrows.forEach(a => a.visible = false); u.extra.forEach(e => e.visible = false); u.cubeRef.visible = false; u.pop.forEach(p => p.visible = false); [u.lC, u.lS].forEach(l => l.update(stage, V(), 0));
      u.main.visible = true; u.main.position.set(0, 0, 0); u.main.scale.setScalar(1); u.main.rotation.set(0, t * 0.3, 0);
      if (mode === 'hero') { m.uRound.value = 1; u.main.scale.setScalar(lerp(0.2, 1.6, ease.outBack(remap(lt, 0, 0.7)))); u.main.position.y = 0.3 + 0.1 * Math.sin(t * 1.5); look(V(Math.sin(lt * 0.5) * 1.5, 0.4, lerp(3.5, 5.5, ease.outCubic(lt / dur))), V(0, 0.2, 0)); }
      else if (mode === 'square') { const k = ease.inOutCubic(remap(lt, 0.6, dur - 0.5)); u.wand.visible = true; u.wand.position.set(0, -0.2, 0); m.uRound.value = k; u.main.position.set(0, lerp(-0.2, 1.4, ease.outCubic(remap(lt, 0.3, dur))), lerp(0, 0.4, k)); look(V(1.2, 0.6, 5), V(0, 0.5, 0)); }
      else if (mode === 'tension') { m.uRound.value = 1; u.main.scale.setScalar(1.6); look(V(0, 0.3, 5), V(0, 0, 0));
        u.arrows.forEach((a, i) => { a.visible = true; const ang = i / 8 * Math.PI * 2 + t * 0.3; const p = V(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(1.02); a.position.copy(p).add(V(0, 0, 0.3)); a.quaternion.setFromUnitVectors(V(0, 1, 0), V(-Math.sin(ang), Math.cos(ang), 0)); a.setLength(0.35 + 0.08 * Math.sin(t * 6)); }); }
      else if (mode === 'sphere') { m.uRound.value = 1; u.main.position.set(0.95, 0, 0); u.cubeRef.visible = true; u.cubeRef.material.uniforms.uRound.value = 0; u.cubeRef.material.uniforms.uT.value = t; u.cubeRef.position.set(-0.95, 0, 0); u.cubeRef.scale.setScalar(1.0); u.cubeRef.rotation.set(0.4, t * 0.3, 0.2);
        look(V(0, 0.8, 5.5), V(0, 0, 0)); u.lC.update(stage, V(-0.95, -0.9, 0), clamp((lt - 0.6) / 0.3), 0, 0); u.lS.update(stage, V(0.95, -0.9, 0), clamp((lt - 1.0) / 0.3), 0, 0); }
      else if (mode === 'squeeze') { m.uRound.value = ease.inOutCubic(remap(lt, 0.2, dur - 0.3)); u.main.scale.setScalar(1.5); u.main.rotation.set(0.5, t * 0.4, 0.3); look(V(0, 0.4, 5), V(0, 0, 0)); }
      else if (mode === 'outro') { m.uRound.value = 1; look(V(Math.sin(lt * 0.2) * 2, 0.5, 7), V(0, 0.5, 0)); const r = rng(7);
        u.extra.forEach((e, i) => { e.visible = true; e.material.uniforms.uT.value = t + i; e.material.uniforms.uRound.value = 1; e.position.set((r() - .5) * 4, ((t * 0.15 + r()) % 1) * 5 - 1.5, (r() - .5) * 3); e.scale.setScalar(0.3 + r() * 0.6); }); u.main.position.y = 0.4; }
    },
  };
  return S;
}
