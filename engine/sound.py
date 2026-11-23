"""Sound design, fully synthesized in code (no samples):
ambient pad + air, soft beat, whooshes on cuts, impacts, riser, UI pops for headline words,
clock ticks, bubble bloops, the stomach growl, sparkle shimmer. Sidechain-ducked under the voice.
Writes sfx_music.wav (stereo, everything but voice), mix.wav (final) and env.json (growl
envelope per video frame, so the 3D visuals react to the exact sound)."""
import json, sys, numpy as np, soundfile as sf
from scipy import signal

SR = 48000
ROOT = __file__.rsplit('/engine/', 1)[0]
rs = np.random.default_rng(11)

def t_(d): return np.arange(int(d * SR)) / SR
def env_adsr(n, a, d, s, r, sus=None):
    a, d, r = int(a*SR), int(d*SR), int(r*SR); sl = n - a - d - r
    if sl < 0: sl = 0
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, s, d, endpoint=False), np.full(sl, s), np.linspace(s, 0, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)
def noise(n): return rs.standard_normal(n)
def stereo(x, pan=0.0):  # pan -1..1, equal power
    a = (pan + 1) * np.pi / 4; return np.stack([x * np.cos(a), x * np.sin(a)], 1)
def sweep_filter(x, f0, f1, q=2.0, steps=64):
    """time-varying bandpass by blocks (cheap and smooth enough for noise)"""
    out = np.zeros_like(x); n = len(x); edges = np.linspace(0, n, steps + 1).astype(int)
    zi = None
    for i in range(steps):
        k = i / max(1, steps - 1); f = f0 * (f1 / f0) ** k
        lo, hi = max(30, f / (1 + 1 / q)), min(SR / 2 - 100, f * (1 + 1 / q))
        sos = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        out[edges[i]:edges[i+1]], zi = signal.sosfilt(sos, x[edges[i]:edges[i+1]], zi=zi)
    return out

def reverb(x, decay=1.6, mix=0.25):
    """simple stereo convolution reverb from decaying noise"""
    n = int(decay * SR); tt = np.arange(n) / SR
    irL = noise(n) * np.exp(-tt * 6.9 / decay); irR = noise(n) * np.exp(-tt * 6.9 / decay)
    irL, irR = lp(irL, 6000), lp(irR, 6000); irL /= np.abs(irL).sum() ** .5 * 8; irR /= np.abs(irR).sum() ** .5 * 8
    mono = x.mean(1) if x.ndim == 2 else x
    wet = np.stack([signal.fftconvolve(mono, irL)[:len(mono)], signal.fftconvolve(mono, irR)[:len(mono)]], 1)
    dry = x if x.ndim == 2 else stereo(x)
    return dry * (1 - mix) + wet * mix * 3

# ---------------- instruments ----------------
def whoosh(d=0.7, peak=0.5, pan_from=-0.7, pan_to=0.7, f0=300, f1=5000):
    n = int(d * SR); x = noise(n)
    k = np.linspace(0, 1, n); pk = peak
    amp = np.where(k < pk, (k / pk) ** 2.2, ((1 - k) / (1 - pk)) ** 1.6)
    # rise then fall in pitch around the peak
    up = sweep_filter(x, f0, f1, q=1.6); y = up * amp
    y += 0.25 * sweep_filter(noise(n), f0 * 2, f1 * 1.5, q=4) * amp
    pans = np.linspace(pan_from, pan_to, n); a = (pans + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], 1) * 0.5

def impact(d=1.8, f0=70, f1=32):
    tt = t_(d); f = f1 + (f0 - f1) * np.exp(-tt * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6)
    crack = hp(noise(len(tt)), 1500) * np.exp(-tt * 40) * 0.5
    body = bp(noise(len(tt)), 80, 600) * np.exp(-tt * 9) * 0.9
    metal = sum(np.sin(2 * np.pi * h * tt) * np.exp(-tt * (3 + i)) for i, h in enumerate([110, 164.8, 233, 311])) * 0.12
    y = np.tanh((sub * 1.2 + body + crack + metal) * 1.3)
    return reverb(stereo(y), 2.2, 0.3) * 0.75

def riser(d=2.5):
    tt = t_(d); k = tt / d
    f = 200 * (12 ** k); tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.12
    nz = sweep_filter(noise(len(tt)), 400, 9000, q=1.4)
    y = (tone + nz * 0.8) * k ** 2.4
    return reverb(np.stack([y, np.roll(y, 300)], 1), 1.5, 0.3) * 0.45

def pop(freq=900, d=0.12):
    tt = t_(d); f = freq * (1 + 0.6 * np.exp(-tt * 60))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38) + hp(noise(len(tt)), 3000) * np.exp(-tt * 120) * 0.2
    return y * 0.45

def tick(hi=True):
    tt = t_(0.05)
    y = bp(noise(len(tt)), 2500 if hi else 1600, 7000) * np.exp(-tt * 140) + np.sin(2 * np.pi * (3200 if hi else 2100) * tt) * np.exp(-tt * 90) * .4
    return y * 0.5

def bloop(freq=320, d=0.18):
    tt = t_(d); f = freq * (1 + 1.4 * (tt / d) ** 0.7)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.5
    return lp(y, 2500) * 0.5

def growl(d=1.6, seed=0, pitch=1.0):
    """stomach rumble: resonant low gurgle (formant-filtered pulses) + bubbly AM + squeezed-air hiss"""
    r = np.random.default_rng(100 + seed); n = int(d * SR); tt = np.arange(n) / SR
    # irregular glottal-like pulse train at 18-40 Hz -> gurgle texture
    rate = (24 + 10 * np.sin(2 * np.pi * 1.3 * tt + seed) + 6 * r.standard_normal(n).cumsum() / np.sqrt(n) * 3) * pitch
    phase = np.cumsum(rate) / SR; pulses = np.exp(-((phase % 1.0) * 9)) * (0.6 + 0.4 * r.random(n))
    src = pulses + 0.35 * noise(n)
    # two moving resonances ("squeeze" formants)
    f1 = 140 * pitch * (1 + 0.5 * np.sin(2 * np.pi * 0.9 * tt + seed)); f2 = 380 * pitch * (1 + 0.3 * np.sin(2 * np.pi * 1.7 * tt))
    y = np.zeros(n); blocks = 80; edges = np.linspace(0, n, blocks + 1).astype(int); z1 = z2 = None
    for i in range(blocks):
        a, b = edges[i], edges[i + 1]; c = (a + b) // 2
        s1 = signal.butter(2, [f1[c] * .7, f1[c] * 1.4], 'band', fs=SR, output='sos'); s2 = signal.butter(2, [f2[c] * .8, f2[c] * 1.25], 'band', fs=SR, output='sos')
        if z1 is None: z1 = np.zeros((s1.shape[0], 2)); z2 = np.zeros((s2.shape[0], 2))
        o1, z1 = signal.sosfilt(s1, src[a:b], zi=z1); o2, z2 = signal.sosfilt(s2, src[a:b], zi=z2); y[a:b] = o1 + 0.6 * o2
    # bubbly amplitude: random gurgle bursts
    am = np.zeros(n); k = 0
    while k < n:
        L = int(r.uniform(0.05, 0.22) * SR); am[k:k + L] += np.sin(np.pi * np.linspace(0, 1, min(L, n - k))) * r.uniform(0.4, 1); k += int(L * r.uniform(0.5, 1.1))
    y *= 0.35 + am
    y += bp(noise(n), 900, 2600) * 0.06 * am                     # air hiss
    y *= env_adsr(n, 0.12, 0.2, 0.85, 0.35)
    y = np.tanh(y / (np.abs(y).max() + 1e-9) * 1.8)
    return y * 0.8

def sparkle(d=1.6):
    tt = t_(d); y = np.zeros(len(tt))
    r = np.random.default_rng(5)
    for i in range(14):
        st = int(r.uniform(0, d * 0.6) * SR); f = r.choice([1568, 1760, 2093, 2349, 2637, 3136]) * r.choice([1, 2])
        L = len(tt) - st; e = np.exp(-np.arange(L) / SR * 5)
        y[st:] += np.sin(2 * np.pi * f * np.arange(L) / SR) * e * 0.12
    return reverb(np.stack([y, np.roll(y, 900)], 1), 2.5, 0.45) * 0.8

def pad(total, root=73.42):  # D2
    tt = t_(total); y = np.zeros(len(tt))
    chord = [1, 1.5, 2, 2.378, 3, 4.757]  # D A D F A F (minor colour)
    for i, m in enumerate(chord):
        for det in (-0.12, 0.0, 0.11):
            f = root * m * 2 ** (det / 12)
            ph = rs.random() * 6.28
            saw = signal.sawtooth(2 * np.pi * f * tt + ph) * (0.5 if m < 2.5 else 0.3)
            y += saw / (1 + i * 0.6)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * tt)
    y = lp(y, 900, 2) * 0.6 + lp(y, 300, 2) * 0.4
    y *= 0.7 + 0.3 * lfo
    air = bp(noise(len(tt)), 2000, 8000) * 0.03 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tt))
    y = y / np.abs(y).max() * 0.35 + air
    fade = np.minimum(1, tt / 1.2) * np.minimum(1, (total - tt) / 1.0)
    st = np.stack([y, np.roll(y, int(0.013 * SR))], 1) * fade[:, None]
    return st

def beat(total, start, bpm=96):
    out = np.zeros((int(total * SR), 2)); spb = 60 / bpm
    def kick():
        tt = t_(0.4); f = 45 + 120 * np.exp(-tt * 30); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * 0.9
    def hat(open_=False):
        tt = t_(0.18 if open_ else 0.05); return hp(noise(len(tt)), 7000) * np.exp(-tt * (25 if open_ else 110)) * 0.18
    def snare():
        tt = t_(0.25); return (bp(noise(len(tt)), 1200, 6000) * np.exp(-tt * 22) * 0.35 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.3)
    b = 0
    while start + b * spb / 2 < total - 0.5:
        tb = start + b * spb / 2; step = b % 8
        if step in (0, 3, 4): place(out, stereo(kick()), tb)
        if step in (2, 6): place(out, stereo(snare() * 0.6, 0.1), tb)
        place(out, stereo(hat(step == 7), 0.3 if step % 2 else -0.3), tb)
        b += 1
    return out

def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    if i < 0: x = x[-i:]; i = 0
    if x.ndim == 1: x = stereo(x)
    L = min(len(x), len(buf) - i); buf[i:i + L] += x[:L] * gain

# ---------------- arrangement ----------------
def main(ep):
    spec = json.load(open(f"{ROOT}/episodes/{ep}/spec.json"))
    tim = json.load(open(f"{ROOT}/episodes/{ep}/timing.json"))
    total = tim["duration"]; N = int(total * SR)
    voice, vsr = sf.read(f"{ROOT}/episodes/{ep}/voice.wav")
    voice = signal.resample_poly(voice, SR, vsr)[:N]; voice = np.pad(voice, (0, N - len(voice)))
    # light voice processing: low-cut, presence, gentle saturation
    v = hp(voice, 90); v = v + 0.25 * bp(v, 2500, 6000); v = np.tanh(v * 1.2) / np.tanh(1.2)

    music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); growl_track = np.zeros(N)
    music += pad(total)
    first_cut = tim["scenes"][1]["t0"]
    music += beat(total, first_cut, 96) * 0.55
    sc_by_id = {s["id"]: s for s in spec["scenes"]}
    for i, s in enumerate(tim["scenes"]):
        sp = sc_by_id[s["id"]]; t0 = s["t0"]
        if i == 0:
            place(sfx, impact(), 0.0, 0.9)
        else:
            w = whoosh(0.75, 0.6, pan_from=-0.8 if i % 2 else 0.8, pan_to=0.8 if i % 2 else -0.8)
            place(sfx, w, t0 - 0.45, 0.8)
        if sp.get("sfx") == "impact" and i > 0: place(sfx, impact(1.4, 60, 30), t0 + 0.02, 0.6)
        # headline word pops
        if sp.get("kicker"):
            kw = sp.get("kickerWord"); kt = s["words"][kw]["s"] if kw is not None else t0 + 0.1
            nwords = len(sp["kicker"].replace("\n", " ").split())
            for j in range(nwords): place(sfx, pop(780 + 140 * j), kt + j * 0.07, 0.5)
        for (lt, d) in sp.get("growl", []):
            g = growl(d, seed=i, pitch=1.0 if i == 0 else 0.9 + 0.08 * i)
            gi = int((t0 + lt) * SR); L = min(len(g), N - gi); growl_track[gi:gi + L] += g[:L]
        if sp.get("ticks"):
            k, tt = 0, t0 + 0.2
            while tt < s["t1"] - 0.3:
                place(sfx, stereo(tick(k % 4 == 0), 0.2), tt, 0.5); k += 1; tt += max(0.07, 0.22 - k * 0.006)
        for bt in sp.get("beats", []):
            for j in range(5): place(sfx, stereo(bloop(260 + 70 * j + rs.uniform(-20, 20)), rs.uniform(-.5, .5)), t0 + bt - 0.1 + j * 0.07, 0.55)
            g = growl(0.8, seed=40 + int(bt * 10), pitch=1.15); gi = int((t0 + bt - 0.15) * SR); L = min(len(g), N - gi); growl_track[gi:gi + L] += g[:L] * 0.6
        if sp.get("sparkle"):
            kw = sp.get("kickerWord"); kt = s["words"][kw]["s"] if kw is not None else t0
            place(sfx, riser(2.2), kt - 2.2, 0.55); place(sfx, sparkle(), kt, 0.7)
    sfx += reverb(stereo(growl_track), 0.9, 0.18) * 0.85

    # sidechain duck music under the voice
    venv = np.abs(signal.hilbert(lp(np.abs(v), 30)))
    venv = signal.sosfiltfilt(signal.butter(1, 6, 'low', fs=SR, output='sos'), np.abs(v)) * 6
    duck = 1 - 0.65 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
    music *= duck[:, None]
    sfx_duck = 1 - 0.45 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
    bed = music * 0.32 + sfx * 0.55 * sfx_duck[:, None]
    mix = bed + stereo(v * 1.1)
    sf.write(f"{ROOT}/episodes/{ep}/build_bed.wav", bed.astype(np.float32), SR); sf.write(f"{ROOT}/episodes/{ep}/build_vox.wav", (v * 1.1).astype(np.float32), SR)
    mix = np.tanh(mix * 1.1) * 0.95
    mix /= np.abs(mix).max() / 0.95
    sf.write(f"{ROOT}/episodes/{ep}/mix.wav", mix.astype(np.float32), SR)

    # growl envelope per video frame (drives shake / glow / rings / bars)
    fps = 30; hop = SR // fps
    ge = np.array([np.sqrt(np.mean(growl_track[i:i + hop] ** 2)) for i in range(0, N, hop)])
    ge = ge / (ge.max() + 1e-9)
    ve = np.array([np.sqrt(np.mean(v[i:i + hop] ** 2)) for i in range(0, N, hop)]); ve /= ve.max() + 1e-9
    json.dump({"fps": fps, "growl": [round(float(x), 3) for x in ge], "voice": [round(float(x), 3) for x in ve]}, open(f"{ROOT}/episodes/{ep}/env.json", "w"))
    print("mix written", total, "s")

if __name__ == "__main__": main(sys.argv[1])
