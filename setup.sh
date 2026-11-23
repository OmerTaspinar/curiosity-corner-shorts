#!/usr/bin/env bash
# Installs everything on a fresh Linux box (Chrome + ffmpeg expected to exist).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p models
B=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -f models/voices-v1.0.bin ] || curl -sL -o models/voices-v1.0.bin $B/voices-v1.0.bin
[ -f models/kokoro-v1.0.int8.onnx ] || curl -sL -o models/kokoro-v1.0.int8.onnx $B/kokoro-v1.0.int8.onnx
pip install --break-system-packages -q kokoro-onnx soundfile numpy scipy
npm install --silent
