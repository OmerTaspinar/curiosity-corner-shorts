// Runtime: loads an episode (spec + timing + env + scenes.js), exposes window.renderAt(t) for the frame grabber.
import { createStage, loadFonts, Kicker, Captions, THREE, clamp, ease } from '/engine/kit.js';
const ep = new URLSearchParams(location.search).get('ep');
const base = `/episodes/${ep}`;
const [spec, timing, env] = await Promise.all(['spec', 'timing', 'env'].map(f => fetch(`${base}/${f}.json`).then(r => r.json())));
await loadFonts();
const stage = createStage();
const byId = Object.fromEntries(spec.scenes.map(s => [s.id, s]));
const scenes = timing.scenes.map(ts => ({ ...byId[ts.id], ...ts }));
const EP = {
  spec, timing, env, scenes,
  scene: id => scenes.find(s => s.id === id),
  kickerTime: id => { const s = EP.scene(id); return s.kickerWord != null ? s.words[s.kickerWord].s : s.t0 + 0.12; },
};
const mod = await import(`${base}/scenes.js?v=${Date.now()}`);
const S = mod.default(stage, EP);
for (const sc of scenes) {
  const def = S[sc.visual]; if (!def) throw new Error('missing visual ' + sc.visual);
  sc.def = def; sc.group = def.build(); sc.group.visible = false; stage.scene.add(sc.group);
  if (sc.kicker) sc.kick = new Kicker(stage.overlay, sc.kicker, { sub: sc.kickerSub, y: sc.kickerY ?? 590, size: sc.kickerSize ?? 150 });
}
const capWords = scenes.filter(s => s.captions !== false).flatMap(s => s.words);
const caps = new Captions(stage.overlay, capWords, { y: -360 });

window.renderAt = (t) => {
  const i = scenes.findIndex(s => t >= s.t0 && t < s.t1); const sc = scenes[i < 0 ? scenes.length - 1 : i];
  for (const s of scenes) s.group.visible = s === sc;
  const lt = t - sc.t0, dur = sc.t1 - sc.t0;
  stage.shake = 0; stage.camera.position.set(0, 0, 11); stage.camera.rotation.set(0, 0, 0);
  sc.def.update(sc.group, lt, dur, t);
  for (const s of scenes) if (s.kick) { const kt = EP.kickerTime(s.id); s.kick.update(s === sc ? t - kt : -1, s.t1 - t); }
  caps.update(t);
  // cut transition: zoom blur / aberration / flash at the start of each scene (and a punch on the first frame)
  const tin = clamp(1 - lt / 0.32), tout = clamp(1 - (sc.t1 - t) / 0.12);
  stage.fx.uniforms.uTrans.value = Math.max(ease.outCubic(tin) * (i === 0 ? 0.6 : 1), tout * 0.7);
  stage.fx.uniforms.uFlash.value = (i === 0 ? 0 : 0.18) * Math.pow(tin, 3);
  stage.render(t);
};
window.EPINFO = { duration: timing.duration, scenes: scenes.map(s => ({ id: s.id, t0: s.t0, t1: s.t1 })) };
window.STAGE = stage; window.ready = true;
