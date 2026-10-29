import ApiService from '../../../../services/api';

/**
 * Эмбарго на гильдию в разрезе стран для экрана «Рынок» (many_teams).
 *
 * В правилах «много команд» эмбарго накладывает ИНОСТРАННОЕ государство на
 * ГИЛЬДИЮ (dizdoc.md:344), поэтому страновой флаг `Country#params["embargo"]`
 * к рынку этой игры отношения не имеет. Карту «страна → есть эмбарго» считает
 * движок:
 *
 *   GET /many_teams/guild_embargoes/market?guild_id=<id>
 *   → { country, guild, countries: [{ id, name, short_name, trades_on_market, embargoed }] }
 *
 * Тем же ответом пользуется веб-админка (`era_front`: EconomicPage.vue →
 * `engineApi.getMarketEmbargoes` → пропс `embargoCountries` в Exchange.vue).
 */
export interface MarketEmbargoCountry {
  id: number;
  name: string;
  short_name?: string;
  trades_on_market?: boolean;
  embargoed: boolean;
}

export interface MarketEmbargoPayload {
  country?: { id: number; name: string } | null;
  guild?: { id: number; name: string; country_id?: number | null; country_name?: string | null } | null;
  countries?: MarketEmbargoCountry[];
}

/** Карта «id страны → эмбарго наложено» — тот же вид, что `embargoCountries` в вебе. */
export type MarketEmbargoMap = Record<number, boolean>;

export function toEmbargoMap(payload?: MarketEmbargoPayload | null): MarketEmbargoMap {
  const map: MarketEmbargoMap = {};
  (payload?.countries || []).forEach((country) => {
    if (country && typeof country.id === 'number') {
      map[country.id] = Boolean(country.embargoed);
    }
  });
  return map;
}

/** Запрос карты эмбарго ВЫБРАННОЙ гильдии (эмбарго у каждой гильдии своё). */
export const fetchMarketEmbargo = (
  guildId: number,
  signal?: AbortSignal,
): Promise<MarketEmbargoPayload> =>
  ApiService.get(`/many_teams/guild_embargoes/market?guild_id=${guildId}`, {
    signal,
  }) as Promise<MarketEmbargoPayload>;
