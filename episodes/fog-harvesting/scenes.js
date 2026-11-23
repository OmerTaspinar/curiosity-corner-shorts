import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label } from '/engine/kit.js';
import { V, C, std, glowMat, fresnelMat, floor, waterPlane } from '/engine/props.js';

const meshMat = () => new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uWet: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uWet; varying vec2 vUv; void main(){ vec2 g=abs(fract(vUv*vec2(60.,30.))-.5); float l=1.-smoothstep(.0,.12,min(g.x,g.y)); vec3 c=mix(vec3(.15,.15,.18),vec3(.4,.8,1.),uWet*.6); gl_FragColor=vec4(c*1.2,l*.85+.06); }` });

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const S = {};
  S.fog = {
    build(sc) {
      const g = new THREE.Group();
      const sand = floor('#5a4330', 14, 0.3); sand.position.y = -1.5; g.add(sand);
      const r = rng(3); for (let i = 0; i < 7; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(1.5 + r() * 2, 32, 16), std('#6b4f36', 0.95)); h.scale.y = 0.35 + r() * 0.2; h.position.set(2 + r() * 8, -1.5, -4 - r() * 6); g.add(h); }
      const sea = waterPlane(20, '#0b3c5c', 60); sea.position.set(-12, -1.6, -2); g.add(sea);
      const net = new THREE.Group(); const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), meshMat()); cloth.position.y = 0.6; net.add(cloth);
      [-1.65, 1.65].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 10), std('#6b4a2a', 0.8)); p.position.set(x, 0.1, 0); net.add(p); });
      const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 16, 1, true, 0, Math.PI), std('#9aa3b2', 0.4, 0.7, { side: THREE.DoubleSide })); gutter.rotation.set(0, 0, Math.PI / 2); gutter.rotation.x = Math.PI; gutter.position.y = -0.25; net.add(gutter);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 10), std('#9aa3b2', 0.4, 0.7)); pipe.position.set(1.65, -0.75, 0); net.add(pipe);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32, 1, true), fresnelMat({ color: '#cfe8ff', body: 0.08, rim: 0.9, side: THREE.DoubleSide })); tank.position.set(2.3, -0.9, 0.4); net.add(tank);
      const level = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1, 32), fresnelMat({ color: '#3aa0ff', body: 0.5, rim: 1.0 })); net.add(level);
      g.add(net);
      const fog = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 1), std('#e8eef5', 1, 0, { transparent: true, opacity: 0.03, depthWrite: false }), 110); g.add(fog);
      const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), fresnelMat({ color: '#bfe9ff', body: 0.4, rim: 1.5 }), 160); g.add(drops);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), glowMat('#ffd27a', 2.2)); sun.position.set(4, 4, -12); g.add(sun);
      g.userData = { net, cloth, level, fog, drops, sun };
      return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; let fogK = 1, netOn = 1, wet = 0, fill = 0, dropK = 0;
      if (mode === 'hero') { wet = 1; dropK = 1; fill = 0.5; look(V(lerp(-2, 1.5, lt / dur), lerp(0.4, 1.2, lt / dur), lerp(3.5, 6.5, ease.outCubic(lt / dur))), V(0.3, 0.1, 0)); }
      else if (mode === 'desert') { fogK = 0; netOn = 0; const a = lt * 0.12; look(V(Math.sin(a) * 9, 2.5, 9), V(2, -0.5, -4)); }
      else if (mode === 'roll') { fogK = ease.outCubic(remap(lt, 0, 1.2)); netOn = 0; look(V(-6, 1.5, 7), V(-1, 0, -1)); }
      else if (mode === 'net') { wet = 0.2; look(V(lerp(4, 2.5, lt / dur), 0.8, lerp(6, 5, lt / dur)), V(0.2, 0.2, 0)); }
      else if (mode === 'drip') { wet = 1; dropK = 1; look(V(0.8, 0.5, 2.2), V(0.2, 0.3, 0)); }
      else if (mode === 'tank') { wet = 1; dropK = 1; fill = ease.inOutSine(remap(lt, 0.2, dur)); look(V(3.2, 0.4, 4.2), V(1.4, -0.4, 0)); }
      u.net.visible = netOn > 0; u.cloth.material.uniforms.uWet.value = wet;
      const lv = Math.max(0.02, fill * 1.1); u.level.scale.y = lv; u.level.position.set(2.3, -1.5 + lv / 2, 0.4);
      const r = rng(9), p = V();
      for (let i = 0; i < 110; i++) { const ph = (t * (0.05 + r() * 0.04) + r()) % 1; p.set(lerp(-12, 10, ph), -0.8 + r() * 2.6, (r() - .5) * 6); setInstance(u.fog, i, p, fogK * (1 + r() * 1.8), [i, i * 2, 0]); }
      u.fog.instanceMatrix.needsUpdate = true;
      u.drops.visible = dropK > 0 && netOn > 0; if (u.drops.visible) { for (let i = 0; i < 160; i++) { const x = (r() - .5) * 3.0, y0 = 1.35 - r() * 1.4; const life = (t * (0.25 + r() * 0.2) + r()) % 1;
        const grow = clamp(life / 0.6), slide = clamp((life - 0.6) / 0.4); p.set(x, lerp(y0, -0.22, slide * slide), 0.03); setInstance(u.drops, i, p, 0.4 + grow * 1.2, [0, 0, 0]); } u.drops.instanceMatrix.needsUpdate = true; }
    },
  };
  return S;
}
