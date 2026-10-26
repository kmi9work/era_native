import ApiService from '../../../../services/api';

/**
 * Данные цеха гильдии для плагина many_teams:
 * `GET /many_teams/guilds/:guild_id/workshop` — где гильдии разрешены
 * строительство и работа предприятий, где запрещены, какие эмбарго наложены,
 * текст надписи для мастеров.
 */
export interface WorkshopCountry {
  country_id: number;
  country_name: string;
  short_name?: string;
  allowed: boolean;
  overridden: boolean;
  own: boolean;
}

export interface WorkshopPlant {
  plant_id: number;
  plant_name?: string;
  extractive: boolean;
  region_name?: string;
  country_id?: number;
  country_name?: string;
  work_forbidden: boolean;
}

export interface GuildWorkshopInfo {
  notice: string;
  guild: { id: number; name: string; country_id?: number; country_name?: string };
  year?: number;
  countries: WorkshopCountry[];
  plants: WorkshopPlant[];
  forbidden_plant_ids: number[];
  embargoes: Array<{ country_id: number; country_name?: string; year?: number }>;
}

export const fetchGuildWorkshop = (guildId: number, signal?: AbortSignal): Promise<GuildWorkshopInfo> =>
  ApiService.get(`/many_teams/guilds/${guildId}/workshop`, { signal }) as Promise<GuildWorkshopInfo>;
