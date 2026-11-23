import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, waterPlane, arrow } from '/engine/props.js';

const L = 9;
function swayMat(color) {
  const m = std(color, 0.4, 0.6); m.userData.u = { uA: { value: 0 }, uPh: { value: 0 } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, m.userData.u); sh.vertexShader = 'uniform float uA,uPh;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 wpos=modelMatrix*vec4(transformed,1.); float uu=clamp(wpos.x/${L.toFixed(1)}+.5,0.,1.); transformed.z+=uA*sin(3.1416*uu)*sin(uPh);`); };
  return m;
}

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.mbridge = {
    build(sc) {
      const g = new THREE.Group();
      const deckM = swayMat('#6f7888'), cabM = swayMat('#a9b2c0');
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.9, 160, 1, 4), deckM); g.add(deck);
      [-0.55, 0.55].forEach(z => { const pts = []; for (let i = 0; i <= 40; i++) { const x = -L / 2 + i / 40 * L; pts.push(V(x, 0.12 - 0.12 * Math.sin(Math.PI * i / 40), z)); } const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 8), cabM); g.add(c); });
      [-L / 6, L / 6].forEach(x => { const pier = new THREE.Group(); const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 16), std('#6a7280', .5, .5)); col.position.y = -0.85; pier.add(col);
        [-1, 1].forEach(s => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), std('#6a7280', .5, .5)); arm.position.set(0, -0.05, s * 0.3); arm.rotation.x = s * 0.5; pier.add(arm); }); pier.position.x = x; g.add(pier); });
      const water = waterPlane(40, '#0a2236', 120); water.position.y = -1.6; water.material.uniforms.uAmp.value = 0.05; water.material.fragmentShader = water.material.fragmentShader.replace('vec3(.5,.8,1.)*fr*.5', 'vec3(.3,.4,.7)*fr*.15'); g.add(water);
      const N = 70; const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), N); g.add(people);
      const cols = ['#ff7ab8', '#ffd84d', '#62f0ff', '#9b8cff', '#ff9a3c'].map(C); for (let i = 0; i < N; i++) people.setColorAt(i, cols[i % 5]); people.instanceColor.needsUpdate = true;
      const arrs = [-1, 1].map(s => { const a = arrow('#ffd84d', 0.7, 0.04); a.rotation.x = s * Math.PI / 2; g.add(a); return a; });
      g.userData = { deckM, cabM, people, water, arrs }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; u.water.material.uniforms.uT.value = t; let A = 0, sync = 0, crowd = 1;
      if (mode === 'hero') { A = 0.18; sync = 1; look(V(lerp(6, 4, lt / dur), lerp(1.2, 2.2, lt / dur), lerp(3, 6, ease.outCubic(lt / dur))), V(-1, 0, 0)); }
      else if (mode === 'open') { A = 0; crowd = remap(lt, 0, dur); const a = lt * 0.12; look(V(7 + Math.sin(a) * 2, 3, 6), V(-1, 0, 0)); }
      else if (mode === 'sway') { A = 0.06; look(V(5.5, 1.6, 4.5), V(-1, 0, 0)); }
      else if (mode === 'sync') { A = 0.09; sync = ease.inOutSine(remap(lt, 0.3, dur)); look(V(1.8, 1.4, 3.2), V(0, 0, 0)); }
      else if (mode === 'wobble') { A = lerp(0.1, 0.28, ease.inOutSine(remap(lt, 0, dur))); sync = 1; look(V(6, 2.0, 5), V(-1, 0, 0)); stage.shake = A * 2; }
      const ph = t * 2 * Math.PI * 0.9; [u.deckM, u.cabM].forEach(m => { m.userData.u.uA.value = A; m.userData.u.uPh.value = ph; });
      u.arrs.forEach((a, i) => { a.visible = mode === 'sway' || mode === 'wobble'; a.position.set(0, 0.6, (i ? -1 : 1) * 0.25); a.setLength(0.3 + A * 3 * Math.max(0, (i ? -1 : 1) * Math.sin(ph))); });
      const r = rng(3), p = V(), tmp = new THREE.Object3D();
      for (let i = 0; i < 70; i++) { const dir = r() < 0.5 ? 1 : -1; const sp = 0.12 + r() * 0.06; const x = ((r() + dir * t * sp / L) % 1 + 1) % 1 * L - L / 2; const z0 = (r() - .5) * 0.6;
        const uu = x / L + 0.5; const deckZ = A * Math.sin(Math.PI * uu) * Math.sin(ph); const ownStep = Math.sin(t * 6 + r() * 6.28) * 0.03; const syncStep = Math.sin(ph) * 0.05;
        const visible = (i / 70) < crowd; p.set(x, 0.17 + Math.abs(Math.sin(t * 6 + i)) * 0.02, z0 + deckZ + lerp(ownStep, syncStep, sync));
        tmp.position.copy(p); tmp.rotation.set(lerp(Math.sin(t * 6 + i) * 0.1, Math.sin(ph) * 0.25, sync), 0, 0); tmp.scale.setScalar(visible ? 1 : 0.0001); tmp.updateMatrix(); u.people.setMatrixAt(i, tmp.matrix); }
      u.people.instanceMatrix.needsUpdate = true;
    },
  };
  return S;
}
