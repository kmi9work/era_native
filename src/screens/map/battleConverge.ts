/**
 * Раскладка армий у места сражения (правило заказчика): в момент начала боя
 * армии сходятся к его точке — атакующие слева, защищающиеся справа, каждая на
 * своём месте, чтобы щиты не перекрывали друг друга.
 *
 * Координаты — нормализованные 0..1 от полотна карты (те же, что
 * `armies.map_x/map_y`), поэтому раскладка переживает перезапуск приложения: она
 * сохраняется на бэкенд обычным перемещением армии.
 *
 * Точка сражения — город (`city:<id>`, якорь по метке города) или армия
 * (`army:<id>`, якорь по координатам армии). Колонки смещены от якоря по
 * горизонтали, чтобы щит не наезжал на метку/цель, а армии в колонке стоят
 * симметрично относительно высоты якоря.
 */
import type { PlannedBattle } from './battlePlan';

export interface ConvergePoint {
  x: number;
  y: number;
}

export interface ConvergePosition extends ConvergePoint {
  armyId: number;
}

/** Горизонтальный сдвиг колонки от точки боя (доля полотна ~55 px при вписанной карте). */
export const CONVERGE_COLUMN_OFFSET = 0.055;

/** Шаг между армиями в одной колонке. */
export const CONVERGE_ROW_OFFSET = 0.045;

/** Поле у края полотна: армию не выставляем за границу карты. */
export const CONVERGE_EDGE = 0.02;

const clamp = (value: number): number =>
  Math.min(1 - CONVERGE_EDGE, Math.max(CONVERGE_EDGE, value));

/** Колонка армий: симметрично относительно `anchorY`, шаг `CONVERGE_ROW_OFFSET`. */
const column = (ids: number[], x: number, anchorY: number): ConvergePosition[] => {
  const middle = (ids.length - 1) / 2;
  return ids.map((armyId, index) => ({
    armyId,
    x: clamp(x),
    y: clamp(anchorY + (index - middle) * CONVERGE_ROW_OFFSET),
  }));
};

/** Позиции армий одного сражения: нападающие слева от точки, защищающиеся справа. */
export const battleConvergePositions = (
  battle: PlannedBattle,
  anchor: ConvergePoint,
): ConvergePosition[] => [
  ...column(battle.attackerIds, anchor.x - CONVERGE_COLUMN_OFFSET, anchor.y),
  ...column(battle.defenderIds, anchor.x + CONVERGE_COLUMN_OFFSET, anchor.y),
];

/**
 * То же для всего набранного плана: точки сражений передаются по ключу
 * (`city:<id>` / `army:<id>`). Сражение без якоря (город или армия исчезли из
 * данных) пропускается — его армии остаются на прежнем месте.
 */
export const planConvergePositions = (
  plan: PlannedBattle[],
  anchors: Record<string, ConvergePoint | undefined>,
): ConvergePosition[] =>
  plan.flatMap(battle => {
    const anchor = anchors[battle.key];
    return anchor ? battleConvergePositions(battle, anchor) : [];
  });
