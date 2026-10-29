/**
 * Статус технологий, запрещающих строительство («Ремесловые люди» → кузница и
 * ювелирная мастерская), в многострановом режиме.
 *
 * Правило заказчика:
 *  * «Новое предприятие» — запрет показывается только если у гильдии НЕТ страны,
 *    где ей разрешено строительство и технология открыта (поле `open_anywhere`);
 *  * «Выбор места» — запрет считается по государству КОНКРЕТНОЙ земли (статус
 *    приходит у места), такие земли уходят вниз списка.
 */
import {
  closedGuildTechnologyNames,
  closedPlaceTechnologyNames,
  formatTechnologyNames,
  isPlaceBuildable,
  isTechnologyClosedForGuild,
  requirementsForPlace,
  sortPlacesForBuilding,
} from '../src/services/plantTechnology';

const requirement = (overrides: Partial<{ open: boolean; open_anywhere?: boolean }> = {}) => ({
  id: 3,
  name: 'Ремесловые люди',
  open: false,
  ...overrides,
});

describe('экран «Новое предприятие»: запрет по гильдии', () => {
  it('технология открыта в одной из разрешённых стран — запрета нет', () => {
    // Москва закрыта, но гильдии разрешено строить в Орде, где технология открыта.
    const requirementInSomeCountry = requirement({ open: false, open_anywhere: true });

    expect(isTechnologyClosedForGuild(requirementInSomeCountry)).toBe(false);
    expect(closedGuildTechnologyNames([requirementInSomeCountry])).toEqual([]);
  });

  it('нет ни одной разрешённой страны с открытой технологией — запрет есть', () => {
    const closedEverywhere = requirement({ open: true, open_anywhere: false });

    expect(isTechnologyClosedForGuild(closedEverywhere)).toBe(true);
    expect(closedGuildTechnologyNames([closedEverywhere])).toEqual(['Ремесловые люди']);
  });

  it('без open_anywhere (базовая игра) решает прежнее поле open', () => {
    expect(isTechnologyClosedForGuild(requirement({ open: false }))).toBe(true);
    expect(isTechnologyClosedForGuild(requirement({ open: true }))).toBe(false);
  });

  it('тип без требований технологий не даёт запрета', () => {
    expect(closedGuildTechnologyNames(undefined)).toEqual([]);
    expect(closedGuildTechnologyNames([])).toEqual([]);
  });
});

describe('экран «Выбор места»: запрет по государству земли', () => {
  const place = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    region_name: 'Канинская земля',
    country_name: 'Москва',
    allowed: true,
    ...overrides,
  });

  it('статус земли важнее статуса типа', () => {
    const typeRequirements = [requirement({ open: false, open_anywhere: true })];

    expect(requirementsForPlace(place({
      technology_requirements: [requirement({ open: true })],
    }), typeRequirements)).toEqual([requirement({ open: true })]);

    expect(closedPlaceTechnologyNames(place({
      technology_requirements: [requirement({ open: false })],
    }), typeRequirements)).toEqual(['Ремесловые люди']);
  });

  it('у места нет своего статуса — берём статус типа (базовая игра, artel, vassals)', () => {
    const typeRequirements = [requirement({ open: false })];

    expect(closedPlaceTechnologyNames(place(), typeRequirements)).toEqual(['Ремесловые люди']);
    expect(closedPlaceTechnologyNames(place({ allowed: false }), typeRequirements)).toEqual([
      'Ремесловые люди',
    ]);
  });

  it('пригодность земли = разрешено И технология открыта', () => {
    const typeRequirements = [requirement({ open: false })];

    expect(isPlaceBuildable(place(), [])).toBe(true);
    expect(isPlaceBuildable(place({ allowed: false }), [])).toBe(false);
    expect(isPlaceBuildable(place(), typeRequirements)).toBe(false);
    expect(
      isPlaceBuildable(place({ technology_requirements: [requirement({ open: true })] }), typeRequirements),
    ).toBe(true);
  });

  it('пригодные земли идут первыми, порядок остальных сохраняется', () => {
    const typeRequirements = [requirement({ open: false, open_anywhere: true })];
    const openPlace = { id: 1, region_name: 'Орда', allowed: true, technology_requirements: [requirement({ open: true })] };
    const foreignClosed = { id: 2, region_name: 'Тверь', allowed: false, technology_requirements: [requirement({ open: false })] };
    const allowedClosed = { id: 3, region_name: 'Новгород', allowed: true, technology_requirements: [requirement({ open: false })] };
    const allowedOpen = { id: 4, region_name: 'Москва', allowed: true, technology_requirements: [requirement({ open: true })] };

    expect(sortPlacesForBuilding([foreignClosed, openPlace, allowedClosed, allowedOpen], typeRequirements))
      .toEqual([openPlace, allowedOpen, foreignClosed, allowedClosed]);
  });

  it('названия технологий склеиваются в «…» через запятую', () => {
    expect(formatTechnologyNames(['Ремесловые люди'])).toBe('«Ремесловые люди»');
    expect(formatTechnologyNames(['А', 'Б'])).toBe('«А», «Б»');
  });
});
