/**
 * Раскладка сцены боя: чистая функция от размеров экрана и состава армий.
 *
 * Ни размеров в dp, ни координат в компонентах — только расчёт: ширина/высота
 * приходят из `onLayout`, потому что на телефоне, планшете и в ландшафте
 * раскладка обязана быть разной (Android-активити сама обрабатывает поворот,
 * см. `AndroidManifest.xml`, у iOS разрешён ландшафт в `Info.plist`).
 *
 * Правила раскладки:
 *  - две полосы (атакующие сверху, защищающиеся снизу) и центральная «ничейная»
 *    полоса между ними;
 *  - армия — блок по размеру своих отрядов (как `inline-block`): блоки идут в
 *    строку друг за другом и переносятся на следующую строку, когда не влезают.
 *    Рамка и подпись армии отделяют её отряды от соседней армии;
 *  - передний ряд блока — ближний к центру: именно он принимает удар;
 *  - слева у полос резервируется колонка `gutter` под крупный счётчик попаданий,
 *    поэтому фишки не прыгают, когда счётчик появляется;
 *  - размер фишки общий для обеих сторон и подбирается от максимального вниз,
 *    пока блоки влезают в полосу;
 *  - если не влезает даже минимальный размер — показываем сколько влезло и
 *    возвращаем `overflow`, чтобы сцена нарисовала «+N».
 */
import type { BattleSide } from '../../hooks/useBattleLogic';

export const BOARD_PAD = 12;
/** Просвет между фишками. */
export const BOARD_GAP = 8;
/** Место под названием отряда под фишкой (две строки по 9–11 dp). */
export const BOARD_LABEL_H = 22;
/** Высота стены крепости над защищающимися. */
export const BOARD_WALL_H = 22;
/** Полоса под названием армии над её блоком отрядов. */
export const BOARD_GROUP_HEAD_H = 18;
/** Просвет между блоками армий одной стороны. */
export const BOARD_GROUP_GAP = 10;
/** Внутренние поля рамки армии. */
export const BOARD_BLOCK_PAD = 8;
export const BOARD_BLOCK_PAD_Y = 6;
export const DEFAULT_MAX_TOKEN = 64;
export const DEFAULT_MIN_TOKEN = 34;

/** Армия на сцене: подпись рамки и её отряды по порядку. */
export interface BoardGroup {
  uid: string;
  label: string;
  uids: string[];
}

export interface BoardBox {
  uid: string;
  side: BattleSide;
  /** Армия отряда: по ней сцена рисует принадлежность. */
  armyUid: string;
  x: number;
  y: number;
  size: number;
  row: number;
  column: number;
}

/** Рамка армии на сцене: подпись сверху, внутри — ряды фишек. */
export interface BoardGroupBox {
  uid: string;
  side: BattleSide;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Сколько отрядов армии показано и сколько их всего (остальные в «+N»). */
  visible: number;
  total: number;
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
  /** Отряды стороны одним строем — когда армий на стороне нет (тесты, пустая сцена). */
  attackers: string[];
  defenders: string[];
  /** Армии нападающих и защищающихся: по блоку на армию. */
  attackerGroups?: BoardGroup[];
  defenderGroups?: BoardGroup[];
  fortressLevel?: number;
  maxToken?: number;
  minToken?: number;
  /** Ширина левой колонки под счётчики попаданий. */
  gutter?: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  tokenSize: number;
  /** Сколько фишек влезает в строку полосы: ориентир для тестов и подсказок. */
  perRow: number;
  overflow: { attacker: number; defender: number };
  boxes: BoardBox[];
  /** Рамки армий: рисуются под фишками. */
  groups: BoardGroupBox[];
  bands: { attacker: BoardBand; center: BoardBand; defender: BoardBand };
  /** Стена крепости между центром и защищающимися; null — крепости нет. */
  wall: BoardRect | null;
  /** Линия горизонта для фона. */
  groundY: number;
  /** Колонка счётчиков попаданий слева от строёв. */
  gutter: number;
}

interface PlannedBlock {
  group: BoardGroup;
  count: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** Положение блока внутри полосы (без внешнего отступа `BOARD_PAD`). */
  x: number;
  y: number;
}

const rowCapacity = (contentWidth: number, size: number): number =>
  Math.max(1, Math.floor((contentWidth + BOARD_GAP) / (size + BOARD_GAP)));

const blockWidth = (cols: number, size: number): number =>
  cols * size + (cols - 1) * BOARD_GAP + BOARD_BLOCK_PAD * 2;

/**
 * Оценка ширины подписи армии: рамка не должна обрезать название («Гарнизон
 * Твери» шире одной фишки). Точная мера текста потребовала бы отрисовки, а
 * промах в пару dp не критичен — подпись всё равно с многоточием.
 */
const labelWidth = (label: string, limit: number): number => {
  if (!label) return 0;
  // 6.2 dp на символ — ширина жирного шрифта 10 dp с кириллицей.
  return Math.min(limit, Math.ceil(label.length * 6.2) + 16);
};

const blockHeight = (rows: number, size: number): number =>
  BOARD_GROUP_HEAD_H +
  rows * (size + BOARD_LABEL_H) +
  (rows - 1) * BOARD_GAP +
  BOARD_BLOCK_PAD_Y;

/** Сколько колонок отрядов брать в блоке: сколько фишек влезает в строку полосы. */
const colsFor = (count: number, size: number, contentWidth: number): number =>
  Math.max(1, Math.min(count, rowCapacity(contentWidth - BOARD_BLOCK_PAD * 2, size)));

/**
 * Разложить блоки армий в строку с переносом (как `flex-wrap`).
 * Возвращает блоки с координатами и высоту всего строя.
 */
const planSide = (
  groups: BoardGroup[],
  counts: number[],
  size: number,
  contentWidth: number,
): { blocks: PlannedBlock[]; height: number } => {
  const blocks: PlannedBlock[] = groups.map((group, index) => {
    const count = counts[index];
    const cols = colsFor(Math.max(1, count), size, contentWidth);
    const rows = Math.max(1, Math.ceil(count / cols));
    return {
      group,
      count,
      cols,
      rows,
      width: Math.max(
        blockWidth(Math.min(count, cols), size),
        labelWidth(group.label, contentWidth),
      ),
      height: blockHeight(rows, size),
      x: 0,
      y: 0,
    };
  });

  // Строки, как `flex-wrap` у `inline-block`: блок идёт в текущую строку,
  // пока влезает по ширине, иначе начинается следующая.
  const rows: PlannedBlock[][] = [];
  let x = 0;
  blocks.forEach(block => {
    const row = rows[rows.length - 1];
    if (row && x + block.width <= contentWidth) {
      row.push(block);
      x += block.width + BOARD_GROUP_GAP;
    } else {
      rows.push([block]);
      x = block.width + BOARD_GROUP_GAP;
    }
  });

  // Строки центрируются по ширине полосы (как `text-align: center`): строй
  // стоит по центру поля, а не липнет к левому краю на широком планшете.
  let top = 0;
  rows.forEach(row => {
    const rowWidth =
      row.reduce((sum, block) => sum + block.width, 0) +
      Math.max(0, row.length - 1) * BOARD_GROUP_GAP;
    let cursor = Math.max(0, Math.round((contentWidth - rowWidth) / 2));
    let rowHeight = 0;
    row.forEach(block => {
      block.x = cursor;
      block.y = top;
      cursor += block.width + BOARD_GROUP_GAP;
      rowHeight = Math.max(rowHeight, block.height);
    });
    top += rowHeight + BOARD_GROUP_GAP;
  });

  const height = rows.length > 0 ? top - BOARD_GROUP_GAP : 0;
  return { blocks, height };
};

/** Наибольший размер фишки, при котором блоки стороны влезают в полосу. */
const bestTokenSize = (
  groups: BoardGroup[],
  counts: number[],
  contentWidth: number,
  bandHeight: number,
  maxToken: number,
  minToken: number,
): number => {
  if (groups.length === 0) return maxToken;
  for (let size = maxToken; size >= minToken; size -= 2) {
    if (planSide(groups, counts, size, contentWidth).height <= bandHeight) return size;
  }
  return minToken;
};

/**
 * Урезать армии, если даже минимальные фишки не влезают: отряды убираются у
 * самой большой армии, остальные уходят в счётчик «+N» рамки.
 */
const fitCounts = (
  groups: BoardGroup[],
  counts: number[],
  size: number,
  contentWidth: number,
  bandHeight: number,
): number[] => {
  const current = [...counts];
  let guard = current.reduce((sum, count) => sum + count, 0) + 1;
  while (guard > 0 && planSide(groups, current, size, contentWidth).height > bandHeight) {
    guard -= 1;
    let biggest = -1;
    current.forEach((count, index) => {
      if (count <= 0) return;
      if (biggest === -1 || count > current[biggest]) biggest = index;
    });
    if (biggest === -1) break;
    current[biggest] -= 1;
  }
  return current;
};

/** Строи из списков отрядов: сторона без армий рисуется одним блоком без подписи. */
const normalizeGroups = (groups: BoardGroup[] | undefined, uids: string[] | undefined): BoardGroup[] => {
  const source =
    groups && groups.length > 0
      ? groups
      : [{ uid: 'side', label: '', uids: uids ?? [] }];
  return source
    .map(group => ({ ...group, uids: group.uids ?? [] }))
    .filter(group => group.uids.length > 0);
};

export const computeBoardLayout = (input: BoardLayoutInput): BoardLayout => {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const maxToken = input.maxToken ?? DEFAULT_MAX_TOKEN;
  const minToken = input.minToken ?? DEFAULT_MIN_TOKEN;
  const gutter = Math.max(0, input.gutter ?? 0);
  const contentLeft = BOARD_PAD + gutter;
  const contentWidth = Math.max(0, width - contentLeft - BOARD_PAD);
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

  const attackerGroups = normalizeGroups(input.attackerGroups, input.attackers);
  const defenderGroups = normalizeGroups(input.defenderGroups, input.defenders);

  const tokenSize = Math.min(
    bestTokenSize(
      attackerGroups,
      attackerGroups.map(group => group.uids.length),
      contentWidth,
      attackerBand.height,
      maxToken,
      minToken,
    ),
    bestTokenSize(
      defenderGroups,
      defenderGroups.map(group => group.uids.length),
      contentWidth,
      defenderBand.height,
      maxToken,
      minToken,
    ),
  );
  const cell = tokenSize + BOARD_LABEL_H + BOARD_GAP;

  const boxes: BoardBox[] = [];
  const frames: BoardGroupBox[] = [];
  const overflow = { attacker: 0, defender: 0 };

  const place = (groups: BoardGroup[], side: BattleSide, band: BoardBand) => {
    if (groups.length === 0) return;

    const counts = fitCounts(
      groups,
      groups.map(group => group.uids.length),
      tokenSize,
      contentWidth,
      band.height,
    );
    const planned = planSide(groups, counts, tokenSize, contentWidth);
    // Строй целиком центрируется в своей полосе: блоки стоят на поле, а не
    // прилипают к центральной линии, оставляя полэкрана пустым.
    const blockTop = Math.round(band.top + Math.max(0, (band.height - planned.height) / 2));

    planned.blocks.forEach(block => {
      const visible = block.group.uids.slice(0, block.count);
      const frameX = contentLeft + block.x;
      const frameY = blockTop + block.y;
      frames.push({
        uid: block.group.uid,
        side,
        label: block.group.label,
        x: frameX,
        y: frameY,
        width: block.width,
        height: block.height,
        visible: visible.length,
        total: block.group.uids.length,
      });
      overflow[side] += block.group.uids.length - visible.length;

      const innerWidth = block.width - BOARD_BLOCK_PAD * 2;
      visible.forEach((uid, index) => {
        const row = Math.floor(index / block.cols);
        const column = index % block.cols;
        const inRow = Math.min(block.cols, visible.length - row * block.cols);
        const rowWidth = inRow * tokenSize + (inRow - 1) * BOARD_GAP;
        const x = Math.round(
          frameX + BOARD_BLOCK_PAD + (innerWidth - rowWidth) / 2 + column * (tokenSize + BOARD_GAP),
        );
        // Передний ряд (row 0) — ближний к центру: у атакующих это низ блока,
        // у защищающихся — верх.
        const visualRow = side === 'attacker' ? block.rows - 1 - row : row;
        const y = Math.round(frameY + BOARD_GROUP_HEAD_H + visualRow * cell);
        boxes.push({ uid, side, armyUid: block.group.uid, x, y, size: tokenSize, row, column });
      });
    });
  };

  place(attackerGroups, 'attacker', attackerBand);
  place(defenderGroups, 'defender', defenderBand);

  return {
    width,
    height,
    tokenSize,
    perRow: rowCapacity(contentWidth, tokenSize),
    overflow,
    boxes,
    groups: frames,
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
    gutter,
  };
};
