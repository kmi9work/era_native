/**
 * Переработка/добыча на предприятии — единственная реализация расчёта на клиенте.
 *
 * Повторяет серверную логику `eraofchange/app/models/plant_level.rb#feed_to_plant!`
 * вместе с эффектом технологии «Технические училища» (`Technology::TECH_SCHOOLS = 4`):
 *   - направление 'from' (сколько выйдет из введённого сырья) — выход × 1.5;
 *   - направление 'to' (сколько нужно сырья на желаемый выход) — сырьё ÷ 1.5, округление вверх;
 *   - сырьё расходуется ПОСЛЕДОВАТЕЛЬНО по формулам (на сервере — `res_array_sum!(request, from, -1)`),
 *     поэтому вторая формула видит остаток, а не весь ввод.
 *
 * Признак открытия технологии приходит вместе с предприятием — `plant.tech_schools_open`
 * и `plant.plant_level.tech_schools_open` (посчитаны по государству ЗЕМЕЛЬ предприятия:
 * `Plant#tech_schools_open?`, есть и в `GET /plants/:id.json`, и в `GET /guilds/:id.json`).
 * Справочник `GET /plant_levels.json` отдаёт глобальный статус текущего государства.
 * Множитель 1.5 зашит так же, как в вебе мастера (`era_front/src/stores/production.js:218`)
 * и в клиенте игроков (`era_players`). Бонус — только перерабатывающим предприятиям.
 */

export interface ResourceAmount {
  identificator: string;
  count: number;
  name?: string;
  [key: string]: unknown;
}

export interface PlantFormula {
  from?: ResourceAmount[];
  to?: ResourceAmount[];
  max_product?: ResourceAmount[];
}

export type ProductionWay = 'from' | 'to';

export interface FeedToPlantOptions {
  /** Технология «Технические училища» открыта у текущего государства. */
  techSchoolsOpen?: boolean;
}

export interface FeedToPlantResult {
  from: ResourceAmount[];
  to: ResourceAmount[];
  change: ResourceAmount[];
}

/** id технологии «Технические училища» в таблице `technologies` (db/seeds/technologies.csv, строка 5). */
export const TECH_SCHOOLS_ID = 4;

/** Коэффициент эффекта «Производство предприятий +50%». */
export const TECH_SCHOOLS_MULTIPLIER = 1.5;

/** Признак открытия технологии из ответа сервера (может прийти как `true`, так и `1`). */
export const isTechSchoolsOpen = (plantLevel: unknown): boolean => {
  const value = (plantLevel as { tech_schools_open?: unknown } | null | undefined)?.tech_schools_open;
  return value === true || value === 1;
};

/**
 * «Технические училища» для КОНКРЕТНОГО предприятия: технология действует только
 * на землях государства, где она открыта (открыта в Москве → бонус у предприятий
 * на московских землях; на новгородских — нет). Сервер кладёт этот статус в
 * `plant.tech_schools_open` и в `plant.plant_level.tech_schools_open` — оба
 * посчитаны по государству места строительства (`Plant#tech_schools_open?`).
 *
 * Справочник `/plant_levels.json` отдаёт ГЛОБАЛЬНЫЙ статус текущего государства и
 * здесь годится только как запасной вариант: приоритет у признака предприятия,
 * иначе `false` из ответа предприятия перебивалось бы глобальным `true`.
 *
 * Бонус — только перерабатывающим: вызывающий код обязан не передавать `true`
 * для добывающих предприятий (см. `is_extractive`).
 */
export const techSchoolsOpenForPlant = (plant: unknown, levelFallback?: unknown): boolean => {
  const source = (plant ?? undefined) as
    | { tech_schools_open?: unknown; plant_level?: unknown }
    | undefined;
  const flag = source?.tech_schools_open;
  if (typeof flag === 'boolean') return flag;
  if (flag === 1) return true;
  if (flag === 0) return false;

  const level = source?.plant_level;
  if (level !== undefined && level !== null) return isTechSchoolsOpen(level);
  return isTechSchoolsOpen(levelFallback);
};

export const resArrayMult = (resArray: ResourceAmount[] = [], n: number): ResourceAmount[] =>
  resArray.map((res) => ({ ...res, count: res.count * n }));

/** Складывает массивы ресурсов, сливая записи по identificator (знак -1 — вычитание). */
export const resArraySum = (
  array1: ResourceAmount[],
  array2: ResourceAmount[] = [],
  sign = 1,
): ResourceAmount[] => {
  const arr2Copy = array2.map((res) => ({ ...res }));
  for (const res1 of array1) {
    for (let i = arr2Copy.length - 1; i >= 0; i -= 1) {
      if (res1.identificator === arr2Copy[i].identificator) {
        res1.count += arr2Copy[i].count * sign;
        arr2Copy.splice(i, 1);
      }
    }
  }
  for (const res of arr2Copy) {
    array1.push({ ...res, count: res.count * sign });
  }
  return array1;
};

type ResourceArrayLike = ResourceAmount[] | undefined;

/** true, если каждого ресурса из первого массива во втором не меньше (нет совпадения — false). */
export const isResArrayLess = (
  resArray1: ResourceArrayLike = [],
  resArray2: ResourceArrayLike = [],
): boolean => {
  for (const res1 of resArray1) {
    const var2 = resArray2.find((res2) => res1.identificator === res2.identificator);
    if (!var2) return false;
    if (res1.count > var2.count) return false;
  }
  return true;
};

/**
 * Сколько раз формула «укладывается» в запрос по одному направлению,
 * с ограничением по `max_product` (потолок выпуска уровня).
 */
export const countRequest = (
  formula: PlantFormula,
  request: ResourceAmount[],
  way: ProductionWay,
): { from: ResourceAmount[]; to: ResourceAmount[] } => {
  const formulaPart = formula[way] ?? [];
  let n = 0;
  let bucket = formulaPart.map((res) => ({ ...res }));

  while (
    isResArrayLess(bucket, request) &&
    isResArrayLess(resArrayMult(formula.to ?? [], n + 1), formula.max_product)
  ) {
    bucket = resArraySum(bucket, formulaPart);
    n += 1;
  }

  return { from: resArrayMult(formula.from ?? [], n), to: resArrayMult(formula.to ?? [], n) };
};

/** Убирает нулевые строки: сервер тоже пропускает `count <= 0` при выдаче ресурсов. */
const withoutZeroCounts = (resources: ResourceAmount[]): ResourceAmount[] =>
  resources.filter((resource) => (resource.count || 0) !== 0);

/**
 * Расчёт переработки/добычи.
 *
 * @param formulas формулы уровня предприятия (`plant_level.formulas`)
 * @param request  ресурсы: для 'from' — ввод, для 'to' — желаемый выпуск
 * @param way      'from' | 'to'
 * @returns from — израсходованное сырьё, to — выпуск, change — остаток запроса
 */
export const feedToPlant = (
  formulas: PlantFormula[] = [],
  request: ResourceAmount[] = [],
  way: ProductionWay = 'from',
  options: FeedToPlantOptions = {},
): FeedToPlantResult => {
  const coof = options.techSchoolsOpen ? TECH_SCHOOLS_MULTIPLIER : 1;

  // Для 'to' сервер делит запрос на coof (округление вверх) до расчёта: request.map { (count / coof).ceil }.
  const change = request.map((req) => {
    const count = Number(req.count) || 0;
    return { ...req, count: way === 'to' ? Math.ceil(count / coof) : count };
  });

  const resultingFrom: ResourceAmount[] = [];
  const resultingTo: ResourceAmount[] = [];

  for (const formula of formulas || []) {
    const { from, to } = countRequest(formula, change, way);
    resArraySum(resultingFrom, from);
    resArraySum(resultingTo, to);
    // Израсходованное сырьё вычитается из запроса: следующая формула видит остаток.
    resArraySum(change, way === 'to' ? to : from, -1);
  }

  return {
    from: withoutZeroCounts(resultingFrom),
    // Выпуск умножается на coof (на сервере — в конце, после обхода формул).
    to: withoutZeroCounts(resArrayMult(resultingTo, coof)),
    change: withoutZeroCounts(change),
  };
};
