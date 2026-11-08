/**
 * Шаги перемещения армии (`src/screens/map/armySteps.ts`) и раскладка армий у
 * места сражения (`src/screens/map/battleConverge.ts`).
 *
 * Проверяется то, чего не видно на экране: числа берутся из ответа сервера (а не
 * пересчитываются на клиенте), больше максимума не списывается, атакующие встают
 * слева от точки боя, защищающиеся справа, и щиты не накладываются друг на друга.
 */
import type { Army } from '../src/types';
import {
  armySteps,
  stepChoices,
  stepsAfterSpend,
  stepsSummary,
} from '../src/screens/map/armySteps';
import {
  CONVERGE_COLUMN_OFFSET,
  CONVERGE_EDGE,
  CONVERGE_ROW_OFFSET,
  battleConvergePositions,
  planConvergePositions,
} from '../src/screens/map/battleConverge';
import {
  armyTarget,
  cityTarget,
  type PlannedBattle,
} from '../src/screens/map/battlePlan';

const army = (overrides: Partial<Army> = {}): Army => ({
  id: 1,
  name: 'Рюрикович',
  ...overrides,
});

const battle = (overrides: Partial<PlannedBattle> = {}): PlannedBattle => ({
  key: 'city:10',
  kind: 'city',
  cityId: 10,
  armyId: null,
  title: 'Москва',
  attackerIds: [],
  defenderIds: [],
  ...overrides,
});

describe('шаги армии', () => {
  it('берёт максимум и потраченное с сервера', () => {
    const steps = armySteps(army({ steps_max: 11, steps_spent: 3 }));
    expect(steps).toEqual({ max: 11, spent: 3, left: 8 });
    expect(stepsSummary(steps!)).toBe('осталось 8 из 11');
  });

  it('без полей сервера шагов нет — экран не выдумывает числа', () => {
    expect(armySteps(army())).toBeNull();
    expect(armySteps(null)).toBeNull();
  });

  it('потрачено больше максимума — остаток 0, а не отрицательное число', () => {
    expect(armySteps(army({ steps_max: 7, steps_spent: 9 }))).toEqual({
      max: 7,
      spent: 7,
      left: 0,
    });
  });

  it('запасной источник потраченного — params.steps_spent', () => {
    expect(armySteps(army({ steps_max: 14, params: { steps_spent: 5 } }))).toEqual({
      max: 14,
      spent: 5,
      left: 9,
    });
  });

  it('списание шагов ограничено максимумом года', () => {
    const steps = armySteps(army({ steps_max: 7, steps_spent: 5 }))!;
    expect(stepsAfterSpend(steps, 1)).toBe(6);
    expect(stepsAfterSpend(steps, 4)).toBe(7);
    expect(stepsAfterSpend(steps, 0)).toBe(5);
  });

  it('кнопки выбора — от 1 до максимума', () => {
    expect(stepChoices(armySteps(army({ steps_max: 6, steps_spent: 0 }))!)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe('армии сходятся к месту сражения', () => {
  const anchor = { x: 0.5, y: 0.5 };

  it('атакующие слева от точки, защищающиеся справа', () => {
    const positions = battleConvergePositions(
      battle({ attackerIds: [1, 2], defenderIds: [3] }),
      anchor,
    );
    const byId = new Map(positions.map(item => [item.armyId, item]));

    expect(byId.get(1)!.x).toBeCloseTo(0.5 - CONVERGE_COLUMN_OFFSET);
    expect(byId.get(2)!.x).toBeCloseTo(0.5 - CONVERGE_COLUMN_OFFSET);
    expect(byId.get(3)!.x).toBeCloseTo(0.5 + CONVERGE_COLUMN_OFFSET);
    positions.forEach(item => expect(item.x).not.toBe(anchor.x));
  });

  it('две армии в колонке стоят симметрично и не накладываются', () => {
    const [first, second] = battleConvergePositions(
      battle({ attackerIds: [1, 2] }),
      anchor,
    ).filter(item => item.x < anchor.x);

    expect(first.y).toBeCloseTo(0.5 - CONVERGE_ROW_OFFSET / 2);
    expect(second.y).toBeCloseTo(0.5 + CONVERGE_ROW_OFFSET / 2);
    expect(Math.abs(first.y - second.y)).toBeCloseTo(CONVERGE_ROW_OFFSET);
  });

  it('одна армия встаёт на высоте точки боя', () => {
    const [only] = battleConvergePositions(battle({ defenderIds: [7] }), anchor);
    expect(only.y).toBeCloseTo(anchor.y);
  });

  it('у края полотна позиции не уезжают за границу карты', () => {
    const positions = battleConvergePositions(
      battle({ attackerIds: [1, 2, 3], defenderIds: [4, 5, 6] }),
      { x: 0.01, y: 0.99 },
    );
    positions.forEach(item => {
      expect(item.x).toBeGreaterThanOrEqual(CONVERGE_EDGE);
      expect(item.x).toBeLessThanOrEqual(1 - CONVERGE_EDGE);
      expect(item.y).toBeGreaterThanOrEqual(CONVERGE_EDGE);
      expect(item.y).toBeLessThanOrEqual(1 - CONVERGE_EDGE);
    });
  });

  it('план целиком: у каждой точки свой якорь, армии в двух боях не смешиваются', () => {
    const moscowBattle = battle({ attackerIds: [1], defenderIds: [2] });
    const kazanBattle = battle({
      key: 'army:9',
      kind: 'army',
      cityId: null,
      armyId: 9,
      title: 'Армия «Казань»',
      attackerIds: [3],
      defenderIds: [9],
    });

    const positions = planConvergePositions([moscowBattle, kazanBattle], {
      'city:10': { x: 0.3, y: 0.3 },
      'army:9': { x: 0.7, y: 0.6 },
    });

    expect(positions).toHaveLength(4);
    const byId = new Map(positions.map(item => [item.armyId, item]));
    expect(byId.get(1)!.x).toBeCloseTo(0.3 - CONVERGE_COLUMN_OFFSET);
    expect(byId.get(2)!.x).toBeCloseTo(0.3 + CONVERGE_COLUMN_OFFSET);
    expect(byId.get(3)!.x).toBeCloseTo(0.7 - CONVERGE_COLUMN_OFFSET);
    // Цель боя (армия 9) уходит в правую колонку — щиты не совпадают.
    expect(byId.get(9)!.x).toBeCloseTo(0.7 + CONVERGE_COLUMN_OFFSET);
    expect(new Set(positions.map(item => `${item.x.toFixed(4)}:${item.y.toFixed(4)}`)).size).toBe(
      positions.length,
    );
  });

  it('сражение без якоря (город исчез) своих армий не двигает', () => {
    const positions = planConvergePositions(
      [battle({ attackerIds: [1], defenderIds: [2] })],
      {},
    );
    expect(positions).toEqual([]);
  });

  it('ключи целей: города и армии различаются', () => {
    const cityBattle = battle({ attackerIds: [1], defenderIds: [2] });
    const armyBattle = battle({
      key: 'army:5',
      kind: 'army',
      cityId: null,
      armyId: 5,
      attackerIds: [3],
      defenderIds: [5],
    });
    expect(cityBattle.key).toBe('city:10');
    expect(armyBattle.key).toBe('army:5');
    expect(cityTarget({ id: 10, name: 'Москва' }).cityId).toBe(10);
    expect(armyTarget({ id: 5, name: 'Казань' }).armyId).toBe(5);
  });
});
