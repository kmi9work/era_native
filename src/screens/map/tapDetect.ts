/**
 * Распознавание двойного нажатия по карте (создание армии).
 *
 * Считаем сами, а не двумя жестами RNGH: связка `Gesture.Exclusive(double, single)`
 * задерживала одиночный тап на время ожидания второго, а на планшете двойное
 * нажатие не срабатывало вовсе. Одиночный тап здесь срабатывает сразу; если
 * второй тап пришёл в пределах `DOUBLE_TAP_MS` и почти в ту же точку — это двойное.
 */
export const DOUBLE_TAP_MS = 400;
/** Допустимый сдвиг пальца между нажатиями, dp. */
export const DOUBLE_TAP_DP = 30;

export interface TapPoint {
  /** Время нажатия, мс. */
  time: number;
  /** Экранные координаты, dp. */
  x: number;
  y: number;
}

/** Второй тап считается двойным: `previous.time = 0` — предыдущего тапа нет. */
export const isDoubleTap = (previous: TapPoint, next: TapPoint): boolean => {
  if (!previous.time) return false;
  const elapsed = next.time - previous.time;
  if (elapsed < 0 || elapsed > DOUBLE_TAP_MS) return false;
  return Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_DP;
};
