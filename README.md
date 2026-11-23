# Curiosity Corner — Shorts factory

Fully code-generated YouTube Shorts: 3D motion graphics (three.js), a fixed AI narrator (Kokoro `am_michael`, open source), burned-in kinetic captions and sound design synthesized from scratch (no samples).

## Where things are
- **Finished videos:** [Releases → videos](https://github.com/OmerTaspinar/curiosity-corner-shorts/releases/tag/videos)
- **Upload kit** (title, description, tags, posting date per video): `upload-kit/upload_kit.csv` / `upload_kit.json`
- **Scripts:** `episodes/_specs.py` (one entry per video) → `episodes/<slug>/spec.json`
- **3D scenes:** `episodes/<slug>/scenes.js`
- **Engine:** `engine/` — `voice.py` (narration + word timing), `sound.py` (synth SFX/music + ducking), `kit.js`/`props.js`/`generic.js` (3D toolkit), `render.mjs` (headless Chrome → ffmpeg)
- **How to write a new episode:** `PLAYBOOK.md`

## Render
- On GitHub: list slugs in `render-queue.txt` and push → GitHub Actions renders them in parallel and attaches the MP4s to the `videos` release.
- Locally: `./setup.sh` once, then `./make.sh <slug>` → `episodes/<slug>/<slug>.mp4`.
