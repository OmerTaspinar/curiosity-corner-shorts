// Frame grabber: renders the episode in headless Chrome (WebGL via SwiftShader), one encoded file per scene,
// then concat (-c copy) and mux the mix (-c:v copy).  usage: node engine/render.mjs <ep> [--stills t1,t2,..] [--scenes id,id]
import { chromium } from 'playwright-core';
import { spawn } from 'child_process'; import fs from 'fs'; import path from 'path';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ep = process.argv[2]; const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FPS = 30, out = `${ROOT}/episodes/${ep}/build`; fs.mkdirSync(out, { recursive: true });
const srv = await serve(ROOT);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.log('PAGE ERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/engine/stage.html?ep=${ep}${process.argv.includes('--clean') ? '&clean=1' : ''}`);
await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
const info = await page.evaluate('window.EPINFO');
const grab = t => page.evaluate(t => { window.renderAt(t); return document.querySelector('canvas').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t).then(b => Buffer.from(b, 'base64'));

if (arg('--stills')) {
  for (const t of arg('--stills').split(',').map(Number)) { fs.writeFileSync(`${out}/still_${t.toFixed(2)}.jpg`, await grab(t)); console.log('still', t); }
} else {
  const only = arg('--scenes')?.split(',');
  const total = Math.round(info.duration * FPS); const files = [];
  for (const [k, sc] of info.scenes.entries()) {
    const f0 = Math.round(sc.t0 * FPS), f1 = k === info.scenes.length - 1 ? total : Math.round(sc.t1 * FPS);
    const file = `${out}/scene_${String(k).padStart(2, '0')}_${sc.id}.mp4`; files.push(file);
    if (only && !only.includes(sc.id) && fs.existsSync(file)) continue;
    const tmp = file.replace(/\.mp4$/, '.part.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) { const buf = await grab((f + 0.5) / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg failed ' + sc.id);
    fs.renameSync(tmp, file); console.log(`scene ${sc.id}: ${f1 - f0} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  fs.writeFileSync(`${out}/list.txt`, files.map(f => `file '${f}'`).join('\n'));
  const run = a => new Promise((res, rej) => spawn('ffmpeg', a, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  await run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${out}/list.txt`, '-c', 'copy', `${out}/video.mp4`]);
  await run(['-y', '-loglevel', 'error', '-i', `${out}/video.mp4`, '-i', `${ROOT}/episodes/${ep}/mix.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-maxrate', '16M', '-bufsize', '32M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-shortest', '-movflags', '+faststart', `${ROOT}/episodes/${ep}/${ep}.mp4`]);
  console.log('done', `${ROOT}/episodes/${ep}/${ep}.mp4`);
}
await browser.close(); srv.close();
