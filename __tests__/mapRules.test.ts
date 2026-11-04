/**
 * Правила карты: цвет и иконка маркера, нормализация имён и раскладка подписей.
 * Числа раскладки сняты с исходника карты — тест держит их от случайной правки.
 */
import {
  FORTRESS_COLORS,
  fortressLabel,
  fortressLevelOf,
  isCapitalSettlement,
  markerColor,
} from '../src/screens/map/mapStyle';
import { CITY_LABEL_LAYOUT, labelLayoutFor, normalizeCityName } from '../src/screens/map/cityLayout';
import type { Settlement } from '../src/types';

const settlement = (patch: Partial<Settlement>): Settlement => ({
  id: 1,
  name: 'Тест',
  ...patch,
});

describe('уровень и цвет крепости', () => {
  it('берёт fortress_level с сервера и ограничивает 0..3', () => {
    expect(fortressLevelOf(settlement({ fortress_level: 2 }))).toBe(2);
    expect(fortressLevelOf(settlement({ fortress_level: undefined }))).toBe(0);
    expect(fortressLevelOf(settlement({ fortress_level: 9 }))).toBe(3);
    expect(fortressLevelOf(settlement({ fortress_level: -2 }))).toBe(0);
  });

  it('красит маркер по уровню: чёрный, коричневый, синий, красный', () => {
    expect([0, 1, 2, 3].map(markerColor)).toEqual(FORTRESS_COLORS);
    expect(FORTRESS_COLORS).toEqual(['#1f1f1f', '#8b5a2b', '#2f6fb5', '#b3382c']);
  });

  it('подписывает уровень для панели и легенды', () => {
    expect(fortressLabel(0)).toBe('без крепости');
    expect(fortressLabel(3)).toBe('кремль 3 ур.');
  });
});

describe('столица', () => {
  it('корона только у типов 2 «Столица» и 4 «Столичная земля»', () => {
    expect(isCapitalSettlement(settlement({ settlement_type_id: 2 }))).toBe(true);
    expect(isCapitalSettlement(settlement({ settlement_type_id: 4 }))).toBe(true);
    expect(isCapitalSettlement(settlement({ settlement_type_id: 1 }))).toBe(false);
    expect(isCapitalSettlement(settlement({ settlement_type_id: 3 }))).toBe(false);
  });
});

describe('раскладка подписей из PSD', () => {
  it('манифест покрывает все 69 городов карты', () => {
    expect(Object.keys(CITY_LABEL_LAYOUT)).toHaveLength(69);
  });

  it('находит подпись без учёта регистра и дефисов', () => {
    expect(normalizeCityName('Новгород-Северский')).toBe('новгород северский');
    expect(labelLayoutFor('Новгород-Северский')).not.toBeNull();
    expect(labelLayoutFor('новгород-северский')).toEqual(labelLayoutFor('Новгород-Северский'));
  });

  it('кегль крупных городов совпадает с исходником', () => {
    expect(labelLayoutFor('Москва')?.font).toBe(33.33);
    expect(labelLayoutFor('Тверь')?.font).toBe(33.33);
    expect(labelLayoutFor('Псков')?.font).toBe(16.67);
  });

  it('подпись стоит выше маркера (dy < 0)', () => {
    expect(labelLayoutFor('Москва')!.dy).toBeLessThan(0);
    expect(labelLayoutFor('Великий Новгород')!.dy).toBeLessThan(0);
  });

  it('неизвестный город не ломает раскладку', () => {
    expect(labelLayoutFor('Новый город')).toBeNull();
  });
});
