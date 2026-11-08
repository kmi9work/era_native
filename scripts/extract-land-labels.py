"""Манифест подписей земель для экрана «Карта» (era_native).

Верхний слой карты — растровый `map-base.png`: названия земель на нём НАРИСОВАНЫ
(группа «Название земель» в map.psd), города и их подписи из подложки убраны.
Поэтому рядом с названием земли нельзя поставить текст «по имени» — нужна точка:
скрипт снимает bbox каждого текстового слоя группы и считает координату сразу за
правым краем названия (там клиент рисует общественный порядок земли).

Запуск: /usr/bin/python3 scripts/extract-land-labels.py   (нужен psd-tools)
Результат: src/screens/map/landLayout.ts — руками не править.
"""
import json
import os
import re

from psd_tools import PSDImage

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PSD = os.path.join(os.path.dirname(REPO), 'tmp', 'map.psd')
OUT = os.path.join(REPO, 'src', 'screens', 'map', 'landLayout.ts')

GROUP = 'Название земель'
# Отступ числа от правого края названия, px полотна 2881.
PAD = 10
# Кегль оцениваем по высоте строки: высота заглавных ≈ 0.72 em.
CAP_RATIO = 0.72


def normalize(name: str) -> str:
    text = (name or '').replace('\r', ' ').replace('\n', ' ').replace('ё', 'е')
    text = text.lower().replace('-', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def main() -> None:
    psd = PSDImage.open(PSD)
    width, height = psd.size
    group = next((layer for layer in psd if layer.name == GROUP), None)
    if group is None:
        raise SystemExit(f'нет группы «{GROUP}» в {PSD}')

    rows = []
    for layer in group:
        if layer.kind != 'type' or not layer.visible:
            continue
        text = (layer.text or '').strip()
        if not text:
            continue
        left, top, right, bottom = layer.bbox
        lines = [line for line in re.split(r'[\r\n]+', text) if line.strip()]
        lines_count = max(1, len(lines))
        line_height = (bottom - top) / lines_count
        rows.append(
            {
                'key': normalize(text),
                'title': ' '.join(text.split()),
                'x': (right + PAD) / width,
                'y': (top + line_height / 2) / height,
                'font': round(line_height / CAP_RATIO, 2),
            }
        )

    rows.sort(key=lambda row: row['key'])
    seen = set()
    for row in rows:
        if row['key'] in seen:
            raise SystemExit(f"дубль подписи земли: {row['title']!r}")
        seen.add(row['key'])

    body = '\n'.join(
        "  {key}: {{ x: {x:.5f}, y: {y:.5f}, font: {font} }},".format(
            key=repr(row['key']).replace("'", "'"),
            x=row['x'],
            y=row['y'],
            font=row['font'],
        )
        for row in rows
    )

    content = f'''/**
 * Подписи земель на полотне карты: сняты с map.psd (группа «{GROUP}»).
 * Файл сгенерирован скриптом scripts/extract-land-labels.py — править вручную
 * не нужно.
 *
 * Названия земель нарисованы на самой подложке `map-base.png`, поэтому манифест
 * хранит не положение текста, а точку СРАЗУ ЗА его правым краем: там клиент
 * пишет общественный порядок земли в скобках. x/y — в долях полотна (0..1),
 * font — кегль названия в пикселях исходника (полотно 2881), от него считается
 * кегль числа.
 */
export interface LandLabelLayout {{
  x: number;
  y: number;
  font: number;
}}

/** Ключ — нормализованное название земли (регистр, «ё», дефисы не важны). */
export const LAND_LABEL_LAYOUT: Record<string, LandLabelLayout> = {{
{body}
}};

/**
 * Названия, которые на карте и в базе отличаются: подпись на полотне → имя
 * земли в БД (ключ — нормализованное имя земли, значение — ключ манифеста).
 */
export const LAND_LABEL_ALIASES: Record<string, string> = {{
  'ногайская орда': 'ногайское ханство',
}};

/** Нормализация названия земли для поиска в манифесте. */
export const normalizeLandName = (name: string): string =>
  (name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/-/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

/** Раскладка подписи земли; для неизвестной земли — null (число не рисуем). */
export const landLabelFor = (name: string): LandLabelLayout | null => {{
  const key = normalizeLandName(name);
  return LAND_LABEL_LAYOUT[LAND_LABEL_ALIASES[key] ?? key] ?? null;
}};
'''

    with open(OUT, 'w', encoding='utf-8') as handle:
        handle.write(content)
    print(f'записано {len(rows)} подписей земель → {OUT}')
    print(json.dumps({row['key']: row['title'] for row in rows}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
