import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, tubeGeometry } from '/engine/kit.js';
import { V, C, std, glowMat, floor, waterPlane, arrow } from '/engine/props.js';

// glass with optional photoelastic stress bands and a travelling crack front (uCrack along aU, 1 = tail tip)
const glass = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uStress: { value: 0 }, uCrack: { value: 2 }, uMolten: { value: 0 }, uT: { value: 0 } },
  vertexShader: `attribute float aU; varying float vU; varying vec3 vN; varying vec3 vP; varying vec3 vO; void main(){ vU=aU; vO=position; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform float uStress,uCrack,uMolten,uT; varying float vU; varying vec3 vN; varying vec3 vP; varying vec3 vO;
    vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
    void main(){ vec3 V=normalize(cameraPosition-vP); vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; float fr=pow(1.-abs(dot(N,V)),2.2);
      vec3 H=normalize(normalize(vec3(.4,.9,.5))+V); float sp=pow(max(dot(N,H),0.),120.);
      vec3 c=vec3(.6,.85,1.)*(.08+fr*1.1)+sp*1.6; float a=.12+fr*.8+sp;
      float r=length(vO.xz)+abs(vO.y)*.2; c=mix(c,hue(r*2.2+vU*3.)*1.3,uStress*.85); a=mix(a,.75,uStress*.6);
      float cr=smoothstep(.06,0.,abs(vU-uCrack)); float behind=step(uCrack,vU); c=mix(c,vec3(1.,1.,1.)*3.,cr); c=mix(c,c*vec3(1.2,1.1,1.3)+vec3(.15),behind*(uCrack<1.5?1.:0.));
      c=mix(c,vec3(1.,.45,.1)*2.2,uMolten); a=mix(a,1.,uMolten);
      gl_FragColor=vec4(c,a); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function dropMesh() {
    const g = new THREE.Group(), mat = glass();
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.05, 0.55, 0), V(0.25, 1.3, 0.05), V(0.75, 2.0, 0.1), V(1.4, 2.4, 0.1)]);
    const rad = u => u < 0.12 ? Math.sqrt(Math.max(0, 1 - Math.pow((0.12 - u) / 0.12, 2))) * 0.62 + 0 : lerp(0.62, 0.03, Math.pow((u - 0.12) / 0.88, 0.55));
    const tail = new THREE.Mesh(tubeGeometry(curve, rad, 220, 40), mat); g.add(tail);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 24), mat); cap.position.y = 0.0; cap.geometry.setAttribute('aU', new THREE.Float32BufferAttribute(new Array(cap.geometry.attributes.position.count).fill(0), 1)); g.add(cap);
    g.userData = { mat, curve }; return g;
  }
  const S = {};
  S.drop = {
    build(sc) {
      const g = new THREE.Group(); const D = dropMesh(); D.position.y = -0.4; g.add(D);
      const fl = floor('#1b2433', 8, 0.7); fl.position.y = -1.05; g.add(fl);
      const hammer = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 32), std('#9aa3b2', 0.25, 0.95)); head.rotation.z = Math.PI / 2;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 16), std('#6b3f24', 0.7)); handle.position.y = 1.6; hammer.add(head, handle); g.add(hammer);
      const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 6, 4), glowMat('#ffd27a', 3), 60); g.add(sparks);
      const rings = [0, 1].map(() => { const r = soundRing(C('#9fe8ff')); g.add(r); return r; });
      const water = waterPlane(14, '#0b3c5c', 100); water.position.y = -1.0; g.add(water);
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16), std('#ff7a1f', 0.3, 0, { emissive: '#ff5a10', emissiveIntensity: 1.6 })); g.add(blob);
      const steam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 1), std('#dfe6f0', 1, 0, { transparent: true, opacity: 0.16, depthWrite: false }), 40); g.add(steam);
      const arrIn = [...Array(8)].map((_, i) => { const a = arrow('#62f0ff', 0.45, 0.03); g.add(a); return a; });
      const arrOut = [...Array(4)].map(() => { const a = arrow('#ff5a5a', 0.3, 0.025); g.add(a); return a; });
      const cutter = new THREE.Group(); [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.18), std('#c0c6d2', 0.2, 1)); b.position.y = s * 0.32; b.userData.s = s; cutter.add(b); }); g.add(cutter);
      const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.05), std('#cfeaff', 0.1, 0.2, { emissive: '#6ab8ff', emissiveIntensity: 0.6, transparent: true }), 400); g.add(shards);
      g.userData = { D, hammer, sparks, rings, water, blob, steam, arrIn, arrOut, cutter, shards }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, m = u.D.userData.mat.uniforms;
      [u.hammer, u.water, u.blob, u.steam, u.cutter, u.shards].forEach(o => o.visible = false); u.arrIn.forEach(a => a.visible = false); u.arrOut.forEach(a => a.visible = false);
      u.D.visible = true; m.uStress.value = 0; m.uCrack.value = 2; m.uMolten.value = 0;
      const hit = (times) => { u.hammer.visible = true; let y = 2.2, imp = -1; for (const ht of times) { const d = lt - ht; if (d > -0.35 && d < 0.4) { y = d < 0 ? lerp(2.2, 0.62, ease.inOutCubic((d + 0.35) / 0.35) ** 2) : lerp(0.62, 1.6, ease.outCubic(d / 0.4)); } if (d >= 0) imp = d; }
        u.hammer.position.set(0, -0.4 + y + 0.0, 0); u.hammer.rotation.z = 0.15;
        const r = rng(4), p = V(); for (let i = 0; i < 60; i++) { const dir = V(r() - .5, r() * 0.8, r() - .5).normalize(); const k = imp >= 0 && imp < 0.5 ? imp : -1; p.set(0, 0.2, 0).addScaledVector(dir, k * (2 + r() * 3)); p.y -= k * k * 3; setInstance(u.sparks, i, p, k >= 0 ? 1 - k * 2 : 0.0001, [0, 0, 0]); }
        u.sparks.instanceMatrix.needsUpdate = true; u.rings.forEach((rg, i) => { rg.position.set(0, 0.2, 0); rg.update(imp - i * 0.1, 0.6, 0.4, 2); }); if (imp >= 0 && imp < 0.3) stage.shake = (0.3 - imp) * 6; };
      if (mode === 'hero') { look(V(lerp(1.5, 3.0, lt / dur), lerp(0.2, 1.0, lt / dur), lerp(4.2, 6.5, ease.outCubic(lt / dur))), V(0.2, 0.3, 0)); hit([0.5, 1.5]); u.D.rotation.y = 0.5; }
      else if (mode === 'make') {
        u.water.visible = true; u.water.material.uniforms.uT.value = t; u.blob.visible = true; look(V(2.5, 1.2, 7), V(0, 0, 0));
        const fall = ease.inOutCubic(remap(lt, 0.1, 0.9)); u.blob.position.set(0, lerp(3.5, -0.6, fall), 0); u.blob.scale.set(1 - fall * 0.2, 1 + fall * 0.5, 1 - fall * 0.2);
        u.D.visible = lt > 0.9; m.uMolten.value = 1 - ease.outCubic(remap(lt, 0.9, dur - 0.3)); u.blob.visible = lt <= 0.9; u.D.position.y = -0.7; u.D.rotation.y = lt * 0.4;
        const r = rng(2), p = V(); u.steam.visible = lt > 0.9; for (let i = 0; i < 40; i++) { const ph = ((lt - 0.9) * 0.6 + r()) % 1; p.set((r() - .5) * 1.5, -0.9 + ph * 2.5, (r() - .5) * 1); setInstance(u.steam, i, p, (0.25 + ph * 0.6) * (1 - ph) * (lt > 0.9 ? 1 : 0), [i, i, i]); } u.steam.instanceMatrix.needsUpdate = true;
      }
      else if (mode === 'stress') { m.uStress.value = ease.outCubic(remap(lt, 0.2, 1.0)); look(V(Math.sin(lt * 0.3) * 1.5, 0.6, 5.5), V(0.3, 0.4, 0)); u.D.position.y = -0.4; u.D.rotation.y = -0.3;
        u.arrIn.forEach((a, i) => { a.visible = lt > 1.0; const ang = i / 8 * Math.PI * 2; const dir = V(Math.cos(ang), Math.sin(ang), 0); const L = 0.45; a.position.set(dir.x * (0.62 + L + 0.08), -0.4 + dir.y * (0.62 + L + 0.08), 0.3); a.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().negate()); });
        u.arrOut.forEach((a, i) => { a.visible = lt > 1.6; const ang = i / 4 * Math.PI * 2 + 0.4; const dir = V(Math.cos(ang), Math.sin(ang), 0); a.position.set(dir.x * 0.08, -0.4 + dir.y * 0.08, 0.3); a.quaternion.setFromUnitVectors(V(0, 1, 0), dir); }); }
      else if (mode === 'hammer') { look(V(3.2, 0.9, 5.5), V(0, 0.3, 0)); hit([0.9, 1.9]); u.D.rotation.y = 0.2; }
      else if (mode === 'crack') { look(V(lerp(3.5, 2.2, lt / dur), 1.4, lerp(5.5, 7, lt / dur)), V(0.6, 0.9, 0)); u.D.position.y = -0.4; u.D.rotation.y = 0;
        u.cutter.visible = true; const tip = u.D.userData.curve.getPointAt(0.92); u.cutter.position.set(tip.x, tip.y - 0.4, 0.1); u.cutter.rotation.z = -0.5;
        const close = ease.inOutCubic(remap(lt, 0.6, 1.1)); u.cutter.children.forEach(b => b.position.y = b.userData.s * lerp(0.35, 0.05, close));
        m.uCrack.value = lt < 1.1 ? 2 : lerp(0.92, 0.0, ease.inOutSine(remap(lt, 1.1, dur - 0.2))); }
      else if (mode === 'powder') { look(V(Math.sin(lt * 0.3) * 2, 1.0, 7), V(0.4, 0.4, 0)); const k = ease.outCubic(remap(lt, 0.85, 2.2)); u.D.visible = lt < 0.9; m.uCrack.value = lt < 0.9 ? lerp(0.5, 0, lt / 0.9) : 2;
        u.shards.visible = lt >= 0.85; const r = rng(8), p = V(); for (let i = 0; i < 400; i++) { const uu = r(); const base = uu < 0.4 ? V((r() - .5) * 1.1, (r() - .5) * 1.1 - 0.4, (r() - .5) * 1.1) : u.D.userData.curve.getPointAt(uu).add(V(0, -0.4, 0));
          const d = V(r() - .5, r() - .2, r() - .5).normalize(); p.copy(base).addScaledVector(d, k * (1 + r() * 2.5)); p.y -= k * k * 1.2; setInstance(u.shards, i, p, (1 - k * 0.6) * (0.6 + r()), [t + i, t * 2 + i, 0]); }
        u.shards.instanceMatrix.needsUpdate = true; u.shards.material.opacity = 1 - remap(lt, 2.4, dur); if (lt > 0.85 && lt < 1.2) stage.shake = 1.5; }
    },
  };
  return S;
}
