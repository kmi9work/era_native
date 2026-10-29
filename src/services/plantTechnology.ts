import { PlantPlace, TechnologyRequirement } from '../types';

/**
 * Технологии, которые запрещают строительство предприятия («Ремесловые люди» →
 * кузница и ювелирная мастерская).
 *
 * Где чей статус:
 *  * экран «Новое предприятие» — по ГИЛЬДИИ: технология считается закрытой только
 *    если нет ни одной страны, где гильдии разрешено строительство и технология
 *    открыта (бэкенд many_teams отдаёт это полем `open_anywhere`). Гильдия Москвы
 *    может строить в Орде, и открытая там технология снимает запрет;
 *  * экран «Выбор места» — по ГОСУДАРСТВУ ЗЕМЛИ: бэкенд many_teams отдаёт у
 *    каждого места `technology_requirements` со статусом технологии в стране
 *    земли. Без этого поля (базовая игра, artel, vassals) статус берётся у типа —
 *    в этих режимах строительство считается по текущему государству/сюзерену.
 */

export type PlaceLike =
  | (Pick<PlantPlace, 'allowed' | 'country_name' | 'technology_requirements'> & { id?: number })
  | null
  | undefined;

/**
 * «Сельские школы» (Technology::RURAL_SCHOOLS на бэкенде) — единственная технология,
 * которая разрешает УЛУЧШЕНИЕ предприятий (dizdoc: «Купцы могут улучшать предприятия»).
 * Сервер улучшение не блокирует, поэтому правило проверяет клиент — предупреждением,
 * которое мастер вправе обойти.
 */
export const RURAL_SCHOOLS_ID = 1;

/**
 * Статус «Сельских школ» по ответу `GET /technologies.json?country_id=`
 * (у технологии есть `is_open`: 1 — открыта, 0 — закрыта).
 * `null` — данных ещё нет (список не пришёл или технологии в нём нет):
 * в этом случае запрещать улучшение нельзя, иначе кнопка «Запрещено» появится
 * на пустом месте при медленной связи.
 */
export function isRuralSchoolsOpen(technologies?: any[] | null): boolean | null {
  const technology = (technologies || []).find((item: any) => item?.id === RURAL_SCHOOLS_ID);
  if (!technology) {
    return null;
  }
  const value = technology.is_open ?? technology.isOpen;
  if (value === undefined || value === null) {
    return null;
  }
  return Number(value) === 1;
}

/** Название технологии из ответа сервера (формулировка игры), иначе — из правил. */
export function ruralSchoolsName(technologies?: any[] | null): string {
  return (technologies || []).find((item: any) => item?.id === RURAL_SCHOOLS_ID)?.name || 'Сельские школы';
}

/** Требования технологии, действующие для конкретной земли. */
export function requirementsForPlace(
  place: PlaceLike,
  typeRequirements?: TechnologyRequirement[] | null,
): TechnologyRequirement[] {
  const placeRequirements = place?.technology_requirements;
  if (Array.isArray(placeRequirements) && placeRequirements.length > 0) {
    return placeRequirements;
  }
  return Array.isArray(typeRequirements) ? typeRequirements : [];
}

/** Названия закрытых технологий из набора требований. */
export function closedTechnologyNames(requirements?: TechnologyRequirement[] | null): string[] {
  return (requirements || []).filter(req => !req.open).map(req => req.name);
}

/** Закрытые для этой земли технологии. */
export function closedPlaceTechnologyNames(
  place: PlaceLike,
  typeRequirements?: TechnologyRequirement[] | null,
): string[] {
  return closedTechnologyNames(requirementsForPlace(place, typeRequirements));
}

/**
 * Технология не открыта нигде, где гильдии разрешено строить.
 * `open_anywhere` приходит только из many_teams; без него — прежнее `open`.
 */
export function isTechnologyClosedForGuild(requirement: TechnologyRequirement): boolean {
  if (typeof requirement.open_anywhere === 'boolean') {
    return !requirement.open_anywhere;
  }
  return !requirement.open;
}

/** Закрытые для гильдии технологии (экран «Новое предприятие»). */
export function closedGuildTechnologyNames(requirements?: TechnologyRequirement[] | null): string[] {
  return (requirements || []).filter(isTechnologyClosedForGuild).map(req => req.name);
}

/** ««A», «B»» — для подстановки в текст предупреждения. */
export function formatTechnologyNames(names: string[]): string {
  return names.map(name => `«${name}»`).join(', ');
}

/**
 * Земля пригодна для строительства: разрешена гильдии и технология в её
 * государстве открыта. Это признак для сортировки/подсветки, а не запрет —
 * построить мастер может и в остальных землях.
 */
export function isPlaceBuildable(
  place: PlaceLike,
  typeRequirements?: TechnologyRequirement[] | null,
): boolean {
  if (!place) {
    return false;
  }
  return place.allowed !== false && closedPlaceTechnologyNames(place, typeRequirements).length === 0;
}

/** Земли, где строительство разрешено и технология открыта, — первыми. */
export function sortPlacesForBuilding<T extends PlaceLike>(
  places: T[] | null | undefined,
  typeRequirements?: TechnologyRequirement[] | null,
): T[] {
  const list = Array.isArray(places) ? places : [];
  return list
    .map((place, index) => ({ place, index, buildable: isPlaceBuildable(place, typeRequirements) }))
    .sort((a, b) => {
      if (a.buildable !== b.buildable) {
        return a.buildable ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(item => item.place);
}
