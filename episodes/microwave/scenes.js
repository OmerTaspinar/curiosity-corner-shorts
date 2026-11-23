import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, waveRibbon, floor, h2o, RoundedBoxGeometry, arrow } from '/engine/props.js';

// food cross-section: heat penetrates from the outside (uDepth 0..1)
const foodMat = () => new THREE.ShaderMaterial({ uniforms: { uHeat: { value: 0 }, uDepth: { value: 0 } },
  vertexShader: `varying vec3 vO; varying vec3 vN; void main(){ vO=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uHeat,uDepth; varying vec3 vO; varying vec3 vN; void main(){ float r=length(vO)/1.0; float hot=smoothstep(1.-uDepth*.75-.08,1.-uDepth*.75,r)*uHeat;
    vec3 c=mix(vec3(.55,.42,.25),vec3(1.,.35,.08)*1.6,hot); c=mix(c,vec3(.95,.85,.6),.15*(1.-hot)); float l=.55+.45*max(dot(normalize(vN),normalize(vec3(.3,.8,.6))),0.); gl_FragColor=vec4(c*l,1.); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.micro = {
    build(sc) {
      const g = new THREE.Group();
      const oven = new THREE.Group(); const shellM = std('#b9bec8', 0.35, 0.5); [[0, 1.3, 0, 4.2, 0.08, 2.6], [0, -1.3, 0, 4.2, 0.08, 2.6], [0, 0, -1.3, 4.2, 2.6, 0.08], [-2.1, 0, 0, 0.08, 2.6, 2.6], [2.1, 0, 0, 0.08, 2.6, 2.6], [1.65, 0, 0, 0.08, 2.6, 2.6]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shellM); m.position.set(x, y, z); oven.add(m); });
      const cav = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.1, 2.3), std('#2a2f3a', 0.5, 0.6, { side: THREE.BackSide })); cav.position.set(-0.45, 0, 0.2); oven.add(cav);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.1), fresnelMat({ color: '#9fd8ff', body: 0.06, rim: 0.4 })); door.position.set(-0.45, 0, 1.31); oven.add(door);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.1), std('#1a1d24', 0.4, 0.5)); panel.position.set(1.65, 0, 1.31); oven.add(panel);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), glowMat('#4dff9a', 1.6)); disp.position.set(1.65, 0.6, 1.32); oven.add(disp);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 48), fresnelMat({ color: '#dff', body: 0.3, rim: 0.8 })); plate.position.set(-0.45, -0.95, 0.2); oven.add(plate);
      // food is a sphere cut in half to show the inside
      const food = new THREE.Group(); const half = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI), foodMat()); const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 48), half.material); cap.rotation.y = Math.PI / 2 * 0; food.add(half, cap); food.scale.setScalar(0.55); food.position.set(-0.45, -0.4, 0.2); oven.add(food);
      g.add(oven);
      const waves = [0, 1, 2].map(i => { const w = waveRibbon({ len: 2.8, width: 0.04, color: '#62f0ff', amp: 0.3, k: 6, glow: 1.6 }); w.position.set(-0.45, 0.5 - i * 0.45, 0.2 + (i - 1) * 0.5); g.add(w); return w; });
      const field = new THREE.Group(); const mols = []; for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) { const m = h2o(0.9); m.position.set((x - 2) * 1.0, (y - 1.5) * 1.0, 0); field.add(m); mols.push(m); } g.add(field);
      const fArrows = [...Array(5)].map((_, i) => { const a = arrow('#ffd84d', 0.8, 0.04); a.position.set((i - 2) * 1.0, 2.3, 0); field.add(a); return a; });
      const fl = floor('#211a33', 8, 0.5); fl.position.y = -1.32; g.add(fl);
      const ov = new THREE.Group(); stage.overlay.add(ov); const lP = new Label(ov, '+', { size: 70, accent: true }), lN = new Label(ov, '−', { size: 80 });
      g.userData = { oven, food, half, waves, field, mols, fArrows, lP, lN, ov, door }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, fm = u.half.material.uniforms; u.oven.visible = true; u.field.visible = false; u.waves.forEach(w => w.visible = false); [u.lP, u.lN].forEach(l => l.update(stage, V(), 0));
      fm.uHeat.value = 0; fm.uDepth.value = 0; u.food.rotation.y = t * 0.8; u.oven.position.set(0, 0, 0); u.oven.scale.setScalar(1);
      const showWaves = () => u.waves.forEach((w, i) => { w.visible = true; w.material.uniforms.uAmp.value = 0.3 * Math.sin(t * 14 + i); w.material.uniforms.uPhase.value = 0; });
      const field = (heat) => { u.oven.visible = false; u.field.visible = true; const E = Math.sin(t * 6); u.mols.forEach((m, i) => { const j = heat * 0.15; m.rotation.set(0, 0, E * 1.2 + (rng(i + 1)() - .5) * 0.3 + Math.sin(t * 23 + i) * j * 3); m.position.z = Math.sin(t * 17 + i * 3) * j; m.children.forEach(c => { if (c.material.emissive) c.material.emissive.set(heat > 0 ? '#ff5a1a' : (c.geometry.parameters.radius > 0.2 ? '#3a0010' : '#202838')).multiplyScalar(heat > 0 ? heat * 0.8 : 1); }); });
        u.fArrows.forEach(a => { a.rotation.z = E > 0 ? -Math.PI / 2 : Math.PI / 2; a.setLength(0.3 + 0.5 * Math.abs(E)); }); };
      if (mode === 'hero') { showWaves(); fm.uHeat.value = 1; fm.uDepth.value = 0.35; look(V(lerp(-2.5, 0.5, ease.outCubic(lt / dur)), lerp(0.3, 0.8, lt / dur), lerp(6, 10, ease.outCubic(lt / dur))), V(0, -0.2, 0)); }
      else if (mode === 'waves') { showWaves(); look(V(-0.45, 0.4, 7.5), V(-0.2, 0, 0)); }
      else if (mode === 'dipole') { field(0); look(V(0, 0, 7.5), V(0, 0.2, 0)); const m = u.mols[7]; const wp = m.getWorldPosition(V()); u.lN.update(stage, wp, clamp((lt - 0.8) / 0.3), 0, 70); u.lP.update(stage, wp, clamp((lt - 1.1) / 0.3), 0, -70); }
      else if (mode === 'spin') { field(0); look(V(Math.sin(lt * 0.3) * 2, 0.5, 7.5), V(0, 0.2, 0)); }
      else if (mode === 'heat') { field(ease.outCubic(remap(lt, 0, 1))); look(V(0, 0.3, 6.5), V(0, 0, 0)); }
      else if (mode === 'depth') { u.oven.visible = true; showWaves(); fm.uHeat.value = 1; fm.uDepth.value = ease.inOutSine(remap(lt, 0.3, dur - 0.3)); u.food.rotation.y = -0.6; look(V(-0.2, 0.3, 4.2), V(-0.45, -0.35, 0)); }
    },
  };
  return S;
}
