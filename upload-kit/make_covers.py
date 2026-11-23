"""Cover images: a clean 3D frame from each video + the hook headline. Writes covers/<day>-<slug>.jpg"""
import json, os, sys, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'engine/fonts/Montserrat.ttf')
def font(size, w='Black'):
    f = ImageFont.truetype(FONT, size); f.set_variation_by_name(w); return f
PICK = json.load(open(sys.argv[1]))  # {slug: path_to_frame}
kit = json.load(open(os.path.join(ROOT, 'upload-kit/upload_kit.json')))
for row in kit:
    slug = row['slug']; spec = json.load(open(os.path.join(ROOT, f'episodes/{slug}/spec.json')))
    text = spec['scenes'][0].get('kicker') or row['title'].upper()
    im = Image.open(PICK[slug]).convert('RGB').resize((1080, 1920))
    # darken top for legibility
    grad = Image.new('L', (1, 1920)); [grad.putpixel((0, y), int(215 * max(0, 1 - y / 1050) ** 1.4)) for y in range(1920)]
    im = Image.composite(Image.new('RGB', im.size, (8, 5, 20)), im, grad.resize(im.size))
    d = ImageDraw.Draw(im)
    lines = text.split('\n'); size = 150
    def layout(sz):
        f = font(sz); widths = [d.textlength(re.sub(r'\*', '', ln), font=f) for ln in lines]; return f, widths
    f, widths = layout(size)
    while max(widths) > 960: size -= 4; f, widths = layout(size)
    y = 300
    for ln, wln in zip(lines, widths):
        x = (1080 - wln) / 2
        for tok in re.split(r'(\*[^*]+\*)', ln):
            if not tok: continue
            acc = tok.startswith('*'); t = tok.strip('*'); col = (255, 216, 77) if acc else (255, 255, 255)
            sh = Image.new('L', im.size, 0); ImageDraw.Draw(sh).text((x, y + 8), t, font=f, fill=200); sh = sh.filter(ImageFilter.GaussianBlur(14))
            im.paste((0, 0, 0), (0, 0), sh)
            d = ImageDraw.Draw(im); d.text((x, y), t, font=f, fill=col, stroke_width=max(6, size // 16), stroke_fill=(18, 10, 38))
            x += d.textlength(t, font=f)
        y += int(size * 1.08)
    fb = font(40, 'ExtraBold'); label = 'CURIOSITY CORNER'; lw = d.textlength(label, font=fb)
    d.rounded_rectangle(((1080 - lw) / 2 - 26, 170, (1080 + lw) / 2 + 26, 236), radius=33, fill=(98, 240, 255))
    d.text(((1080 - lw) / 2, 178), label, font=fb, fill=(10, 8, 25))
    out = os.path.join(ROOT, f'covers/{row["day"]:02d}-{slug}.jpg'); im.save(out, quality=90); print(out)
