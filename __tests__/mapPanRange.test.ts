/**
 * Границы пана карты (`src/screens/map/mapStyle.ts`): свободный ход за край
 * экрана — 50 % ширины и 30 % высоты (решение заказчика).
 *
 * Проверяется то, чего не видно на экране: раньше `clampView` держал карту в
 * рамках (вписанная стояла по центру намертво), теперь по каждой оси есть
 * свободный ход ровно заданной доли, и он не зависит от того, больше карта
 * экрана или меньше.
 */
import { PAN_SLACK_X, PAN_SLACK_Y, panRange } from '../src/screens/map/mapStyle';

describe('свободный ход карты за край экрана', () => {
  it('доли — 50 % ширины и 30 % высоты', () => {
    expect(PAN_SLACK_X).toBe(0.5);
    expect(PAN_SLACK_Y).toBe(0.3);
  });

  it('вписанная карта сдвигается на половину экрана влево и вправо', () => {
    const view = 1000;
    const map = 1000; // карта ровно по экрану
    const [min, max] = panRange(view, map, view * PAN_SLACK_X);
    expect(min).toBe(-500);
    expect(max).toBe(500);
  });

  it('вписанная по высоте карта сдвигается на 30 % высоты', () => {
    const view = 600;
    const map = 600;
    const [min, max] = panRange(view, map, view * PAN_SLACK_Y);
    expect(min).toBe(-180);
    expect(max).toBe(180);
  });

  it('карта меньше экрана: ход считается от центра, а не от нуля', () => {
    const [min, max] = panRange(1000, 600, 500);
    // Центр вписанной карты — 200, свободный ход ±500
    expect(min).toBe(-300);
    expect(max).toBe(700);
  });

  it('увеличенная карта: обычные границы плюс свободный ход', () => {
    const [min, max] = panRange(1000, 2000, 500);
    expect(min).toBe(-1500); // 1000 - 2000 - 500
    expect(max).toBe(500);
  });

  it('общий ход по оси = карта минус экран плюс два свободных хода', () => {
    const view = 1000;
    const map = 3000;
    const slack = view * PAN_SLACK_X;
    const [min, max] = panRange(view, map, slack);
    // Было [1000-3000, 0] = 2000 хода; со свободным ходом 2×500 = 3000.
    expect(max - min).toBe(map - view + 2 * slack);
    expect(max - min).toBe(3000);
  });
});
