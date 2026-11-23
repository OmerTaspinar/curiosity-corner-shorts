#!/usr/bin/env bash
# One command per episode:  ./make.sh <slug>   (needs episodes/<slug>/spec.json + scenes.js)
set -euo pipefail
cd "$(dirname "$0")"
EP="$1"
[ -f models/kokoro-v1.0.int8.onnx ] || ./setup.sh
python3 engine/voice.py "$EP"          # voice.wav + timing.json (word timings)
python3 engine/sound.py "$EP"          # mix.wav + env.json (synth sound design, ducked)
node engine/render.mjs "$EP" --stills "$(python3 -c "import json;t=json.load(open('episodes/$EP/timing.json'));print(','.join(f'{(s[\"t0\"]+s[\"t1\"])/2:.2f}' for s in t['scenes']))")"
node engine/render.mjs "$EP"           # episodes/<slug>/<slug>.mp4
