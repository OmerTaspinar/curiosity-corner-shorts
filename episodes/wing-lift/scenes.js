import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, arrow, pathTube } from '/engine/props.js';

function airfoilShape(c = 2.4, tk = 0.14, camber = 0.05) {   // NACA-like
  const top = [], bot = [];
  for (let i = 0; i <= 40; i++) { const x = (1 - Math.cos(Math.PI * i / 40)) / 2; const yt = 5 * tk * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4); const yc = camber * (x < 0.4 ? (2 * 0.4 * x - x * x) / 0.16 : ((1 - 0.8) + 2 * 0.4 * x - x * x) / 0.36);
    top.push([x * c - c / 2, (yc + yt) * c]); bot.push([x * c - c / 2, (yc - yt) * c]); }
  const sh = new THREE.Shape(); sh.moveTo(top[0][0], top[0][1]); top.forEach(([x, y]) => sh.lineTo(x, y)); bot.reverse().forEach(([x, y]) => sh.lineTo(x, y)); return sh;
}
const AOA = 0.12;
// streamline y for start height y0 at x (wing centred at origin): flow curves over the wing and is turned downward behind it
const stream = (y0, x) => { const near = Math.exp(-y0 * y0 * 1.2); const bump = (y0 >= 0 ? 0.42 : 0.12) * near * Math.exp(-x * x / 1.1) * Math.sign(y0 || 1);
  const down = -0.75 * near * smoothstep(-0.8, 2.6, x); return y0 + bump + down; };
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.wing = {
    build(sc) {
      const g = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(airfoilShape(), { depth: 3, bevelEnabled: false, steps: 1, curveSegments: 40 }), std('#d6dbe6', 0.25, 0.8)); wing.geometry.translate(0, 0, -1.5); wing.rotation.z = -AOA; g.add(wing);
      const lines = []; const Ys = [-1.6, -1.1, -0.65, -0.3, 0.3, 0.6, 0.95, 1.4, 1.9];
      Ys.forEach((y0, k) => { const pts = []; for (let i = 0; i <= 60; i++) { const x = -4.5 + i / 60 * 9; pts.push(V(x, stream(y0, x), 1.6)); }
        const tub = pathTube(new THREE.CatmullRomCurve3(pts), 0.012, y0 > 0 ? '#62f0ff' : '#9b8cff', 1.0); tub.material.uniforms.uOp.value = 0.35; g.add(tub); lines.push({ tub, y0 }); });
      const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 160); g.add(parts);
      const pairA = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8), glowMat('#62f0ff', 2.5)), pairB = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8), glowMat('#ff7ab8', 2.5)); g.add(pairA, pairB);
      const lift = arrow('#ffd84d', 2.2, 0.08); g.add(lift);
      const downs = [...Array(5)].map(() => { const a = arrow('#62f0ff', 1, 0.05); a.rotation.z = Math.PI + 0.35; g.add(a); return a; });
      const pr = [['#3aa0ff', 1], ['#ff5a4d', -1]].map(([c, s]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: C(c) }, uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: `uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float a=smoothstep(.5,0.,length(vUv-.5))*uA; gl_FragColor=vec4(uC*a,a); }` }));
        m.scale.set(1.4, 0.55, 1); m.position.set(0, s * 0.75, -0.2); g.add(m); return m; });
      const ov = new THREE.Group(); stage.overlay.add(ov); const lLo = new Label(ov, 'LOW PRESSURE', { size: 40 }), lHi = new Label(ov, 'HIGH PRESSURE', { size: 40, accent: true }), lM = new Label(ov, 'MEET?', { size: 46, accent: true });
      g.userData = { wing, lines, parts, pairA, pairB, lift, downs, pr, lLo, lHi, lM, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; [u.pairA, u.pairB, u.lift].forEach(o => o.visible = false); u.downs.forEach(a => a.visible = false); u.pr.forEach(p => p.material.uniforms.uA.value = 0);
      [u.lLo, u.lHi, u.lM].forEach(l => l.update(stage, V(), 0));
      let flowK = 1, lineOp = 0.35;
      // flow particles: faster above the wing (that's why the top air arrives first)
      const r = rng(2), p = V();
      for (let i = 0; i < 160; i++) { const y0 = (r() - .5) * 4.2; const sp = 1 + (y0 > 0 ? 0.55 : 0) * Math.exp(-y0 * y0); const ph = (t * 0.22 * sp + r()) % 1; const x = -4.5 + ph * 9;
        p.set(x, stream(y0, x), (r() - .5) * 2.4); setInstance(u.parts, i, p, flowK * (0.6 + r() * 0.6), [0, 0, 0]); u.parts.setColorAt(i, (y0 > 0 ? C('#9ff4ff') : C('#c9b8ff')).multiplyScalar(1.6)); }
      u.parts.instanceMatrix.needsUpdate = true; u.parts.instanceColor.needsUpdate = true;
      if (mode === 'hero') { look(V(lerp(-3.5, 1.5, ease.outCubic(lt / dur)), lerp(2.5, 1, lt / dur), lerp(5, 8.5, ease.outCubic(lt / dur))), V(0, 0, 0)); u.lift.visible = true; u.lift.position.set(0, 0.25, 0); u.lift.setLength(1.6 + 0.2 * Math.sin(t * 4)); }
      else if (mode === 'myth' || mode === 'early') {
        look(V(0, 0.6, 7.5), V(0, 0, 0)); const k = remap(lt, 0.5, dur - 0.4); const xs = -2.2;
        const top = mode === 'early' ? 1.6 : 1.0, xa = lerp(xs, 3.5, clamp(k * top)), xb = lerp(xs, 3.5, k);
        u.pairA.visible = u.pairB.visible = true; u.pairA.position.set(xa, stream(0.3, xa) + 0.0, 1.8); u.pairB.position.set(xb, stream(-0.3, xb), 1.8);
        if (mode === 'myth') u.lM.update(stage, V(1.25, -0.25, 1.8), clamp((lt - 2.0) / 0.3), 0, 0);
      }
      else if (mode === 'turn') { look(V(1.5, 0.8, 8), V(0.6, -0.4, 0)); u.downs.forEach((a, i) => { a.visible = true; a.position.set(1.3 + i * 0.45, -0.3 - i * 0.12, 1.8); a.setLength(0.7 + 0.15 * Math.sin(t * 5 + i)); }); lineOp = 0.7; }
      else if (mode === 'pressure') { look(V(-1, 0.4, 7.5), V(0, 0, 0)); const a = ease.outCubic(remap(lt, 0.2, 1.0)); u.pr[0].material.uniforms.uA.value = a * 0.9; u.pr[1].material.uniforms.uA.value = a * 0.9;
        u.lLo.update(stage, V(0, 1.15, 0), a, 0, 0); u.lHi.update(stage, V(0, -1.0, 0), a, 0, 0); }
      else if (mode === 'up') { look(V(lerp(2, -2, lt / dur), 1.2, 8.5), V(0, 0.2, 0)); u.lift.visible = true; u.lift.position.set(0, 0.25, 0); u.lift.setLength(lerp(0.5, 2.4, ease.outBack(remap(lt, 0.4, 1.2))));
        u.downs.forEach((a, i) => { a.visible = true; a.position.set(1.3 + i * 0.45, -0.3 - i * 0.12, 1.8); a.setLength(0.7); }); g.position.y = 0.3 * ease.outCubic(remap(lt, 0.8, dur)); }
      if (mode !== 'up') g.position.y = 0;
      u.lines.forEach(l => l.tub.material.uniforms.uOp.value = lineOp);
    },
  };
  return S;
}
