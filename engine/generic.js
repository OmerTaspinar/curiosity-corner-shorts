// Reusable visuals any episode can use from spec.json alone:
//  "bigStat": {"stat": {"from":0,"to":38,"dec":0,"prefix":"+","suffix":"","unit":"MICROSECONDS / DAY","color":"#ffd84d"}}
//  "compare": {"compare": {"items":[{"label":"SUN","value":5500,"text":"5,500°C","color":"#ffb347"}, ...]}}
import { THREE, PAL, clamp, lerp, remap, ease, spring, rng, DynText, textMesh, soundRing } from '/engine/kit.js';
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function fmt(v, dec) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

export default function generic(stage, EP) {
  const look = (p, tg = V(0, 0, 0)) => { stage.camera.position.copy(p); stage.camera.lookAt(tg); };
  const G = {};

  G.bigStat = {
    build(sc) {
      const st = sc.stat, col = new THREE.Color(st.color || PAL.accent);
      const g = new THREE.Group();
      // gyroscope rings + particle burst behind the number
      const rings = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.35, 0.03 + i * 0.01, 12, 160),
        new THREE.MeshBasicMaterial({ color: i === 1 ? col : PAL.cyan, transparent: true, toneMapped: false })); g.add(m); return m; });
      const N = 140, r = rng(5), parts = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), N);
      parts.userData.d = [...Array(N)].map(() => ({ dir: V(r() - .5, r() - .5, r() - .5).normalize(), sp: 1.5 + r() * 3.5, s: .5 + r() }));
      g.add(parts);
      const burst = [0, 1, 2].map(() => { const s = soundRing(col); g.add(s); return s; });
      const ov = new THREE.Group(); stage.overlay.add(ov); ov.visible = false;
      const num = new DynText(ov, { size: 260, fill: '#ffffff', strokeW: 16, glow: st.color || PAL.accent });
      num.mesh.position.y = 40;
      const unit = st.unit ? textMesh(st.unit, { size: 64, weight: 800, fill: st.color || PAL.accent, strokeW: 7, stroke: '#120a26', track: 4 }) : null;
      if (unit) { unit.position.y = -150; const w = unit.userData.textW; if (w > 940) unit.scale.setScalar(940 / w); ov.add(unit); }
      g.userData = { rings, parts, burst, ov, num, unit, st };
      sc.overlayGroup = ov; return g;
    },
    update(g, lt, dur, t, sc) {
      const { rings, parts, burst, ov, num, unit, st } = g.userData;
      ov.visible = true;
      look(V(Math.sin(lt * .5) * 1.2, 0.4, lerp(13, 11, ease.outCubic(lt / dur))), V(0, 0, 0));
      rings.forEach((m, i) => { m.rotation.set(lt * (0.6 + i * 0.3) + i, lt * (0.4 - i * 0.2), i * 0.7); m.material.opacity = ease.outCubic(lt / 0.4); m.scale.setScalar(ease.outBack(lt / 0.5)); });
      const k = ease.outCubic(remap(lt, 0.15, Math.min(dur * 0.65, 1.6)));
      num.set((st.prefix || '') + fmt(lerp(st.from ?? 0, st.to, k), st.dec || 0) + (st.suffix || ''));
      const fit = Math.min(1, 900 / (num.textW || 1)); const pop = spring(lt - 0.05, 14, 0.4); num.mesh.scale.setScalar(fit * Math.max(0.001, pop) * (k >= 1 ? 1 + 0.05 * Math.exp(-(lt - Math.min(dur * 0.65, 1.6)) * 6) : 1));
      num.mesh.material.opacity = clamp(lt / 0.1) * clamp((dur - lt) / 0.2);
      if (unit) { unit.material.opacity = clamp((lt - 0.35) / 0.2) * clamp((dur - lt) / 0.2); unit.position.y = -150 - (1 - ease.outCubic((lt - 0.35) / 0.3)) * 30; }
      const tmp = new THREE.Object3D(), land = Math.min(dur * 0.65, 1.6) + 0.15;
      parts.userData.d.forEach((p, i) => { const a = lt - land; const d = a > 0 ? p.sp * ease.outCubic(a / 1.2) : 0;
        tmp.position.copy(p.dir).multiplyScalar(1.2 + d * 1.4); tmp.scale.setScalar(a > 0 ? p.s * (1 - clamp(a / 1.6)) : 0.0001); tmp.rotation.set(t * 3, t * 2, i); tmp.updateMatrix(); parts.setMatrixAt(i, tmp.matrix); });
      parts.instanceMatrix.needsUpdate = true;
      burst.forEach((b, i) => b.update(lt - land + 0.1 - i * 0.12, 1.1, 1.0, 4.5));
      stage.shake = Math.exp(-Math.max(0, lt - land + 0.15) * 10) * (lt > land - 0.15 ? 1.2 : 0);
    },
  };

  G.compare = {
    build(sc) {
      const c = sc.compare, n = c.items.length, g = new THREE.Group();
      const maxV = Math.max(...c.items.map(i => i.value));
      const bars = c.items.map((it, i) => {
        const col = new THREE.Color(it.color || (i ? PAL.accent : PAL.cyan));
        const mat = new THREE.ShaderMaterial({ transparent: true, toneMapped: false, uniforms: { uC: { value: col }, uT: { value: 0 } },
          vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
          fragmentShader: `uniform vec3 uC; uniform float uT; varying vec3 vP; varying vec3 vN;
            void main(){ float y=vP.y+.5; float scan=.5+.5*sin(y*40.-uT*6.); float side=abs(vN.x)>.5?.75:1.; vec3 c=uC*(.7+.6*y)*side+uC*scan*.15; gl_FragColor=vec4(c*1.4,1.); }` });
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), mat);
        m.userData = { h: 5.2 * it.value / maxV, x: (i - (n - 1) / 2) * 1.9, it };
        g.add(m); return m;
      });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: .6, roughness: .3 }));
      base.position.y = -2.62; g.add(base);
      const ov = new THREE.Group(); stage.overlay.add(ov); ov.visible = false;
      const labels = c.items.map(it => { const l = textMesh(it.label, { size: 58, weight: 900, fill: '#ffffff', strokeW: 7, stroke: '#120a26' }); ov.add(l); return l; });
      const vals = c.items.map((it, i) => { const d = new DynText(ov, { size: 76, fill: i ? PAL.accent : '#bff4ff', strokeW: 8 }); return d; });
      g.userData = { bars, labels, vals, ov, c }; return g;
    },
    update(g, lt, dur, t, sc) {
      const { bars, labels, vals, ov, c } = g.userData; ov.visible = true;
      look(V(Math.sin(lt * .3) * 1.5 + 0.8, 1.2, 13.5), V(0, 0, 0)); g.position.y = 0.1; g.rotation.y = -0.25 + lt * 0.05;
      bars.forEach((b, i) => {
        const st = 0.2 + i * (c.stagger ?? 0.9), k = ease.outCubic(remap(lt, st, st + 1.0)); const h = Math.max(0.001, b.userData.h * k);
        b.scale.set(1, h, 1); b.position.set(b.userData.x, -2.6 + h / 2, 0); b.material.uniforms.uT.value = t;
        const top = stage.project(new THREE.Vector3(b.userData.x, -2.6 + h + 0.35, 0).applyMatrix4(g.matrixWorld));
        const bot = stage.project(new THREE.Vector3(b.userData.x, -3.1, 0).applyMatrix4(g.matrixWorld));
        const it = b.userData.it, a = clamp((lt - st) / 0.2) * clamp((dur - lt) / 0.2);
        const dec = it.dec ?? (it.value < 10 ? 2 : 0); vals[i].set(k >= 0.999 && it.text ? it.text : fmt(it.value * k, dec) + (it.suffix || ''));
        vals[i].mesh.position.set(top.x, top.y + 40, 0); vals[i].mesh.material.opacity = a;
        labels[i].position.set(bot.x, bot.y - 30, 0); labels[i].material.opacity = a;
      });
      g.updateMatrixWorld();
    },
  };
  return G;
}
