#!/usr/bin/env python3
"""
Генератор простых иконок приложений для era_native (Android/iOS) без внешних дизайнерских ассетов.

Дизайн:
- Цветной фон
- Белая буква по центру (E / V / A)

Требования:
  pip install Pillow
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class Variant:
    name: str
    letter: str
    bg: tuple[int, int, int]


VARIANTS: dict[str, Variant] = {
    "base": Variant(name="base", letter="E", bg=(25, 118, 210)),      # blue
    "vassals": Variant(name="vassals", letter="V", bg=(67, 160, 71)), # green
    "artel": Variant(name="artel", letter="A", bg=(245, 124, 0)),     # orange
}


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _load_font(px: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Пытаемся найти более-менее стандартный шрифт; если не нашли — PIL дефолт.
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, px)
    return ImageFont.load_default()


def render_icon(letter: str, size: int, bg: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size, size), (*bg, 255))
    draw = ImageDraw.Draw(img)

    # Подбираем размер шрифта (грубо) так, чтобы буква занимала ~70% высоты.
    font_size = max(12, int(size * 0.72))
    font = _load_font(font_size)

    # PIL >= 8: textbbox
    bbox = draw.textbbox((0, 0), letter, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) / 2
    y = (size - h) / 2 - size * 0.02

    draw.text((x, y), letter, font=font, fill=(255, 255, 255, 255))
    return img


ANDROID_MIPMAPS: list[tuple[str, int]] = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]


def write_android_icons(project_root: Path, variant: Variant) -> None:
    android_res_root = project_root / "android" / "app" / "src" / variant.name / "res"
    for folder, size in ANDROID_MIPMAPS:
        out_dir = android_res_root / folder
        _ensure_dir(out_dir)

        icon = render_icon(variant.letter, size, variant.bg).convert("RGBA")
        # Простая совместимость с manifest: @mipmap/ic_launcher и @mipmap/ic_launcher_round
        icon.save(out_dir / "ic_launcher.png", optimize=True)
        icon.save(out_dir / "ic_launcher_round.png", optimize=True)


IOS_APPICON_SPECS: list[tuple[str, str, str]] = [
    # (idiom, size, scale)
    ("iphone", "20x20", "2x"),
    ("iphone", "20x20", "3x"),
    ("iphone", "29x29", "2x"),
    ("iphone", "29x29", "3x"),
    ("iphone", "40x40", "2x"),
    ("iphone", "40x40", "3x"),
    ("iphone", "60x60", "2x"),
    ("iphone", "60x60", "3x"),
    ("ios-marketing", "1024x1024", "1x"),
]


def _ios_px(size_str: str, scale: str) -> int:
    base = int(size_str.split("x")[0])
    mult = int(scale.replace("x", ""))
    return base * mult


def write_ios_appicon(project_root: Path, variant: Variant) -> None:
    # В Xcode AppIcon — это appiconset внутри Images.xcassets
    xcassets = project_root / "ios" / "era_native" / "Images.xcassets"
    appiconset = xcassets / f"AppIcon{variant.name.capitalize()}.appiconset"
    _ensure_dir(appiconset)

    images_json = []
    for idiom, size_str, scale in IOS_APPICON_SPECS:
        px = _ios_px(size_str, scale)
        filename = f"AppIcon-{idiom}-{size_str}@{scale}.png"
        icon = render_icon(variant.letter, px, variant.bg).convert("RGBA")
        icon.save(appiconset / filename, optimize=True)
        images_json.append(
            {
                "idiom": idiom,
                "size": size_str,
                "scale": scale,
                "filename": filename,
            }
        )

    contents = {"images": images_json, "info": {"author": "xcode", "version": 1}}
    (appiconset / "Contents.json").write_text(json.dumps(contents, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--variants", default="base,vassals,artel")
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    variants = [v.strip() for v in args.variants.split(",") if v.strip()]
    for v in variants:
        if v not in VARIANTS:
            raise SystemExit(f"Unknown variant: {v}. Known: {', '.join(VARIANTS.keys())}")
        variant = VARIANTS[v]
        write_android_icons(project_root, variant)
        write_ios_appicon(project_root, variant)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

