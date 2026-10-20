/**
 * Раскладка сцены боя: чистая функция от размеров экрана и списков отрядов.
 *
 * Ни размеров в dp, ни координат в компонентах — только расчёт: ширина/высота
 * приходят из `onLayout`, потому что на телефоне, планшете и в ландшафте
 * раскладка обязана быть разной (Android-активити сама обрабатывает поворот,
 * см. `AndroidManifest.xml`, у iOS разрешён ландшафт в `Info.plist`).
 *
 * Правила раскладки:
 *  - две полосы (атакующие сверху, защищающиеся снизу) и центральная «ничейная»
 *    полоса между ними;
 *  - передний ряд каждой стороны — ближний к центру: именно он принимает удар;
 *  - размер фишки общий для обеих сторон и подбирается от максимального вниз,
 *    пока ряды влезают в полосу;
 *  - если не влезает даже минимальный размер — показываем сколько влезло и
 *    возвращаем `overflow`, чтобы сцена нарисовала «+N».
 */
import type { BattleSide } from '../../hooks/useBattleLogic';

export const BOARD_PAD = 12;
export const BOARD_GAP = 8;
/** Место под названием отряда под фишкой (две строки по 9–11 dp). */
export const BOARD_LABEL_H = 22;
/** Высота стены крепости над защищающимися. */
export const BOARD_WALL_H = 22;
export const DEFAULT_MAX_TOKEN = 64;
export const DEFAULT_MIN_TOKEN = 34;

export interface BoardBox {
  uid: string;
  side: BattleSide;
  x: number;
  y: number;
  size: number;
  row: number;
  column: number;
}

export interface BoardBand {
  top: number;
  height: number;
}

export interface BoardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardLayoutInput {
  width: number;
  height: number;
  attackers: string[];
  defenders: string[];
  fortressLevel?: number;
  maxToken?: number;
  minToken?: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  tokenSize: number;
  perRow: number;
  overflow: { attacker: number; defender: number };
  boxes: BoardBox[];
  bands: { attacker: BoardBand; center: BoardBand; defender: BoardBand };
  /** Стена крепости между центром и защищающимися; null — крепости нет. */
  wall: BoardRect | null;
  /** Линия горизонта для фона. */
  groundY: number;
}

const rowCapacity = (width: number, size: number): number =>
  Math.max(1, Math.floor((width - BOARD_PAD * 2 + BOARD_GAP) / (size + BOARD_GAP)));

const rowsThatFit = (bandHeight: number, size: number): number =>
  Math.max(0, Math.floor((bandHeight + BOARD_GAP) / (size + BOARD_LABEL_H + BOARD_GAP)));

/** Наибольший размер фишки, при котором все отряды стороны влезают в полосу. */
const bestTokenSize = (
  count: number,
  width: number,
  bandHeight: number,
  maxToken: number,
  minToken: number,
): number => {
  if (count === 0) return maxToken;
  for (let size = maxToken; size >= minToken; size -= 2) {
    const perRow = rowCapacity(width, size);
    const rows = Math.ceil(count / perRow);
    if (rows <= rowsThatFit(bandHeight, size)) return size;
  }
  return minToken;
};

export const computeBoardLayout = (input: BoardLayoutInput): BoardLayout => {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const maxToken = input.maxToken ?? DEFAULT_MAX_TOKEN;
  const minToken = input.minToken ?? DEFAULT_MIN_TOKEN;
  const wallHeight = (input.fortressLevel ?? 0) > 0 ? BOARD_WALL_H : 0;

  const centerHeight = Math.max(40, Math.round(height * 0.14));
  const centerTop = Math.round((height - centerHeight) / 2);
  const center: BoardBand = { top: centerTop, height: centerHeight };

  const attackerBand: BoardBand = {
    top: BOARD_PAD,
    height: Math.max(0, centerTop - BOARD_PAD),
  };
  const defenderTop = centerTop + centerHeight + (wallHeight > 0 ? wallHeight + 4 : 0);
  const defenderBand: BoardBand = {
    top: defenderTop,
    height: Math.max(0, height - defenderTop - BOARD_PAD),
  };

  const tokenSize = Math.min(
    bestTokenSize(input.attackers.length, width, attackerBand.height, maxToken, minToken),
    bestTokenSize(input.defenders.length, width, defenderBand.height, maxToken, minToken),
  );
  const perRow = rowCapacity(width, tokenSize);

  const boxes: BoardBox[] = [];
  const overflow = { attacker: 0, defender: 0 };

  const place = (uids: string[], side: BattleSide, band: BoardBand) => {
    if (uids.length === 0) return;
    const cell = tokenSize + BOARD_LABEL_H + BOARD_GAP;
    const capacityRows = Math.max(1, rowsThatFit(band.height, tokenSize));
    const capacity = capacityRows * perRow;
    const visible = uids.slice(0, capacity);
    overflow[side] = Math.max(0, uids.length - visible.length);

    const rows = Math.ceil(visible.length / perRow);
    // Блок рядов центрируется в своей полосе: строй стоит на поле, а не
    // прилипает к центральной линии, оставляя полэкрана пустым.
    const blockHeight = rows * cell - BOARD_GAP;
    const blockTop = Math.round(band.top + Math.max(0, (band.height - blockHeight) / 2));
    const blockBottom = blockTop + blockHeight;

    visible.forEach((uid, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const inRow = Math.min(perRow, visible.length - row * perRow);
      const rowWidth = inRow * tokenSize + (inRow - 1) * BOARD_GAP;
      const x = Math.round((width - rowWidth) / 2 + column * (tokenSize + BOARD_GAP));
      // Передний ряд (row 0) — ближний к центру: у атакующих это низ блока,
      // у защищающихся — верх.
      const y =
        side === 'attacker'
          ? Math.round(blockBottom - (row + 1) * cell + BOARD_GAP)
          : Math.round(blockTop + row * cell);
      boxes.push({ uid, side, x, y, size: tokenSize, row, column });
    });
  };

  place(input.attackers, 'attacker', attackerBand);
  place(input.defenders, 'defender', defenderBand);

  return {
    width,
    height,
    tokenSize,
    perRow,
    overflow,
    boxes,
    bands: { attacker: attackerBand, center, defender: defenderBand },
    wall:
      wallHeight > 0
        ? {
            x: BOARD_PAD,
            y: centerTop + centerHeight + 2,
            width: Math.max(0, width - BOARD_PAD * 2),
            height: wallHeight,
          }
        : null,
    groundY: centerTop + Math.round(centerHeight / 2),
  };
};
