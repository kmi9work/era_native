/**
 * Правила плана сражений, набранного на карте (`src/screens/map/battlePlan.ts`).
 *
 * Проверяется то, чего не видно на экране: армия не может стоять в двух боях,
 * атакованная армия встаёт в защиту, пустые точки исчезают, а «Начать сражения»
 * не включается, пока в каком-то бою нет одной из сторон.
 */
import {
  armySideInPlan,
  armyTarget,
  assignArmyToBattle,
  battleKey,
  battleSummary,
  cityTarget,
  defendTargetArmy,
  planArmyCount,
  planIsReady,
  planProblem,
  prunePlan,
  removeArmyFromPlan,
  type AttackSide,
  type PlannedBattle,
} from '../src/screens/map/battlePlan';

const moscow = { id: 10, name: 'Москва' };
const novgorod = { id: 11, name: 'Новгород' };

const place = (
  plan: PlannedBattle[],
  armyId: number,
  side: AttackSide,
  target = cityTarget(moscow),
) => assignArmyToBattle(plan, armyId, side, target);

describe('план сражений с карты', () => {
  it('ключ точки: город и армия различаются', () => {
    expect(battleKey(cityTarget(moscow))).toBe('city:10');
    expect(battleKey(armyTarget({ id: 7, name: 'Казань' }))).toBe('army:7');
    expect(armyTarget({ id: 7, name: 'Казань' }).title).toBe('Армия «Казань»');
  });

  it('две армии в атаку и три в защиту на один город — одно сражение', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    plan = place(plan, 2, 'attacker');
    plan = place(plan, 3, 'defender');
    plan = place(plan, 4, 'defender');
    plan = place(plan, 5, 'defender');

    expect(plan).toHaveLength(1);
    expect(plan[0].attackerIds).toEqual([1, 2]);
    expect(plan[0].defenderIds).toEqual([3, 4, 5]);
    expect(plan[0].title).toBe('Москва');
    expect(battleSummary(plan[0])).toBe('2 в атаку, 3 в защиту');
    expect(planIsReady(plan)).toBe(true);
    expect(planProblem(plan)).toBeNull();
    expect(planArmyCount(plan)).toBe(5);
  });

  it('несколько точек сразу: Москва и Новгород не смешиваются', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    plan = place(plan, 2, 'attacker', cityTarget(novgorod));
    plan = place(plan, 3, 'defender', cityTarget(novgorod));

    expect(plan.map(battle => battle.key)).toEqual(['city:10', 'city:11']);
    expect(armySideInPlan(plan, 1)?.battle.key).toBe('city:10');
    expect(armySideInPlan(plan, 2)?.side).toBe('attacker');
    expect(armySideInPlan(plan, 3)?.side).toBe('defender');
    expect(armySideInPlan(plan, 99)).toBeNull();
  });

  it('армия переносится из прежнего сражения, а не воюет в двух', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    plan = place(plan, 2, 'defender');
    plan = place(plan, 1, 'defender', cityTarget(novgorod));

    expect(plan).toHaveLength(2);
    expect(plan[0].attackerIds).toEqual([]);
    expect(plan[0].defenderIds).toEqual([2]);
    expect(plan[1].defenderIds).toEqual([1]);
  });

  it('сражение без армий из плана исчезает', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    plan = place(plan, 2, 'defender');
    plan = removeArmyFromPlan(plan, 1);
    expect(plan).toHaveLength(1);
    plan = removeArmyFromPlan(plan, 2);
    expect(plan).toHaveLength(0);
  });

  it('атакованная армия встаёт в защиту своей точки', () => {
    const target = armyTarget({ id: 7, name: 'Казань' });
    let plan = assignArmyToBattle([], 1, 'attacker', target);
    plan = defendTargetArmy(plan, target);

    expect(plan[0].defenderIds).toEqual([7]);
    expect(planIsReady(plan)).toBe(true);
  });

  it('атакованная армия не выдёргивается из другого сражения', () => {
    const target = armyTarget({ id: 7, name: 'Казань' });
    let plan = assignArmyToBattle([], 7, 'attacker', cityTarget(moscow));
    plan = assignArmyToBattle(plan, 1, 'attacker', target);
    plan = defendTargetArmy(plan, target);

    expect(armySideInPlan(plan, 7)?.battle.key).toBe('city:10');
    expect(plan.find(battle => battle.key === 'army:7')?.defenderIds).toEqual([]);
  });

  it('начинать нельзя, пока в сражении нет стороны', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    expect(planIsReady(plan)).toBe(false);
    expect(planProblem(plan)).toContain('не хватает защищающихся');
    expect(planProblem([])).toContain('ни одного сражения');

    plan = place(plan, 2, 'defender');
    plan = place(plan, 3, 'attacker', cityTarget(novgorod));
    expect(planProblem(plan)).toContain('Новгород');
  });

  it('пропавшие на бэкенде армии вычищаются, остальное не трогается', () => {
    let plan: PlannedBattle[] = [];
    plan = place(plan, 1, 'attacker');
    plan = place(plan, 2, 'defender');
    plan = place(plan, 3, 'attacker', cityTarget(novgorod));

    const pruned = prunePlan(plan, [1, 2]);
    expect(pruned.map(battle => battle.key)).toEqual(['city:10']);
    expect(pruned[0].defenderIds).toEqual([2]);

    // Ничего не пропало — тот же объект, лишних перерисовок нет.
    expect(prunePlan(plan, [1, 2, 3])).toBe(plan);
  });
});
