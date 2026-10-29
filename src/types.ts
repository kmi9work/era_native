export interface Player {
  id: number;
  name: string;
  identificator: string;
  player_type?: string;
  family?: string;
  jobs: string[];
  /** Государство игрока: GET /players.json отдаёт и id, и объект страны. */
  country_id?: number | null;
  country?: { id: number; name: string; short_name?: string } | null;
}

export interface Guild {
  id: number;
  name: string;
  /** Сколько предприятий уже построено (GET /guilds.json). */
  plants_count?: number;
  /** Максимум предприятий у гильдии из настроек игры; 0 — лимит не задан. */
  plants_limit?: number;
  /** Предприятия гильдии — приходят в том же ответе (/guilds.json). */
  plants?: any[];
}

export interface PlantPlace {
  id: number;
  name: string;
  region_id: number;
  region_name: string;
  region_country_id?: number | null;
  /** Можно ли этой гильдии строить и работать в государстве места (many_teams). */
  allowed?: boolean;
  /** Название государства места — приходит из движка many_teams. */
  country_name?: string;
  /**
   * Статус технологий, запрещающих это предприятие, в государстве земли
   * (many_teams). Без поля статус берётся у типа предприятия.
   */
  technology_requirements?: TechnologyRequirement[];
}

export interface TechnologyRequirement {
  id: number;
  name: string;
  /** Открыта ли технология в текущем государстве (прежнее поле). */
  open: boolean;
  /**
   * Открыта ли технология хотя бы в одном государстве, где гильдии разрешено
   * строительство (many_teams). Нет поля — смотрим `open`.
   */
  open_anywhere?: boolean;
}

export interface PlantLevel {
  id: number;
  level: number;
  plant_type_id: number;
  price: Record<string, number>;
  deposit: string;
}

export interface PlantType {
  id: number;
  name: string;
  plant_category_id: number;
  plant_category: string;
  fossil_type_id?: number;
}

export interface AvailablePlaceInfo {
  plant_type_id: number;
  plant_type_name: string;
  plant_category: string;
  plant_category_id: number;
  available_places: PlantPlace[];
  technology_requirements?: TechnologyRequirement[];
}

export interface Plant {
  id: number;
  plant_level_id: number;
  plant_place_id: number;
  economic_subject_id: number;
  economic_subject_type: string;
  /** «Технические училища» на землях ЭТОГО предприятия (Plant#tech_schools_open?). */
  tech_schools_open?: boolean;
  plant_place?: {
    id?: number;
    name: string;
    region_id?: number;
    region_name?: string;
    region_country_id?: number;
    region_country_name?: string;
  } | null;
}

export interface Country {
  id: number;
  name: string;
  short_name?: string;
  flag_image_name?: string;
  relations?: number;
  params?: {
    embargo?: number;
  };
}

export interface ArmyTroop {
  id: number;
  troop_type?: { id: number; name: string; params?: Record<string, unknown> };
  power?: number;
  health?: number;
  damage?: number;
  max_health?: number;
  army_id?: number;
  is_hired?: boolean;
  params?: Record<string, unknown>;
}

/**
 * Ответ `PATCH /armies/award_battle_victory.json`: влияние Воеводе за сражение.
 *
 * `bonus` — начисление за каждую разбитую армию противника (+4), `penalty` — штраф
 * за каждую разбитую армию своего государства (−1). `awarded` пуст, если в
 * сражении не было реально разбитых армий на бэкенде (например, разбит только
 * гарнизон города).
 */
export interface VoevodaAwardResult {
  success?: boolean;
  bonus?: number;
  penalty?: number;
  awarded?: Array<{
    id: number;
    name: string;
    country_id?: number | null;
    country_name?: string | null;
    value?: number;
    role?: 'bonus' | 'penalty' | string;
  }>;
}

/** Армия с бэкенда: GET /armies.json. Государство выводится из владельца (country_id может быть null). */
export interface Army {
  id: number;
  name: string;
  owner_type?: 'Country' | 'Player' | string | null;
  owner_id?: number | null;
  country_id?: number | null;
  owner?: {
    id: number;
    name: string;
    country_id?: number | null;
    country?: { id: number; name: string } | null;
  } | null;
  settlement?: {
    id: number;
    name: string;
    settlement_type_id?: number;
    settlement_type?: { id: number; name: string } | null;
    region_id?: number | null;
  } | null;
  troops?: ArmyTroop[];
  attack_power?: number;
  defense_power?: number;
}

export interface Building {
  id: number;
  building_type_name?: string | null;
  building_level_level?: number | null;
  building_level_name?: string | null;
  building_level?: {
    level?: number;
    building_type?: { id: number; name: string } | null;
  } | null;
}

export interface Settlement {
  id: number;
  name: string;
  settlement_type_id?: number | null;
  settlement_type?: { id: number; name: string } | null;
  region_id?: number | null;
  buildings?: Building[];
  income?: number;
  /** Владелец города (игрок). Отдельного player_id партиал не отдаёт — только объект. */
  player?: Player | null;
}

export interface Region {
  id: number;
  name: string;
  country_id?: number | null;
  country?: { id: number; name: string; short_name?: string } | null;
}

export interface Resource {
  identificator: string;
  name: string;
  count?: number;
  country_id?: number;
  country?: { id: number };
  buy_price?: number;
  sell_price?: number;
}

export interface CaravanRequest {
  country_id: number | null; // null для Artel (рынок без страны)
  guild_id: number;
  incoming: Array<{
    identificator: string;
    name: string;
    count: number;
    current_sell_price?: number;
  }>;
  outcoming: Array<{
    identificator: string;
    name: string;
    count: number;
    current_buy_price?: number;
  }>;
  purchase_cost: number;
  sale_income: number;
  via_vyatka: boolean;
  is_protected: boolean;
}

/** Мастер (пользователь веб-админки и планшета): GET /users.json */
export interface AppUser {
  id: number;
  name: string;
  job?: string | null;
}

/**
 * Уведомление мастеру: GET /notifications.json?user_id=<id>&status=pending.
 * Адресовано ПОЛЬЗОВАТЕЛЮ, а не устройству: подтверждение с любого устройства
 * снимает окно на остальных.
 */
export interface AppNotification {
  id: number;
  kind: string;
  title: string;
  body?: string | null;
  technology_id?: number | null;
  country_id?: number | null;
  payload?: Record<string, unknown>;
  acknowledged_at?: string | null;
  created_at?: string;
  country?: { id: number; name: string } | null;
  technology?: { id: number; name: string } | null;
}
