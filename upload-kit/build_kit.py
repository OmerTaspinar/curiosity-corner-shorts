"""Upload metadata for the 30-day batch -> upload-kit/upload_kit.json, .csv and index.html (copy-button page)."""
import json, csv, datetime, html, os
HERE = os.path.dirname(os.path.abspath(__file__))
REL = "https://github.com/OmerTaspinar/curiosity-corner-shorts/releases/download/videos/"
BASE_TAGS = ["shorts", "science", "didyouknow", "curiosity", "sciencefacts", "learnsomethingnew", "curiositycorner"]
V = [
 ("stomach-growl", "Your Stomach Isn't Growling Because You're Hungry", "That rumble is your gut's cleaning cycle squeezing trapped air and gas through empty intestines. Scientists call it borborygmi.", ["stomach growling", "borborygmi", "human body", "digestion", "biology"]),
 ("spaghetti", "Why Spaghetti Never Breaks in Half", "Bend a dry noodle and it shatters into 3+ pieces. MIT finally found the trick to snap it cleanly in two.", ["spaghetti", "physics", "feynman", "mit", "fracture"]),
 ("walkie-scorchie", "The Skyscraper That Melted a Car", "London's Walkie-Talkie tower worked like a giant concave mirror and melted parts of a parked Jaguar in 2013.", ["walkie talkie building", "london", "engineering fail", "architecture", "sunlight"]),
 ("acoustic-levitation", "Sound Can Make Things Float", "Two arrays of ultrasonic speakers create a standing wave that traps tiny beads in midair.", ["acoustic levitation", "sound waves", "ultrasound", "physics", "standing wave"]),
 ("cat-righting", "How Cats Always Land on Their Feet", "A falling cat twists its two halves in opposite directions to flip upright without breaking physics.", ["cats", "cat righting reflex", "physics", "angular momentum", "animals"]),
 ("ariane-5", "One Number Blew Up This Rocket", "In 1996, Ariane 5 tried to fit a 64-bit number into a 16-bit space. 37 seconds later it was gone.", ["ariane 5", "software bug", "rocket", "integer overflow", "space"]),
 ("blue-sky", "Why Is the Sky Blue and Not White?", "Air molecules scatter short blue light far more than red, so blue reaches you from every direction.", ["blue sky", "rayleigh scattering", "sunset", "light", "physics"]),
 ("prince-ruperts-drop", "The Glass a Hammer Can't Break", "A Prince Rupert's drop survives hammer blows, but snip its tail and it explodes into powder.", ["prince ruperts drop", "glass", "materials science", "physics", "tempered glass"]),
 ("tacoma-narrows", "The Bridge the Wind Tore Apart", "In 1940, modest winds made the Tacoma Narrows Bridge twist itself to pieces through aeroelastic flutter.", ["tacoma narrows bridge", "engineering disaster", "galloping gertie", "bridge collapse", "physics"]),
 ("saturn-floats", "Saturn Would Float in Water", "Saturn is so light for its size that its average density is lower than water's.", ["saturn", "space", "planets", "astronomy", "density"]),
 ("mirror-flip", "Mirrors Don't Flip Left and Right", "A mirror actually flips front and back. Your brain does the rest.", ["mirror", "reflection", "optics", "brain", "illusion"]),
 ("leidenfrost", "Water That Floats on a Hot Pan", "Above about 200°C, a water drop hovers on its own steam cushion. It's the Leidenfrost effect.", ["leidenfrost effect", "water", "kitchen science", "physics", "steam"]),
 ("gps-relativity", "Your GPS Needs Einstein to Work", "GPS satellite clocks run 38 microseconds fast every day. Without relativity, your location would drift ~10 km daily.", ["gps", "relativity", "einstein", "satellites", "time dilation"]),
 ("mantis-shrimp", "The Fastest Punch on Earth", "The peacock mantis shrimp strikes so fast it vaporizes water, hitting its prey twice with one punch.", ["mantis shrimp", "animals", "cavitation", "ocean", "nature"]),
 ("wing-lift", "How Wings Really Make Lift", "The 'equal transit time' story is a myth. Wings fly by turning air downward.", ["how planes fly", "lift", "aerodynamics", "physics", "airplane"]),
 ("paper-folding", "Fold Paper 42 Times to Reach the Moon", "Each fold doubles the thickness. 42 folds would pass the Moon, but the real record is just 12.", ["paper folding", "exponential growth", "math", "moon", "fold paper"]),
 ("leaning-tower", "Why the Leaning Tower Hasn't Fallen", "Soft clay tilted Pisa's tower for centuries until engineers pulled soil out from under the high side.", ["leaning tower of pisa", "engineering", "pisa", "italy", "history"]),
 ("noise-cancelling", "How Headphones Erase Sound With Sound", "Noise-cancelling headphones create an opposite sound wave that cancels the noise out.", ["noise cancelling", "headphones", "sound waves", "technology", "physics"]),
 ("ice-floats", "Ice Shouldn't Float", "Most solids sink in their own liquid. Water's hexagonal ice lattice makes it about 9% lighter.", ["ice", "water", "chemistry", "hydrogen bonds", "science"]),
 ("lightning-sun", "Lightning Is Hotter Than the Sun", "A lightning bolt heats air to around 30,000°C, about five times the Sun's surface. That blast is thunder.", ["lightning", "thunder", "weather", "storm", "physics"]),
 ("curveball", "Why a Spinning Ball Bends in Midair", "Spin flings the air behind a ball to one side and the ball gets pushed the other way: the Magnus effect.", ["magnus effect", "curveball", "free kick", "sports science", "physics"]),
 ("round-bubbles", "Why Every Bubble Is Round", "Surface tension squeezes soap film into the shape with the least surface for its air: a sphere.", ["bubbles", "surface tension", "soap bubbles", "physics", "geometry"]),
 ("millennium-bridge", "The Bridge Footsteps Made Wobble", "London's Millennium Bridge closed 2 days after opening when walkers fell into step with its sway.", ["millennium bridge", "london", "engineering", "resonance", "bridge"]),
 ("moon-face", "Why We Only See One Side of the Moon", "The Moon spins once per orbit, so it always shows us the same face. It's called tidal locking.", ["moon", "tidal locking", "far side of the moon", "astronomy", "space"]),
 ("steel-ships", "How Do Steel Ships Float?", "Steel is 8x denser than water, but a hull full of air displaces enough water to float.", ["ships", "buoyancy", "archimedes principle", "physics", "engineering"]),
 ("microwave", "Microwaves Don't Cook From the Inside Out", "Microwaves twist water molecules billions of times a second, but only a few centimeters deep.", ["microwave oven", "kitchen science", "physics", "water molecules", "cooking"]),
 ("fog-harvesting", "People Drink Water Pulled From Fog", "In Chile's Atacama Desert, mesh nets catch fog droplets and turn them into drinking water.", ["fog harvesting", "atacama desert", "water", "chile", "sustainability"]),
 ("spinning-top", "Why a Spinning Top Doesn't Fall", "Angular momentum turns gravity's pull into a slow circle called precession.", ["spinning top", "gyroscope", "precession", "physics", "angular momentum"]),
 ("glass-transparent", "Why Is Glass See-Through?", "Visible light doesn't have enough energy to be absorbed by glass's electrons, so it passes straight through.", ["glass", "light", "photons", "physics", "materials"]),
 ("salty-ocean", "Rain Is Fresh, So Why Is the Ocean Salty?", "Rain dissolves minerals from rocks, rivers carry them to the sea, and evaporation leaves the salt behind.", ["ocean", "salt water", "earth science", "geology", "water cycle"]),
]
start = datetime.date(2026, 11, 24)
rows = []
for i, (slug, title, desc, extra) in enumerate(V):
    tags = extra + BASE_TAGS
    hashtags = "#shorts #science #didyouknow " + "#" + extra[0].replace(" ", "")
    full = f"{desc}\n\nFollow Curiosity Corner for a new mind-blowing fact every day.\n\n{hashtags}"
    rows.append({"day": i + 1, "date": (start + datetime.timedelta(days=i)).isoformat(), "time": "20:00 (TR) / 12:00 ET", "slug": slug,
                 "file": f"{slug}.mp4", "download": REL + f"{slug}.mp4", "cover": f"https://raw.githubusercontent.com/OmerTaspinar/curiosity-corner-shorts/main/covers/{i + 1:02d}-{slug}.jpg", "title": title, "description": full, "tags": ", ".join(tags),
                 "pinned_comment": "Did you know this one already? Tell me in the comments 👇", "category": "Education", "audience": "Not made for kids"})
json.dump(rows, open(os.path.join(HERE, "upload_kit.json"), "w"), indent=1, ensure_ascii=False)
with open(os.path.join(HERE, "upload_kit.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

def card(r):
    e = html.escape
    def field(label, val, mono=False):
        return f'<div class="f"><div class="fl">{label}<button onclick="cp(this)">Kopyala</button></div><div class="fv{" mono" if mono else ""}">{e(val)}</div></div>'
    return f'''<section class="card" data-q="{e((r["title"]+" "+r["slug"]).lower())}"><header><span class="day">GÜN {r["day"]}</span><span class="date">{r["date"]} · {e(r["time"])}</span>
<a class="dl" href="{r["download"]}">Videoyu indir ↓</a><a class="dl" style="margin-left:14px" href="{r["cover"]}">Kapak ↓</a></header>{field("Başlık", r["title"])}{field("Açıklama", r["description"])}{field("Etiketler", r["tags"], True)}{field("Sabit yorum", r["pinned_comment"])}
<div class="meta">Kategori: {r["category"]} · Kitle: {r["audience"]} · Dosya: {e(r["file"])}</div></section>'''

page = f'''<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Curiosity Corner — 30 günlük yükleme kiti</title>
<style>:root{{--bg:#0f0c1d;--card:#1a1530;--ink:#f3f0ff;--mut:#a59fc4;--acc:#ffd84d;--cy:#62f0ff}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
.wrap{{max-width:880px;margin:0 auto;padding:28px 16px 60px}}h1{{font-size:26px;margin:0 0 4px}}p.sub{{color:var(--mut);margin:0 0 18px}}input{{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #33295a;background:#140f26;color:var(--ink);font-size:15px;margin-bottom:18px}}
.card{{background:var(--card);border:1px solid #2c2450;border-radius:14px;padding:16px;margin-bottom:14px}}header{{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}}.day{{background:var(--acc);color:#1a1300;font-weight:800;border-radius:6px;padding:2px 8px;font-size:13px}}
.date{{color:var(--mut);font-size:13px}}.dl{{margin-left:auto;color:var(--cy);text-decoration:none;font-weight:600;font-size:14px}}.f{{margin:8px 0}}.fl{{display:flex;justify-content:space-between;align-items:center;color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}}
.fv{{white-space:pre-wrap;background:#120e22;border-radius:8px;padding:9px 11px;margin-top:4px}}.mono{{font-family:ui-monospace,Menlo,monospace;font-size:13px}}button{{background:#2c2450;color:var(--ink);border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}}button.ok{{background:#2e7d4f}}.meta{{color:var(--mut);font-size:12px;margin-top:8px}}</style></head>
<body><div class="wrap"><h1>Curiosity Corner — 30 günlük yükleme kiti</h1><p class="sub">Her gün bir Short. Başlık, açıklama ve etiketleri tek tıkla kopyala; videoyu karttaki bağlantıdan indir.</p>
<input placeholder="Ara: başlık veya konu…" oninput="f(this.value)">{"".join(card(r) for r in rows)}</div>
<script>function cp(b){{const t=b.closest('.f').querySelector('.fv').innerText;navigator.clipboard.writeText(t).then(()=>{{b.textContent='Kopyalandı';b.classList.add('ok');setTimeout(()=>{{b.textContent='Kopyala';b.classList.remove('ok')}},1400)}}).catch(()=>{{const r=document.createRange();r.selectNodeContents(b.closest('.f').querySelector('.fv'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);b.textContent='Seçildi, Ctrl+C'}})}}
function f(q){{q=q.toLowerCase();document.querySelectorAll('.card').forEach(c=>c.style.display=c.dataset.q.includes(q)?'':'none')}}</script></body></html>'''
open(os.path.join(HERE, "index.html"), "w").write(page)
print(len(rows), "videos")
