# Curiosity Corner Shorts — Production Playbook

How each automatic run makes ONE finished Short. Follow it top to bottom.

## Channel rules (from the channel analysis)
- 20–30 s, English, hook in the first second, ends on a line that loops back to the hook.
- Everyday "why does my body / the world do this?" or "physics that looks fake" or "engineering disasters". No scary medical claims.
- Every fact checked against at least 2 reliable sources (journals, NASA, university, major science outlets). Put the sources in `episodes/<slug>/sources.md`. If the facts don't hold up, drop the topic.
- Own visuals only (procedural 3D from this engine). Never reuse other creators' footage.
- Description: 1–2 sentences + 3–5 hashtags. No Etsy links, no prompt leftovers.

## 1. Pick a topic
Take the first unused topic from `topics.json` (or add a better one). Mark it used with the date when done.

## 2. Script (60–75 words, 6–8 scenes)
Formula: **Hook (contrarian/surprising, ≤ 6 words)** → reveal → mechanism in 2–4 visual beats → name the thing → callback line that loops to the hook.
Example: "That growl isn't hunger." … "So when your stomach rumbles, it's not complaining. It's cleaning."

## 3. spec.json (episodes/<slug>/spec.json)
```json
{"slug": "...", "title": "...", "voice": {"name": "am_michael", "speed": 1.08},
 "scenes": [{"id": "hook", "text": "...", "visual": "<key in scenes.js>", "kicker": "BIG\n*ACCENT* WORD",
             "kickerWord": 0, "kickerSub": "small line", "captions": false, "sfx": "impact",
             "growl": [[start, dur]], "beats": [t, t], "ticks": true, "sparkle": true,
             "pron": {"word": "IPA"}}]}
```
- Voice is FIXED: Kokoro `am_michael`, speed 1.08 (channel signature). Do not change.
- `kicker`: headline text, `*word*` = yellow accent, `\n` = new line. `kickerWord`: index of the spoken word it pops on.
- Hook scene: `"captions": false` (the kicker is the caption). First scene `sfx: impact`.
- Sound cues (all local times in seconds from scene start): `growl` = synthesized rumble (also drives shake/glow in visuals), `beats` = bubble/pulse hits, `ticks` = clock ticking, `sparkle` = riser + shimmer on the kicker word. Whooshes on every cut and pops on headline words are automatic.
- `pron`: fix mispronounced words with IPA (check with `k.tokenizer.phonemize`).

## 4. scenes.js (episodes/<slug>/scenes.js)
Export `default function episode(stage, EP)` returning `{ visualKey: { build(), update(group, lt, dur, t) } }`.
Use `episodes/stomach-growl/scenes.js` as the reference. Kit (`engine/kit.js`) gives:
- `organMaterial({xray, rimAmt, waveW, waveGlow, colA, colB})` — organic shaded material with travelling contraction wave (`uWavePos`, `uWaveAmp`), pulse (`uPulse`), glow.
- `tubeGeometry(curve, radiusFn)` — any organ/pipe/cable/vessel along a curve.
- `crumbs(n)`, `setInstance()` — instanced particles; `bubbleMaterial()`; `soundRing()` — expanding rings.
- `ease`, `spring`, `lerp`, `remap`, `rng(seed)`; `stage.shake`, `stage.bgMat.uniforms.uGlowAmt`.
- Plus anything from three.js (instanced meshes, shaders, lathe/extrude geometry, lines).
Rules: everything must be a pure function of time (no state carried between frames). Keep the subject in the middle 60% of the frame; headline zone is the top ~25%, captions sit at ~68% height; nothing important in the bottom 20% or right edge (Shorts UI). Set the camera every frame with `look()`.
Make the hero object readable at a glance: one subject per scene, strong silhouette, camera motion every scene.

## 5. Build
`./make.sh <slug>` → voice → sound → stills of every scene → full render.
Look at the stills (contact sheet) BEFORE trusting the full render: framing, text overlap, nothing cut off. Fix and re-run.
Output: `episodes/<slug>/<slug>.mp4` (1080×1920, 30 fps, −14 LUFS).

## 6. Deliver
Send the mp4 plus a ready-to-paste title (≤ 60 chars, curiosity gap), description and hashtags.
