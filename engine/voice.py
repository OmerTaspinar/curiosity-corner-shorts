"""Voiceover: synthesize each scene with a fixed Kokoro voice, join with small gaps,
and estimate word timings for captions (per-scene audio gives exact sentence timing;
words inside a sentence are placed by syllable weight, then pauses at punctuation)."""
import json, re, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
ROOT = __file__.rsplit('/engine/', 1)[0]
SR = 24000

def syllables(w):
    w = re.sub(r'[^a-z]', '', w.lower())
    if not w: return 1
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and n > 1 and not w.endswith('le'): n -= 1
    return max(1, n)

def trim(a, thr=0.012):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0: return a
    s, e = max(0, idx[0] - int(0.02*SR)), min(len(a), idx[-1] + int(0.06*SR))
    return a[s:e]

def word_times(text, audio):
    """Find speech segments via energy, then distribute words across them by syllables."""
    words = text.split()
    win = int(0.02*SR)
    env = np.array([np.sqrt(np.mean(audio[i:i+win]**2)) for i in range(0, len(audio)-win, win)])
    voiced = env > max(0.015, env.max()*0.06)
    # pauses longer than 140ms split the audio into segments
    segs, start, gap = [], None, 0
    for i, v in enumerate(voiced):
        if v:
            if start is None: start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap*0.02 > 0.14:
                segs.append((start*0.02, (i-gap+1)*0.02)); start = None; gap = 0
    if start is not None: segs.append((start*0.02, len(voiced)*0.02))
    # group words into phrases at punctuation; match phrases to segments when counts agree
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[,.;:!?…]$', w): phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    if len(phrases) != len(segs):
        phrases, segs = [words], [(segs[0][0], segs[-1][1])] if segs else [(0, len(audio)/SR)]
    out = []
    for ph, (s, e) in zip(phrases, segs):
        wts = [syllables(w) + 0.6 for w in ph]
        tot, t = sum(wts), s
        for w, wt in zip(ph, wts):
            d = (e - s) * wt / tot
            out.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)}); t += d
    return out

def main(ep):
    spec = json.load(open(f"{ROOT}/episodes/{ep}/spec.json"))
    k = Kokoro(f"{ROOT}/models/kokoro-v1.0.int8.onnx", f"{ROOT}/models/voices-v1.0.bin")
    v = spec["voice"]
    lead, gap, tail = 0.2, 0.28, 0.7
    chunks, t, timing = [np.zeros(int(lead*SR))], lead, []
    for sc in spec["scenes"]:
        if sc.get("pron"):   # {"word": "IPA"} fixes for words the phonemizer gets wrong
            ph = k.tokenizer.phonemize(sc["text"], "en-us")
            for word, ipa in sc["pron"].items():
                ph = ph.replace(k.tokenizer.phonemize(word, "en-us").strip(" ."), ipa)
            a, sr = k.create(ph, voice=v["name"], speed=v["speed"], is_phonemes=True)
        else:
            a, sr = k.create(sc["text"], voice=v["name"], speed=v["speed"], lang="en-us")
        a = trim(a.astype(np.float32))
        wt = word_times(sc["text"], a)
        for w in wt: w["s"] += t; w["e"] += t
        dur = len(a)/SR
        timing.append({"id": sc["id"], "start": round(t, 3), "end": round(t+dur, 3), "words": wt})
        chunks += [a, np.zeros(int(gap*SR))]; t += dur + gap
    chunks.append(np.zeros(int(tail*SR)))
    audio = np.concatenate(chunks); audio /= max(1e-6, np.abs(audio).max()) / 0.9
    sf.write(f"{ROOT}/episodes/{ep}/voice.wav", audio, SR)
    total = len(audio)/SR
    # scene windows: each scene runs from its speech start (first starts at 0) to the next one's
    for i, s in enumerate(timing):
        s["t0"] = 0.0 if i == 0 else round(s["start"] - 0.12, 3)
        s["t1"] = round(timing[i+1]["start"] - 0.12, 3) if i+1 < len(timing) else round(total, 3)
    json.dump({"duration": round(total, 3), "scenes": timing}, open(f"{ROOT}/episodes/{ep}/timing.json", "w"), indent=1)
    print(f"duration {total:.2f}s"); [print(s["id"], s["t0"], s["t1"]) for s in timing]

if __name__ == "__main__": main(sys.argv[1])
