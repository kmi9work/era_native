/**
 * Двойное нажатие по карте: порог по времени и сдвигу пальца.
 * При 400 мс живое двойное нажатие человека (150–250 мс) распознаётся, а два
 * осознанных нажатия подряд — нет.
 */
import { DOUBLE_TAP_DP, DOUBLE_TAP_MS, isDoubleTap } from '../src/screens/map/tapDetect';

describe('двойное нажатие', () => {
  it('второй тап в пределах 400 мс и 30 dp — двойное', () => {
    const first = { time: 1000, x: 300, y: 400 };
    expect(isDoubleTap(first, { time: 1000 + DOUBLE_TAP_MS, x: 300, y: 400 })).toBe(true);
    expect(isDoubleTap(first, { time: 1200, x: 300 + DOUBLE_TAP_DP, y: 400 })).toBe(true);
  });

  it('слишком поздно или слишком далеко — не двойное', () => {
    const first = { time: 1000, x: 300, y: 400 };
    expect(isDoubleTap(first, { time: 1000 + DOUBLE_TAP_MS + 1, x: 300, y: 400 })).toBe(false);
    expect(isDoubleTap(first, { time: 1150, x: 300 + DOUBLE_TAP_DP + 1, y: 400 })).toBe(false);
    expect(isDoubleTap(first, { time: 1150, x: 300, y: 400 + DOUBLE_TAP_DP + 5 })).toBe(false);
  });

  it('первого тапа не было — двойного нет', () => {
    expect(isDoubleTap({ time: 0, x: 0, y: 0 }, { time: 1000, x: 300, y: 400 })).toBe(false);
  });
});
