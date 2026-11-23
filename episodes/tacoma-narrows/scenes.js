import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, waterPlane, pathTube, arrow } from '/engine/props.js';

const L = 8;  // centre span length
// deck material: torsion (one node at centre, like the real collapse) + vertical galloping, injected into a standard material
function deckMat(color) {
  const m = std(color, 0.6, 0.3); m.userData.u = { uTw: { value: 0 }, uGal: { value: 0 }, uPh: { value: 0 } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = 'uniform float uTw,uGal,uPh;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      float uu=position.x/${L.toFixed(1)}+.5; float a=uTw*sin(6.2832*uu)*sin(uPh); float ca=cos(a), sa=sin(a);
      objectNormal=vec3(objectNormal.x, ca*objectNormal.y-sa*objectNormal.z, sa*objectNormal.y+ca*objectNormal.z);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed=vec3(transformed.x, ca*transformed.y-sa*transformed.z, sa*transformed.y+ca*transformed.z);
      transformed.y+=uGal*sin(3.1416*uu*2.)*sin(uPh*.7);`); };
  return m;
}

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.bridge = {
    build(sc) {
      const g = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.7, 200, 1, 8), deckMat('#5d6f86')); g.add(deck);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.18, 0.04, 200, 1, 1), deckMat('#8a3a2a')); rail.position.z = 0.36; const rail2 = rail.clone(); rail2.material = rail.material; rail2.position.z = -0.36; g.add(rail, rail2);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.7), std('#5d6f86', .6, .3)); sideL.position.x = -L / 2 - 1.6; const sideR = sideL.clone(); sideR.position.x = L / 2 + 1.6; g.add(sideL, sideR);
      [-1, 1].forEach(s => { const tw = new THREE.Group(); [-0.42, 0.42].forEach(z => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.6, 0.16), std('#7a8796', .5, .5)); leg.position.set(0, 0.9, z); tw.add(leg); });
        [0.6, 1.9, 2.6].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), std('#7a8796', .5, .5)); b.position.y = y; tw.add(b); }); tw.position.x = s * L / 2; g.add(tw);
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 1.2), std('#4b5260', .8)); pier.position.set(s * L / 2, -1.2, 0); g.add(pier); });
      [-0.4, 0.4].forEach(z => { const pts = []; for (let i = 0; i <= 20; i++) { const x = -L / 2 - 2.8 + i / 20 * (L + 5.6); const inSpan = Math.abs(x) <= L / 2; const y = inSpan ? 2.65 - 2.3 * (1 - Math.pow(x / (L / 2), 2)) : 2.65 - (Math.abs(x) - L / 2) * 0.9; pts.push(V(x, y, z)); }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.03, 8), std('#9aa5b5', .4, .8))); });
      const water = waterPlane(40, '#07182a', 120); water.material.uniforms.uAmp.value = 0.05; water.material.fragmentShader = water.material.fragmentShader.replace('vec3(.5,.8,1.)*fr*.5', 'vec3(.3,.4,.7)*fr*.15'); water.position.y = -1.6; g.add(water);
      const wind = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.012, 0.012), glowMat('#cfe0ff', 1.6, { blending: THREE.AdditiveBlending, depthWrite: false }), 90); g.add(wind);
      const loop = new THREE.Group(); const tor = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 64, Math.PI * 1.7), glowMat(PAL.accent, 1.8)); const hd = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 12), glowMat(PAL.accent, 1.8)); hd.position.set(0.9, 0, 0); hd.rotation.z = Math.PI; loop.add(tor, hd); g.add(loop);
      const splash = [0, 1, 2].map(() => { const r = soundRing(C('#bfe6ff')); r.rotation.x = Math.PI / 2; r.position.y = -1.55; g.add(r); return r; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const l1 = new Label(ov, 'WIND PUSHES', { size: 40 }), l2 = new Label(ov, 'DECK TWISTS', { size: 40, accent: true });
      g.userData = { deck, rail, water, wind, loop, splash, l1, l2, sideL, sideR, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, du = u.deck.material.userData.u, ru = u.rail.material.userData.u;
      u.water.material.uniforms.uT.value = t; u.loop.visible = false; let tw = 0, gal = 0, windK = 0.3, fall = -1, labels = 0;
      if (mode === 'hero') { tw = 0.55; gal = 0.15; windK = 1; look(V(lerp(5.5, 7.5, lt / dur), lerp(0.8, 2.6, lt / dur), lerp(2.5, 6.5, ease.outCubic(lt / dur))), V(-1.5, 0.4, 0)); }
      else if (mode === 'calm') { gal = 0.25; windK = 0.4; const a = -0.5 + lt * 0.08; look(V(7 + Math.sin(a) * 2, 3.2, 6.5 + lt * 0.2), V(-1.5, 0.6, 0)); }
      else if (mode === 'wind') { gal = 0.2; windK = 1; look(V(8, 2.4, 5.5), V(-1, 0.4, 0)); }
      else if (mode === 'twist') { tw = 0.5 * ease.inOutSine(remap(lt, 0.3, dur)); gal = 0.1; windK = 1; look(V(L / 2 + 2, 2.2, 5), V(0, 0.2, 0)); }
      else if (mode === 'flutter') { tw = 0.6; windK = 1; u.loop.visible = true; labels = clamp((lt - 0.6) / 0.3); look(V(-8, 3.0, 6), V(1, 0.4, 0)); u.loop.position.set(L / 4, 0.0, 0.9); u.loop.rotation.set(0, 0, -t * 2); }
      else if (mode === 'collapse') { tw = 0.65 * (1 - remap(lt, 1.2, 1.6)); windK = 1; fall = lt - 1.2; look(V(lerp(8, 9.5, lt / dur), lerp(3.4, 4.4, lt / dur), lerp(7, 9, lt / dur)), V(-0.5, -0.3, 0)); }
      [du, ru].forEach(x => { x.uTw.value = tw; x.uGal.value = gal; x.uPh.value = t * 4.5; });
      const drop = fall > 0 ? ease.inCubic ? 0 : 0 : 0;
      if (fall > 0) { const k = clamp(fall / 1.3); const y = -k * k * 2.2; [u.deck, u.rail].forEach(o => { o.position.y = y; o.rotation.x = k * 0.6; }); u.splash.forEach((s, i) => s.update(fall - 1.25 - i * 0.15, 1.2, 1, 5)); if (fall > 1.2 && fall < 1.8) stage.shake = 1.5; }
      else { [u.deck, u.rail].forEach(o => { o.position.y = 0; o.rotation.x = 0; }); u.splash.forEach(s => s.visible = false); }
      const r = rng(5), p = V();
      for (let i = 0; i < 90; i++) { const ph = (t * (0.5 + r() * 0.5) + r()) % 1; p.set((r() - .5) * 12, (r() - .3) * 2.5, -6 + ph * 12); setInstance(u.wind, i, p, windK * Math.sin(Math.PI * ph), [0, Math.PI / 2, 0]); }
      u.wind.instanceMatrix.needsUpdate = true;
      u.l1.update(stage, V(-L / 4, 0.9, -1.5), labels); u.l2.update(stage, V(L / 4, 0.4, 0.6), labels);
      stage.shake = Math.max(stage.shake, tw * 0.6);
    },
  };
  return S;
}
