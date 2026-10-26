/**
 * Правила сражения (экран «Сражения», era_native).
 *
 * Модуль намеренно чистый: ни React, ни запросов — только правила из ТЗ,
 * чтобы их можно было проверить тестами без устройства. Экранный хук
 * (`screens/hooks/useBattleLogic.ts`) хранит состояние и вызывает эти функции.
 *
 * Правила:
 *  - за каждый отряд, кроме пушки, бросается к6;
 *  - попадание: пехота 5–6, тяжёлая пехота 4–6, конница 3–6;
 *  - попадание убивает любой отряд (и пушку тоже, если её выбрали потерю);
 *  - крепость 2-го уровня даёт +1 к значению кубика защищающихся, 3-го — +2;
 *  - бонус мастера +1 ко всем кубикам армии, дебафф −1;
 *  - авто-выбор потерь — самые слабые отряды (по силе типа);
 *  - отступление удаётся на 4–6.
 */
import type { Army, ArmyTroop, Settlement } from '../types';

/** Тип отряда. Названия — как в файле символов detachments.png. */
export type TroopKind = 'cavalry' | 'infantry' | 'heavy_infantry' | 'cannon';

/** Порядок типов для интерфейса выбора отряда (как в detachments.png). */
export const TROOP_KINDS: readonly TroopKind[] = ['cavalry', 'infantry', 'heavy_infantry', 'cannon'];

export const TROOP_LABEL: Record<TroopKind, string> = {
  cavalry: 'Конница',
  infantry: 'Пехота',
  heavy_infantry: 'Тяжёлая пехота',
  cannon: 'Пушка',
};

/** Порог попадания на к6; у пушки его нет — она не участвует в бою. */
export const HIT_THRESHOLD: Record<TroopKind, number | null> = {
  cavalry: 3,
  infantry: 5,
  heavy_infantry: 4,
  cannon: null,
};

/** Вес типа отряда: только для выбора «самых слабых» потерь, на экран не выводится. */
export const TROOP_POWER: Record<TroopKind, number> = {
  infantry: 1,
  heavy_infantry: 3,
  cavalry: 5,
  cannon: 8,
};

/** Город добавляет одну пехоту в защищающуюся армию. */
export const CITY_INFANTRY_BONUS = 1;

/** Минимальный размер кубика на экране: 0.7 см × 0.7 см ≈ 44 dp (1 см ≈ 63 dp). */
export const MIN_DIE_SIZE = 44;

/** Отступление удаётся на 4–6. */
export const RETREAT_MIN = 4;

/** Тип отряда по названию из бэкенда («Кавалерия»/«Конница», «Тяжелая пехота» и т. п.). */
export const troopKindFromName = (name?: string | null): TroopKind | null => {
  const normalized = (name || '').trim().toLowerCase().replace(/ё/g, 'е');
  if (!normalized) return null;
  if (normalized.includes('пушк') || normalized.includes('артиллер')) return 'cannon';
  if (normalized.includes('кавалер') || normalized.includes('конниц') || normalized.includes('конн')) {
    return 'cavalry';
  }
  if (normalized.includes('тяжел')) return 'heavy_infantry';
  if (normalized.includes('пехот')) return 'infantry';
  return null;
};

/** Тип отряда из ответа бэкенда: сначала по названию, затем по силе типа, затем по id типа. */
export const troopKindFromTroop = (troop: ArmyTroop): TroopKind => {
  const byName = troopKindFromName(troop.troop_type?.name);
  if (byName) return byName;

  // Сила/здоровье типа, а не текущие здоровье отряда (оно падает от ран).
  const power = Number(
    troop.troop_type?.params?.power ?? troop.troop_type?.params?.max_health ?? troop.max_health ?? 0,
  );
  if (power >= 8) return 'cannon';
  if (power >= 5) return 'cavalry';
  if (power >= 3) return 'heavy_infantry';
  if (power >= 1) return 'infantry';

  const typeId = Number(troop.troop_type?.id ?? 0);
  if (typeId === 4) return 'cannon';
  if (typeId === 3) return 'cavalry';
  if (typeId === 2) return 'heavy_infantry';
  return 'infantry';
};

export const hitThreshold = (kind: TroopKind): number | null => HIT_THRESHOLD[kind];

/** Участвует ли отряд в бросках: пушка не участвует. */
export const participates = (kind: TroopKind): boolean => HIT_THRESHOLD[kind] !== null;

/** Попадание по эффективному значению кубика (бросок + модификаторы). */
export const isHit = (kind: TroopKind, value: number): boolean => {
  const threshold = HIT_THRESHOLD[kind];
  return threshold !== null && value >= threshold;
};

/** Модификатор армии от мастера: бонусы минус дебаффы. */
export const armyModifier = (bonus: number, debuff: number): number => bonus - debuff;

/** Бонус крепости к значению кубика защищающихся: 1 уровень — 0, 2 — +1, 3 — +2. */
export const fortressDiceBonus = (fortressLevel: number): number => {
  if (fortressLevel >= 3) return 2;
  if (fortressLevel === 2) return 1;
  return 0;
};

/** С крепостью 1-го уровня и выше нельзя напасть без пушки (предупреждение, не запрет). */
export const fortressRequiresCannon = (fortressLevel: number): boolean => fortressLevel >= 1;

/** Эффективное значение кубика: бросок + модификатор армии + бонус крепости. */
export const effectiveRoll = (
  roll: number,
  options: { modifier?: number; fortressBonus?: number } = {},
): number => roll + (options.modifier || 0) + (options.fortressBonus || 0);

/** Бросок к6. rng передаётся для тестов. */
export const rollDie = (rng: () => number = Math.random): number => Math.floor(rng() * 6) + 1;

/** Отступление удалось? */
export const canRetreat = (value: number): boolean => value >= RETREAT_MIN;

/** Уровень крепости (Кремль) в поселении: 0 — крепости нет. */
export const fortressLevelFromSettlement = (settlement?: Settlement | null): number => {
  if (!settlement?.buildings?.length) return 0;

  let level = 0;
  settlement.buildings.forEach(building => {
    const typeName = building.building_type_name || building.building_level?.building_type?.name;
    if (typeName !== 'Кремль') return;
    const buildingLevel = Number(
      building.building_level_level ?? building.building_level?.level ?? 0,
    );
    if (buildingLevel > level) level = buildingLevel;
  });
  return level;
};

/** Столица ли это: тип «Столица» (в сидах id 2, но проверяем и по названию). */
export const isCapitalSettlement = (settlement?: Settlement | null): boolean => {
  if (!settlement) return false;
  if (settlement.settlement_type?.name?.toLowerCase() === 'столица') return true;
  return Number(settlement.settlement_type_id) === 2;
};

/** Слабейшие отряды первыми: по силе типа, затем по порядку добавления. */
export const weakestFirst = <T extends { kind: TroopKind; order: number }>(troops: T[]): T[] =>
  [...troops].sort((a, b) => {
    const powerDiff = TROOP_POWER[a.kind] - TROOP_POWER[b.kind];
    if (powerDiff !== 0) return powerDiff;
    return a.order - b.order;
  });

/** Авто-выбор потерь: N самых слабых отрядов стороны. */
export const autoCasualties = <T extends { kind: TroopKind; order: number }>(
  troops: T[],
  hits: number,
): T[] => {
  if (hits <= 0) return [];
  return weakestFirst(troops).slice(0, Math.min(hits, troops.length));
};

/** Сколько попаданий нанесли броски стороны. */
export const countHits = (rolls: Array<{ kind: TroopKind; value: number }>): number =>
  rolls.reduce((sum, item) => (isHit(item.kind, item.value) ? sum + 1 : sum), 0);

/** Отряды армии с бэкенда → карточки боя (по одному на каждый отряд). */
export const battleTroopsFromArmy = (
  army: Army,
  startOrder: number,
  uidPrefix: string,
): Array<{ uid: string; kind: TroopKind; name: string; source: 'backend'; order: number }> =>
  (army.troops || []).map((troop, index) => {
    const kind = troopKindFromTroop(troop);
    return {
      uid: `${uidPrefix}-t${startOrder + index}`,
      kind,
      name: TROOP_LABEL[kind],
      source: 'backend' as const,
      order: startOrder + index,
    };
  });

/**
 * Государство армии: country_id (many_teams), затем государство-владелец, затем
 * государство региона, где армия стоит. На старом бэкенде country_id и
 * player.country_id в ответе отсутствуют — третий путь и остаётся основным.
 */
export const armyCountryId = (
  army: Army,
  regionCountryId: (regionId?: number | null) => number | null,
): number | null => {
  if (army.country_id) return army.country_id;
  if (army.owner_type === 'Country' && army.owner?.id) return army.owner.id;
  if (army.owner?.country_id) return army.owner.country_id;
  if (army.owner?.country?.id) return army.owner.country.id;
  return regionCountryId(army.settlement?.region_id);
};
