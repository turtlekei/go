"""產生金邊鍋貼 PWA 圖示：把真實鍋貼照片裁成方形，加上金色發光效果。

用法：
    python3 scripts/make_icons.py <鍋貼照片.jpg 或 .png>

會輸出到 icons/：
    icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
GOLD = (255, 176, 84)  # 與網站橘色、金色相近的發光色


def base_photo(src, size):
    """中心裁成正方形，並調整成溫暖、飽和的鍋貼色調。"""
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    img = ImageEnhance.Color(img).enhance(1.15)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    warm = Image.new("RGB", img.size, (255, 236, 205))
    return ImageChops.multiply(img, warm)


def radial_glow(size, strength):
    """中心亮、四周淡的金色光暈，用於 screen 疊加。"""
    glow = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(glow)
    steps = 60
    for i in range(steps):
        r = size * 0.5 * (1 - i / steps)
        v = int(255 * strength * (i / steps) ** 1.6)
        draw.ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r], fill=v)
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.05))
    color = Image.new("RGB", (size, size), GOLD)
    return Image.composite(color, Image.new("RGB", (size, size), (0, 0, 0)), glow)


def bloom(img, size):
    """把亮部擷取出來模糊後疊回去，讓鍋貼邊緣像在發光。"""
    bright = img.convert("L").point(lambda v: 255 if v > 170 else 0)
    halo = Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), bright)
    halo = halo.filter(ImageFilter.GaussianBlur(size * 0.04))
    return ImageChops.screen(img, ImageEnhance.Brightness(halo).enhance(0.8))


def vignette(img, size):
    """四角微暗，讓中心的鍋貼更突出。"""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([-size * 0.1, -size * 0.1, size * 1.1, size * 1.1], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(size * 0.12))
    dark = ImageEnhance.Brightness(img).enhance(0.72)
    return Image.composite(img, dark, mask)


def compose(src, size, safe_zone=False):
    """safe_zone=True 用於 maskable 圖示：內容縮到中央 80%，避免被系統裁切。"""
    inner = int(size * 0.8) if safe_zone else size
    img = base_photo(src, inner)
    img = bloom(img, inner)
    img = ImageChops.screen(img, radial_glow(inner, 0.35))
    img = vignette(img, inner)
    canvas = Image.new("RGB", (size, size), (57, 41, 31))  # 品牌深咖啡底
    offset = (size - inner) // 2
    canvas.paste(img, (offset, offset))
    return canvas


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    os.makedirs(OUT_DIR, exist_ok=True)
    outputs = {
        "icon-192.png": compose(src, 192),
        "icon-512.png": compose(src, 512),
        "icon-maskable-512.png": compose(src, 512, safe_zone=True),
        "apple-touch-icon.png": compose(src, 180),
    }
    for name, im in outputs.items():
        im.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
        print("wrote", os.path.join("icons", name), im.size)


if __name__ == "__main__":
    main()
