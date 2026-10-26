/**
 * Фабрика ключей кэша данных (см. ТЗ «Единый слой загрузки данных», § 3, § 5).
 *
 * Ключ — массив строк/чисел. Один ключ = один набор данных.
 * Параметризованные данные включаются в ключ, а не фильтруются из общего списка.
 */
export type QueryKey = readonly (string | number)[];

/** Строковое представление ключа для логов и Map: ['guild', 12, 'plants'] → 'guild:12:plants'. */
export const keyToString = (key: QueryKey): string => key.map(String).join(':');

/** Ключ, у которого срезан последний элемент — используется для invalidatePrefix. */
export const keyPrefix = (key: QueryKey, length: number): QueryKey => key.slice(0, length);

export const queryKeys = {
  /** Список гильдий. Один ключ для обоих эндпоинтов: /guilds.json и /guilds/list.json
   *  отдают побайтово одинаковый ответ (проверено на живом бэкенде), см. § 8 ТЗ, вопрос 6. */
  guilds: (): QueryKey => ['guilds'],
  /** Предприятия гильдии: GET /guilds/:id.json */
  guildPlants: (guildId: number | null | undefined): QueryKey => ['guild', guildId ?? 'none', 'plants'],
  /** Предприятие по id: GET /plants/:id.json */
  plant: (plantId: number | null | undefined): QueryKey => ['plant', plantId ?? 'none'],
  /** Все уровни предприятий: GET /plant_levels.json */
  plantLevels: (): QueryKey => ['plantLevels'],
  /** Ресурсы (номенклатура): GET /resources/show_all_resources */
  resources: (): QueryKey => ['resources'],
  /** Доступные места: GET /plant_places/available_places?guild_id=
   *  Гильдия в ключе обязательна: от неё зависит признак `allowed` (разрешение
   *  гильдии строить и работать в государстве места), а место без гильдии
   *  показывало бы чужой ответ из кэша. */
  availablePlaces: (guildId?: number | null): QueryKey => ['availablePlaces', guildId ?? 'none'],
  /** Технологии государства (название, эффект, факт открытия): GET /technologies.json */
  technologies: (): QueryKey => ['technologies'],
  /** Страны (отношения, эмбарго): GET /countries/foreign_countries.json */
  countries: (): QueryKey => ['countries'],
  /** Цены: GET /resources/show_prices.json */
  prices: (): QueryKey => ['prices'],
  /** Вероятность ограбления гильдии: GET /caravans/check_robbery.json?guild_id= */
  robbery: (guildId: number): QueryKey => ['robbery', guildId],
  /** Армии (все активные): GET /armies.json — экран «Сражения» */
  armies: (): QueryKey => ['armies'],
  /** Все государства игры: GET /countries.json (не путать с ['countries'] — foreign_countries) */
  allCountries: (): QueryKey => ['allCountries'],
  /** Все поселения: GET /settlements.json?all=1 — выбор города и крепости */
  settlements: (): QueryKey => ['settlements'],
  /** Регионы с государством: GET /regions.json — страна поселения */
  regions: (): QueryKey => ['regions'],
  /** Все игроки игры: GET /players.json — назначение владельца города */
  players: (): QueryKey => ['players'],
};

/** Строковые представления ключей (для логов). */
export const keysToStrings = (keys: QueryKey[]): string[] => keys.map(keyToString);
