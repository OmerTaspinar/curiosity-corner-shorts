import { THREE, PAL, clamp, lerp, remap, ease, rng, soundRing, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, floor, fresnelMat, lathe, pathTube } from '/engine/props.js';

const shellMat = () => new THREE.ShaderMaterial({ uniforms: { uCrack: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `uniform float uCrack; varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ float s=fract(vUv.y*7.+vUv.x*1.); vec3 c=mix(vec3(.55,.35,.2),vec3(.95,.85,.7),smoothstep(.3,.7,s));
    float l=max(dot(normalize(vN),normalize(vec3(.4,.9,.5))),0.)*.8+.25; float cr=step(.97,fract(vUv.x*9.+sin(vUv.y*20.)*.3))*uCrack; c=mix(c*l,vec3(1.,.95,.6)*2.,cr); gl_FragColor=vec4(c,1.); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  function shrimp() {
    const g = new THREE.Group(); const cols = ['#2fd18a', '#2fb8d1', '#ff7a3d', '#ff4d6d', '#ffd84d'];
    for (let i = 0; i < 9; i++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(0.38 - i * 0.022, 24, 12), std(cols[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 0], 0.35, 0.3)); seg.scale.set(0.7, 0.75, 1); seg.position.set(-i * 0.4, 0.05 * Math.sin(i), 0); g.add(seg);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.02, 0.025, 6, 24), std('#ff7a3d', 0.4, 0.2)); band.rotation.y = Math.PI / 2; band.position.copy(seg.position).add(V(-0.12, 0, 0)); g.add(band); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 3), std('#2fb8d1', 0.3, 0.3)); tail.rotation.z = Math.PI / 2; tail.scale.z = 0.3; tail.position.set(-3.75, 0, 0); g.add(tail);
    [-1, 1].forEach(s => { const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), std('#2fd18a', .5)); stalk.position.set(0.3, 0.45, s * 0.12); stalk.rotation.z = -0.3; g.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 8), std('#3a8cff', 0.2, 0.3, { emissive: '#103a7a' })); eye.scale.set(1.2, 0.8, 0.8); eye.position.set(0.38, 0.65, s * 0.12); g.add(eye);
      const strip = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 20), std('#ffd84d', .3)); strip.position.copy(eye.position); strip.rotation.y = Math.PI / 2; g.add(strip); });
    // raptorial appendage: shoulder pivot -> forearm -> club
    const arm = new THREE.Group(); arm.position.set(0.35, -0.15, 0.25); g.add(arm);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 6, 12), std('#ff4d6d', .35, .2)); upper.position.set(0.3, -0.05, 0); upper.rotation.z = Math.PI / 2; arm.add(upper);
    const fore = new THREE.Group(); fore.position.set(0.6, -0.05, 0); arm.add(fore);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 6, 12), std('#ff7a3d', .35, .2)); lower.position.set(0, -0.25, 0); fore.add(lower);
    const club = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12), std('#ff4d6d', 0.25, 0.4, { emissive: '#3a0010' })); club.scale.set(1, 1.3, 0.8); club.position.set(0, -0.55, 0); fore.add(club);
    const spring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 24), glowMat('#ffd84d', 1.8)); spring.position.set(0.55, 0.0, 0.05); arm.add(spring);
    g.userData = { arm, fore, club, spring }; return g;
  }
  const S = {};
  S.shrimp = {
    build(sc) {
      const g = new THREE.Group(); const sh = shrimp(); sh.position.set(0.2, 0.2, 0); g.add(sh);
      const sand = floor('#2a3b3a', 9, 0.3); sand.position.y = -0.85; g.add(sand);
      const snail = new THREE.Group(); const sm = shellMat(); const shell = lathe([[0, 0], [0.42, 0.05], [0.5, 0.25], [0.38, 0.5], [0.22, 0.75], [0.1, 0.95], [0, 1.05]], sm, 48); shell.rotation.z = -1.1; snail.add(shell); snail.position.set(1.85, -0.55, 0.25); g.add(snail);
      const bub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), fresnelMat({ color: '#bff4ff', body: 0.15, rim: 1.6 })); g.add(bub);
      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), glowMat('#ffffff', 4)); g.add(flash);
      const rings = [0, 1, 2].map(() => { const r = soundRing(C('#bff4ff')); g.add(r); return r; });
      const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 6, 4), glowMat('#9fe8ff', 1.2, { blending: THREE.AdditiveBlending, depthWrite: false }), 120); g.add(motes);
      const trail = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 48, 1.6), glowMat('#ffffff', 2, { blending: THREE.AdditiveBlending, depthWrite: false })); g.add(trail);
      const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.07), std('#d9c7a6', 0.6), 80); g.add(shards);
      g.userData = { sh, snail, sm, bub, flash, rings, motes, trail, shards }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode, A = u.sh.userData;
      u.bub.visible = u.flash.visible = u.trail.visible = u.shards.visible = false; u.snail.visible = true; u.sm.uniforms.uCrack.value = 0;
      // strike: arm cocked (-1.3) -> hits (+0.35) in ~60 ms; slow motion factor sm
      let strikeT = 99, slow = 1;
      if (mode === 'hero') strikeT = 0.9; if (mode === 'speed') { strikeT = 0.8; slow = 8; } if (mode === 'bubble' || mode === 'collapse') { strikeT = mode === 'bubble' ? 0.3 : -0.9; slow = 3.5; } if (mode === 'outro') { strikeT = 0.4; slow = 1.5; }
      const d = (lt - strikeT) / slow, k = clamp(d / 0.06); const ang = mode === 'spring' ? -1.3 - 0.15 * ease.inOutSine(remap(lt, 0.3, 1.5)) : lerp(-1.3, 0.35, k * k);
      A.arm.rotation.z = 0; A.fore.rotation.z = ang; A.spring.scale.set(1, mode === 'spring' ? 1 - 0.45 * ease.inOutSine(remap(lt, 0.3, 1.5)) : (k > 0 ? 1 : 0.6), 1);
      A.spring.material.color.set('#ffd84d').multiplyScalar(mode === 'spring' ? 1.8 + 1.5 * ease.inOutSine(remap(lt, 0.3, 1.5)) : 1.2);
      const clubW = V(); A.club.getWorldPosition(clubW);
      const hitPt = u.snail.position.clone().add(V(-0.28, 0.25, 0));
      if (d > 0) { u.trail.visible = d < 0.3; u.trail.position.copy(A.fore.getWorldPosition(V())); u.trail.rotation.set(0, 0, -1.6 - ang * 0.2); u.trail.material.opacity = 1 - d / 0.3; }
      if (mode === 'hero') { look(V(lerp(3.0, 4.4, ease.outCubic(lt / dur)), lerp(0.6, 1.5, lt / dur), lerp(2.4, 4.6, ease.outCubic(lt / dur))), V(0.8, -0.2, 0)); }
      else if (mode === 'speed') look(V(3.6, 0.6, 3.2), V(1.1, -0.3, 0.1));
      else if (mode === 'spring') look(V(2.3, 0.9, 2.6), V(0.8, -0.2, 0.1));
      else if (mode === 'bubble' || mode === 'collapse') look(V(2.8, 0.3, 2.8), V(1.5, -0.35, 0.2));
      else if (mode === 'outro') look(V(lerp(4.5, 5.5, lt / dur), lerp(1.6, 2.2, lt / dur), lerp(4.5, 5.5, lt / dur)), V(0.0, -0.2, 0));
      // cavitation bubble: forms at impact, collapses ~0.35 s later (in strike-time units)
      const bt = d - 0.06; const bubR = bt > 0 && bt < 0.4 ? Math.sin(Math.PI * bt / 0.4) * 0.28 : 0; u.bub.visible = bubR > 0.01 && (mode !== 'hero' || true); u.bub.position.copy(hitPt).add(V(-0.05, 0, 0)); u.bub.scale.setScalar(Math.max(0.01, bubR / 0.3));
      const ct = bt - 0.4; if (ct > 0 && ct < 0.15) { u.flash.visible = true; u.flash.position.copy(hitPt); u.flash.scale.setScalar(1 + ct * 30); u.flash.material.opacity = 1 - ct / 0.15; }
      const ringT = mode === 'collapse' ? ct : (d - 0.06); u.rings.forEach((r, i) => { r.position.copy(hitPt); r.lookAt(stage.camera.position); r.update(ringT * slow - i * 0.08, 0.6, 0.05, 0.7); });
      if (d > 0.06) u.sm.uniforms.uCrack.value = clamp((d - 0.06) / 0.2);
      if (mode === 'outro' && d > 0.5) { u.snail.visible = d < 0.55; u.shards.visible = true; const r = rng(3), p = V(); const q = clamp((d - 0.5) / 1.2);
        for (let i = 0; i < 80; i++) { const dir = V(r() - .2, r() * 0.8, r() - .5).normalize(); p.copy(u.snail.position).addScaledVector(dir, ease.outCubic(q) * (0.6 + r() * 1.4)); p.y = Math.max(-0.82, p.y - q * q); setInstance(u.shards, i, p, 0.7 + r(), [i + q * 4, i, 0]); } u.shards.instanceMatrix.needsUpdate = true; }
      if (d > 0 && d < 0.2) stage.shake = (mode === 'hero' || mode === 'outro') ? 1.8 : 0.4;
      const r = rng(7), p = V(); for (let i = 0; i < 120; i++) { p.set((r() - .5) * 8, ((t * 0.08 + r()) % 1) * 4 - 1, (r() - .5) * 4 - 1); setInstance(u.motes, i, p, 0.6 + r(), [0, 0, 0]); } u.motes.instanceMatrix.needsUpdate = true;
      stage.bgMat.uniforms.uGlowPos.value.set(0.5, 0.75);
    },
  };
  return S;
}
