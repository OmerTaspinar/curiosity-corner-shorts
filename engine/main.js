// Runtime: loads an episode (spec + timing + env + scenes.js), exposes window.renderAt(t) for the frame grabber.
import { createStage, loadFonts, Kicker, Captions, THREE, clamp, ease } from '/engine/kit.js';
import generic from '/engine/generic.js';
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
  kickerTime: id => { const s = EP.scene(id); return s.kickerWord != null ? s.words[s.kickerWord].s : s.t0 + (s === scenes[0] ? 0.0 : 0.12); },
  envAt: (k, t) => { const a = env[k] || []; return a[Math.min(a.length - 1, Math.max(0, Math.round(t * 30)))] || 0; },
};
const mod = await import(`${base}/scenes.js?v=${Date.now()}`);
const S = { ...generic(stage, EP), ...mod.default(stage, EP) };
for (const [i, sc] of scenes.entries()) {
  const def = S[sc.visual]; if (!def) throw new Error('missing visual ' + sc.visual);
  sc.def = def; sc.group = def.build(sc); sc.group.visible = false; stage.scene.add(sc.group);
  if (sc.group.userData.ov) sc.group.userData.ov.visible = false;
  const slam = i === 0 && sc.slam !== false;
  if (sc.kicker) sc.kick = new Kicker(stage.overlay, sc.kicker, { sub: sc.kickerSub, y: sc.kickerY ?? 590, size: sc.kickerSize ?? (slam ? 140 : 150), slam });
}
const capWords = scenes.filter(s => s.captions !== false).flatMap(s => s.words);
const caps = new Captions(stage.overlay, capWords, { y: -360 });
const hook = scenes[0];
const slamLands = hook.kick?.slam ? hook.kick.words.map(m => EP.kickerTime(hook.id) + m.userData.delay + 0.17) : [];

window.renderAt = (t) => {
  const i = scenes.findIndex(s => t >= s.t0 && t < s.t1); const sc = scenes[i < 0 ? scenes.length - 1 : i];
  for (const s of scenes) { s.group.visible = s === sc; if (s.group.userData.ov) s.group.userData.ov.visible = s === sc; }
  const lt = t - sc.t0, dur = sc.t1 - sc.t0;
  stage.shake = 0; stage.flashExtra = 0; stage.camera.position.set(0, 0, 11); stage.camera.rotation.set(0, 0, 0); stage.camera.fov = 32; stage.camera.updateProjectionMatrix();
  stage.setTheme(sc.theme || EP.spec.theme || 'default'); stage.bgMat.uniforms.uGlowAmt.value = 0.3;
  stage.scene.updateMatrixWorld(true);
  sc.def.update(sc.group, lt, dur, t, sc);
  for (const s of scenes) if (s.kick) { const kt = EP.kickerTime(s.id); s.kick.update(s === sc ? t - kt : -1, s.t1 - t); }
  caps.update(t);
  // cut transition: zoom blur / aberration / flash at the start of each scene
  const tin = clamp(1 - lt / 0.32), tout = clamp(1 - (sc.t1 - t) / 0.12);
  let trans = Math.max(ease.outCubic(tin), tout * 0.7), flash = 0.18 * Math.pow(tin, 3);
  if (i === 0) {   // hook: hard open + a punch every time a headline word slams down
    trans = Math.max(Math.pow(clamp(1 - t / 0.45), 2), tout * 0.7); flash = 0.55 * Math.pow(clamp(1 - t / 0.25), 2);
    for (const L of slamLands) { const d = t - L; if (d > 0 && d < 0.4) { const k = Math.exp(-d * 14); stage.shake += 2.2 * k; trans = Math.max(trans, 0.45 * k); flash = Math.max(flash, 0.12 * k); } }
  }
  stage.fx.uniforms.uTrans.value = trans; stage.fx.uniforms.uFlash.value = Math.max(flash, stage.flashExtra || 0);
  stage.render(t);
};
window.EPINFO = { duration: timing.duration, scenes: scenes.map(s => ({ id: s.id, t0: s.t0, t1: s.t1 })) };
if (new URLSearchParams(location.search).get('clean')) stage.overlay.visible = false;
window.STAGE = stage; window.ready = true;
