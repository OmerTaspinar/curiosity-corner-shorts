import { THREE, PAL, clamp, lerp, remap, ease, rng, setInstance, Label, DynText } from '/engine/kit.js';
import { V, C, std, glowMat, floor, planet, atmosphere, stars, pathTube } from '/engine/props.js';

export default function episode(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const paperMat = std('#c9c3b6', 0.85, 0);
  const winMat = new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; void main(){ vec2 g=vUv*vec2(5.,30.); vec2 f=fract(g); float w=step(.2,f.x)*step(f.x,.8)*step(.25,f.y)*step(f.y,.75); float on=step(.5,fract(sin(dot(floor(g),vec2(12.9,78.2)))*43758.)); gl_FragColor=vec4(vec3(.06,.06,.1)+w*on*vec3(1.,.8,.45)*.8,1.); }` });
  const S = {};
  S.paper = {
    build(sc) {
      const g = new THREE.Group(); g.add(stars(800, 60));
      const fl = floor('#1d1a33', 9, 0.6); fl.position.y = -1.5; g.add(fl);
      const halfA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 2.1), paperMat); halfA.position.x = -0.75; const hinge = new THREE.Group(); const halfB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 2.1), paperMat); halfB.position.x = 0.75; hinge.add(halfB);
      const sheet = new THREE.Group(); sheet.add(halfA, hinge); g.add(sheet);
      const layers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1, 2.1), paperMat, 128); g.add(layers);
      const ruler = new THREE.Group(); const rb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.05), glowMat('#ffd84d', 1.3)); ruler.add(rb); g.add(ruler);
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.8), paperMat); g.add(column);
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), winMat); g.add(bldg);
      const earth = planet({ r: 1.2, type: 'earth', seed: 3 }); const atmo = atmosphere(1.3, '#4fa8ff', 1.8); const moon = planet({ r: 0.35, type: 'moon', colA: '#9a9aa2', colB: '#5d5d66', seed: 2 }); g.add(earth, atmo, moon);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), glowMat('#f3efe6', 1.2)); g.add(beam);
      const ov = new THREE.Group(); stage.overlay.add(ov); const cnt = new DynText(ov, { size: 120, fill: PAL.accent, strokeW: 10 }); cnt.mesh.position.set(0, -170, 0);
      const lb = new Label(ov, '30-STORY BUILDING', { size: 40 }), lc = new Label(ov, '1 CM', { size: 46, accent: true }), lm = new Label(ov, 'MOON', { size: 44 });
      g.userData = { sheet, hinge, layers, ruler, column, bldg, earth, atmo, moon, beam, cnt, lb, lc, lm, ov }; return g;
    },
    update(g, lt, dur, t, sc) {
      const u = g.userData, mode = sc.mode; const hide = [u.sheet, u.layers, u.ruler, u.column, u.bldg, u.earth, u.atmo, u.moon, u.beam]; hide.forEach(o => o.visible = false);
      u.cnt.mesh.visible = false; [u.lb, u.lc, u.lm].forEach(l => l.update(stage, V(), 0)); u.earth.material.uniforms.uT.value = t;
      const stackLayers = (n, thick, y0 = -1.48) => { u.layers.visible = true; u.layers.count = Math.min(128, n); const tmp = new THREE.Object3D(); for (let i = 0; i < u.layers.count; i++) { tmp.position.set(0, y0 + thick * (i + 0.5), 0); tmp.scale.set(1, thick * 0.8, 1); tmp.rotation.y = (i % 2) * 0.01; tmp.updateMatrix(); u.layers.setMatrixAt(i, tmp.matrix); } u.layers.instanceMatrix.needsUpdate = true; };
      if (mode === 'hero') {
        u.earth.visible = u.atmo.visible = u.moon.visible = u.beam.visible = true; const k = ease.inOutCubic(remap(lt, 0.2, dur - 0.2));
        u.earth.position.set(0, -2.6, 0); u.moon.position.set(0.0, 5.5, -1); const top = lerp(-1.4, 5.2, k); u.beam.position.set(0, (-1.4 + top) / 2, 0); u.beam.scale.y = Math.max(0.01, top + 1.4);
        look(V(3, lerp(-0.2, 2.6, k), lerp(8, 12, k)), V(0, lerp(-0.8, 3.0, k), 0));
      } else if (mode === 'double') {
        u.sheet.visible = true; const n = Math.floor(remap(lt, 0.3, dur) * 3); const ph = (remap(lt, 0.3, dur) * 3) % 1;
        u.hinge.rotation.z = Math.PI * ease.inOutCubic(clamp(ph * 1.4)); u.sheet.scale.set(Math.pow(0.5, n), Math.pow(2, n) * 0.0 + 1 + n * 0.6, Math.pow(0.7, n)); u.sheet.position.y = -0.8;
        look(V(2.2, 3.6, 7), V(0, -0.8, 0)); u.cnt.mesh.visible = lt > 0.4; u.cnt.set('×' + Math.pow(2, n + (ph > 0.6 ? 1 : 0)) + '  thickness');
      } else if (mode === 'seven') {
        const n = Math.pow(2, Math.min(7, Math.floor(remap(lt, 0.2, dur - 0.8) * 8))); stackLayers(n, 0.018); look(V(3.2, 0.6, 6.5), V(0, -0.6, 0));
        u.ruler.visible = true; u.ruler.position.set(0.95, -1.48 + 128 * 0.018 / 2, 0.3); u.ruler.scale.y = 128 * 0.018; u.cnt.mesh.visible = true; u.cnt.set(n + ' layers');
        u.lc.update(stage, V(0.95, -1.48 + 128 * 0.018, 0.3), clamp((lt - 1.2) / 0.3), 60, 20);
      } else if (mode === 'tower') {
        u.column.visible = u.bldg.visible = true; const k = ease.outCubic(remap(lt, 0.2, dur - 0.5)); const H = lerp(0.1, 6.2, k);
        u.column.scale.y = H; u.column.position.set(-0.6, -1.5 + H / 2, 0); u.bldg.scale.y = 5.6; u.bldg.position.set(0.9, -1.5 + 2.8, 0); look(V(4, lerp(1, 2.5, k), 11), V(0, 1.2, 0));
        u.lb.update(stage, V(0.9, 4.2, 0), clamp((lt - 0.6) / 0.3), 0, 40); u.cnt.mesh.visible = true; u.cnt.set(Math.round(H / 6.2 * 105) + ' m');
      } else if (mode === 'moon') {
        u.earth.visible = u.atmo.visible = u.moon.visible = u.beam.visible = true; const k = ease.inOutCubic(remap(lt, 0.1, dur - 0.5));
        u.earth.position.set(-1.0, -2.8, 0); u.moon.position.set(1.0, 3.6, -1); const a = u.earth.position.clone().add(V(0, 1.2, 0)), b = a.clone().lerp(u.moon.position, k);
        u.beam.position.copy(a.clone().add(b).multiplyScalar(0.5)); u.beam.scale.y = Math.max(0.01, a.distanceTo(b)); u.beam.quaternion.setFromUnitVectors(V(0, 1, 0), u.moon.position.clone().sub(a).normalize());
        look(V(5, 0.8, 15), V(0, 0.8, 0)); u.lm.update(stage, u.moon.position, clamp((lt - 0.3) / 0.3), 0, 60);
      }
    },
  };
  return S;
}
