/**
 * Тесты правил сражения (`src/services/battleRules.ts`).
 *
 * Правила взяты из ТЗ экрана «Сражения»: пороги попадания по типам отрядов,
 * бонусы крепости (только защищающимся в городе), бонус/дебафф мастера,
 * авто-выбор самых слабых потерь и отступление на 4–6.
 */
import {
  armyCountryId,
  armyModifier,
  autoCasualties,
  battleTroopsFromArmy,
  canRetreat,
  countHits,
  effectiveRoll,
  fortressDiceBonus,
  fortressLevelFromSettlement,
  fortressRequiresCannon,
  hitThreshold,
  isCapitalSettlement,
  isHit,
  participates,
  rollDie,
  troopKindFromName,
  troopKindFromTroop,
  weakestFirst,
} from '../src/services/battleRules';
import type { Army, Settlement } from '../src/types';

const troop = (kind: 'infantry' | 'heavy_infantry' | 'cavalry' | 'cannon', order: number) => ({
  kind,
  order,
});

describe('пороги попадания', () => {
  it('пехота попадает на 5–6, тяжёлая — на 4–6, конница — на 3–6', () => {
    expect(hitThreshold('infantry')).toBe(5);
    expect(hitThreshold('heavy_infantry')).toBe(4);
    expect(hitThreshold('cavalry')).toBe(3);
    expect(hitThreshold('cannon')).toBeNull();
  });

  it('пушка не участвует в бросках и не попадает', () => {
    expect(participates('cannon')).toBe(false);
    expect(participates('infantry')).toBe(true);
    expect(isHit('cannon', 6)).toBe(false);
  });

  it('попадание считается по эффективному значению кубика', () => {
    expect(isHit('infantry', 4)).toBe(false);
    expect(isHit('infantry', 5)).toBe(true);
    expect(isHit('cavalry', 3)).toBe(true);
    expect(isHit('heavy_infantry', 3)).toBe(false);
  });
});

describe('модификаторы', () => {
  it('бонус мастера +1 и дебафф −1 складываются в один модификатор', () => {
    expect(armyModifier(1, 0)).toBe(1);
    expect(armyModifier(0, 1)).toBe(-1);
    expect(armyModifier(2, 1)).toBe(1);
    expect(armyModifier(0, 0)).toBe(0);
  });

  it('крепость 1 уровня не даёт бонуса, 2 — +1, 3 — +2', () => {
    expect(fortressDiceBonus(0)).toBe(0);
    expect(fortressDiceBonus(1)).toBe(0);
    expect(fortressDiceBonus(2)).toBe(1);
    expect(fortressDiceBonus(3)).toBe(2);
  });

  it('без пушки нельзя напасть только при крепости 1 уровня и выше', () => {
    expect(fortressRequiresCannon(0)).toBe(false);
    expect(fortressRequiresCannon(1)).toBe(true);
    expect(fortressRequiresCannon(3)).toBe(true);
  });

  it('эффективное значение = бросок + модификатор армии + бонус крепости', () => {
    expect(effectiveRoll(4, { modifier: 1, fortressBonus: 2 })).toBe(7);
    expect(effectiveRoll(3, { modifier: -1 })).toBe(2);
    // Дебафф может сделать бросок 3 непопадающим для конницы (3 + (-1) = 2).
    expect(isHit('cavalry', effectiveRoll(3, { modifier: -1 }))).toBe(false);
  });
});

describe('бросок и отступление', () => {
  it('к6 выдаёт значения 1..6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999)).toBe(6);
    expect(rollDie(() => 0.5)).toBe(4);
  });

  it('отступление удаётся на 4–6', () => {
    expect(canRetreat(3)).toBe(false);
    expect(canRetreat(4)).toBe(true);
    expect(canRetreat(6)).toBe(true);
  });
});

describe('типы отрядов', () => {
  it('названия с бэкенда распознаются, включая «Кавалерия» как конницу', () => {
    expect(troopKindFromName('Пехота')).toBe('infantry');
    expect(troopKindFromName('Тяжелая пехота')).toBe('heavy_infantry');
    expect(troopKindFromName('Тяжёлая пехота')).toBe('heavy_infantry');
    expect(troopKindFromName('Кавалерия')).toBe('cavalry');
    expect(troopKindFromName('Конница')).toBe('cavalry');
    expect(troopKindFromName('Пушка')).toBe('cannon');
    expect(troopKindFromName('')).toBeNull();
  });

  it('без названия тип выводится по силе типа, затем по id типа', () => {
    expect(troopKindFromTroop({ id: 1, troop_type: { id: 9, name: '', params: { power: 5 } } })).toBe(
      'cavalry',
    );
    expect(troopKindFromTroop({ id: 2, troop_type: { id: 4, name: '' } })).toBe('cannon');
    expect(troopKindFromTroop({ id: 3, troop_type: { id: 2, name: '' } })).toBe('heavy_infantry');
    expect(troopKindFromTroop({ id: 4, troop_type: { id: 1, name: '' } })).toBe('infantry');
  });
});

describe('крепость и столица', () => {
  const city = (buildings: Settlement['buildings']): Settlement => ({
    id: 1,
    name: 'Москва',
    settlement_type_id: 2,
    settlement_type: { id: 2, name: 'Столица' },
    buildings,
  });

  it('уровень крепости берётся из постройки «Кремль», 0 — если её нет', () => {
    expect(fortressLevelFromSettlement(city([]))).toBe(0);
    expect(
      fortressLevelFromSettlement(
        city([
          { id: 1, building_type_name: 'Церковь', building_level_level: 3 },
          { id: 2, building_type_name: 'Кремль', building_level_level: 2 },
        ]),
      ),
    ).toBe(2);
  });

  it('уровень читается и из вложенного building_level (другая форма ответа)', () => {
    expect(
      fortressLevelFromSettlement(
        city([
          {
            id: 3,
            building_level: { level: 3, building_type: { id: 2, name: 'Кремль' } },
          },
        ]),
      ),
    ).toBe(3);
  });

  it('столица определяется по типу поселения', () => {
    expect(isCapitalSettlement(city([]))).toBe(true);
    expect(
      isCapitalSettlement({ id: 2, name: 'Коломна', settlement_type_id: 1, settlement_type: { id: 1, name: 'Город' } }),
    ).toBe(false);
    expect(isCapitalSettlement(null)).toBe(false);
  });
});

describe('выбор потерь', () => {
  it('самые слабые отряды идут первыми: пехота → тяжёлая → конница → пушка', () => {
    const troops = [
      troop('cavalry', 1),
      troop('infantry', 2),
      troop('cannon', 3),
      troop('heavy_infantry', 4),
    ];
    expect(weakestFirst(troops).map(t => t.kind)).toEqual([
      'infantry',
      'heavy_infantry',
      'cavalry',
      'cannon',
    ]);
  });

  it('при равной силе порядок добавления сохраняется', () => {
    const troops = [troop('infantry', 2), troop('infantry', 1)];
    expect(weakestFirst(troops).map(t => t.order)).toEqual([1, 2]);
  });

  it('авто-выбор берёт N самых слабых и не больше, чем есть отрядов', () => {
    const troops = [
      troop('cavalry', 1),
      troop('infantry', 2),
      troop('heavy_infantry', 3),
    ];
    expect(autoCasualties(troops, 2).map(t => t.kind)).toEqual(['infantry', 'heavy_infantry']);
    expect(autoCasualties(troops, 0)).toEqual([]);
    expect(autoCasualties(troops, 10)).toHaveLength(3);
  });
});

describe('попадания и состав армии', () => {
  it('считаются только попадания, пушка не попадает', () => {
    expect(
      countHits([
        { kind: 'infantry', value: 5 },
        { kind: 'infantry', value: 4 },
        { kind: 'cavalry', value: 3 },
        { kind: 'cannon', value: 6 },
      ]),
    ).toBe(2);
  });

  it('отряды армии превращаются в карточки с типом и порядком', () => {
    const army = {
      id: 7,
      name: 'Молодые',
      troops: [
        { id: 1, troop_type: { id: 1, name: 'Пехота' } },
        { id: 2, troop_type: { id: 3, name: 'Кавалерия' } },
      ],
    } as Army;

    const troops = battleTroopsFromArmy(army, 0, 'a7');
    expect(troops.map(t => t.kind)).toEqual(['infantry', 'cavalry']);
    expect(troops.map(t => t.uid)).toEqual(['a7-t0', 'a7-t1']);
    expect(troops.every(t => t.source === 'backend')).toBe(true);
  });

  it('государство армии: country_id → владелец-страна → игрок → регион стоянки', () => {
    const regionCountryId = (regionId?: number | null) => (regionId === 5 ? 42 : null);

    expect(armyCountryId({ id: 1, name: 'A', country_id: 3 } as Army, regionCountryId)).toBe(3);
    expect(
      armyCountryId(
        { id: 2, name: 'B', owner_type: 'Country', owner: { id: 4, name: 'Русь' } } as Army,
        regionCountryId,
      ),
    ).toBe(4);
    expect(
      armyCountryId(
        { id: 3, name: 'C', owner_type: 'Player', owner: { id: 9, name: 'Князь', country_id: 6 } } as Army,
        regionCountryId,
      ),
    ).toBe(6);
    expect(
      armyCountryId(
        {
          id: 4,
          name: 'D',
          owner_type: 'Player',
          owner: { id: 9, name: 'Князь' },
          settlement: { id: 1, name: 'Москва', region_id: 5 },
        } as Army,
        regionCountryId,
      ),
    ).toBe(42);
    expect(armyCountryId({ id: 5, name: 'E' } as Army, regionCountryId)).toBeNull();
  });
});
