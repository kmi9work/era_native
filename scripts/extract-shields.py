#!/usr/bin/env python3
"""Иконки щитов армий для экрана «Карта».

Источник — 18 PSD заказчика (папка на Яндекс.Диске, файлы вида
«Moscow_and_Novgorod_<Фамилия>.psd»). Каждый PSD — щит с гербовыми цветами
без эмблем (кроме Борецких и Рюриковичей, у них эмблема есть).

Что делает скрипт:
  1. рендерит видимые слои (psd.composite), обрезает по альфе;
  2. у PSD государств (Moscow, Novgorod) в файле только ЛЕВАЯ половина щита —
     достраивает вторую зеркалом (у семейных щитов эта половина залита цветом
     семьи, поэтому у Москвы щит сплошь красный, у Новгорода — сплошь лиловый);
  3. приводит все иконки к одному размеру (общая высота, прозрачный фон);
  4. делает два служебных щита: «враг» — сплошная заливка оранжевым, «бунт» —
     сплошная заливка чёрным (силуэт берётся с щита Москвы).

Запуск: python3 scripts/extract-shields.py <каталог с psd> [каталог вывода]
Нужны psd-tools и Pillow (см. requirements-icons.txt).
"""

import os
import sys

from PIL import Image, ImageFilter
from psd_tools import PSDImage

SRC_PREFIX = "Moscow_and_Novgorod_"

# Имя файла PSD -> имя иконки в assets/map/shields
NAMES = {
    "Aksakovy": "aksakovy",
    "Bolshiy": "bolshiy",
    "Boretsky": "boretsky",
    "Esipov": "esipov",
    "Golitsyny": "golitsyny",
    "Kolychevi": "kolychevi",
    "Mishinich": "mishinich",
    "Molodye": "molodye",
    "Moscow": "moscow",
    "Novgorod": "novgorod",
    "Ontsiforovich": "ontsiforovich",
    "Ovinov": "ovinov",
    "Patrikeevy": "patrikeevy",
    "Prokshinich": "prokshinich",
    "Rogovichi": "rogovichi",
    "Ryurikovichi": "ryurikovichi",
    "Svoezemtsev": "svoezemtsev",
    "Volotskie": "volotskie",
}

# Цвета служебных щитов (сплошная заливка, без эмблем).
ENEMY_COLOR = (224, 122, 31, 255)
REBEL_COLOR = (24, 24, 24, 255)
# Светлый кант: без него чёрный щит теряется на тёмной карте.
OUTLINE_COLOR = (244, 234, 216, 255)
OUTLINE_WIDTH = 5

HEIGHT = 240


def render(psd_path: str) -> Image.Image:
    psd = PSDImage.open(psd_path)
    image = psd.composite().convert("RGBA")
    image = image.crop(image.getbbox())
    # У государственных PSD в файле половина щита: достраиваем зеркалом.
    if image.width < 600:
        mirrored = image.transpose(Image.FLIP_LEFT_RIGHT)
        full = Image.new("RGBA", (image.width * 2, image.height), (0, 0, 0, 0))
        full.paste(image, (0, 0))
        full.paste(mirrored, (image.width, 0))
        image = full
    return image


def normalize(image: Image.Image) -> Image.Image:
    width = round(image.width * HEIGHT / image.height)
    return image.resize((width, HEIGHT), Image.LANCZOS)


def solid_shield(template: Image.Image, color) -> Image.Image:
    """Силуэт шаблона, залитый одним цветом, со светлым кантом."""
    mask = template.split()[-1].point(lambda a: 255 if a > 40 else 0)
    flat = Image.new("RGBA", template.size, color)
    flat.putalpha(mask)
    # Кант: расширяем маску и красим её светлым, сверху кладём заливку.
    outline_mask = mask.filter(ImageFilter.MaxFilter(OUTLINE_WIDTH))
    outline = Image.new("RGBA", template.size, OUTLINE_COLOR)
    outline.putalpha(outline_mask)
    outline.alpha_composite(flat)
    return outline


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "map", "shields"
    )
    os.makedirs(dst, exist_ok=True)

    rendered = {}
    for key in NAMES:
        path = os.path.join(src, f"{SRC_PREFIX}{key}.psd")
        if not os.path.exists(path):
            print(f"! нет файла {path}")
            continue
        rendered[key] = normalize(render(path))

    # Общая ширина: щиты должны быть одного размера, иначе на карте «прыгает» ряд.
    width = max(image.width for image in rendered.values())
    for key, image in rendered.items():
        canvas = Image.new("RGBA", (width, HEIGHT), (0, 0, 0, 0))
        canvas.alpha_composite(image, ((width - image.width) // 2, 0))
        canvas.save(os.path.join(dst, f"{NAMES[key]}.png"))
        print("ok", NAMES[key], canvas.size)

    template = rendered["Moscow"]
    template_canvas = Image.new("RGBA", (width, HEIGHT), (0, 0, 0, 0))
    template_canvas.alpha_composite(template, ((width - template.width) // 2, 0))
    for name, color in (("enemy", ENEMY_COLOR), ("rebel", REBEL_COLOR)):
        solid = solid_shield(template_canvas, color)
        solid.save(os.path.join(dst, f"{name}.png"))
        print("ok", name, solid.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
