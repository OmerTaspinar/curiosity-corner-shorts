// Episode visuals: "Why your stomach growls". Each scene: build() once, update(lt, dur, t) per frame.
import { THREE, PAL, clamp, lerp, remap, ease, spring, rng, tubeGeometry, capSphere, organMaterial, bubbleMaterial,
  soundRing, crumbs, setInstance } from '/engine/kit.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- shared anatomy ----
const STOMACH_PTS = [V(-0.55, 2.45, 0), V(-0.48, 1.85, 0.05), V(-0.62, 1.15, 0.12), V(-0.88, 0.35, 0.12), V(-0.72, -0.5, 0.05),
  V(-0.15, -1.0, 0), V(0.55, -1.0, -0.05), V(1.05, -0.62, -0.05), V(1.25, -0.12, 0), V(1.22, 0.32, 0)];
function stomachRadius(u) {
  const eso = 0.17, body = 0.88;
  let r = lerp(eso, body, smooth(0.1, 0.33, u));
  r = lerp(r, 0.55, smooth(0.55, 0.8, u));
  r = lerp(r, 0.2, smooth(0.8, 0.93, u));
  return r * (1 + 0.06 * Math.sin(u * 40) * smooth(0.2, 0.8, u) * 0); // keep smooth
}
function stomach(opts = {}) {
  const curve = new THREE.CatmullRomCurve3(STOMACH_PTS, false, 'catmullrom', 0.5);
  const mat = organMaterial(opts);
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(tubeGeometry(curve, stomachRadius, 360, 64), mat);
  g.add(mesh, capSphere(curve, 0, stomachRadius(0) * 0.98, mat), capSphere(curve, 1, stomachRadius(1) * 0.98, mat));
  g.userData = { curve, mat, mesh };
  return g;
}
// stomach + duodenum + coiled small intestine as one continuous tube (for the travelling wave)
function gut(opts = {}) {
  const pts = STOMACH_PTS.slice(0, 9).concat([V(1.38, -0.55, 0), V(1.05, -1.3, 0.05)]);
  const rows = [-1.62, -2.12, -2.62, -3.12, -3.62];
  rows.forEach((y, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    pts.push(V(0.0 * dir, y - 0.03, 0.1 * dir), V(1.1 * dir, y, 0), V(1.38 * dir, y - 0.25, -0.05));
    if (i < rows.length - 1) pts.push(V(1.1 * dir, y - 0.5 + 0.0, 0));
  });
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const L = curve.getLength(), Ls = new THREE.CatmullRomCurve3(STOMACH_PTS.slice(0, 9), false, 'catmullrom', 0.5).getLength();
  const us = Ls / L; // where the stomach ends along the full tube
  const rad = u => u < us ? stomachRadius(u / us * 0.93) : lerp(0.21, 0.16, smooth(us, us + 0.08, u));
  const mat = organMaterial({ waveW: 0.018, ...opts });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tubeGeometry(curve, rad, 1400, 40), mat), capSphere(curve, 0, rad(0), mat), capSphere(curve, 1, rad(1), mat));
  g.userData = { curve, mat, us, rad };
  return g;
}

export default function episode(stage, EP) {
  const { scene, camera } = stage;
  const growlAt = t => EP.env.growl[Math.min(EP.env.growl.length - 1, Math.max(0, Math.round(t * 30)))] || 0;
  const look = (p, target = V(0, 0, 0)) => { camera.position.copy(p); camera.lookAt(target); };
  const S = {};

  // ---------- 1. HOOK: hero stomach, growl shakes it, sound rings burst out ----------
  S.stomachHero = {
    build() {
      const g = new THREE.Group(); const st = stomach({ rimAmt: 1.3 }); st.position.set(-0.15, -1.0, 0); g.add(st);
      const rings = [...Array(6)].map(() => { const r = soundRing(); r.position.copy(st.position); g.add(r); return r; });
      g.userData = { st, rings }; return g;
    },
    update(g, lt, dur, t) {
      const { st, rings } = g.userData, gr = growlAt(t);
      look(V(Math.sin(lt * .4) * 0.6, 0.1, lerp(15.5, 12.6, ease.outCubic(lt / dur))), V(0, -0.75, 0));
      st.rotation.set(0.1, -0.35 + lt * 0.18, 0.04);
      const m = st.userData.mat.uniforms; m.uTime.value = t; m.uPulse.value = gr * 1.6; m.uGlow.value = gr * 0.35;
      st.scale.setScalar(1 + gr * 0.05);
      stage.shake = gr * 1.6;
      rings.forEach((r, i) => r.update(lt - i * 0.28, 1.1, 1.2, 3.0));
      stage.bgMat.uniforms.uGlowAmt.value = 0.3 + gr * 0.35;
    },
  };

  // ---------- 2. TRASH: x-ray stomach, a sweep wave pushes crumbs out of the exit ----------
  S.stomachSweep = {
    build() {
      const g = new THREE.Group(); const st = stomach({ xray: 0.85, depthWrite: false, side: THREE.DoubleSide, rimAmt: 1.6, waveW: 0.06 });
      st.position.set(-0.15, -1.0, 0); g.add(st);
      const cr = crumbs(70, 9); st.add(cr); cr.renderOrder = -1; st.userData.mesh.renderOrder = 2;
      g.userData = { st, cr }; return g;
    },
    update(g, lt, dur, t) {
      const { st, cr } = g.userData; const curve = st.userData.curve;
      look(V(lerp(-1.2, 0.8, ease.inOutSine(lt / dur)), 0.0, 12.2), V(0, -0.8, 0));
      st.rotation.set(0.12, -0.25 + lt * 0.12, 0.02);
      const wave = lerp(0.1, 1.05, ease.inOutSine(remap(lt, 0.2, dur + 0.4)));
      const m = st.userData.mat.uniforms; m.uTime.value = t; m.uWavePos.value = wave; m.uWaveAmp.value = 0.55;
      const front = wave + 0.09, pos = new THREE.Vector3();
      cr.userData.items.forEach((c, i) => {
        const base = 0.22 + c.u * 0.62; let u = base, out = 0;
        if (base < front) { u = front + (base - 0.22) * 0.06; }
        if (u > 0.97) { out = (u - 0.97) * 6; u = 0.999; }
        const p = curve.getPointAt(Math.min(u, 0.999)); const r = stomachRadius(u) * 0.55;
        pos.set(p.x + c.off[0] * r * 2, p.y + c.off[1] * r * 2, p.z + c.off[2] * r * 2);
        if (out > 0) { pos.x += out * 1.2; pos.y -= out * out * 1.5; }
        const s = c.s * (out > 0 ? Math.max(0, 1 - out * 0.8) : 1) * 2.0;
        setInstance(cr, i, pos, s, [c.rot[0] + t * c.spin, c.rot[1] + t * c.spin, c.rot[2]]);
      });
      cr.instanceMatrix.needsUpdate = true;
      stage.shake = 0; stage.bgMat.uniforms.uGlowAmt.value = 0.3;
    },
  };

  // ---------- 3. CLOCK: 3D progress ring sweeps to 2 hours while the stomach empties ----------
  S.clock = {
    build() {
      const g = new THREE.Group(); g.rotation.x = -0.32;
      const arcMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, uniforms: { uP: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform float uP; varying vec2 vUv; void main(){ if(vUv.x>uP) discard;
          vec3 c=mix(vec3(.38,.94,1.),vec3(1.,.85,.3),vUv.x); float head=smoothstep(uP-.04,uP,vUv.x);
          gl_FragColor=vec4(c*(1.6+head*2.5),1.); }` });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.085, 24, 256), arcMat);
      arc.rotation.z = Math.PI / 2; arc.scale.x = -1; g.add(arc);
      const track = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.05, 16, 256), new THREE.MeshBasicMaterial({ color: 0x3a2f6b, transparent: true, opacity: .8 }));
      g.add(track);
      const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), new THREE.MeshBasicMaterial({ color: 0xb9b0ff, toneMapped: false }), 60);
      const tmp = new THREE.Object3D();
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0; tmp.position.set(Math.sin(a) * 2.45, Math.cos(a) * 2.45, 0); tmp.rotation.z = -a; tmp.scale.set(1, big ? 1.6 : 0.8, 1); tmp.updateMatrix(); ticks.setMatrixAt(i, tmp.matrix); }
      g.add(ticks);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false })); g.add(head);
      const st = stomach({ rimAmt: 1.2, xray: 0.6, depthWrite: false, side: THREE.DoubleSide }); st.scale.setScalar(0.62); st.position.set(-0.1, -0.05, 0); g.add(st);
      const cr = crumbs(40, 4); st.add(cr); cr.renderOrder = -1; st.userData.mesh.renderOrder = 2;
      g.userData = { arcMat, head, st, cr, ticks }; return g;
    },
    update(g, lt, dur, t) {
      const { arcMat, head, st, cr } = g.userData;
      look(V(0.4 * Math.sin(lt * .5), 0.4, lerp(12.5, 11.2, ease.outCubic(lt / dur))), V(0, -0.2, 0));
      g.rotation.y = lerp(-0.35, 0.2, ease.inOutSine(lt / dur)); g.position.y = -0.25;
      const p = ease.inOutCubic(remap(lt, 0.25, dur - 0.5)); arcMat.uniforms.uP.value = p;
      const a = p * Math.PI * 2; head.position.set(Math.sin(a) * 2.05, Math.cos(a) * 2.05, 0); head.visible = p > 0.005;
      head.scale.setScalar(1 + 0.25 * Math.sin(t * 20));
      st.rotation.y = lt * 0.4; const m = st.userData.mat.uniforms; m.uTime.value = t; m.uGlow.value = 0.1;
      const curve = st.userData.curve, pos = new THREE.Vector3();
      cr.userData.items.forEach((c, i) => {
        const u = 0.25 + c.u * 0.55, P = curve.getPointAt(u), r = stomachRadius(u) * 0.55;
        pos.set(P.x + c.off[0] * r * 2, P.y + c.off[1] * r * 2 + Math.sin(t * 2 + c.seed * 9) * 0.03, P.z + c.off[2] * r * 2);
        const gone = clamp((p - c.seed * 0.85) / 0.12);          // crumbs disappear as time passes
        setInstance(cr, i, pos, c.s * 1.5 * (1 - gone), [c.rot[0] + t * c.spin, c.rot[1], c.rot[2]]);
      });
      cr.instanceMatrix.needsUpdate = true;
      stage.shake = 0; stage.bgMat.uniforms.uGlowAmt.value = 0.25;
    },
  };

  // ---------- 4. PERISTALSIS: glowing contraction wave travels from stomach through the intestines ----------
  S.peristalsis = {
    build() {
      const g = new THREE.Group(); const gt = gut({ xray: 0.55, depthWrite: false, side: THREE.DoubleSide, rimAmt: 1.4, waveGlow: 1.6 });
      g.add(gt); const cr = crumbs(120, 21); gt.add(cr); cr.renderOrder = -1; gt.children[0].renderOrder = 2;
      g.userData = { gt, cr }; return g;
    },
    update(g, lt, dur, t) {
      const { gt, cr } = g.userData; const { curve, mat, rad } = gt.userData;
      const wave = lerp(0.04, 1.02, remap(lt, 0.2, dur));
      // camera follows the wave down the body
      const wp = curve.getPointAt(clamp(wave, 0, 1));
      const camY = lerp(-0.2, -2.6, ease.inOutSine(remap(lt, 0.3, dur - 0.3)));
      look(V(0.6 * Math.sin(lt * 0.35), camY + 0.6, lerp(12.8, 13.2, ease.inOutSine(lt / dur))), V(0, camY, 0));
      gt.rotation.set(0.05, -0.18 + 0.1 * Math.sin(lt * 0.4), 0); gt.position.set(-0.1, 0.25, 0);
      const m = mat.uniforms; m.uTime.value = t; m.uWavePos.value = wave; m.uWaveAmp.value = 0.75;
      const front = wave + 0.03, pos = new THREE.Vector3();
      cr.userData.items.forEach((c, i) => {
        const base = 0.08 + c.u * 0.9; let u = base < front ? front + (base - 0.08) * 0.012 : base;
        u = Math.min(u, 0.995); const P = curve.getPointAt(u), r = rad(u) * 0.45;
        pos.set(P.x + c.off[0] * r * 2, P.y + c.off[1] * r * 2, P.z + c.off[2] * r * 2);
        setInstance(cr, i, pos, c.s * (u < 0.3 ? 1.3 : 0.75), [c.rot[0] + t * c.spin, c.rot[1] + t, c.rot[2]]);
      });
      cr.instanceMatrix.needsUpdate = true;
      stage.shake = growlAt(t) * 0.6; stage.bgMat.uniforms.uGlowAmt.value = 0.3;
    },
  };

  // ---------- 5. GAS: close-up glass intestine, constriction rings squeeze air bubbles ----------
  const ringTimes = EP.scene('gas').beats; // when a constriction passes the centre (y=0)
  S.bubbles = {
    build() {
      const g = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([V(0.3, 5.5, -0.5), V(-0.3, 2.5, 0), V(0.25, 0, 0.2), V(-0.25, -2.5, 0), V(0.3, -5.5, -0.5)]);
      const R = 0.78;
      const mat = organMaterial({ xray: 0.92, depthWrite: false, side: THREE.DoubleSide, rimAmt: 1.8, waveW: 0.035, waveGlow: 1.4, colA: new THREE.Color('#ff6f8a'), colB: new THREE.Color('#ff9a6b') });
      const tube = new THREE.Mesh(tubeGeometry(curve, () => R, 300, 64), mat); tube.renderOrder = 2; g.add(tube);
      const N = 70, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 16), bubbleMaterial(), N); g.add(bub);
      const r = rng(17); const items = [...Array(N)].map(() => ({ y: r() * 11 - 5.5, a: r() * 6.28, rr: r() * 0.45, s: 0.1 + r() * 0.2, w: r() * 6 }));
      const rings = ringTimes.map(() => [0, 1, 2].map(() => { const sr = soundRing(); sr.rotation.x = Math.PI / 2; g.add(sr); return sr; }));
      g.userData = { curve, mat, bub, items, rings, R }; return g;
    },
    update(g, lt, dur, t) {
      const { curve, mat, bub, items, rings, R } = g.userData;
      look(V(3.6, 1.0, 10.6), V(0, -0.6, 0)); g.rotation.set(0, lerp(-0.15, 0.15, lt / dur), lerp(-0.12, 0.05, lt / dur));
      // constriction centre y(t): moves top->bottom, passes 0 at each ring time (speed 3.2 u/s)
      const speed = 3.2, ys = ringTimes.map(rt => -(lt - rt) * speed);
      const active = ys.reduce((best, y) => Math.abs(y) < Math.abs(best) ? y : best, 99);
      const uOf = y => clamp((5.5 - y) / 11);
      mat.uniforms.uTime.value = t; mat.uniforms.uWavePos.value = uOf(active); mat.uniforms.uWaveAmp.value = 0.9;
      const tmp = new THREE.Vector3(), sc = new THREE.Vector3();
      items.forEach((b, i) => {
        let y = b.y - lt * 0.25; let push = 0;
        ys.forEach(yc => { push += 1.6 * clamp((y - yc) / 1.6 + 1, 0, 1) * (yc < y + 1.6 ? 1 : 0); });
        y -= Math.min(push, 3.2); y = ((y + 5.5) % 11 + 11) % 11 - 5.5;
        const near = Math.exp(-Math.pow((y - active) / 0.6, 2));
        const P = curve.getPointAt(uOf(y)); const rr = b.rr * R * (1 - near * 0.6);
        tmp.set(P.x + Math.cos(b.a + t * .5) * rr, P.y, P.z + Math.sin(b.a + t * .5) * rr);
        const s = b.s * (1 + 0.1 * Math.sin(t * 6 + b.w));
        sc.set(s * (1 + near * 0.5), s * (1 - near * 0.45), s * (1 + near * 0.5));
        setInstance(bub, i, tmp, sc, [0, 0, 0]);
      });
      bub.instanceMatrix.needsUpdate = true;
      rings.forEach((set, k) => set.forEach((sr, j) => { const age = lt - ringTimes[k] + 0.05 - j * 0.15; sr.position.copy(curve.getPointAt(0.5)); sr.update(age, 0.9, 0.85, 2.6); }));
      stage.shake = growlAt(t) * 0.5; stage.bgMat.uniforms.uGlowAmt.value = 0.28;
    },
  };

  // ---------- 6. ECHO: stomach rumbles, circular audio-reactive bars and expanding waves ----------
  S.soundwave = {
    build() {
      const g = new THREE.Group(); const st = stomach({ rimAmt: 1.5 }); st.scale.setScalar(0.72); st.position.set(-0.1, -0.15, 0); g.add(st);
      const NB = 84; const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB);
      for (let i = 0; i < NB; i++) bars.setColorAt(i, new THREE.Color().lerpColors(PAL.cyan, PAL.accentC, Math.abs(Math.sin(i / NB * Math.PI))));
      bars.instanceColor.needsUpdate = true; g.add(bars);
      const rings = [...Array(10)].map(() => { const r = soundRing(new THREE.Color('#ff9fb4')); g.add(r); return r; });
      g.userData = { st, bars, rings, NB }; return g;
    },
    update(g, lt, dur, t) {
      const { st, bars, rings, NB } = g.userData, gr = growlAt(t);
      look(V(0, 0.2, lerp(11.5, 10.5, lt / dur)), V(0, -0.3, 0)); g.position.y = -0.55;
      g.rotation.set(0, 0, 0); st.rotation.set(0.1, -0.3 + lt * 0.15, 0);
      const m = st.userData.mat.uniforms; m.uTime.value = t; m.uPulse.value = gr * 2; m.uGlow.value = gr * 0.4;
      st.scale.setScalar(0.72 * (1 + gr * 0.06));
      const tmp = new THREE.Object3D();
      for (let i = 0; i < NB; i++) {
        const a = i / NB * Math.PI * 2;
        const h = 0.12 + gr * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7 + t * 9) * Math.sin(i * 0.37 - t * 5))) * 1.5 + 0.05 * Math.sin(t * 3 + i);
        const rad = 2.25 + h / 2;
        tmp.position.set(Math.sin(a) * rad, Math.cos(a) * rad, 0); tmp.rotation.set(0, 0, -a); tmp.scale.set(1, h, 1); tmp.updateMatrix(); bars.setMatrixAt(i, tmp.matrix);
      }
      bars.instanceMatrix.needsUpdate = true;
      rings.forEach((r, i) => r.update(lt - i * 0.22, 1.3, 1.6, 4.2));
      stage.shake = gr * 1.2; stage.bgMat.uniforms.uGlowAmt.value = 0.3 + gr * 0.3;
    },
  };

  // ---------- 7. OUTRO: clean, sparkling stomach; camera returns to the hook framing (loops) ----------
  S.stomachOutro = {
    build() {
      const g = new THREE.Group(); const st = stomach({ rimAmt: 1.4 }); st.position.set(-0.15, -1.0, 0); g.add(st);
      const N = 60, sp = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false }), N);
      const r = rng(31); const items = [...Array(N)].map(() => ({ p: V((r() - .5) * 4.2, (r() - .5) * 5, (r() - .5) * 2 + 0.6), ph: r() * 6.28, s: 0.03 + r() * 0.05 }));
      g.add(sp); g.userData = { st, sp, items }; return g;
    },
    update(g, lt, dur, t) {
      const { st, sp, items } = g.userData;
      const kt = EP.kickerTime('outro') - EP.scene('outro').t0;
      look(V(Math.sin(lt * .4) * 0.6, 0.1, lerp(12.6, 15.5, ease.inOutSine(remap(lt, dur - 1.6, dur)))), V(0, -0.75, 0));
      st.rotation.set(0.1, -0.35 + (lt - dur) * 0.18 + 0.0, 0.04);
      const clean = ease.outCubic(remap(lt, kt - 0.1, kt + 0.6));
      const m = st.userData.mat.uniforms; m.uTime.value = t; m.uGlow.value = 0.05 + clean * 0.25 * (1 - remap(lt, dur - 1.2, dur));
      m.uPulse.value = growlAt(t) * 1.2;
      const tmp = new THREE.Vector3();
      items.forEach((it, i) => { const tw = Math.max(0, Math.sin(t * 3 + it.ph)) ** 3 * clean;
        tmp.copy(it.p); tmp.y += Math.sin(t * .6 + it.ph) * 0.1; setInstance(sp, i, tmp, it.s * tw * 1.6, [t + it.ph, t * 1.3, 0]); });
      sp.instanceMatrix.needsUpdate = true;
      stage.shake = growlAt(t) * 0.8; stage.bgMat.uniforms.uGlowAmt.value = 0.3 + clean * 0.12;
    },
  };

  return S;
}
