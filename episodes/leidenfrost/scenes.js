import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, floor, arrow, pathTube } from '/engine/props.js';

const surfMat = () => new THREE.ShaderMaterial({ uniforms: { uHeat: { value: 0.5 }, uT: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform float uHeat,uT; varying vec2 vUv; varying vec3 vP; void main(){ vec2 d=vUv-.5; float r=length(d)*2.;
    float rings=.5+.5*sin(r*160.); vec3 V=normalize(cameraPosition-vP); vec3 H=normalize(normalize(vec3(.3,1.,.5))+V); float sp=pow(max(H.y,0.),60.)*.6;
    vec3 c=vec3(.07,.07,.08)*(0.8+.2*rings)+sp; float glow=uHeat*smoothstep(1.,.0,r)*(.85+.15*sin(uT*3.+r*8.));
    c+=mix(vec3(.6,.05,0.),vec3(1.,.45,.05),glow)*glow*1.4; gl_FragColor=vec4(c,1.); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.pan = {
    build(sc) {
      const g = new THREE.Group(); g.position.y = -0.8;
      const surf = new THREE.Mesh(new THREE.CircleGeometry(2.6, 96), surfMat()); surf.rotation.x = -Math.PI / 2; g.add(surf);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.6, 0.45, 96, 1, true), std('#26262c', 0.35, 0.9, { side: THREE.DoubleSide })); rim.position.y = 0.2; g.add(rim);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.05, 8, 96), std('#3a3a42', 0.3, 0.9)); lip.rotation.x = Math.PI / 2; lip.position.y = 0.43; g.add(lip);
      const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 2.6, 6, 12), std('#141418', 0.6, 0.3)); handle.rotation.z = Math.PI / 2; handle.position.set(4.2, 0.35, 0); g.add(handle);
      const fl = floor('#2a1210', 9, 0.5); fl.position.y = -0.3; g.add(fl);
      const drops = [0, 1, 2, 3, 4].map(() => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.32, 40, 20), fresnelMat({ color: '#7fd4ff', body: 0.35, rim: 1.5 })); g.add(d);
        const cushion = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), glowMat('#ffffff', 1.4, { blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 })); cushion.rotation.x = -Math.PI / 2; g.add(cushion); d.userData.cushion = cushion; return d; });
      const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), fresnelMat({ color: '#cfefff', body: 0.2, rim: 1.2 }), 80); g.add(bubbles);
      const steam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.18, 1), std('#ffffff', 1, 0, { transparent: true, opacity: 0.05, depthWrite: false }), 60); g.add(steam);
      const vapor = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), glowMat('#ffffff', 1.6, { blending: THREE.AdditiveBlending, depthWrite: false }), 120); g.add(vapor);
      const arrows = [-1, 0, 1].map(i => { const a = arrow('#ffd84d', 0.35, 0.02); g.add(a); return a; });
      const trails = [0, 1, 2].map(i => { const pts = []; for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2 * 1.3 + i * 2; pts.push(V(Math.cos(a) * (1.1 + 0.6 * Math.sin(a * 2 + i)), 0.02, Math.sin(a) * (1.1 + 0.5 * Math.cos(a * 3)))); }
        const tr = pathTube(new THREE.CatmullRomCurve3(pts), 0.012, '#9fe8ff', 1.4); g.add(tr); return tr; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const lab = new Label(ov, 'STEAM LAYER', { size: 40, accent: true });
      g.userData = { surf, drops, bubbles, steam, vapor, arrows, trails, lab, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, sm = u.surf.material.uniforms; sm.uT.value = t;
      u.drops.forEach(d => { d.visible = false; d.userData.cushion.visible = false; d.scale.set(1, 1, 1); }); [u.bubbles, u.steam, u.vapor].forEach(o => o.visible = false);
      u.arrows.forEach(a => a.visible = false); u.trails.forEach(tr => tr.visible = false); u.lab.update(stage, V(), 0);
      const r = rng(4), p = V();
      const skate = (d, i, speed) => { const a = t * speed + i * 2.1; const x = Math.cos(a) * (1.1 + 0.6 * Math.sin(a * 2 + i)), z = Math.sin(a) * (1.1 + 0.5 * Math.cos(a * 3)); d.position.set(x, 0.3 + 0.03 * Math.sin(t * 20 + i), z);
        d.scale.set(1 + 0.08 * Math.sin(t * 13 + i), 0.82 + 0.06 * Math.sin(t * 17 + i), 1 + 0.08 * Math.cos(t * 11 + i)); d.visible = true; const c = d.userData.cushion; c.visible = true; c.position.set(x, 0.012, z); c.material.opacity = 0.35 + 0.15 * Math.sin(t * 30 + i); };
      if (mode === 'hero') { sm.uHeat.value = 1; look(V(lerp(1.2, 3.5, lt / dur), lerp(1.2, 3.2, ease.outCubic(lt / dur)), lerp(3, 6.5, ease.outCubic(lt / dur))), V(0, 0, 0)); u.drops.slice(0, 3).forEach((d, i) => skate(d, i, 1.6)); }
      else if (mode === 'boil') { sm.uHeat.value = 0.25; look(V(2.0, 3.2, 5.5), V(0, 0, 0)); const d = u.drops[0]; d.visible = true; const k = remap(lt, 0.3, dur);
        d.position.set(0, 0.12 * (1 - k), 0); d.scale.set(1.6 + k * 0.5, 0.35 * (1 - k) + 0.02, 1.6 + k * 0.5); u.bubbles.visible = u.steam.visible = true;
        for (let i = 0; i < 80; i++) { const a = r() * 6.28, rr = r() * 0.5 * (1.6 + k * 0.5); const ph = (t * 2 + r()) % 1; p.set(Math.cos(a) * rr, 0.03 + ph * 0.1 * (1 - k), Math.sin(a) * rr); setInstance(u.bubbles, i, p, (1 - k) * (0.5 + r()), [0, 0, 0]); }
        for (let i = 0; i < 60; i++) { const ph = (lt * 0.5 + r()) % 1; p.set((r() - .5) * 1.2, ph * 2.5, (r() - .5) * 1.2); setInstance(u.steam, i, p, (0.3 + ph * 1.2) * (1 - ph), [i, i, 0]); }
        u.bubbles.instanceMatrix.needsUpdate = u.steam.instanceMatrix.needsUpdate = true; }
      else if (mode === 'hot') { sm.uHeat.value = ease.inOutSine(remap(lt, 0, 1.5)); look(V(2.5, 3.0, 5), V(0, 0, 0)); const d = u.drops[0]; const k = ease.outBack(remap(lt, 1.2, 1.8));
        d.visible = true; d.position.set(0, lerp(2.5, 0.3, clamp(k)), 0); d.scale.set(1, 0.85, 1); if (lt > 1.5) { d.userData.cushion.visible = true; d.userData.cushion.position.set(0, 0.012, 0); } }
      else if (mode === 'cushion') { sm.uHeat.value = 1; look(V(1.3, -0.25, 2.1), V(0, -0.45, 0)); const d = u.drops[0]; d.visible = true; d.position.set(0, 0.36, 0); d.scale.set(1.1, 0.8, 1.1);
        u.vapor.visible = true; for (let i = 0; i < 120; i++) { const a = r() * 6.28, rr = r() * 0.34; const ph = (t * 1.5 + r()) % 1; p.set(Math.cos(a) * (rr + ph * 0.2), 0.02 + 0.06 * Math.sin(Math.PI * ph), Math.sin(a) * (rr + ph * 0.2)); setInstance(u.vapor, i, p, 1 - ph, [0, 0, 0]); }
        u.vapor.instanceMatrix.needsUpdate = true; u.arrows.forEach((a, i) => { a.visible = true; a.position.set((i - 1) * 0.2, 0.02, 0.15); a.setLength(0.1 + 0.02 * Math.sin(t * 10 + i)); });
        u.lab.update(stage, V(0.45, 0.05, 0).applyMatrix4(g.matrixWorld), clamp((lt - 0.8) / 0.3), 120, -10); }
      else if (mode === 'skate') { sm.uHeat.value = 1; const a = lt * 0.2; look(V(Math.sin(a) * 4.5, 3.4, Math.cos(a) * 4.5), V(0, 0, 0)); u.drops.slice(0, 3).forEach((d, i) => skate(d, i, 1.3)); u.trails.forEach(tr => { tr.visible = true; tr.material.uniforms.uP.value = 1; tr.material.uniforms.uOp.value = 0.4; }); }
      else if (mode === 'outro') { sm.uHeat.value = 1; look(V(lerp(3, 1.5, lt / dur), lerp(3.2, 5, lt / dur), lerp(5, 6.5, lt / dur)), V(0, 0, 0)); u.drops.forEach((d, i) => skate(d, i, 1.1 + i * 0.1)); }
    },
  };
  return S;
}
