/**
 * План сражений, набранный на карте: точки сражений и стороны армий.
 *
 * Мастер набирает сражения прямо на карте: армия «поднимается» долгим нажатием
 * и переносится на цель — город или другую армию; при переносе он указывает
 * сторону (нападение или защита). Одно сражение = одна точка (город или армия),
 * у него два списка: нападающие и защищающиеся. Точек может быть сколько угодно:
 * две армии в атаку на Москву, три в защиту Москвы, две против Новгорода и т.д.
 *
 * Здесь только чистые правила над планом (без React и без сети) — состояние
 * живёт в `battlePlanStore`, экран «Сражения» получает готовый список сражений.
 *
 * Правила:
 *   - армия участвует ровно в одном сражении: новое назначение переносит её из
 *     прежнего (иначе одна армия дралась бы в двух боях сразу);
 *   - сражение без армий из плана исчезает;
 *   - атакованная армия встаёт в защиту своей точки, если её ещё никуда не
 *     назначили: «перенёс армию в атаку на армию» сразу даёт две стороны;
 *   - начинать можно, когда в каждом сражении есть хотя бы одна армия сверху и
 *     снизу (`planProblem` объясняет, чего не хватает).
 */

export type AttackSide = 'attacker' | 'defender';

export type BattleTargetKind = 'city' | 'army';

/** Цель переноса: город или армия (точка сражения). */
export interface BattleTarget {
  kind: BattleTargetKind;
  cityId: number | null;
  armyId: number | null;
  /** Подпись для панели и вопроса о стороне. */
  title: string;
}

export interface PlannedBattle {
  /** `city:<id>` или `army:<id>` — ключ точки сражения. */
  key: string;
  kind: BattleTargetKind;
  cityId: number | null;
  armyId: number | null;
  title: string;
  attackerIds: number[];
  defenderIds: number[];
}

export const cityTarget = (city: { id: number; name: string }): BattleTarget => ({
  kind: 'city',
  cityId: city.id,
  armyId: null,
  title: city.name,
});

export const armyTarget = (army: { id: number; name: string }): BattleTarget => ({
  kind: 'army',
  cityId: null,
  armyId: army.id,
  title: `Армия «${army.name}»`,
});

export const battleKey = (target: BattleTarget): string =>
  target.kind === 'city' ? `city:${target.cityId}` : `army:${target.armyId}`;

export const battleIsReady = (battle: PlannedBattle): boolean =>
  battle.attackerIds.length > 0 && battle.defenderIds.length > 0;

export const planIsReady = (plan: PlannedBattle[]): boolean =>
  plan.length > 0 && plan.every(battleIsReady);

/** Сторона армии в плане (или null, если армия никуда не назначена). */
export const armySideInPlan = (
  plan: PlannedBattle[],
  armyId: number,
): { battle: PlannedBattle; side: AttackSide } | null => {
  for (const battle of plan) {
    if (battle.attackerIds.includes(armyId)) return { battle, side: 'attacker' };
    if (battle.defenderIds.includes(armyId)) return { battle, side: 'defender' };
  }
  return null;
};

/** Снять армию со всех сражений и убрать опустевшие точки. */
const detachArmy = (plan: PlannedBattle[], armyId: number): PlannedBattle[] =>
  plan
    .map(battle => ({
      ...battle,
      attackerIds: battle.attackerIds.filter(id => id !== armyId),
      defenderIds: battle.defenderIds.filter(id => id !== armyId),
    }))
    .filter(battle => battle.attackerIds.length > 0 || battle.defenderIds.length > 0);

const toBattle = (target: BattleTarget): PlannedBattle => ({
  key: battleKey(target),
  kind: target.kind,
  cityId: target.cityId,
  armyId: target.armyId,
  title: target.title,
  attackerIds: [],
  defenderIds: [],
});

/** Поставить армию на указанную сторону точки сражения (перенос из прежней). */
export const assignArmyToBattle = (
  plan: PlannedBattle[],
  armyId: number,
  side: AttackSide,
  target: BattleTarget,
): PlannedBattle[] => {
  const key = battleKey(target);
  const stripped = detachArmy(plan, armyId);
  const existing = stripped.find(battle => battle.key === key);
  const base = existing ?? toBattle(target);
  const next: PlannedBattle =
    side === 'attacker'
      ? { ...base, attackerIds: [...base.attackerIds, armyId] }
      : { ...base, defenderIds: [...base.defenderIds, armyId] };

  if (!existing) return [...stripped, next];
  return stripped.map(battle => (battle.key === key ? next : battle));
};

/**
 * Атакованная армия встаёт в защиту своей точки — но только если её ещё никуда
 * не назначили (иначе мастер молча перетащил бы чужую армию из другого боя).
 */
export const defendTargetArmy = (
  plan: PlannedBattle[],
  target: BattleTarget,
): PlannedBattle[] => {
  if (target.kind !== 'army' || target.armyId === null) return plan;
  if (armySideInPlan(plan, target.armyId)) return plan;
  return assignArmyToBattle(plan, target.armyId, 'defender', target);
};

export const removeArmyFromPlan = (plan: PlannedBattle[], armyId: number): PlannedBattle[] =>
  detachArmy(plan, armyId);

/**
 * Убрать из плана армии, которых больше нет на карте (их удалили на бэкенде):
 * иначе «Начать сражения» уведёт на экран с несуществующей армией.
 */
export const prunePlan = (plan: PlannedBattle[], knownArmyIds: number[]): PlannedBattle[] => {
  const known = new Set(knownArmyIds);
  const next = plan
    .map(battle => ({
      ...battle,
      attackerIds: battle.attackerIds.filter(id => known.has(id)),
      defenderIds: battle.defenderIds.filter(id => known.has(id)),
    }))
    .filter(battle => battle.attackerIds.length > 0 || battle.defenderIds.length > 0);

  const changed =
    next.length !== plan.length ||
    next.some((battle, index) => {
      const before = plan[index];
      return (
        battle.key !== before.key ||
        battle.attackerIds.length !== before.attackerIds.length ||
        battle.defenderIds.length !== before.defenderIds.length
      );
    });
  return changed ? next : plan;
};

/** Строка сражения для панели: «Москва — 2 в атаку, 3 в защиту». */
export const battleSummary = (battle: PlannedBattle): string => {
  const parts: string[] = [];
  if (battle.attackerIds.length > 0) parts.push(`${battle.attackerIds.length} в атаку`);
  if (battle.defenderIds.length > 0) parts.push(`${battle.defenderIds.length} в защиту`);
  return parts.length > 0 ? parts.join(', ') : 'армий нет';
};

/** Почему начинать нельзя; `null` — можно. */
export const planProblem = (plan: PlannedBattle[]): string | null => {
  if (plan.length === 0) return 'На карте не набрано ни одного сражения.';
  for (const battle of plan) {
    if (battle.attackerIds.length === 0) {
      return `«${battle.title}»: не хватает нападающих.`;
    }
    if (battle.defenderIds.length === 0) {
      return `«${battle.title}»: не хватает защищающихся.`;
    }
  }
  return null;
};

/** Сколько всего армий набрано в план. */
export const planArmyCount = (plan: PlannedBattle[]): number =>
  plan.reduce((sum, battle) => sum + battle.attackerIds.length + battle.defenderIds.length, 0);
